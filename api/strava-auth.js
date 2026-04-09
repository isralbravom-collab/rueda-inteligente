export const config = { runtime: 'edge' }

export default async function handler(req) {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  if (error) {
    return Response.redirect(`${process.env.APP_URL || ''}/#/strava?error=denied`)
  }

  if (!code) {
    return new Response(JSON.stringify({ error: 'No code provided' }), { status: 400, headers: cors })
  }

  const CLIENT_ID = process.env.STRAVA_CLIENT_ID
  const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return Response.redirect(`${process.env.APP_URL || ''}/#/strava?error=no_keys`)
  }

  try {
    const res = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code'
      })
    })

    const data = await res.json()

    if (data.errors) {
      return Response.redirect(`${process.env.APP_URL || ''}/#/strava?error=token_failed`)
    }

    const params = new URLSearchParams({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      athlete_name: data.athlete?.firstname || '',
      athlete_id: data.athlete?.id || ''
    })

    return Response.redirect(`${process.env.APP_URL || ''}/#/strava?${params}`)

  } catch (e) {
    return Response.redirect(`${process.env.APP_URL || ''}/#/strava?error=network`)
  }
}
