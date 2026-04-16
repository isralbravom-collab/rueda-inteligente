import { useState, useEffect } from 'react'

const KEYS = { rides:'ri3_rides', supps:'ri3_supps', profile:'ri3_profile', plan:'ri3_plan' }

const DEFAULT_PROFILE = {
  nombre:'', edad:0, peso:70, fcmax:185, fcrest:55,
  nivel:'recreativo', objetivo:'salud y adherencia', dias:3,
  ciudad:'', altitud:0, clima:'templado',
  tienePotenciometro: false, ftp:0,
  ruta:'', horariosDisponibles:'mañana',
  suplementosBase:''
}

function load(key, def) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key))
    if (parsed === null || parsed === undefined) return def
    if (Array.isArray(def)) return Array.isArray(parsed) ? parsed : def
    return { ...def, ...parsed }
  } catch { return def }
}

function sortByDate(rides) {
  return [...rides].sort((a,b) => new Date(b.iso).getTime() - new Date(a.iso).getTime())
}

export function useStore() {
  const [rides,   setRides]   = useState(() => sortByDate(load(KEYS.rides, [])))
  const [supps,   setSupps]   = useState(() => load(KEYS.supps, []))
  const [profile, setProfile] = useState(() => load(KEYS.profile, DEFAULT_PROFILE))
  const [activePlan, setActivePlan] = useState(() => load(KEYS.plan, null))

  useEffect(() => { localStorage.setItem(KEYS.rides,   JSON.stringify(rides))   }, [rides])
  useEffect(() => { localStorage.setItem(KEYS.supps,   JSON.stringify(supps))   }, [supps])
  useEffect(() => { localStorage.setItem(KEYS.profile, JSON.stringify(profile)) }, [profile])
  useEffect(() => { localStorage.setItem(KEYS.plan,    JSON.stringify(activePlan)) }, [activePlan])

  function addRide(ride)       { setRides(prev => sortByDate([ride, ...prev])) }
  function deleteRide(id)      { setRides(prev => prev.filter(r => r.id !== id)) }
  function clearAllRides()     { setRides([]); localStorage.removeItem(KEYS.rides) }
  function addSupp(supp)       { setSupps(prev => [...prev, { ...supp, id:Date.now() }]) }
  function deleteSupp(id)      { setSupps(prev => prev.filter(s => s.id !== id)) }
  function saveProfile(data)   { setProfile(data) }
  function savePlan(plan)      { setActivePlan(plan) }
  function clearPlan()         { setActivePlan(null); localStorage.removeItem(KEYS.plan) }

  function completeSesion(planType, weekIdx, sesionIdx) {
    setActivePlan(prev => {
      if (!prev) return prev
      const updated = { ...prev }
      if (planType === 'weekly') {
        const sesiones = [...(updated.sesiones || [])]
        if (sesiones[sesionIdx]) sesiones[sesionIdx] = { ...sesiones[sesionIdx], completada: true, fechaCompletada: new Date().toISOString() }
        updated.sesiones = sesiones
      } else {
        const semanas = [...(updated.semanas || [])]
        if (semanas[weekIdx]) {
          const sems = { ...semanas[weekIdx] }
          const sess = [...(sems.sesiones || [])]
          if (sess[sesionIdx]) sess[sesionIdx] = { ...sess[sesionIdx], completada: true, fechaCompletada: new Date().toISOString() }
          sems.sesiones = sess
          semanas[weekIdx] = sems
          updated.semanas = semanas
        }
      }
      return updated
    })
  }

  function isDuplicate(newRide) {
    const t = new Date(newRide.iso).getTime()
    return rides.find(r => {
      const diff    = Math.abs(new Date(r.iso).getTime() - t)
      const durDiff = Math.abs((r.dur||0) - (newRide.dur||0))
      return diff < 30*60*1000 && durDiff < 10
    })
  }

  return { rides, supps, profile, activePlan, addRide, deleteRide, clearAllRides, addSupp, deleteSupp, saveProfile, savePlan, clearPlan, completeSesion, isDuplicate }
}
