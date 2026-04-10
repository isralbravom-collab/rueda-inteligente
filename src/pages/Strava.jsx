import { useState } from 'react';

export default function StravaPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const handleConnect = () => {
    setIsConnected(true);
  };

  const handleSync = () => {
    if (isSyncing) return;

    setIsSyncing(true);
    setSyncMessage('');

    setTimeout(() => {
      // Rodadas más realistas con fechas variadas (no todas seguidas)
      const newRides = [
        { id: Date.now() + 1, name: "Morning Ride", fecha: "09 abr 2026", dur: 52, dist: 21.8, eg: 195, hrAvg: 152, rpe: 7, sen: "bien", cadence: 89, zones: [18, 38, 32, 9, 3] },
        { id: Date.now() + 2, name: "Afternoon Ride", fecha: "08 abr 2026", dur: 128, dist: 41.2, eg: 315, hrAvg: 0, rpe: 8, sen: "cansado", cadence: 84, zones: [12, 28, 35, 18, 7] },
        { id: Date.now() + 3, name: "Recovery Spin", fecha: "06 abr 2026", dur: 68, dist: 26.4, eg: 135, hrAvg: 132, rpe: 4, sen: "fresco", cadence: 91, zones: [52, 38, 8, 2, 0] },
        { id: Date.now() + 4, name: "Weekend Long Ride", fecha: "05 abr 2026", dur: 182, dist: 68.5, eg: 480, hrAvg: 140, rpe: 6, sen: "bien", cadence: 86, zones: [22, 58, 15, 4, 1] },
        { id: Date.now() + 5, name: "Tempo Intervals", fecha: "03 abr 2026", dur: 75, dist: 29.7, eg: 265, hrAvg: 157, rpe: 8, sen: "duro", cadence: 93, zones: [14, 24, 36, 21, 5] },
        { id: Date.now() + 6, name: "Easy Evening", fecha: "02 abr 2026", dur: 48, dist: 19.5, eg: 90, hrAvg: 135, rpe: 5, sen: "bien", cadence: 88, zones: [35, 48, 14, 3, 0] },
        { id: Date.now() + 7, name: "Hill Training", fecha: "31 mar 2026", dur: 98, dist: 27.9, eg: 650, hrAvg: 161, rpe: 9, sen: "muy cansado", cadence: 79, zones: [10, 20, 25, 30, 15] },
      ];

      let existing = [];
      try {
        const saved = localStorage.getItem('ri3_rides');
        if (saved) existing = JSON.parse(saved);
      } catch (e) {}

      // Evitar duplicados por nombre + fecha
      const filteredNew = newRides.filter(newRide => 
        !existing.some(old => old.name === newRide.name && old.fecha === newRide.fecha)
      );

      const allRides = [...existing, ...filteredNew];
      localStorage.setItem('ri3_rides', JSON.stringify(allRides));

      setIsSyncing(false);
      setSyncMessage(`¡Sincronización completada! Se importaron ${filteredNew.length} rodadas nuevas. Total: ${allRides.length}`);
    }, 1600);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#f1f1f1', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <a href="/" style={{ color: '#10b981', marginBottom: '30px', display: 'inline-block' }}>← Volver</a>

      <h1 style={{ fontSize: '42px', marginBottom: '10px' }}>Sincronizar con Strava</h1>
      <p style={{ color: '#aaa' }}>Importa solo rodadas de bicicleta</p>

      <div style={{ background: '#18181b', padding: '40px', borderRadius: '16px', maxWidth: '700px', marginTop: '40px' }}>
        {!isConnected ? (
          <button 
            onClick={handleConnect}
            style={{ padding: '14px 40px', background: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontSize: '17px', cursor: 'pointer' }}
          >
            Conectar con Strava
          </button>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '18px' }}>✅ Conectado • Israel</div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={handleSync} 
                  disabled={isSyncing}
                  style={{ padding: '12px 28px', background: isSyncing ? '#555' : '#10b981', color: 'white', border: 'none', borderRadius: '12px', cursor: isSyncing ? 'not-allowed' : 'pointer' }}
                >
                  {isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
                </button>
                <button 
                  onClick={() => setIsConnected(false)}
                  style={{ padding: '12px 24px', background: '#444', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer' }}
                >
                  Desconectar
                </button>
              </div>
            </div>

            {syncMessage && <p style={{ marginTop: '20px', color: '#10b981', fontSize: '16px' }}>{syncMessage}</p>}
          </>
        )}
      </div>
    </div>
  );
}
