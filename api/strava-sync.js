export const config = { runtime: 'edge' }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const { access_token, refresh_token, expires_at, after_timestamp } = await req.json()

  const CLIENT_ID = process.env.STRAVA_CLIENT_ID
  const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET

  // Refresh token if expired
  let token = access_token
  if (Date.now() / 1000 > expires_at - 300) {
    try {
      const r = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token, grant_type: 'refresh_token' })
      })
      const refreshed = await r.json()
      token = refreshed.access_token
      // Return new tokens so client can save them
    } catch {
      return new Response(JSON.stringify({ error: 'Token refresh failed' }), { status: 401, headers: cors })
    }
  }

  // Fetch activities from Strava
  const since = after_timestamp || Math.floor(Date.now() / 1000) - 90 * 86400 // last 90 days
  const activitiesRes = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${since}&per_page=30`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!activitiesRes.ok) {
    return new Response(JSON.stringify({ error: 'Strava API error', status: activitiesRes.status }), { status: 400, headers: cors })
  }

  const activities = await activitiesRes.json()

  // Filter only cycling activities and map to our format
  const rides = activities
    .filter(a => ['Ride', 'VirtualRide', 'MountainBikeRide', 'GravelRide', 'EBikeRide'].includes(a.type))
    .map(a => {
      const dur = a.moving_time / 60 // minutes
      const dist = a.distance / 1000  // km
      const hrAvg = a.average_heartrate || 0
      const hrMax = a.max_heartrate || 0
      const cad = a.average_cadence || 0
      const eg = a.total_elevation_gain || 0
      const temp = a.average_temp || null
      const speed = dur > 0 ? dist / (dur / 60) : 0

      // Estimate zones from HR (need fcmax from profile - use 185 default)
      // Will be refined when user has profile
      const zp = [0, 0, 0, 0, 0]
      if (hrAvg > 0) {
        const pct = hrAvg / 185 * 100
        if (pct < 60) zp[0] = 100
        else if (pct < 70) zp[1] = 100
        else if (pct < 80) zp[2] = 100
        else if (pct < 90) zp[3] = 100
        else zp[4] = 100
      }

      return {
        id: a.id * 1000 + Math.floor(Math.random() * 999), // unique id
        stravaId: a.id,
        name: a.name,
        dur: Math.round(dur * 10) / 10,
        dist: Math.round(dist * 100) / 100,
        hrAvg,
        hrMax,
        cad: Math.round(cad),
        eg: Math.round(eg),
        zp,
        temp,
        speed: Math.round(speed * 10) / 10,
        fecha: new Date(a.start_date_local).toLocaleDateString('es-MX', { weekday:'short', day:'numeric', month:'short' }),
        iso: a.start_date,
        rpe: null,    // user must fill
        sen: null,    // user must fill
        com: '',
        ia: '',
        fromStrava: true,
        needsRPE: true
      }
    })

  return new Response(JSON.stringify({ rides, count: rides.length, new_token: token }), { headers: cors })
}
