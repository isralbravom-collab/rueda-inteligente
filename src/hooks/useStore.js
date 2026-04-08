import { useState, useEffect } from 'react'

const KEYS = { rides: 'ri3_rides', supps: 'ri3_supps', profile: 'ri3_profile' }
const DEFAULT_PROFILE = { nombre:'', edad:0, peso:0, fcmax:185, fcrest:55, nivel:'recreativo', objetivo:'salud y adherencia', dias:3, ruta:'' }

function load(key, def) {
  try { return JSON.parse(localStorage.getItem(key)) || def } catch { return def }
}

export function useStore() {
  const [rides, setRides] = useState(() => load(KEYS.rides, []))
  const [supps, setSupps] = useState(() => load(KEYS.supps, []))
  const [profile, setProfile] = useState(() => load(KEYS.profile, DEFAULT_PROFILE))

  useEffect(() => { localStorage.setItem(KEYS.rides, JSON.stringify(rides)) }, [rides])
  useEffect(() => { localStorage.setItem(KEYS.supps, JSON.stringify(supps)) }, [supps])
  useEffect(() => { localStorage.setItem(KEYS.profile, JSON.stringify(profile)) }, [profile])

  function addRide(ride) { setRides(prev => [ride, ...prev]) }
  function deleteRide(id) { setRides(prev => prev.filter(r => r.id !== id)) }
  function addSupp(supp) { setSupps(prev => [...prev, { ...supp, id: Date.now() }]) }
  function deleteSupp(id) { setSupps(prev => prev.filter(s => s.id !== id)) }
  function saveProfile(data) { setProfile(data) }

  // Dupe detection: same date ±30min AND similar duration ±10min
  function isDuplicate(newRide) {
    const newTime = new Date(newRide.iso).getTime()
    return rides.find(r => {
      const diff = Math.abs(new Date(r.iso).getTime() - newTime)
      const durDiff = Math.abs((r.dur || 0) - (newRide.dur || 0))
      return diff < 30 * 60 * 1000 && durDiff < 10
    })
  }

  return { rides, supps, profile, addRide, deleteRide, addSupp, deleteSupp, saveProfile, isDuplicate }
}
