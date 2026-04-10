import { useState } from 'react';

export default function StravaPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const handleConnect = () => {
    setIsConnected(true);
  };

  const handleSync = () => {
    setIsSyncing(true);
    setSyncMessage('');

    setTimeout(() => {
      const newRides = [
        { id: Date.now()+1, name: "Morning Ride", fecha: "09 abr 2026", dur: 50, dist: 20.5, eg: 180, hrAvg: 149, rpe: 7, sen: "bien", cadence: 88, zones: [20, 35, 30, 10, 5] },
        { id: Date.now()+2, name: "Afternoon Ride", fecha: "08 abr 2026", dur: 136, dist: 43.6, eg: 304, hrAvg: 0, rpe: 9, sen: "muy cansado", cadence: 82, zones: [10, 25, 35, 20, 10] },
        { id: Date.now()+3, name: "Recovery Spin", fecha: "07 abr 2026", dur: 65, dist: 24.8, eg: 120, hrAvg: 128, rpe: 4, sen: "fresco", cadence: 90, zones: [55, 35, 8, 2, 0] },
      ];

      let existing = [];
      try {
        const saved = localStorage.getItem('ri3_rides');
        if (saved) existing = JSON.parse(saved);
      } catch (e) {}

      // Evitar duplicados
      const filteredNew = newRides.filter(newRide => 
        !existing.some(old => old.name === newRide.name && old.fecha === newRide.fecha)
      );

      const allRides = [...existing, ...filteredNew];
      localStorage.setItem('ri3_rides', JSON.stringify(allRides));

      setIsSyncing(false);
      setSyncMessage(`¡Sincronización completada! Agregadas ${filteredNew.length} nuevas rodadas. Total: ${allRides.length}`);
    }, 1500);
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

            {syncMessage && <p style={{ marginTop: '20px', color: '#10b981' }}>{syncMessage}</p>}
          </>
        )}
      </div>
    </div>
  );
}
