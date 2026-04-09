// src/components/RideCard.jsx
import React from 'react'
import ZoneBars from './ZoneBars'

export default function RideCard({ ride, deleteRide, profile }) {
  const speed = ride.dur > 0 ? (ride.dist / (ride.dur / 60)).toFixed(1) : '0'
  const hasFC = ride.hrAvg > 0
  const intensityColor = ride.rpe >= 8 ? '#ef4444' : ride.rpe >= 6 ? '#f59e0b' : '#4ade80'

  return (
    <div className="hc" style={{ marginBottom: 20, borderRadius: '16px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ 
        padding: '16px 20px', 
        background: '#1f2937', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>{ride.name || 'Rodada'}</div>
          <div style={{ fontSize: '13px', color: '#9ca3af' }}>{ride.fecha}</div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ 
            padding: '4px 12px', 
            borderRadius: '9999px', 
            background: intensityColor + '20', 
            color: intensityColor, 
            fontSize: '13px', 
            fontWeight: 600 
          }}>
            RPE {ride.rpe}
          </div>
          <div style={{ 
            padding: '4px 12px', 
            borderRadius: '9999px', 
            background: '#374151', 
            color: '#d1d5db', 
            fontSize: '13px' 
          }}>
            {ride.sen}
          </div>
          <button 
            onClick={() => { if (confirm('¿Eliminar esta rodada?')) deleteRide(ride.id || ride.stravaId) }}
            style={{ background: 'none', border: 'none', fontSize: '22px', color: '#6b7280', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Stats principales */}
      <div style={{ padding: '20px', background: '#111827' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '16px', marginBottom: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 700 }}>{Math.round(ride.dur)}</div>
            <div style={{ fontSize: '12px', color: '#9ca3af' }}>MINUTOS</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 700 }}>{ride.dist?.toFixed(1) || 0}</div>
            <div style={{ fontSize: '12px', color: '#9ca3af' }}>KM</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 700 }}>{speed}</div>
            <div style={{ fontSize: '12px', color: '#9ca3af' }}>KM/H</div>
          </div>
          {hasFC && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#60a5fa' }}>{ride.hrAvg}</div>
              <div style={{ fontSize: '12px', color: '#9ca3af' }}>FC PROM</div>
            </div>
          )}
          {ride.eg > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 700 }}>{ride.eg}</div>
              <div style={{ fontSize: '12px', color: '#9ca3af' }}>METROS ↑</div>
            </div>
          )}
        </div>

        {/* Cadence */}
        {ride.cadence > 0 && (
          <div style={{ marginBottom: 16, fontSize: '14px' }}>
            Cadencia: <strong>{ride.cadence} rpm</strong>
          </div>
        )}

        {/* Zonas de FC */}
        {hasFC ? (
          <ZoneBars zp={ride.zp || [0,0,0,0,0]} />
        ) : (
          <div style={{ color: '#9ca3af', fontSize: '13px', padding: '8px 0' }}>
            Sin sensor FC — zonas no disponibles
          </div>
        )}

        {/* Análisis IA */}
        {ride.ia && (
          <div style={{ marginTop: 16, padding: '12px', background: '#1f2937', borderRadius: '8px', fontSize: '13px', lineHeight: 1.5 }}>
            {ride.ia}
          </div>
        )}
      </div>
    </div>
  )
}
