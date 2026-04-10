import React from 'react'
import ZoneBars from '../components/ZoneBars'

function getZP(r) {
  if (Array.isArray(r.zp) && r.zp.length === 5) return r.zp
  if (Array.isArray(r.zones) && r.zones.length === 5) return r.zones
  return [0,0,0,0,0]
}

export default function Historial({ rides, deleteRide }) {
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
        const sp  = r.speed || (r.dur>0 ? ((r.dist||0)/(r.dur/60)).toFixed(1) : 0)
        const zpArr = getZP(r); const z45 = (zpArr[3]||0)+(zpArr[4]||0)
        const rpeClass = r.rpe>=8?'br2':r.rpe>=6?'ba':'bg'
        const hasFC = r.hrAvg > 0
        const decOk = r.decoupling != null && Math.abs(r.decoupling) > 5

        return (
          <div key={r.id} className="hc">
            {/* Header */}
            <div className="hct">
              <div>
                <div className="hcn">{r.name||'Rodada'}
                  {r.device&&<span style={{fontSize:10,color:'var(--text3)',marginLeft:8,fontFamily:'var(--fm)'}}>{r.device}</span>}
                </div>
                <div className="hcd">{r.fecha}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div className="badges">
                  <span className={`badge ${rpeClass}`}>RPE {r.rpe}</span>
                  {z45>55&&hasFC&&<span className="badge ba">Z4-Z5 alto</span>}
                  {!hasFC&&<span className="badge" style={{color:'var(--text3)',borderColor:'var(--border)'}}>Sin FC</span>}
                  <span className="badge bg">{r.sen}</span>
                </div>
                <button onClick={()=>{ if(confirm('¿Eliminar esta rodada?')) deleteRide(r.id) }}
                  style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:18,padding:'2px 6px',borderRadius:6,lineHeight:1}}
                  onMouseOver={e=>e.target.style.color='var(--red)'} onMouseOut={e=>e.target.style.color='var(--text3)'}>×</button>
              </div>
            </div>

            {/* Primary stats */}
            <div className="hcst" style={{marginBottom:6}}>
              <span className="hcsi">{Math.round(r.dur)} <strong>min</strong>
                {(r.pauseMin||0)>5&&<span style={{fontSize:10,color:'var(--amber)',marginLeft:4}}>+{r.pauseMin}min pausa{r.longPauses>0?' ★':''}</span>}
              </span>
              {r.dist&&<span className="hcsi">{r.dist.toFixed(1)} <strong>km</strong></span>}
              {sp>0&&<span className="hcsi">{parseFloat(sp).toFixed(1)} <strong>km/h</strong></span>}
              {r.hrAvg>0&&<span className="hcsi">FC <strong>{Math.round(r.hrAvg)} lpm</strong></span>}
              {r.eg>0&&<span className="hcsi">+{Math.round(r.eg)} <strong>m</strong></span>}
            </div>

            {/* Secondary stats */}
            <div style={{display:'flex',gap:14,flexWrap:'wrap',fontSize:11,color:'var(--text3)',marginBottom:10,fontFamily:'var(--fm)'}}>
              {r.cad>0&&(
                <span>Cad <strong style={{color:'var(--text)'}}>{Math.round(r.cad)}</strong>rpm
                  {r.cadPctOptimal>0&&<span style={{color:r.cadPctOptimal>=70?'#6db86a':r.cadPctOptimal>=50?'#e8c97a':'#e09850',marginLeft:3}}>({r.cadPctOptimal}% ópt.)</span>}
                </span>
              )}
              {r.watts>0&&(
                <span>{r.hasPower?'Potencia':'Potencia est.'} <strong style={{color:'var(--text)'}}>{r.watts}</strong>W</span>
              )}
              {r.calories>0&&<span>Calorías <strong style={{color:'var(--text)'}}>{r.calories}</strong>kcal</span>}
              {r.kilojoules>0&&<span>Energía <strong style={{color:'var(--text)'}}>{r.kilojoules}</strong>kJ</span>}
              {r.decoupling!=null&&(
                <span style={{color:decOk?'#e09850':'var(--text3)'}}>
                  Desacoplamiento <strong>{r.decoupling}%</strong>{decOk?' ⚠':''}
                </span>
              )}
              {r.suffer>0&&<span>Sufrimiento <strong style={{color:'var(--text)'}}>{r.suffer}</strong></span>}
            </div>

            {/* Zones */}
            {hasFC
              ? <ZoneBars zp={r.zp} compact/>
              : <div style={{fontSize:11,color:'var(--text3)',padding:'4px 0',marginBottom:6}}>Sin sensor FC — zonas no disponibles</div>
            }

            {/* Cadence warning */}
            {r.cad>0 && r.cadPctOptimal < 50 && (
              <div style={{fontSize:11,color:'#e09850',marginTop:6,fontStyle:'italic'}}>
                {r.cadPctOptimal}% del tiempo en rango óptimo (80-100rpm) — trabajar cadencia en Z2
              </div>
            )}

            {/* Decoupling warning */}
            {decOk && (
              <div style={{fontSize:11,color:'#e09850',marginTop:4,fontStyle:'italic'}}>
                Desacoplamiento aeróbico de {r.decoupling}% — base Z2 necesita más volumen (Seiler 2010)
              </div>
            )}

            {/* Comment */}
            {r.com&&<div style={{fontSize:12,color:'var(--text3)',fontStyle:'italic',marginTop:8}}>"{r.com}"</div>}

            {/* IA analysis */}
            {r.ia&&<div className="hcia">{r.ia}</div>}
          </div>
        )
      })}
    </div>
  )
}
