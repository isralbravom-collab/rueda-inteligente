import { useState, useEffect } from 'react'

const KEYS = { rides:'ri3_rides', supps:'ri3_supps', profile:'ri3_profile' }

const DEFAULT_PROFILE = {
  nombre:'', edad:0, peso:70, fcmax:185, fcrest:55,
  nivel:'recreativo', objetivo:'salud y adherencia', dias:3,
  // Localización
  ciudad:'', altitud:0, clima:'templado',
  // Equipamiento
  tienePotenciometro: false, ftp:0,
  // Entrenamiento
  ruta:'', horariosDisponibles:'mañana',
  // Suplementación base
  suplementosBase:''
}

function load(key, def) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key))
    if (parsed === null || parsed === undefined) return def
    // Arrays (rides, supps) returned as-is; objects merged with defaults
    if (Array.isArray(def)) return Array.isArray(parsed) ? parsed : def
    return { ...def, ...parsed }
  } catch { return def }
}

function sortByDate(rides) {
  return [...rides].sort((a,b) => new Date(b.iso).getTime() - new Date(a.iso).getTime())
}

export function useStore() {
  const [rides,   setRides]   = useState(() => sortByDate(load(KEYS.rides,   [])))
  const [supps,   setSupps]   = useState(() => load(KEYS.supps,   []))
  const [profile, setProfile] = useState(() => load(KEYS.profile, DEFAULT_PROFILE))

  useEffect(() => { localStorage.setItem(KEYS.rides,   JSON.stringify(rides))   }, [rides])
  useEffect(() => { localStorage.setItem(KEYS.supps,   JSON.stringify(supps))   }, [supps])
  useEffect(() => { localStorage.setItem(KEYS.profile, JSON.stringify(profile)) }, [profile])

  function addRide(ride)     { setRides(prev => sortByDate([ride, ...prev])) }
  function deleteRide(id)    { setRides(prev => prev.filter(r => r.id !== id)) }
  function clearAllRides()   { setRides([]); localStorage.removeItem(KEYS.rides) }
  function addSupp(supp)     { setSupps(prev => [...prev, { ...supp, id:Date.now() }]) }
  function deleteSupp(id)    { setSupps(prev => prev.filter(s => s.id !== id)) }
  function saveProfile(data) { setProfile(data) }

  function isDuplicate(newRide) {
    const t = new Date(newRide.iso).getTime()
    return rides.find(r => {
      const diff    = Math.abs(new Date(r.iso).getTime() - t)
      const durDiff = Math.abs((r.dur||0) - (newRide.dur||0))
      return diff < 30*60*1000 && durDiff < 10
    })
  }

  return { rides, supps, profile, addRide, deleteRide, clearAllRides, addSupp, deleteSupp, saveProfile, isDuplicate }
}
