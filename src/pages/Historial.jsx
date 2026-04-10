import React from 'react'
import RideCard from '../components/RideCard'

export default function Historial({ rides, deleteRide, profile }) {
  if (!rides.length) {
    return (
      <div className="page">
        <div className="ph"><h1><em>Historial</em> de rodadas</h1></div>
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
