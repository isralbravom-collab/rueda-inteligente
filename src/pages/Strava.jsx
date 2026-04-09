import React, { useState, useEffect } from 'react'

function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d } catch { return d } }

function estimateRPE(hrAvg, cadence = 0, fcmax = 185) {
  if (!hrAvg || hrAvg < 40) return 5
  const pct = hrAvg / fcmax * 100
  let rpe = 5
  if (pct < 55) rpe = 2
  else if (pct < 62) rpe = 3
  else if (pct < 68) rpe = 4
  else if (pct < 74) rpe = 5
  else if (pct < 80) rpe = 6
  else if (pct < 86) rpe = 7
  else if (pct < 92) rpe = 8
  else if (pct < 96) rpe = 9
  else rpe = 10
  if (cadence > 85) rpe = Math.min(10, rpe + 1)
  if (cadence > 95) rpe = Math.min(10, rpe + 1)
  return rpe
}

function mergeSegments(rides) {
  const groups = []
  const sorted = [...rides].sort((a, b) => new Date(a.iso) - new Date(b.iso))
  for (const ride of sorted) {
    const rideTime = new Date(ride.iso).getTime()
    const last = groups[groups.length - 1]
    if (last) {
      const lastStart = new Date(last.iso).getTime()
      const sameDay = new Date(ride.iso).toDateString() === new Date(last.iso).toDateString()
      const gap = rideTime - lastStart
      if (sameDay && gap < 2 * 3600 * 1000) {
        last.dur = Math.round((last.dur + ride.dur) * 10) / 10
        last.dist = Math.round((last.dist + ride.dist) * 100) / 100
        last.eg += ride.eg
        last.hrAvg = last.hrAvg > 0 && ride.hrAvg > 0 ? Math.round((last.hrAvg + ride.hrAvg) / 2) : last.hrAvg || ride.hrAvg
        last.hrMax = Math.max(last.hrMax, ride.hrMax)
        last.cadence = Math.round((last.cadence + (ride.cadence || 0)) / 2)
        last._merged = (last._merged || 1) + 1
        continue
      }
    }
    groups.push({ ...ride })
  }
  return groups
}

const DAYS_OLD_THRESHOLD = 14

export default function Strava({ rides, addRide, isDuplicate, profile, clearAllRides }) {
  const [stravaAuth, setStravaAuth] = useState(() => load('ri3_strava', null))
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState(null)
  const [pendingRides, setPendingRides] = useState([])
  const [rpeInputs, setRpeInputs] = useState({})
  const [senInputs, setSenInputs] = useState({})

  const CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID || ''
  const REDIRECT = encodeURIComponent(window.location.origin + '/api/strava-auth')
  const STRAVA_URL = `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT}&response_type=code&scope=activity:read_all&approval_prompt=force`

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
        setResult({ type: 'success', msg: `Conectado como ${auth.athlete_name || 'atleta'}.` })
      }
    }
  }, [])

  function disconnect() {
    setStravaAuth(null)
    localStorage.removeItem('ri3_strava')
    setPendingRides([])
    setResult(null)
  }

  function clearPending() {
    setPendingRides([])
    setRpeInputs({})
    setSenInputs({})
    setResult({ type: 'info', msg: 'Pendientes limpiados.' })
  }

  // Nuevo: Limpiar TODO el historial
  function clearAllHistory() {
    if (!confirm('¿Estás seguro? Esto borrará TODAS tus rodadas guardadas.')) return
    clearAllRides()
    setResult({ type: 'success', msg: 'Historial completo borrado. Ahora puedes sincronizar desde cero.' })
  }

  async function sync() {
    if (!stravaAuth) return
    setSyncing(true)
    setResult(null)
    setPendingRides([])

    try {
      const res = await fetch('/api/strava-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: stravaAuth.access_token })
      })
      const data = await res.json()

      if (!data.success) {
        setResult({ type: 'error', msg: data.error })
        setSyncing(false)
        return
      }

      const existingIds = new Set(rides.filter(r => r.stravaId).map(r => r.stravaId))
      let newRides = (data.rides || []).filter(r => !existingIds.has(r.stravaId))
      newRides = mergeSegments(newRides)

      const now = Date.now()
      const initRpe = {}, initSen = {}

      newRides.forEach(r => {
        const daysOld = Math.round((now - new Date(r.iso).getTime()) / 86400000)
        const hasFC = r.hrAvg > 40

        if (hasFC) {
          initRpe[r.stravaId] = estimateRPE(r.hrAvg, r.cadence || 0, profile.fcmax || 185)
          initSen[r.stravaId] = 'bien'
        } else if (daysOld >= DAYS_OLD_THRESHOLD) {
          initRpe[r.stravaId] = 5
          initSen[r.stravaId] = 'bien'
        }
      })

      setRpeInputs(initRpe)
      setSenInputs(initSen)
      setPendingRides(newRides)

      setResult({ 
        type: 'success', 
        msg: `${newRides.length} rodadas nuevas. La mayoría con RPE automático.` 
      })
    } catch (e) {
      setResult({ type: 'error', msg: 'Error: ' + e.message })
    }
    setSyncing(false)
  }

  function buildRide(ride) {
    return { ...ride, rpe: rpeInputs[ride.stravaId], sen: senInputs[ride.stravaId] }
  }

  function saveOne(ride) {
    if (!rpeInputs[ride.stravaId] || !senInputs[ride.stravaId]) return alert('Falta RPE o sensación')
    const dupe = isDuplicate(ride)
    if (dupe && !confirm(`Ya tienes una rodada similar el ${dupe.fecha}. ¿Guardar?`)) return
    addRide(buildRide(ride))
    setPendingRides(prev => prev.filter(r => r.stravaId !== ride.stravaId))
  }

  async function saveAll() {
    const missing = pendingRides.filter(r => !rpeInputs[r.stravaId] || !senInputs[r.stravaId])
    if (missing.length > 0) return alert(`Falta RPE o sensación en ${missing.length} rodadas.`)
    
    for (const r of pendingRides) {
      addRide(buildRide(r))
      await new Promise(res => setTimeout(res, 30))
    }
    setPendingRides([])
    setResult({ type: 'success', msg: 'Todas las rodadas guardadas correctamente.' })
  }

  const RPE_LABELS = {1:'Muy fácil',2:'Fácil',3:'Fácil+',4:'Moderado-',5:'Moderado',6:'Moderado+',7:'Difícil',8:'Muy difícil',9:'Extremo',10:'Máximo'}
  const now = Date.now()
  const recentRides = pendingRides.filter(r => Math.round((now - new Date(r.iso).getTime()) / 86400000) < DAYS_OLD_THRESHOLD)

  return (
    <div className="page">
      <div className="ph">
        <h1>Sincronizar con <em>Strava</em></h1>
        <p>Importa solo tus rodadas de bicicleta • RPE automático con FC + cadencia</p>
      </div>

      <div className="card" style={{marginBottom:24}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:12,height:12,borderRadius:'50%',background:stravaAuth?'#4ade80':'#78716c'}} />
              <span style={{fontWeight:600}}>{stravaAuth ? `Conectado · ${stravaAuth.athlete_name}` : 'No conectado'}</span>
            </div>
          </div>
          <div style={{display:'flex',gap:10}}>
            {stravaAuth ? (
              <>
                <button className="btn bp" onClick={sync} disabled={syncing}>
                  {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
                </button>
                <button className="btn bs" onClick={disconnect}>Desconectar</button>
              </>
            ) : CLIENT_ID ? (
              <a href={STRAVA_URL} className="btn bp">Conectar con Strava</a>
            ) : null}
          </div>
        </div>

        {result && <div className={`al ${result.type}`} style={{marginTop:16}}>{result.msg}</div>}
      </div>

      {/* Botón peligroso: Limpiar todo el historial */}
      {rides.length > 0 && (
        <button 
          className="btn bs" 
          style={{marginBottom:24, width:'100%', background:'#ef4444', color:'white'}}
          onClick={clearAllHistory}
        >
          🗑️ Limpiar TODO el historial y sincronizar desde cero
        </button>
      )}

      {pendingRides.length > 0 && (
        <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <div><strong>{pendingRides.length}</strong> rodadas pendientes</div>
            <div>
              <button className="btn bs" onClick={clearPending} style={{marginRight:8}}>Limpiar pendientes</button>
              <button className="btn bp" onClick={saveAll}>Guardar todas</button>
            </div>
          </div>

          {recentRides.map(ride => {
            const speed = ride.dur > 0 ? (ride.dist / (ride.dur / 60)).toFixed(1) : '?'
            return (
              <div key={ride.stravaId} className="hc" style={{marginBottom:20}}>
                <div className="hct">
                  <div>
                    <div className="hcn">{ride.name}</div>
                    <div className="hcd">{ride.fecha} · hace {Math.round((now - new Date(ride.iso).getTime())/86400000)}d</div>
                  </div>
                </div>

                <div className="hcst" style={{marginBottom:16}}>
                  <span>{ride.dur} min</span>
                  <span>{ride.dist} km</span>
                  <span>{speed} km/h</span>
                  {ride.hrAvg > 0 && <span>FC {ride.hrAvg}</span>}
                  {ride.cadence > 0 && <span>Cad {ride.cadence}</span>}
                  {ride.eg > 0 && <span>+{ride.eg} m</span>}
                </div>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                  <div>
                    <label>RPE (Esfuerzo percibido)</label>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6}}>
                      {[1,2,3,4,5,6,7,8,9,10].map(n => (
                        <button 
                          key={n} 
                          className={`rb ${rpeInputs[ride.stravaId] === n ? 'sel' : ''}`}
                          onClick={() => setRpeInputs(p => ({...p, [ride.stravaId]: n}))}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label>Sensación posterior</label>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                      {['muy bien','bien','regular','cansado','muy cansado','con molestias'].map(s => (
                        <button 
                          key={s} 
                          className={`sb2 ${senInputs[ride.stravaId] === s ? 'sel' : ''}`}
                          onClick={() => setSenInputs(p => ({...p, [ride.stravaId]: s}))}
                        >
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button className="btn bp" style={{width:'100%', marginTop:16}} onClick={() => saveOne(ride)}>
                  Guardar esta rodada
                </button>
              </div>
            )
          })}
        </>
      )}

      <div className="card" style={{marginTop:30}}>
        <strong>Resumen actual:</strong><br/>
        • Solo rodadas de bicicleta<br/>
        • RPE + zonas automáticas cuando hay FC<br/>
        • Botón para limpiar todo el historial
      </div>
    </div>
  )
}
