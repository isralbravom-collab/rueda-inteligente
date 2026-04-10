export const config = { runtime: 'edge' }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
}

// Smart zone distribution from average HR using bell-curve model
// Instead of naively assigning 100% to one zone, distributes realistically
function estimateZoneDistribution(hrAvg, fcmax = 185) {
  if (!hrAvg || hrAvg < 40 || !fcmax) return [0,0,0,0,0]

  const pct = hrAvg / fcmax * 100
  // HR std deviation varies by intensity: hard efforts are more sustained
  const std = pct > 85 ? 7 : pct > 75 ? 10 : pct > 65 ? 14 : 18

  function normalCDF(x, mean, s) {
    const t = (x - mean) / (s * Math.SQRT2)
    return 0.5 * (1 + (t < 0 ? -1 : 1) * (1 - Math.exp(-t*t*(0.147*t*t+1.4142)/(t*t*0.147+1))))
  }

  const bounds = [0, 60, 70, 80, 90, 120]
  const raw = []
  for (let i = 0; i < 5; i++) {
    raw.push(Math.max(0, normalCDF(bounds[i+1], pct, std) - normalCDF(bounds[i], pct, std)))
  }

  const total = raw.reduce((a,b)=>a+b, 0) || 1
  const zones = raw.map(v => Math.round(v/total*100))
  // Fix rounding drift
  const diff = 100 - zones.reduce((a,b)=>a+b, 0)
  zones[zones.indexOf(Math.max(...zones))] += diff
  return zones
}

// Calculate real zone distribution from HR stream
function calcZones(hrStream, fcmax) {
  if (!hrStream?.length || !fcmax) return [0,0,0,0,0]
  const valid = hrStream.filter(h => h > 40)
  if (!valid.length) return [0,0,0,0,0]
  const z = [0,0,0,0,0]
  valid.forEach(h => {
    const p = h / fcmax * 100
    if (p < 60) z[0]++
    else if (p < 70) z[1]++
    else if (p < 80) z[2]++
    else if (p < 90) z[3]++
    else z[4]++
  })
  const tot = z.reduce((a,b)=>a+b,0) || 1
  return z.map(v => Math.round(v/tot*100))
}

// Cadence metrics from stream
function calcCadenceMetrics(cadStream) {
  if (!cadStream?.length) return { avg:0, pctOptimal:0, stdDev:0 }
  const active = cadStream.filter(c => c > 20) // exclude stopped
  if (!active.length) return { avg:0, pctOptimal:0, stdDev:0 }
  const avg = Math.round(active.reduce((a,b)=>a+b,0) / active.length)
  const optimal = active.filter(c => c >= 80 && c <= 100).length
  const pctOptimal = Math.round(optimal / active.length * 100)
  const mean = active.reduce((a,b)=>a+b,0) / active.length
  const variance = active.reduce((a,b)=>a+Math.pow(b-mean,2),0) / active.length
  const stdDev = Math.round(Math.sqrt(variance))
  return { avg, pctOptimal, stdDev }
}

// Aerobic decoupling: compare HR/speed ratio first half vs second half
function calcDecoupling(hrStream, velStream) {
  if (!hrStream?.length || !velStream?.length) return null
  const len = Math.min(hrStream.length, velStream.length)
  if (len < 100) return null
  const mid = Math.floor(len / 2)

  const hrSpeedRatio = (hrArr, velArr) => {
    const validPairs = hrArr.map((h,i) => [h, velArr[i]]).filter(([h,v]) => h > 40 && v > 0)
    if (!validPairs.length) return 0
    return validPairs.reduce((a,[h,v]) => a + h/v, 0) / validPairs.length
  }

  const r1 = hrSpeedRatio(hrStream.slice(0, mid), velStream.slice(0, mid))
  const r2 = hrSpeedRatio(hrStream.slice(mid), velStream.slice(mid))
  if (!r1) return null
  return Math.round(((r2 - r1) / r1) * 100 * 10) / 10 // % change
}

// Estimated power without power meter (physics model)
// P = (Crr*m*g + 0.5*Cd*A*rho*v^2)*v + m*g*sin(theta)*v
function estimatePower(velStream, altStream, weightKg = 75) {
  if (!velStream?.length) return 0
  const Crr = 0.004    // rolling resistance coefficient (road)
  const CdA = 0.35     // drag area (hoods position)
  const rho = 1.1      // air density kg/m³ (adjusted for ~1800m avg altitude Mexico)
  const g   = 9.81
  const totalMass = weightKg + 8  // rider + bike

  const powers = []
  for (let i = 1; i < Math.min(velStream.length, altStream?.length || 9999); i++) {
    const v = velStream[i] // m/s
    if (v < 0.5) continue  // stopped
    const dAlt = altStream ? (altStream[i] - altStream[i-1]) : 0
    const slope = Math.max(-0.15, Math.min(0.15, dAlt / Math.max(v, 0.1))) // clamp ±15%
    const Froll = Crr * totalMass * g
    const Faero = 0.5 * CdA * rho * v * v
    const Fgrav = totalMass * g * slope
    const P = (Froll + Faero + Fgrav) * v
    if (P > 0 && P < 2000) powers.push(P) // sanity check
  }

  return powers.length ? Math.round(powers.reduce((a,b)=>a+b,0) / powers.length) : 0
}

// Detect pauses from velocity stream (returns segments of moving time)
function analyzeActivity(velStream, timeStream) {
  if (!velStream?.length || !timeStream?.length) return { pauseMin: 0, segments: 1 }

  let pauseSeconds = 0
  let longPauses = 0
  let inPause = false
  let pauseStart = 0

  for (let i = 0; i < velStream.length; i++) {
    const stopped = velStream[i] < 0.5 // less than 0.5 m/s
    if (stopped && !inPause) {
      inPause = true
      pauseStart = timeStream[i]
    } else if (!stopped && inPause) {
      const pauseDur = timeStream[i] - pauseStart
      pauseSeconds += pauseDur
      if (pauseDur > 1800) longPauses++ // 30+ min pause
      inPause = false
    }
  }

  return {
    pauseMin: Math.round(pauseSeconds / 60),
    longPauses // number of pauses > 30min (e.g. visiting grandma)
  }
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const body = await req.json()
  const { access_token, refresh_token, expires_at, after_timestamp, fcmax = 185, weight = 75 } = body

  const CLIENT_ID     = process.env.STRAVA_CLIENT_ID
  const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET

  // Refresh token if expired
  let token = access_token
  if (Date.now() / 1000 > expires_at - 300) {
    try {
      const r = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id:CLIENT_ID, client_secret:CLIENT_SECRET, refresh_token, grant_type:'refresh_token' })
      })
      const refreshed = await r.json()
      if (!refreshed.access_token) throw new Error('No token')
      token = refreshed.access_token
    } catch {
      return new Response(JSON.stringify({ error:'Token refresh failed — reconecta Strava' }), { status:401, headers:cors })
    }
  }

  // 1. Fetch activity list
  const since = after_timestamp || Math.floor(Date.now()/1000) - 90*86400
  const listRes = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${since}&per_page=30`,
    { headers:{ Authorization:`Bearer ${token}` } }
  )
  if (!listRes.ok) {
    return new Response(JSON.stringify({ error:`Strava list error: ${listRes.status}` }), { status:400, headers:cors })
  }

  const activities = await listRes.json()
  const cycling = activities.filter(a =>
    ['Ride','VirtualRide','MountainBikeRide','GravelRide','EBikeRide'].includes(a.type)
  )

  // 2. Fetch streams for each activity (max 15 to stay within rate limits)
  const streamKeys = 'heartrate,cadence,velocity_smooth,altitude,watts,time'
  const withStreams = await Promise.all(
    cycling.slice(0, 15).map(async a => {
      try {
        const sRes = await fetch(
          `https://www.strava.com/api/v3/activities/${a.id}/streams?keys=${streamKeys}&key_by_type=true`,
          { headers:{ Authorization:`Bearer ${token}` } }
        )
        if (!sRes.ok) return { activity: a, streams: null }
        const streams = await sRes.json()
        return { activity: a, streams }
      } catch {
        return { activity: a, streams: null }
      }
    })
  )

  // 3. Build enriched ride objects
  const rides = withStreams.map(({ activity: a, streams: s }) => {
    const dur        = a.moving_time / 60           // moving minutes
    const elapsedMin = a.elapsed_time / 60           // total minutes including pauses
    const dist       = a.distance / 1000             // km
    const speed      = a.average_speed * 3.6         // m/s → km/h (Strava's own calc)

    // HR: prefer stream, fallback to summary
    const hrStream   = s?.heartrate?.data || []
    const hrAvg      = hrStream.length
      ? Math.round(hrStream.filter(h=>h>40).reduce((a,b)=>a+b,0) / Math.max(hrStream.filter(h=>h>40).length,1))
      : Math.round(a.average_heartrate || 0)
    const hrMax      = hrStream.length
      ? Math.max(...hrStream)
      : Math.round(a.max_heartrate || 0)

    // Cadence: prefer stream metrics, fallback to summary → laps[0]
    const cadStream   = s?.cadence?.data || []
    const cadMetrics  = calcCadenceMetrics(cadStream)
    const cadAvg      = cadMetrics.avg || Math.round(a.average_cadence || a.laps?.[0]?.average_cadence || 0)

    // Velocity stream (m/s)
    const velStream   = s?.velocity_smooth?.data || []
    const altStream   = s?.altitude?.data || []
    const timeStream  = s?.time?.data || []
    const wattsStream = s?.watts?.data || []

    // Real zone distribution from HR stream
    const zp = hrStream.length
      ? calcZones(hrStream, fcmax)
      : estimateZoneDistribution(hrAvg, fcmax)

    // Power: real if available, estimated if not
    const wattsAvg = a.average_watts
      || (wattsStream.length ? Math.round(wattsStream.filter(w=>w>0).reduce((a,b)=>a+b,0)/Math.max(wattsStream.filter(w=>w>0).length,1)) : 0)
      || estimatePower(velStream, altStream, weight)
    const wattsNorm  = a.weighted_average_watts || 0
    const hasPower   = !!(a.average_watts || a.device_watts)

    // Pause analysis
    const { pauseMin, longPauses } = analyzeActivity(velStream, timeStream)

    // Aerobic decoupling
    const decoupling = calcDecoupling(hrStream, velStream)

    // Energy
    const kilojoules = a.kilojoules || 0
    const calories   = a.calories   || Math.round(kilojoules * 0.239 * 1.05)

    return {
      id:           a.id * 1000 + Math.floor(Math.random()*999),
      stravaId:     a.id,
      name:         a.name,
      // Time
      dur:          Math.round(dur * 10) / 10,       // moving time (min)
      elapsedMin:   Math.round(elapsedMin),           // total elapsed (min)
      pauseMin:     pauseMin || Math.round(elapsedMin - dur), // pause time
      longPauses,                                     // pauses > 30min
      // Distance & speed
      dist:         Math.round(dist * 100) / 100,
      speed:        Math.round(speed * 10) / 10,      // km/h (Strava's calc)
      // Heart rate
      hrAvg, hrMax,
      // Cadence
      cad:          cadAvg,
      cadPctOptimal: cadMetrics.pctOptimal,           // % time 80-100rpm
      cadStdDev:    cadMetrics.stdDev,                // technique consistency
      // Power
      watts:        wattsAvg,
      wattsNorm,
      hasPower,                                       // true if real power meter
      // Elevation & environment
      eg:           Math.round(a.total_elevation_gain || 0),
      temp:         a.average_temp || null,
      // Zones (real distribution)
      zp,
      // Performance metrics
      kilojoules,
      calories,
      decoupling,   // aerobic decoupling % (null if no data)
      // Metadata
      device:       a.device_name || '',
      gear:         a.gear_id || '',
      suffer:       a.suffer_score || null,
      // Dates
      fecha:        new Date(a.start_date_local).toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short'}),
      iso:          a.start_date,
      // App fields
      rpe:null, sen:null, com:'', ia:'',
      fromStrava:true, needsRPE:true
    }
  })

  return new Response(
    JSON.stringify({ rides, count: rides.length, new_token: token }),
    { headers: cors }
  )
}
