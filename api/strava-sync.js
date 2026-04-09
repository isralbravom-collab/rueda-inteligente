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
        { headers: { Authorization: `Bearer ${token}` } }
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

    // === PROCESAMIENTO MEJORADO ===
    const processedRides = allActivities.map(activity => {
      const movingMinutes = Math.round((activity.moving_time || 0) / 60);        // ← TIEMPO REAL EN MOVIMIENTO
      const distanceKm = Math.round((activity.distance || 0) / 1000 * 100) / 100;
      const elevationM = Math.round(activity.total_elevation_gain || 0);

      // Velocidad promedio correcta (Strava ya la calcula)
      let avgSpeed = activity.average_speed 
        ? Math.round(activity.average_speed * 3.6 * 10) / 10   // m/s → km/h
        : movingMinutes > 0 
          ? Math.round((distanceKm / movingMinutes) * 60 * 10) / 10 
          : 0;

      const startDate = activity.start_date || '';
      const fecha = startDate 
        ? new Date(startDate).toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' })
        : '';

      return {
        stravaId: activity.id?.toString(),
        name: activity.name || 'Rodada sin nombre',
        iso: startDate,
        fecha: fecha,
        dur: movingMinutes,                    // ← USAMOS MOVING TIME
        dist: distanceKm,
        eg: elevationM,
        hrAvg: Math.round(activity.average_heartrate || 0),
        hrMax: Math.round(activity.max_heartrate || 0),
        cadence: Math.round(activity.average_cadence || 0),   // ← Cadencia real
        avgSpeed: avgSpeed,                                    // ← Velocidad correcta
        fromStrava: true,
        sport_type: activity.sport_type,
      };
    });

    console.log(`✅ Procesadas ${processedRides.length} rodadas correctamente`);

    return res.status(200).json({
      success: true,
      rides: processedRides,
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
