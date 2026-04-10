import React from 'react'
import RideCard from '../components/RideCard'

export default function Historial({ rides, deleteRide, profile, clearAllRides }) {
  const handleClearAll = () => {
    if (rides.length === 0) return;
    
    if (window.confirm(`¿Estás seguro de borrar TODO el historial?\nSe eliminarán ${rides.length} rodadas.`)) {
      if (clearAllRides) {
        clearAllRides();
      } else {
        // Fallback por si no llega la función
        localStorage.removeItem('ri3_rides');
        window.location.reload();
      }
    }
  };

  if (!rides.length) {
    return (
      <div className="page">
        <div className="ph">
          <h1><em>Historial</em> de rodadas</h1>
        </div>
        <div className="empty">
          <p>No tienes rodadas registradas aún</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="ph">
        <h1><em>Historial</em> de rodadas</h1>
        <p>{rides.length} rodadas registradas</p>

        {/* Botón Borrar Todo */}
        <button 
          onClick={handleClearAll}
          style={{
            marginTop: '15px',
            padding: '10px 20px',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          🗑️ Borrar todo el historial
        </button>
      </div>

      {rides.map(ride => (
        <RideCard 
          key={ride.id || ride.stravaId} 
          ride={ride} 
          deleteRide={deleteRide}
          profile={profile}
        />
      ))}
    </div>
  )
}
