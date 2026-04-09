// api/strava-sync.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accessToken } = req.body;

  if (!accessToken) {
    return res.status(400).json({ error: 'Falta accessToken de Strava' });
  }

  try {
    let allActivities = [];
    let page = 1;
    const perPage = 200; // máximo permitido por Strava

    while (true) {
      const response = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${perPage}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Strava API error: ${response.status}`);
      }

      const activities = await response.json();

      if (activities.length === 0) break; // no hay más rodadas

      allActivities = [...allActivities, ...activities];
      page++;

      // Pequeña pausa para no golpear el rate limit de Strava
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    console.log(`✅ Sincronizadas ${allActivities.length} rodadas de Strava`);

    // Aquí puedes agregar lógica extra si quieres descargar GPX o streams de cada actividad
    // Por ahora devolvemos todas las rodadas completas

    return res.status(200).json({
      success: true,
      activities: allActivities,
      total: allActivities.length,
    });
  } catch (error) {
    console.error('Error en strava-sync:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error desconocido al sincronizar Strava',
    });
  }
}
