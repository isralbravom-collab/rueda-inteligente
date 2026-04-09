import React, { useState, useEffect } from 'react'

function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d } catch { return d } }

// RPE automático con FC + Cadencia
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

function calculateZones(hrAvg, fcmax = 185) {
  if (!hrAvg || hrAvg < 50) return [0, 0, 0, 0, 0]
  const zones = [0, 0, 0, 0, 0]
  const pct = (hrAvg / fcmax) * 100
  if (pct < 60) zones[0] = 100
  else if (pct < 70) zones[1] = 100
  else if (pct < 80) zones[2] = 100
  else if (pct < 90) zones[3] = 100
  else zones[4] = 100
  return zones
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

  function clearAllHistory() {
    if (!confirm('¿Estás seguro? Esto borrará TODAS tus rodadas guardadas.')) return
    clearAllRides()
    setResult({ type: 'success', msg: 'Historial completo borrado.' })
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

      setResult({ type: 'success', msg: `${newRides.length} rodadas nuevas.` })
    } catch (e) {
      setResult({ type: 'error', msg: 'Error: ' + e.message })
    }
    setSyncing(false)
  }

  function saveOne(ride) {
    if (!rpeInputs[ride.stravaId] || !senInputs[ride.stravaId]) {
      return alert('Falta RPE o sensación')
    }
    const dupe = isDuplicate(ride)
    if (dupe && !confirm(`Ya tienes una rodada similar el ${dupe.fecha}. ¿Guardar?`)) return

    const zp = calculateZones(ride.hrAvg, profile.fcmax || 185)

    addRide({
      ...ride,
      id: ride.stravaId || Date.now().toString(),
      rpe: rpeInputs[ride.stravaId],
      sen: senInputs[ride.stravaId],
      zp: zp
    })

    setPendingRides(prev => prev.filter(r => r.stravaId !== ride.stravaId))
  }

  async function saveAll() {
    const missing = pendingRides.filter(r => !rpeInputs[r.stravaId] || !senInputs[r.stravaId])
    if (missing.length > 0) return alert(`Falta RPE o sensación en ${missing.length} rodadas.`)

    for (const r of pendingRides) {
      const zp = calculateZones(r.hrAvg, profile.fcmax || 185)
      addRide({
        ...r,
        id: r.stravaId || Date.now().toString(),
        rpe: rpeInputs[r.stravaId],
        sen: senInputs[r.stravaId],
        zp: zp
      })
      await new Promise(res => setTimeout(res, 30))
    }
    setPendingRides([])
    setResult({ type: 'success', msg: 'Todas las rodadas guardadas correctamente.' })
  }

  const now = Date.now()
  const recentRides = pendingRides.filter(r => Math.round((now - new Date(r.iso).getTime()) / 86400000) < DAYS_OLD_THRESHOLD)

  return (
    <div className="page">
      <div className="ph">
        <h1>Sincronizar con <em>Strava</em></h1>
        <p>Importa solo rodadas de bicicleta • RPE automático</p>
      </div>

      <div className="card" style={{marginBottom:24}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:12,height:12,borderRadius:'50%',background:stravaAuth?'#4ade80':'#78716c'}} />
              <span style={{fontWeight:600}}>{stravaAuth ? `Conectado · ${stravaAuth.athlete_name}` : 'No conectado'}</span>
            </div>
          </div>
          <div>
            {stravaAuth ? (
              <>
                <button className="btn bp" onClick={sync} disabled={syncing} style={{marginRight:8}}>
                  {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
                </button>
                <button className="btn bs" onClick={disconnect}>Desconectar</button>
              </>
            ) : CLIENT_ID && <a href={STRAVA_URL} className="btn bp">Conectar con Strava</a>}
          </div>
        </div>
        {result && <div className={`al ${result.type}`} style={{marginTop:16}}>{result.msg}</div>}
      </div>

      {rides.length > 0 && (
        <button 
          onClick={clearAllHistory}
          className="btn bs"
          style={{width:'100%', marginBottom:24, background:'#ef4444', color:'white'}}
        >
          🗑️ Limpiar TODO el historial
        </button>
      )}

      {pendingRides.length > 0 && (
        <>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
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
                    <div className="hcd">{ride.fecha}</div>
                  </div>
                </div>

                <div className="hcst" style={{marginBottom:16}}>
                  <span>{ride.dur} min</span>
                  <span>{ride.dist} km</span>
                  <span>{speed} km/h</span>
                  {ride.hrAvg > 0 && <span>FC <strong>{ride.hrAvg}</strong> lpm</span>}
                  {ride.cadence > 0 && <span>Cad <strong>{ride.cadence}</strong></span>}
                  {ride.eg > 0 && <span>+{ride.eg} m</span>}
                </div>

                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
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

                <button className="btn bp" style={{width:'100%',marginTop:16}} onClick={() => saveOne(ride)}>
                  Guardar esta rodada
                </button>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
