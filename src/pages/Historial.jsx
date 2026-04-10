import React from 'react'
import ZoneBars from '../components/ZoneBars'

function getZP(r) {
  if (Array.isArray(r.zp) && r.zp.length === 5) return r.zp
  if (Array.isArray(r.zones) && r.zones.length === 5) return r.zones
  return [0,0,0,0,0]
}

function getCad(r) { return Math.round(r.cad || r.cadence || 0) }

export default function Historial({ rides, deleteRide, profile = {} }) {
  const fcmax = profile.fcmax || 185

  if (!rides.length) return (
    <div className="page">
      <div className="ph"><h1><em>Historial</em> de rodadas</h1></div>
      <div className="empty">
        <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        <p>Registra tu primera rodada para comenzar</p>
      </div>
    </div>
  )

  return (
    <div className="page">
      <div className="ph">
        <h1><em>Historial</em> de rodadas</h1>
        <p>{rides.length} rodadas registradas</p>
      </div>

      {rides.map(r => {
        const zp    = getZP(r)
        const z45   = (zp[3]||0) + (zp[4]||0)
        const hasFC = (r.hrAvg || r.hr_avg || 0) > 0
        const hrAvg = Math.round(r.hrAvg || r.hr_avg || 0)
        const cad   = getCad(r)
        const sp    = r.speed || (r.dur > 0 ? ((r.dist||0)/(r.dur/60)).toFixed(1) : 0)
        const decOk = r.decoupling != null && Math.abs(r.decoupling) > 5

        const rpeColor = r.rpe >= 8 ? '#e07070' : r.rpe >= 6 ? '#e09850' : '#6db86a'

        return (
          <div key={r.id} className="hc">
            {/* Header */}
            <div className="hct">
              <div>
                <div className="hcn">
                  {r.name || 'Rodada'}
                  {r.device && <span style={{fontSize:10,color:'var(--text3)',marginLeft:8,fontFamily:'var(--fm)'}}>{r.device}</span>}
                </div>
                <div className="hcd">{r.fecha}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                {r.rpe && (
                  <span style={{fontSize:12,fontFamily:'var(--fm)',color:rpeColor,
                    border:`1px solid ${rpeColor}40`,borderRadius:20,padding:'2px 10px'}}>
                    RPE {r.rpe}
                  </span>
                )}
                {!hasFC && (
                  <span style={{fontSize:11,fontFamily:'var(--fm)',color:'var(--text3)',
                    border:'1px solid var(--border)',borderRadius:20,padding:'2px 8px'}}>
                    Sin FC
                  </span>
                )}
                {r.sen && (
                  <span style={{fontSize:12,fontFamily:'var(--fm)',color:'#6db86a',
                    border:'1px solid #6db86a40',borderRadius:20,padding:'2px 10px'}}>
                    {r.sen}
                  </span>
                )}
                <button
                  onClick={() => { if (confirm('¿Eliminar esta rodada?')) deleteRide(r.id) }}
                  style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',
                    fontSize:18,padding:'2px 6px',lineHeight:1,borderRadius:6}}
                  onMouseOver={e=>e.currentTarget.style.color='#e07070'}
                  onMouseOut={e=>e.currentTarget.style.color='var(--text3)'}>
                  ×
                </button>
              </div>
            </div>

            {/* Primary stats */}
            <div className="hcst" style={{marginBottom:6}}>
              <span className="hcsi">
                {Math.round(r.dur)} <strong>min</strong>
                {(r.pauseMin||0) > 5 && (
                  <span style={{fontSize:10,color:'var(--amber)',marginLeft:4}}>
                    +{r.pauseMin}min pausa{r.longPauses > 0 ? ' ★' : ''}
                  </span>
                )}
              </span>
              {r.dist > 0 && <span className="hcsi">{parseFloat(r.dist).toFixed(1)} <strong>km</strong></span>}
              {sp > 0 && <span className="hcsi">{parseFloat(sp).toFixed(1)} <strong>km/h</strong></span>}
              {hrAvg > 0 && <span className="hcsi" style={{color:'#7ab8e8'}}>FC <strong>{hrAvg} lpm</strong></span>}
              {r.eg > 0 && <span className="hcsi">+{Math.round(r.eg)} <strong>m</strong></span>}
            </div>

            {/* Secondary stats */}
            <div style={{display:'flex',gap:16,flexWrap:'wrap',fontSize:11,color:'var(--text3)',
              marginBottom:12,fontFamily:'var(--fm)'}}>
              {cad > 0 && (
                <span>
                  Cad <strong style={{color:'var(--text)'}}>{cad}</strong> rpm
                  {r.cadPctOptimal > 0 && (
                    <span style={{color: r.cadPctOptimal >= 70 ? '#6db86a' : r.cadPctOptimal >= 50 ? '#e8c97a' : '#e09850', marginLeft:4}}>
                      ({r.cadPctOptimal}% ópt.)
                    </span>
                  )}
                </span>
              )}
              {(r.watts || 0) > 0 && (
                <span>{r.hasPower ? 'Potencia' : 'Potencia est.'} <strong style={{color:'var(--text)'}}>{r.watts}</strong> W</span>
              )}
              {(r.calories || 0) > 0 && <span>Cal <strong style={{color:'var(--text)'}}>{r.calories}</strong> kcal</span>}
              {r.decoupling != null && (
                <span style={{color: decOk ? '#e09850' : 'var(--text3)'}}>
                  Desacoplamiento <strong>{r.decoupling}%</strong>{decOk ? ' ⚠' : ''}
                </span>
              )}
            </div>

            {/* Zones — pass hrAvg and fcmax so it can recalculate naive zones */}
            <ZoneBars zp={zp} hrAvg={hrAvg} fcmax={fcmax} compact/>

            {/* Warnings */}
            {cad > 0 && (r.cadPctOptimal || 0) < 50 && (
              <div style={{fontSize:11,color:'#e09850',marginTop:6,fontStyle:'italic'}}>
                {r.cadPctOptimal || 0}% del tiempo en rango óptimo (80-100 rpm) — trabajar cadencia en Z2
              </div>
            )}
            {decOk && (
              <div style={{fontSize:11,color:'#e09850',marginTop:4,fontStyle:'italic'}}>
                Desacoplamiento aeróbico de {r.decoupling}% — base Z2 necesita más volumen (Seiler 2010)
              </div>
            )}

            {/* Comment & IA */}
            {r.com && <div style={{fontSize:12,color:'var(--text3)',fontStyle:'italic',marginTop:8}}>"{r.com}"</div>}
            {r.ia && <div className="hcia">{r.ia}</div>}
          </div>
        )
      })}
    </div>
  )
}
