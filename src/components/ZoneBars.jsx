import React from 'react'

export default function ZoneBars({ zp = [0, 0, 0, 0, 0] }) {
  const labels = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']
  const colors = ['#4ade80', '#67e8f9', '#facc15', '#fb923c', '#f87171']

  // Siempre mostramos las barras, incluso si los porcentajes son bajos
  const total = zp.reduce((sum, val) => sum + val, 0)

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '8px' }}>
        Distribución de zonas de frecuencia cardíaca
      </p>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {zp.map((perc, i) => {
          const percentage = Math.max(perc || 0, 0)
          const showBar = percentage > 0 || total === 0 // siempre mostrar aunque sea 0

          return (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                height: '18px',
                backgroundColor: '#27272a',
                borderRadius: '6px',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div
                  style={{
                    height: '100%',
                    backgroundColor: colors[i],
                    width: `${percentage}%`,
                    borderRadius: '6px',
                    transition: 'width 0.5s ease'
                  }}
                />
              </div>
              <div style={{ fontSize: '11px', marginTop: '4px', color: '#aaa' }}>
                {labels[i]}
              </div>
              <div style={{ 
                fontSize: '13px', 
                fontWeight: '600',
                color: percentage > 0 ? '#fff' : '#555'
              }}>
                {Math.round(percentage)}%
              </div>
            </div>
          )
        })}
      </div>

      {total === 0 && (
        <p style={{ fontSize: '12px', color: '#666', marginTop: '8px', fontStyle: 'italic' }}>
          Sin datos de frecuencia cardíaca (solo cadencia o potencia)
        </p>
      )}
    </div>
  )
}
