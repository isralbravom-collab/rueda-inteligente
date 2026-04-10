import React, { useState, useEffect } from 'react'

function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d } catch { return d } }

// Estima RPE desde FC promedio y FCmax
function estimateRPE(hrAvg, fcmax = 185) {
  if (!hrAvg || hrAvg < 40) return 5
  const pct = hrAvg / fcmax * 100
  if (pct < 55) return 2
  if (pct < 62) return 3
  if (pct < 68) return 4
  if (pct < 74) return 5
  if (pct < 80) return 6
  if (pct < 86) return 7
  if (pct < 92) return 8
  if (pct < 96) return 9
  return 10
}

// Agrupa actividades del mismo día con < 2h de diferencia (pausas largas)
function mergeSegments(rides) {
  const groups = []
  const sorted = [...rides].sort((a, b) => new Date(a.iso) - new Date(b.iso))

  for (const ride of sorted) {
    const rideTime = new Date(ride.iso).getTime()
    const last = groups[groups.length - 1]

    // Mismo día y menos de 2h desde el inicio del último grupo
    if (last) {
      const lastStart = new Date(last.iso).getTime()
      const sameDay = new Date(ride.iso).toDateString() === new Date(last.iso).toDateString()
      const gap = rideTime - lastStart
      if (sameDay && gap < 2 * 3600 * 1000) {
        // Fusionar: sumar duración y distancia, promediar FC
        last.dur = Math.round((last.dur + ride.dur) * 10) / 10
        last.dist = Math.round((last.dist + ride.dist) * 100) / 100
        last.eg += ride.eg
        last.hrAvg = last.hrAvg > 0 && ride.hrAvg > 0
          ? Math.round((last.hrAvg + ride.hrAvg) / 2)
          : last.hrAvg || ride.hrAvg
        last.hrMax = Math.max(last.hrMax, ride.hrMax)
        last.name = last.name // mantiene nombre del primero
        last._merged = (last._merged || 1) + 1
        continue
      }
    }
    groups.push({ ...ride })
  }
  return groups
}

const DAYS_OLD_THRESHOLD = 30  // rodadas de más de 30 días → RPE estimado automático

export default function Strava({ rides, addRide, isDuplicate, profile }) {
  const [stravaAuth, setStravaAuth] = useState(() => load('ri3_strava', null))
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState(null)
  const [pendingRides, setPendingRides] = useState([])
  const [rpeInputs, setRpeInputs] = useState({})
  const [senInputs, setSenInputs] = useState({})
  const [savingAll, setSavingAll] = useState(false)

  const CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID || ''
  const REDIRECT = encodeURIComponent(window.location.origin + '/api/strava-auth')
  const STRAVA_URL = `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT}&response_type=code&scope=activity:read_all`

  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.split('?')[1] || '')
      if (params.get('access_token')) {
        const auth = {
          access_token: params.get('access_token'),
          refresh_token: params.get('refresh_token'),
          expires_at: parseInt(params.get('expires_at')),
          athlete_name: params.get('athlete_name'),
          athlete_id: params.get('athlete_id'),
          connected_at: Date.now()
        }
        setStravaAuth(auth)
        save('ri3_strava', auth)
        window.location.hash = '/strava'
        setResult({ type: 'success', msg: `Conectado como ${auth.athlete_name || 'atleta'}. ¡Listo para sincronizar!` })
      } else if (params.get('error')) {
        setResult({ type: 'error', msg: 'Error: ' + params.get('error') })
        window.location.hash = '/strava'
      }
    }
  }, [])

  function disconnect() {
    setStravaAuth(null)
    localStorage.removeItem('ri3_strava')
    setPendingRides([])
    setResult(null)
  }

  async function sync() {
    if (!stravaAuth) return
    setSyncing(true)
    setResult(null)
    setPendingRides([])

    const lastStrava = rides.filter(r => r.fromStrava).sort((a, b) => new Date(b.iso) - new Date(a.iso))[0]
    const after = lastStrava ? Math.floor(new Date(lastStrava.iso).getTime() / 1000) : null

    try {
      const res = await fetch('/api/strava-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: stravaAuth.access_token,
          refresh_token: stravaAuth.refresh_token,
          expires_at: stravaAuth.expires_at,
          after_timestamp: after,
          fcmax: profile.fcmax || 185,
          weight: profile.peso || 75
        })
      })
      const data = await res.json()
      if (data.error) { setResult({ type: 'error', msg: data.error }); setSyncing(false); return }

      if (data.new_token && data.new_token !== stravaAuth.access_token) {
        const updated = { ...stravaAuth, access_token: data.new_token }
        setStravaAuth(updated)
        save('ri3_strava', updated)
      }

      const existingIds = new Set(rides.filter(r => r.stravaId).map(r => r.stravaId))
      let newRides = (data.rides || []).filter(r => !existingIds.has(r.stravaId))

      // Fusionar segmentos del mismo día
      newRides = mergeSegments(newRides)

      // Pre-rellenar RPE estimado y sensación para rodadas viejas
      const now = Date.now()
      const initRpe = {}, initSen = {}
      newRides.forEach(r => {
        const daysOld = Math.round((now - new Date(r.iso).getTime()) / 86400000)
        if (daysOld >= DAYS_OLD_THRESHOLD) {
          initRpe[r.stravaId] = estimateRPE(r.hrAvg, profile.fcmax || 185)
          initSen[r.stravaId] = 'bien'  // sensación default para rodadas viejas
        }
      })
      setRpeInputs(initRpe)
      setSenInputs(initSen)

      if (newRides.length === 0) {
        setResult({ type: 'info', msg: `Sin actividades nuevas. Ya tienes todo sincronizado.` })
      } else {
        setPendingRides(newRides)
        const oldCount = newRides.filter(r => Math.round((now - new Date(r.iso).getTime()) / 86400000) >= DAYS_OLD_THRESHOLD).length
        const newCount = newRides.length - oldCount
        let msg = `${newRides.length} actividad${newRides.length > 1 ? 'es' : ''} encontrada${newRides.length > 1 ? 's' : ''}.`
        if (oldCount > 0) msg += ` ${oldCount} con más de ${DAYS_OLD_THRESHOLD} días tienen RPE estimado automáticamente por FC.`
        if (newCount > 0) msg += ` ${newCount} reciente${newCount > 1 ? 's' : ''} requiere${newCount > 1 ? 'n' : ''} tu RPE.`
        setResult({ type: 'info', msg })
      }
    } catch (e) {
      setResult({ type: 'error', msg: 'Error de conexión: ' + e.message })
    }
    setSyncing(false)
  }

  function buildRide(ride) {
    const rpe = rpeInputs[ride.stravaId]
    const sen = senInputs[ride.stravaId]
    const fcmax = profile.fcmax || 185
    const zp = [0, 0, 0, 0, 0]
    if (ride.hrAvg > 0) {
      const pct = ride.hrAvg / fcmax * 100
      if (pct < 60) zp[0] = 100
      else if (pct < 70) zp[1] = 100
      else if (pct < 80) zp[2] = 100
      else if (pct < 90) zp[3] = 100
      else zp[4] = 100
    }
    return { ...ride, rpe, sen, zp, needsRPE: false }
  }

  function saveOne(ride) {
    const rpe = rpeInputs[ride.stravaId]
    const sen = senInputs[ride.stravaId]
    if (!rpe || !sen) return alert('Agrega RPE y sensación')
    const dupe = isDuplicate(ride)
    if (dupe && !confirm(`Ya tienes una rodada similar el ${dupe.fecha}. ¿Guardar de todas formas?`)) return
    addRide(buildRide(ride))
    setPendingRides(prev => prev.filter(r => r.stravaId !== ride.stravaId))
  }

  async function saveAll() {
    const missing = pendingRides.filter(r => !rpeInputs[r.stravaId] || !senInputs[r.stravaId])
    if (missing.length > 0) return alert(`Falta RPE o sensación en ${missing.length} rodada${missing.length > 1 ? 's' : ''}. Revísalas arriba.`)
    setSavingAll(true)
    for (const r of pendingRides) {
      addRide(buildRide(r))
      await new Promise(res => setTimeout(res, 30))
    }
    setPendingRides([])
    setResult({ type: 'success', msg: `${pendingRides.length} rodadas guardadas correctamente.` })
    setSavingAll(false)
  }

  const RPE_LABELS = {1:'Muy fácil',2:'Fácil',3:'Fácil+',4:'Moderado-',5:'Moderado',6:'Moderado+',7:'Difícil',8:'Muy difícil',9:'Extremo',10:'Máximo'}
  const now = Date.now()

  // Separar en recientes (necesitan RPE manual) y antiguas (RPE estimado)
  const recentRides = pendingRides.filter(r => Math.round((now - new Date(r.iso).getTime()) / 86400000) < DAYS_OLD_THRESHOLD)
  const oldRides    = pendingRides.filter(r => Math.round((now - new Date(r.iso).getTime()) / 86400000) >= DAYS_OLD_THRESHOLD)

  return (
    <div className="page">
      <div className="ph">
        <h1>Sincronizar con <em>Strava</em></h1>
        <p>Importa tus actividades automáticamente — sin exportar archivos</p>
      </div>

      {/* STATUS */}
      <div className="card" style={{marginBottom:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
              <div style={{width:10,height:10,borderRadius:'50%',background:stravaAuth?'#6db86a':'#5c5a55'}}/>
              <span style={{fontSize:15,fontWeight:500}}>{stravaAuth?`Conectado · ${stravaAuth.athlete_name||'Atleta'}`:'No conectado'}</span>
            </div>
            <div style={{fontSize:12,color:'var(--text3)'}}>
              {stravaAuth?'Token guardado · Sincroniza cuando quieras':'Conecta una vez y sincroniza con un clic'}
            </div>
          </div>
          <div style={{display:'flex',gap:10}}>
            {stravaAuth
              ? <>
                  <button className="btn bp" onClick={sync} disabled={syncing}>
                    {syncing&&<span className="spin"/>}
                    {syncing?'Sincronizando...':'Sincronizar ahora'}
                  </button>
                  <button className="btn bs" onClick={disconnect}>Desconectar</button>
                </>
              : CLIENT_ID
                ? <a href={STRAVA_URL} className="btn bp" style={{textDecoration:'none',color:'#fff'}}>Conectar con Strava</a>
                : <button className="btn" disabled>Configura VITE_STRAVA_CLIENT_ID</button>
            }
          </div>
        </div>
        {result&&(
          <div className={`al ${result.type==='error'?'ar':result.type==='success'?'ai':'aw'}`} style={{marginTop:12}}>
            {result.msg}
          </div>
        )}
      </div>

      {/* PENDING */}
      {pendingRides.length > 0 && (
        <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <div style={{fontSize:13,color:'var(--text2)'}}>{pendingRides.length} rodada{pendingRides.length>1?'s':''} pendiente{pendingRides.length>1?'s':''} de guardar</div>
            <button className="btn bp" onClick={saveAll} disabled={savingAll}>
              {savingAll&&<span className="spin"/>}
              {savingAll?'Guardando...':'Guardar todas'}
            </button>
          </div>

          {/* RODADAS ANTIGUAS — RPE estimado automático */}
          {oldRides.length > 0 && (
            <div className="card" style={{marginBottom:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <div>
                  <div style={{fontSize:14,fontWeight:500}}>Rodadas antiguas ({oldRides.length})</div>
                  <div style={{fontSize:12,color:'var(--text2)',marginTop:2}}>Más de {DAYS_OLD_THRESHOLD} días · RPE estimado automáticamente por FC · puedes ajustarlo</div>
                </div>
              </div>
              <div style={{display:'grid',gap:8}}>
                {oldRides.map(ride => {
                  const daysOld = Math.round((now - new Date(ride.iso).getTime()) / 86400000)
                  const sp = ride.dur > 0 ? (ride.dist/(ride.dur/60)).toFixed(1) : '?'
                  return (
                    <div key={ride.stravaId} style={{background:'var(--bg3)',borderRadius:'var(--r)',padding:'12px 14px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                        <div>
                          <div style={{fontSize:13,fontWeight:500}}>{ride.name}</div>
                          <div style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--fm)'}}>{ride.fecha} · hace {daysOld}d{ride._merged?` · ${ride._merged} segmentos fusionados`:''}</div>
                        </div>
                        <button onClick={()=>saveOne(ride)} className="btn bp bs">Guardar</button>
                      </div>
                      <div style={{display:'flex',gap:12,flexWrap:'wrap',fontSize:12,color:'var(--text2)',marginBottom:10}}>
                        <span>{Math.round(ride.dur)} <strong style={{color:'var(--text)'}}>min</strong></span>
                        {ride.dist>0&&<span>{ride.dist.toFixed(1)} <strong style={{color:'var(--text)'}}>km</strong></span>}
                        {sp!=='?'&&ride.dist>0&&<span>{sp} <strong style={{color:'var(--text)'}}>km/h</strong></span>}
                        {ride.hrAvg>0&&<span>FC <strong style={{color:'var(--text)'}}>{Math.round(ride.hrAvg)} lpm</strong></span>}
                        {ride.eg>0&&<span>+{ride.eg} <strong style={{color:'var(--text)'}}>m</strong></span>}
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                        <div>
                          <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--fm)',marginBottom:5}}>RPE ESTIMADO — ajusta si recuerdas</div>
                          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:3}}>
                            {[1,2,3,4,5,6,7,8,9,10].map(n=>(
                              <button key={n} className={`rb${rpeInputs[ride.stravaId]===n?' sel':''}`}
                                style={{fontSize:12,padding:'6px 2px'}}
                                onClick={()=>setRpeInputs(p=>({...p,[ride.stravaId]:n}))}>
                                {n}
                              </button>
                            ))}
                          </div>
                          <div style={{fontSize:10,color:'var(--text3)',marginTop:3}}>
                            {rpeInputs[ride.stravaId]?RPE_LABELS[rpeInputs[ride.stravaId]]:''}
                          </div>
                        </div>
                        <div>
                          <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--fm)',marginBottom:5}}>SENSACIÓN — ajusta si recuerdas</div>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
                            {['muy bien','bien','regular','cansado','muy cansado','con molestias'].map(s=>(
                              <button key={s} className={`sb2${senInputs[ride.stravaId]===s?' sel':''}`}
                                style={{fontSize:11,padding:'5px'}}
                                onClick={()=>setSenInputs(p=>({...p,[ride.stravaId]:s}))}>
                                {s.charAt(0).toUpperCase()+s.slice(1)}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* RODADAS RECIENTES — RPE manual obligatorio */}
          {recentRides.length > 0 && (
            <>
              {recentRides.length > 0 && <div style={{fontSize:12,color:'var(--text2)',marginBottom:10,fontWeight:500}}>Rodadas recientes — agrega RPE y sensación</div>}
              {recentRides.map(ride => {
                const daysOld = Math.round((now - new Date(ride.iso).getTime()) / 86400000)
                const sp = ride.dur > 0 ? (ride.dist/(ride.dur/60)).toFixed(1) : '?'
                return (
                  <div key={ride.stravaId} className="hc" style={{marginBottom:12}}>
                    <div className="hct" style={{marginBottom:10}}>
                      <div>
                        <div className="hcn">{ride.name}{ride._merged?<span style={{fontSize:11,color:'var(--text3)',marginLeft:8}}>({ride._merged} segmentos fusionados)</span>:''}</div>
                        <div className="hcd">{ride.fecha} · hace {daysOld}d</div>
                      </div>
                      <span style={{fontSize:11,color:'var(--amber)',fontFamily:'var(--fm)',border:'1px solid rgba(232,201,122,0.3)',padding:'2px 9px',borderRadius:20}}>Pendiente RPE</span>
                    </div>
                    <div className="hcst" style={{marginBottom:14}}>
                      <span className="hcsi">{Math.round(ride.dur)} <strong>min</strong></span>
                      {ride.dist>0&&<span className="hcsi">{ride.dist.toFixed(1)} <strong>km</strong></span>}
                      {sp!=='?'&&ride.dist>0&&<span className="hcsi">{sp} <strong>km/h</strong></span>}
                      {ride.hrAvg>0&&<span className="hcsi">FC <strong>{Math.round(ride.hrAvg)} lpm</strong></span>}
                      {ride.eg>0&&<span className="hcsi">+{ride.eg} <strong>m</strong></span>}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:10}}>
                      <div>
                        <label className="fl">RPE (esfuerzo percibido)</label>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:4,marginBottom:4}}>
                          {[1,2,3,4,5,6,7,8,9,10].map(n=>(
                            <button key={n} className={`rb${rpeInputs[ride.stravaId]===n?' sel':''}`}
                              onClick={()=>setRpeInputs(p=>({...p,[ride.stravaId]:n}))}>
                              {n}
                            </button>
                          ))}
                        </div>
                        <div className="rh">{rpeInputs[ride.stravaId]?RPE_LABELS[rpeInputs[ride.stravaId]]:''}</div>
                      </div>
                      <div>
                        <label className="fl">Sensación posterior</label>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                          {['muy bien','bien','regular','cansado','muy cansado','con molestias'].map(s=>(
                            <button key={s} className={`sb2${senInputs[ride.stravaId]===s?' sel':''}`}
                              onClick={()=>setSenInputs(p=>({...p,[ride.stravaId]:s}))}>
                              {s.charAt(0).toUpperCase()+s.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button className="btn bp" style={{width:'100%',justifyContent:'center'}} onClick={()=>saveOne(ride)}>
                      Guardar esta rodada
                    </button>
                  </div>
                )
              })}
            </>
          )}
        </>
      )}

      {/* INFO */}
      <div className="card" style={{marginTop:pendingRides.length>0?20:0}}>
        <div className="stit" style={{marginBottom:10}}>Cómo funciona</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
          {[
            {t:'Autorización única',d:'Solo la primera vez. Tu contraseña nunca llega a la app.'},
            {t:'RPE inteligente',d:`Rodadas de más de ${DAYS_OLD_THRESHOLD} días reciben RPE estimado automáticamente por FC. Las recientes requieren tu input.`},
            {t:'Sin duplicados',d:'Actividades del mismo día con pausa corta se fusionan automáticamente en una sola rodada.'},
          ].map(item=>(
            <div key={item.t} style={{background:'var(--bg3)',borderRadius:'var(--r)',padding:'12px 14px'}}>
              <div style={{fontSize:13,fontWeight:500,marginBottom:4}}>{item.t}</div>
              <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.6}}>{item.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
