import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d } catch { return d } }

export default function Strava({ rides, addRide, isDuplicate, profile }) {
  const nav = useNavigate()
  const [stravaAuth, setStravaAuth] = useState(() => load('ri3_strava', null))
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState(null)
  const [pendingRides, setPendingRides] = useState([])
  const [rpeInputs, setRpeInputs] = useState({})
  const [senInputs, setSenInputs] = useState({})

  const CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID || ''
  const REDIRECT = encodeURIComponent(window.location.origin + '/api/strava-auth')
  const STRAVA_URL = `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT}&response_type=code&scope=activity:read_all`

  // Parse tokens from URL hash after OAuth redirect
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
        setResult({ type: 'error', msg: 'Error al conectar con Strava: ' + params.get('error') })
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

    // Find most recent Strava ride to avoid re-fetching everything
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
          after_timestamp: after
        })
      })
      const data = await res.json()

      if (data.error) {
        setResult({ type: 'error', msg: data.error })
        setSyncing(false)
        return
      }

      // Update token if refreshed
      if (data.new_token && data.new_token !== stravaAuth.access_token) {
        const updated = { ...stravaAuth, access_token: data.new_token }
        setStravaAuth(updated)
        save('ri3_strava', updated)
      }

      // Filter out already-saved rides (by stravaId)
      const existingIds = new Set(rides.filter(r => r.stravaId).map(r => r.stravaId))
      const newRides = (data.rides || []).filter(r => !existingIds.has(r.stravaId))

      if (newRides.length === 0) {
        setResult({ type: 'info', msg: `Sin actividades nuevas. Ya tienes todo sincronizado (${data.count} actividades revisadas).` })
      } else {
        setPendingRides(newRides)
        setResult({ type: 'info', msg: `${newRides.length} actividad${newRides.length > 1 ? 'es' : ''} nueva${newRides.length > 1 ? 's' : ''} encontrada${newRides.length > 1 ? 's' : ''}. Agrega RPE y sensación antes de guardar.` })
      }
    } catch (e) {
      setResult({ type: 'error', msg: 'Error de conexión: ' + e.message })
    }
    setSyncing(false)
  }

  function saveRide(ride) {
    const rpe = rpeInputs[ride.stravaId]
    const sen = senInputs[ride.stravaId]
    if (!rpe || !sen) return alert('Agrega RPE y sensación para esta rodada')

    // Recalculate zones with user's fcmax
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

    const dupe = isDuplicate({ ...ride, iso: ride.iso })
    if (dupe && !confirm(`Parece que ya tienes esta rodada (${dupe.fecha}). ¿Guardar de todas formas?`)) return

    addRide({ ...ride, rpe, sen, zp, needsRPE: false })
    setPendingRides(prev => prev.filter(r => r.stravaId !== ride.stravaId))
  }

  function saveAll() {
    const missing = pendingRides.filter(r => !rpeInputs[r.stravaId] || !senInputs[r.stravaId])
    if (missing.length > 0) return alert(`Falta RPE o sensación en ${missing.length} rodada${missing.length > 1 ? 's' : ''}`)
    pendingRides.forEach(r => saveRide(r))
  }

  const RPE_LABELS = {1:'Muy fácil',2:'Fácil',3:'Fácil+',4:'Moderado-',5:'Moderado',6:'Moderado+',7:'Difícil',8:'Muy difícil',9:'Extremo',10:'Máximo'}

  return (
    <div className="page">
      <div className="ph">
        <h1>Sincronizar con <em>Strava</em></h1>
        <p>Importa tus actividades automáticamente — sin exportar archivos</p>
      </div>

      {/* CONNECTION STATUS */}
      <div className="card" style={{marginBottom:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
              <div style={{width:10,height:10,borderRadius:'50%',background: stravaAuth ? '#6db86a' : '#5c5a55'}}/>
              <span style={{fontSize:15,fontWeight:500}}>{stravaAuth ? `Conectado · ${stravaAuth.athlete_name || 'Atleta'}` : 'No conectado'}</span>
            </div>
            <div style={{fontSize:12,color:'var(--text3)'}}>
              {stravaAuth
                ? `Token guardado · Sincroniza cuando quieras`
                : 'Conecta una vez y sincroniza con un clic'}
            </div>
          </div>
          <div style={{display:'flex',gap:10}}>
            {stravaAuth
              ? <>
                  <button className="btn bp" onClick={sync} disabled={syncing}>
                    {syncing && <span className="spin"/>}
                    {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
                  </button>
                  <button className="btn bs" onClick={disconnect}>Desconectar</button>
                </>
              : CLIENT_ID
                ? <a href={STRAVA_URL} className="btn bp" style={{textDecoration:'none',color:'#fff'}}>
                    Conectar con Strava
                  </a>
                : <button className="btn" disabled>Configura VITE_STRAVA_CLIENT_ID</button>
            }
          </div>
        </div>

        {result && (
          <div className={`al ${result.type === 'error' ? 'ar' : result.type === 'success' ? 'ai' : 'aw'}`} style={{marginTop:12}}>
            {result.msg}
          </div>
        )}
      </div>

      {/* SETUP INSTRUCTIONS */}
      {!CLIENT_ID && (
        <div className="card" style={{marginBottom:20}}>
          <div className="stit" style={{marginBottom:14}}>Configuración inicial (5 minutos, gratis)</div>
          {[
            { n:1, title:'Crea una aplicación en Strava', desc:'Ve a strava.com/settings/api → "Create & Manage Your App". Nombre: Rueda Inteligente. Website: tu URL de Vercel. Authorization Callback Domain: tu dominio de Vercel (ej: rueda-inteligente.vercel.app).' },
            { n:2, title:'Copia tu Client ID y Client Secret', desc:'Strava te muestra el Client ID (número) y Client Secret (texto largo) al crear la app.' },
            { n:3, title:'Agrega las variables en Vercel', desc:'En vercel.com → tu proyecto → Settings → Environment Variables, agrega: STRAVA_CLIENT_ID (el número), STRAVA_CLIENT_SECRET (el texto), APP_URL (tu URL completa, ej: https://rueda-inteligente.vercel.app).' },
            { n:4, title:'Agrega VITE_STRAVA_CLIENT_ID en Vercel', desc:'También agrega VITE_STRAVA_CLIENT_ID con el mismo número. Esta variable la usa el frontend para construir el botón de login.' },
            { n:5, title:'Redespliega', desc:'En Vercel → tu proyecto → Deployments → clic en los tres puntos del último deploy → Redeploy. Listo.' },
          ].map(step => (
            <div key={step.n} style={{display:'flex',gap:14,marginBottom:14,paddingBottom:14,borderBottom:'1px solid var(--border)'}}>
              <div style={{width:28,height:28,borderRadius:'50%',background:'var(--green3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:500,color:'#fff',flexShrink:0}}>{step.n}</div>
              <div>
                <div style={{fontSize:14,fontWeight:500,marginBottom:3}}>{step.title}</div>
                <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.6}}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PENDING RIDES */}
      {pendingRides.length > 0 && (
        <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div style={{fontSize:13,color:'var(--text2)'}}>Agrega RPE y sensación a cada rodada antes de guardar</div>
            <button className="btn bp bs" onClick={saveAll}>Guardar todas</button>
          </div>

          {pendingRides.map(ride => {
            const sp = ride.dur > 0 ? (ride.dist / (ride.dur / 60)).toFixed(1) : '?'
            return (
              <div key={ride.stravaId} className="hc" style={{marginBottom:12}}>
                <div className="hct" style={{marginBottom:10}}>
                  <div>
                    <div className="hcn">{ride.name}</div>
                    <div className="hcd">{ride.fecha}</div>
                  </div>
                  <div style={{display:'flex',gap:8'}}>
                    <span style={{fontSize:12,color:'var(--amber)',fontFamily:'var(--fm)',border:'1px solid rgba(232,201,122,0.3)',padding:'2px 9px',borderRadius:20}}>Pendiente RPE</span>
                  </div>
                </div>

                <div className="hcst" style={{marginBottom:14}}>
                  <span className="hcsi">{Math.round(ride.dur)} <strong>min</strong></span>
                  <span className="hcsi">{ride.dist.toFixed(1)} <strong>km</strong></span>
                  <span className="hcsi">{sp} <strong>km/h</strong></span>
                  {ride.hrAvg > 0 && <span className="hcsi">FC <strong>{Math.round(ride.hrAvg)} lpm</strong></span>}
                  {ride.eg > 0 && <span className="hcsi">+{ride.eg} <strong>m</strong></span>}
                </div>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:10}}>
                  <div>
                    <label className="fl">RPE (esfuerzo percibido)</label>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:4,marginBottom:4}}>
                      {[1,2,3,4,5,6,7,8,9,10].map(n => (
                        <button key={n}
                          className={`rb${rpeInputs[ride.stravaId]===n?' sel':''}`}
                          onClick={() => setRpeInputs(prev=>({...prev,[ride.stravaId]:n}))}>
                          {n}
                        </button>
                      ))}
                    </div>
                    <div className="rh">{rpeInputs[ride.stravaId] ? RPE_LABELS[rpeInputs[ride.stravaId]] : ''}</div>
                  </div>
                  <div>
                    <label className="fl">Sensación posterior</label>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                      {['muy bien','bien','regular','cansado','muy cansado','con molestias'].map(s => (
                        <button key={s}
                          className={`sb2${senInputs[ride.stravaId]===s?' sel':''}`}
                          onClick={() => setSenInputs(prev=>({...prev,[ride.stravaId]:s}))}>
                          {s.charAt(0).toUpperCase()+s.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button className="btn bp" style={{width:'100%',justifyContent:'center'}} onClick={() => saveRide(ride)}>
                  Guardar esta rodada
                </button>
              </div>
            )
          })}
        </>
      )}

      {/* INFO */}
      <div className="card" style={{marginTop:pendingRides.length > 0 ? 20 : 0}}>
        <div className="stit" style={{marginBottom:10}}>Cómo funciona</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
          {[
            {t:'Autorización única',d:'Solo la primera vez. Strava te pide permiso para leer tus actividades. Tu contraseña nunca llega a la app.'},
            {t:'Sincronización selectiva',d:'Jala solo actividades de ciclismo nuevas desde tu última sincronización. No re-importa lo que ya tienes.'},
            {t:'RPE obligatorio',d:'Strava no tiene RPE ni sensación. Los agregas tú antes de guardar. Esto es lo que hace el análisis IA útil.'},
          ].map(item => (
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
