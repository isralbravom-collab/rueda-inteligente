// api/strava-sync.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accessToken, access_token } = req.body;
  const token = accessToken || access_token;

  if (!token) {
    return res.status(400).json({ error: 'Falta accessToken de Strava' });
  }

  try {
    let allActivities = [];
    let page = 1;
    const perPage = 200;

    while (true) {
      const response = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${perPage}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`Strava error ${response.status}: ${err.message || 'Unknown'}`);
      }

      const activities = await response.json();
      if (activities.length === 0) break;

      allActivities = [...allActivities, ...activities];
      page++;
      await new Promise(r => setTimeout(r, 300));
    }

    // === PROCESAMIENTO: Convertir a formato que tu app espera ===
    const processedRides = allActivities.map(activity => {
      const movingTimeMinutes = Math.round((activity.moving_time || 0) / 60);
      const distanceKm = Math.round((activity.distance || 0) / 1000 * 100) / 100;
      const elevationM = Math.round(activity.total_elevation_gain || 0);

      const startDate = activity.start_date || '';
      const iso = startDate;
      const fecha = startDate ? new Date(startDate).toLocaleDateString('es-MX', {
        day: '2-digit', month: 'short', year: 'numeric'
      }) : '';

      return {
        stravaId: activity.id?.toString(),
        name: activity.name || 'Rodada sin nombre',
        iso: iso,
        fecha: fecha,
        dur: movingTimeMinutes,
        dist: distanceKm,
        eg: elevationM,
        hrAvg: Math.round(activity.average_heartrate || 0),
        hrMax: Math.round(activity.max_heartrate || 0),
        fromStrava: true,
        // Campos extra útiles para futuro
        type: activity.type,
        sport_type: activity.sport_type,
        average_speed: activity.average_speed,
        max_speed: activity.max_speed,
      };
    });

    console.log(`✅ Procesadas ${processedRides.length} rodadas de Strava`);

    return res.status(200).json({
      success: true,
      rides: processedRides,        // ← Cambié "activities" por "rides" para que coincida mejor con tu Strava.jsx
      total: processedRides.length,
    });

  } catch (error) {
    console.error('Error en strava-sync:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error desconocido al sincronizar Strava',
    });
  }
}
