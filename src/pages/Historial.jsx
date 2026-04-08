import React from 'react'
import ZoneBars from '../components/ZoneBars'

export default function Historial({ rides, deleteRide }) {
  if (!rides.length) return (
    <div className="page">
      <div className="ph"><h1><em>Historial</em> de rodadas</h1></div>
      <div className="empty">
        <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        <p>Aún no hay rodadas. ¡Registra tu primera salida!</p>
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
        const sp = r.dur>0 ? ((r.dist||0)/(r.dur/60)) : 0
        const z45 = ((r.zp||[])[3]||0)+((r.zp||[])[4]||0)
        const rpeClass = r.rpe>=8?'br2':r.rpe>=6?'ba':'bg'
        return (
          <div key={r.id} className="hc">
            <div className="hct">
              <div>
                <div className="hcn">{r.name||'Rodada'}</div>
                <div className="hcd">{r.fecha}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div className="badges">
                  <span className={`badge ${rpeClass}`}>RPE {r.rpe}</span>
                  {z45>55 && <span className="badge ba">Z4-Z5 alto</span>}
                  <span className="badge bg">{r.sen}</span>
                </div>
                <button onClick={()=>{ if(confirm('¿Eliminar esta rodada?')) deleteRide(r.id) }}
                  style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:18,padding:'2px 6px',borderRadius:6,lineHeight:1,transition:'color .15s'}}
                  onMouseOver={e=>e.target.style.color='var(--red)'} onMouseOut={e=>e.target.style.color='var(--text3)'}>×</button>
              </div>
            </div>
            <div className="hcst">
              {r.dur&&<span className="hcsi">{Math.round(r.dur)} <strong>min</strong></span>}
              {r.dist&&<span className="hcsi">{r.dist.toFixed(1)} <strong>km</strong></span>}
              {sp>0&&<span className="hcsi">{sp.toFixed(1)} <strong>km/h</strong></span>}
              {r.hrAvg&&<span className="hcsi">FC <strong>{Math.round(r.hrAvg)} lpm</strong></span>}
              {r.eg&&<span className="hcsi">+{Math.round(r.eg)} <strong>m</strong></span>}
              <span className="hcsi">Z4+Z5 <strong>{z45}%</strong></span>
            </div>
            {r.zp && <ZoneBars zp={r.zp}/>}
            {r.com && <div style={{fontSize:12,color:'var(--text3)',fontStyle:'italic',marginBottom:6}}>"{r.com}"</div>}
            {r.ia && <div className="hcia">{r.ia}</div>}
          </div>
        )
      })}
    </div>
  )
}
