import React, { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

export default function Dashboard({ rides, profile }) {
  const nav = useNavigate()
  const chartRef = useRef(null)
  const chartInst = useRef(null)

  const totalKm = rides.reduce((a,r)=>a+(r.dist||0),0)
  const totalMin = rides.reduce((a,r)=>a+(r.dur||0),0)
  const now = new Date()
  const ws = new Date(); ws.setDate(now.getDate()-7)
  const weekRides = rides.filter(r=>new Date(r.iso)>ws)
  const tss = weekRides.reduce((a,r)=>a+Math.round((r.dur/60)*Math.pow((r.rpe||5)/10,2)*100),0)

  useEffect(() => {
    if (!chartRef.current) return
    if (chartInst.current) chartInst.current.destroy()
    const weeks=[], loads=[]
    for (let w=7; w>=0; w--) {
      const we=new Date(); we.setDate(we.getDate()-w*7)
      const wst=new Date(we); wst.setDate(we.getDate()-7)
      weeks.push(wst.toLocaleDateString('es-MX',{day:'numeric',month:'short'}))
      const wr=rides.filter(r=>{const d=new Date(r.iso);return d>=wst&&d<we})
      loads.push(wr.reduce((a,r)=>a+Math.round((r.dur/60)*Math.pow((r.rpe||5)/10,2)*100),0))
    }
    chartInst.current = new Chart(chartRef.current, {
      type:'bar',
      data:{labels:weeks,datasets:[{data:loads,backgroundColor:'rgba(168,213,162,0.3)',borderColor:'rgba(168,213,162,0.8)',borderWidth:1,borderRadius:4}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#5c5a55',font:{size:10}},grid:{color:'rgba(255,255,255,0.04)'}},y:{ticks:{color:'#5c5a55',font:{size:10}},grid:{color:'rgba(255,255,255,0.04)'},beginAtZero:true}}}
    })
    return () => chartInst.current?.destroy()
  }, [rides])

  const last = rides[0]
  let rec = ''
  if (last) {
    const z45 = ((last.zp||[])[3]||0)+((last.zp||[])[4]||0)
    if (last.rpe>=8||last.sen==='muy cansado') rec = <div className="al aw">RPE {last.rpe} en tu última rodada. Prioriza recuperación activa: 30-45 min en Z1-Z2 o descanso completo.</div>
    else if (z45>55) rec = <div className="al aw">Alto tiempo en Z4-Z5. El modelo polarizado (Seiler 2010) recomienda 80% del volumen en baja intensidad.</div>
    else if (last.sen==='muy bien'&&last.rpe<=5) rec = <div className="al ai">Excelente recuperación. Puedes incrementar duración 5-10% (principio de sobrecarga progresiva).</div>
    else rec = <div className="al ai">Continúa con tu ritmo. La consistencia es el factor #1 de progreso a largo plazo.</div>
  }

  return (
    <div className="page">
      <div className="ph">
        <h1>Buenos días, <em>{profile.nombre||'ciclista'}</em></h1>
        <p>{now.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
      </div>

      <div className="g4" style={{marginBottom:20}}>
        <div className="sc"><div className="sl">Rodadas</div><div className="sv">{rides.length}</div><div className="st">total</div></div>
        <div className="sc"><div className="sl">Horas</div><div className="sv">{(totalMin/60).toFixed(1)}<span>h</span></div><div className="st">acumuladas</div></div>
        <div className="sc"><div className="sl">Kilómetros</div><div className="sv">{Math.round(totalKm)}<span>km</span></div><div className="st">total</div></div>
        <div className="sc"><div className="sl">Carga semanal</div><div className="sv">{tss||'—'}</div><div className="st">TSS estimado</div></div>
      </div>

      <div className="g2" style={{marginBottom:20}}>
        <div className="card">
          <div className="stit">Última rodada</div>
          {last ? (
            <>
              <div style={{fontSize:15,fontWeight:500,marginBottom:6}}>{last.name||'Rodada'}</div>
              <div style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--fm)',marginBottom:10}}>{last.fecha}</div>
              <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
                {last.dur&&<span style={{fontSize:13,color:'var(--text2)'}}>{Math.round(last.dur)}<strong style={{color:'var(--text)'}}> min</strong></span>}
                {last.dist&&<span style={{fontSize:13,color:'var(--text2)'}}>{last.dist.toFixed(1)}<strong style={{color:'var(--text)'}}> km</strong></span>}
                {last.dur>0&&<span style={{fontSize:13,color:'var(--text2)'}}>{((last.dist||0)/(last.dur/60)).toFixed(1)}<strong style={{color:'var(--text)'}}> km/h</strong></span>}
                <span style={{fontSize:13,color:'var(--text2)'}}>RPE <strong style={{color:'var(--text)'}}>{last.rpe}</strong></span>
              </div>
              {last.ia&&<div style={{fontSize:12,color:'var(--green2)',marginTop:10,lineHeight:1.6,borderTop:'1px solid var(--border)',paddingTop:8}}>{last.ia.substring(0,200)}{last.ia.length>200?'…':''}</div>}
            </>
          ) : <p style={{color:'var(--text3)',fontSize:13}}>Sin rodadas aún. <button className="btn bs" style={{marginLeft:8}} onClick={()=>nav('/registrar')}>Registrar primera</button></p>}
        </div>
        <div className="card">
          <div className="stit">Recomendación IA</div>
          {rec || <p style={{color:'var(--text3)',fontSize:13}}>Registra tu primera rodada para recibir recomendaciones.</p>}
        </div>
      </div>

      <div className="card">
        <div className="stit">Carga de entrenamiento — últimas 8 semanas (TSS estimado)</div>
        <div style={{position:'relative',height:200,marginTop:12}}>
          <canvas ref={chartRef}/>
        </div>
      </div>
    </div>
  )
}
