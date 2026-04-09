// api/strava-sync.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Aceptar ambos nombres para evitar errores
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
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Strava API error ${response.status}: ${errText}`);
      }

      const activities = await response.json();

      if (activities.length === 0) break;

      allActivities = [...allActivities, ...activities];
      page++;

      await new Promise(resolve => setTimeout(resolve, 250)); // pausa suave
    }

    console.log(`✅ Sincronizadas ${allActivities.length} actividades de Strava`);

    return res.status(200).json({
      success: true,
      activities: allActivities,
      total: allActivities.length,
    });
  } catch (error) {
    console.error('Error en strava-sync:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error desconocido al sincronizar con Strava',
    });
  }
}
