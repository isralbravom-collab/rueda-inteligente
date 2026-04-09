// src/components/ZoneBars.jsx
import React from 'react'

export default function ZoneBars({ zp = [0,0,0,0,0], fcmax = 185 }) {
  const labels = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']
  const colors = ['#4ade80', '#67e8f9', '#facc15', '#fb923c', '#f87171']

  // Si no hay zonas calculadas, mostramos mensaje
  const total = zp.reduce((a, b) => a + b, 0)
  if (total === 0) {
    return (
      <div style={{fontSize:11, color:'var(--text3)', padding:'8px 0'}}>
        Sin datos suficientes para calcular zonas de frecuencia cardíaca
      </div>
    )
  }

  return (
    <div style={{marginTop:8}}>
      <div style={{display:'flex', gap:6, marginBottom:6}}>
        {zp.map((percentage, index) => (
          <div key={index} style={{flex: 1}}>
            <div style={{
              height: '14px',
              background: colors[index],
              borderRadius: '4px',
              width: `${percentage}%`,
              transition: 'width 0.4s ease'
            }} />
            <div style={{textAlign:'center', fontSize:'10px', marginTop:4, color:'var(--text3)'}}>
              {labels[index]}
            </div>
            <div style={{textAlign:'center', fontSize:'11px', fontWeight:600}}>
              {Math.round(percentage)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
