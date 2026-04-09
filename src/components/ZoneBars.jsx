import React from 'react'

export default function ZoneBars({ zp = [0, 0, 0, 0, 0] }) {
  const labels = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']
  const colors = ['#4ade80', '#67e8f9', '#facc15', '#fb923c', '#f87171']

  const total = zp.reduce((sum, val) => sum + val, 0)

  if (total < 10) {
    return (
      <div style={{ fontSize: '11px', color: 'var(--text3)', padding: '8px 0', fontStyle: 'italic' }}>
        Sin datos suficientes para calcular zonas de frecuencia cardíaca
      </div>
    )
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        {zp.map((perc, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <div
              style={{
                height: '14px',
                backgroundColor: colors[i],
                borderRadius: '4px',
                width: `${Math.max(perc, 0)}%`,
                margin: '0 auto',
                transition: 'width 0.4s'
              }}
            />
            <div style={{ fontSize: '10px', marginTop: '4px', color: 'var(--text3)' }}>
              {labels[i]}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600 }}>
              {Math.round(perc)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
