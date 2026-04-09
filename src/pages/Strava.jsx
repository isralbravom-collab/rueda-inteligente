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

    addRide({
      ...ride,
      id: ride.stravaId || Date.now().toString(),
      rpe: rpeInputs[ride.stravaId],
      sen: senInputs[ride.stravaId],
      zp: calculateZones(ride.hrAvg, profile.fcmax || 185)
    })

    setPendingRides(prev => prev.filter(r => r.stravaId !== ride.stravaId))
  }

  async function saveAll() {
    const missing = pendingRides.filter(r => !rpeInputs[r.stravaId] || !senInputs[r.stravaId])
    if (missing.length > 0) return alert(`Falta RPE o sensación en ${missing.length} rodadas.`)

    for (const r of pendingRides) {
      addRide({
        ...r,
        id: r.stravaId || Date.now().toString(),
        rpe: rpeInputs[r.stravaId],
        sen: senInputs[r.stravaId],
        zp: calculateZones(r.hrAvg, profile.fcmax || 185)
      })
      await new Promise(res => setTimeout(res, 30))
    }
    setPendingRides([])
    setResult({ type: 'success', msg: 'Todas las rodadas guardadas.' })
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

  const now = Date.now()
  const recentRides = pendingRides.filter(r => Math.round((now - new Date(r.iso).getTime()) / 86400000) < DAYS_OLD_THRESHOLD)

  return (
    <div className="page">
      {/* ... tu JSX actual ... */}
      {/* (mantén el mismo return que tenías antes) */}
    </div>
  )
}

// ←←← ESTA LÍNEA ES LA QUE FALTABA
export default Strava
