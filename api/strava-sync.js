// api/strava-sync.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accessToken, access_token } = req.body;
  const token = accessToken || access_token;

  if (!token) {
    return res.status(400).json({ error: 'Falta accessToken' });
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

      if (!response.ok) throw new Error(`Strava error ${response.status}`);

      const activities = await response.json();
      if (activities.length === 0) break;

      allActivities = [...allActivities, ...activities];
      page++;
      await new Promise(r => setTimeout(r, 300));
    }

    // Filtro solo bicicleta
    const cyclingTypes = ['Ride', 'MountainBikeRide', 'GravelRide', 'EBikeRide', 'VirtualRide'];

    const processedRides = await Promise.all(
      allActivities
        .filter(act => cyclingTypes.includes(act.sport_type || act.type))
        .map(async (activity) => {
          let hrAvg = Math.round(activity.average_heartrate || 0);
          let hrMax = Math.round(activity.max_heartrate || 0);

          // Si no viene FC en el summary, intentamos obtener más detalles (opcional pero útil)
          if (hrAvg === 0 && activity.id) {
            try {
              const detailRes = await fetch(`https://www.strava.com/api/v3/activities/${activity.id}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (detailRes.ok) {
                const detail = await detailRes.json();
                hrAvg = Math.round(detail.average_heartrate || 0);
                hrMax = Math.round(detail.max_heartrate || 0);
              }
            } catch (e) { /* silencioso */ }
          }

          const movingMinutes = Math.round((activity.moving_time || 0) / 60);
          const distanceKm = Math.round((activity.distance || 0) / 1000 * 100) / 100;
          const elevationM = Math.round(activity.total_elevation_gain || 0);
          const speed = activity.average_speed 
            ? Math.round(activity.average_speed * 3.6 * 10) / 10 
            : movingMinutes > 0 ? Math.round((distanceKm / movingMinutes) * 60 * 10) / 10 : 0;

          const startDate = activity.start_date || '';
          const fecha = startDate 
            ? new Date(startDate).toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' })
            : '';

          return {
            stravaId: activity.id?.toString(),
            id: activity.id?.toString(),           // importante para deleteRide
            name: activity.name || 'Rodada sin nombre',
            iso: startDate,
            fecha: fecha,
            dur: movingMinutes,
            dist: distanceKm,
            eg: elevationM,
            hrAvg: hrAvg,
            hrMax: hrMax,
            cadence: Math.round(activity.average_cadence || 0),
            avgSpeed: speed,
            fromStrava: true,
            sport_type: activity.sport_type,
            hasHeartrate: hrAvg > 0
          };
        })
    );

    console.log(`✅ Procesadas ${processedRides.length} rodadas de bicicleta`);

    return res.status(200).json({
      success: true,
      rides: processedRides,
      total: processedRides.length,
    });

  } catch (error) {
    console.error('Error strava-sync:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
