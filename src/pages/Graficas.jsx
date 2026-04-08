import React, { useEffect, useRef, useState } from 'react'
import { Chart, registerables } from 'chart.js'
import IABox from '../components/IABox'
import { callIA, buildTrendPrompt } from '../hooks/useIA'
Chart.register(...registerables)

const ZC = ['#6db86a','#a8d5a2','#e8c97a','#e09850','#e07070']
const CO = { responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#5c5a55',font:{size:10}},grid:{color:'rgba(255,255,255,0.04)'}},y:{ticks:{color:'#5c5a55',font:{size:10}},grid:{color:'rgba(255,255,255,0.04)'},beginAtZero:false}} }

function LineChart({ id, labels, datasets, opts = {} }) {
  const ref = useRef(); const inst = useRef()
  useEffect(() => {
    if (!ref.current) return
    inst.current?.destroy()
    inst.current = new Chart(ref.current, { type:'line', data:{labels,datasets}, options:{...CO,...opts} })
    return () => inst.current?.destroy()
  }, [labels, datasets])
  return <canvas ref={ref}/>
}

export default function Graficas({ rides }) {
  const [iaText, setIaText] = useState('')
  const [iaLoaded, setIaLoaded] = useState(false)

  if (rides.length < 3) return (
    <div className="page">
      <div className="ph"><h1>Gráficas de <em>progreso</em></h1></div>
      <div className="empty">
        <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        <p>Registra al menos 3 rodadas para ver tus gráficas</p>
      </div>
    </div>
  )

  const last = rides.slice(0,20).reverse()
  const labels = last.map(r=>r.fecha)
  const speeds = last.map(r=>r.dur>0?parseFloat(((r.dist||0)/(r.dur/60)).toFixed(1)):0)
  const hrs = last.map(r=>Math.round(r.hrAvg||0))
  const rpes = last.map(r=>r.rpe||0)
  const z45s = last.map(r=>((r.zp||[])[3]||0)+((r.zp||[])[4]||0))

  const wd = {}
  rides.forEach(r=>{const d=new Date(r.iso);const wk=`S${Math.ceil(d.getDate()/7)} ${d.toLocaleDateString('es-MX',{month:'short'})}`;wd[wk]=(wd[wk]||0)+(r.dur||0)})
  const wks = Object.keys(wd).slice(-8)

  const tz = [0,0,0,0,0]
  rides.forEach(r=>(r.zp||[]).forEach((p,i)=>tz[i]+=p))
  const tzAvg = tz.map(v=>Math.round(v/rides.length))

  async function loadIA() {
    if (iaLoaded) return
    setIaLoaded(true)
    setIaText('Analizando...')
    const t = await callIA(buildTrendPrompt(rides), 300)
    setIaText(t)
  }

  useEffect(()=>{ if(rides.length>=5&&!iaLoaded) loadIA() },[rides.length])

  return (
    <div className="page">
      <div className="ph">
        <h1>Gráficas de <em>progreso</em></h1>
        <p>Detecta mejoras, estancamiento y distribución de carga</p>
      </div>

      <div className="g2" style={{marginBottom:20}}>
        <div className="card">
          <div className="stit">Velocidad promedio (km/h)</div>
          <div style={{height:200,marginTop:12}}>
            <LineChart labels={labels} datasets={[{data:speeds,borderColor:'#a8d5a2',backgroundColor:'#a8d5a222',fill:true,tension:0.35,pointRadius:3,pointBackgroundColor:'#a8d5a2'}]}/>
          </div>
        </div>
        <div className="card">
          <div className="stit">FC promedio por rodada (lpm)</div>
          <div style={{height:200,marginTop:12}}>
            <LineChart labels={labels} datasets={[{data:hrs,borderColor:'#7ab8e8',backgroundColor:'#7ab8e822',fill:true,tension:0.35,pointRadius:3,pointBackgroundColor:'#7ab8e8'}]}/>
          </div>
        </div>
      </div>

      <div className="g2" style={{marginBottom:20}}>
        <div className="card">
          <div className="stit">Duración semanal acumulada (min)</div>
          <div style={{height:200,marginTop:12}}>
            <LineChart labels={wks} datasets={[{data:wks.map(w=>Math.round(wd[w])),borderColor:'#7ab8e8',backgroundColor:'rgba(122,184,232,0.25)',fill:true,tension:0.3,pointRadius:3,pointBackgroundColor:'#7ab8e8'}]}
              opts={{...CO,scales:{...CO.scales,y:{...CO.scales.y,beginAtZero:true}}}}/>
          </div>
        </div>
        <div className="card">
          <div className="stit">RPE vs Zona alta (Z4+Z5 % ÷10)</div>
          <div style={{height:200,marginTop:12}}>
            <LineChart labels={labels}
              datasets={[
                {data:rpes,borderColor:'#e09850',backgroundColor:'transparent',tension:0.3,pointRadius:3,pointBackgroundColor:'#e09850',label:'RPE'},
                {data:z45s.map(v=>v/10),borderColor:'#e07070',backgroundColor:'transparent',tension:0.3,pointRadius:3,pointBackgroundColor:'#e07070',label:'Z4+Z5/10',borderDash:[4,3]}
              ]}
              opts={{...CO,plugins:{legend:{display:true,labels:{color:'#9a9690',font:{size:11}}}}}}/>
          </div>
        </div>
      </div>

      <div className="card" style={{marginBottom:20}}>
        <div className="stit">Distribución de zonas FC — promedio acumulado</div>
        <div style={{height:220,marginTop:12}}>
          <BarChart labels={['Z1 recuperación','Z2 base aeróbica','Z3 tempo','Z4 umbral','Z5 VO2max']} data={tzAvg} colors={ZC}/>
        </div>
      </div>

      {(iaText||rides.length>=5) && <IABox text={iaText} label="Análisis de tendencia IA" loading={iaText==='Analizando...'}/>}
    </div>
  )
}

function BarChart({ labels, data, colors }) {
  const ref = useRef(); const inst = useRef()
  useEffect(() => {
    if (!ref.current) return
    inst.current?.destroy()
    inst.current = new Chart(ref.current, {
      type:'bar',
      data:{labels,datasets:[{data,backgroundColor:colors,borderRadius:4}]},
      options:{...CO,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#5c5a55',font:{size:10}},grid:{color:'rgba(255,255,255,0.04)'},beginAtZero:true},y:{ticks:{color:'#9a9690',font:{size:11}},grid:{color:'rgba(255,255,255,0.04)'}}}}
    })
    return () => inst.current?.destroy()
  }, [labels, data])
  return <canvas ref={ref}/>
}
