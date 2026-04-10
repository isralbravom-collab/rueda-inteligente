import React from 'react'
import RideCard from '../components/RideCard'

export default function Historial({ rides, deleteRide, profile, clearAllRides }) {
  const handleClearAll = () => {
    if (window.confirm('¿Estás seguro de borrar TODO el historial? Esta acción no se puede deshacer.')) {
      clearAllRides();
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
          <p style={{ marginTop: '20px', color: '#666' }}>
            Conecta Strava y sincroniza para ver tus rodadas.
          </p>
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
