import React, { useEffect, useRef, useState } from 'react'
import { Chart, registerables } from 'chart.js'
import IABox from '../components/IABox'
import { callIA, buildTrendPrompt } from '../hooks/useIA'
Chart.register(...registerables)

const ZC = ['#6db86a','#a8d5a2','#e8c97a','#e09850','#e07070']
const CO = {
  responsive:true, maintainAspectRatio:false,
  plugins:{ legend:{ display:false } },
  scales:{
    x:{ ticks:{color:'#5c5a55',font:{size:10}}, grid:{color:'rgba(255,255,255,0.04)'} },
    y:{ ticks:{color:'#5c5a55',font:{size:10}}, grid:{color:'rgba(255,255,255,0.04)'}, beginAtZero:false }
  }
}

function useChart(ref, config, deps) {
  const inst = useRef()
  useEffect(() => {
    if (!ref.current) return
    inst.current?.destroy()
    inst.current = new Chart(ref.current, config)
    return () => inst.current?.destroy()
  }, deps)
}

function LineChart({ id, labels, datasets, opts={} }) {
  const ref = useRef()
  useChart(ref, { type:'line', data:{labels,datasets}, options:{...CO,...opts} }, [labels,datasets])
  return <canvas ref={ref}/>
}

function BarChart({ labels, data, colors, opts={} }) {
  const ref = useRef()
  useChart(ref, { type:'bar', data:{labels,datasets:[{data,backgroundColor:colors,borderRadius:4}]}, options:{...CO,...opts} }, [labels,data])
  return <canvas ref={ref}/>
}

export default function Graficas({ rides }) {
  const [iaText, setIaText]     = useState('')
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

  const last   = rides.slice(0,20).reverse()
  const labels = last.map(r => r.fecha)
  const speeds = last.map(r => parseFloat(r.speed||(r.dur>0?((r.dist||0)/(r.dur/60)).toFixed(1):0)))
  const hrs    = last.map(r => Math.round(r.hrAvg||0))
  const rpes   = last.map(r => r.rpe||0)
  const z45s   = last.map(r => ((r.zp||[])[3]||0)+((r.zp||[])[4]||0))
  const cads   = last.map(r => Math.round(r.cad||0))
  const watts  = last.map(r => r.watts||0)
  const hasCad = cads.some(c => c > 0)
  const hasWatts = watts.some(w => w > 0)

  // Weekly duration
  const wd = {}
  rides.forEach(r => {
    const d = new Date(r.iso)
    const mon = new Date(d); mon.setDate(d.getDate()-((d.getDay()+6)%7))
    const wk = mon.toLocaleDateString('es-MX',{day:'numeric',month:'short'})
    wd[wk] = (wd[wk]||0) + (r.dur||0)
  })
  const wks = Object.keys(wd).slice(-8)

  // Zone totals
  const tz = [0,0,0,0,0]
  rides.forEach(r => (r.zp||[]).forEach((p,i) => tz[i]+=p))
  const tzAvg = tz.map(v => Math.round(v/rides.length))

  useEffect(() => {
    if (rides.length >= 5 && !iaLoaded) {
      setIaLoaded(true)
      setIaText('Analizando...')
      callIA(buildTrendPrompt(rides), 350).then(t => setIaText(t))
    }
  }, [rides.length])

  // Cadence chart with optimal band annotation
  const cadRef = useRef()
  useEffect(() => {
    if (!cadRef.current || !hasCad) return
    const existing = Chart.getChart(cadRef.current)
    if (existing) existing.destroy()

    new Chart(cadRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            data: cads,
            borderColor: '#e8c97a',
            backgroundColor: 'transparent',
            tension: 0.3,
            pointRadius: 3,
            pointBackgroundColor: '#e8c97a',
            label: 'Cadencia (rpm)'
          }
        ]
      },
      options: {
        ...CO,
        plugins: {
          legend: { display: false },
          annotation: undefined
        },
        scales: {
          ...CO.scales,
          y: {
            ...CO.scales.y,
            min: Math.max(0, Math.min(...cads.filter(c=>c>0)) - 10),
            max: Math.max(...cads) + 10,
            ticks: { color:'#5c5a55', font:{size:10} },
            grid: { color:'rgba(255,255,255,0.04)' }
          }
        }
      },
      plugins: [{
        id: 'optimalBand',
        beforeDraw(chart) {
          const { ctx, chartArea: { top, bottom }, scales: { y } } = chart
          const y1 = y.getPixelForValue(80)
          const y2 = y.getPixelForValue(100)
          ctx.save()
          ctx.fillStyle = 'rgba(109,184,106,0.12)'
          ctx.fillRect(chart.chartArea.left, Math.min(y1,y2), chart.chartArea.width, Math.abs(y2-y1))
          ctx.strokeStyle = 'rgba(109,184,106,0.4)'
          ctx.lineWidth = 1
          ctx.setLineDash([4,3])
          ctx.beginPath(); ctx.moveTo(chart.chartArea.left,y1); ctx.lineTo(chart.chartArea.right,y1); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(chart.chartArea.left,y2); ctx.lineTo(chart.chartArea.right,y2); ctx.stroke()
          ctx.restore()
        }
      }]
    })
  }, [cads, labels])

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

      {/* Cadence chart */}
      {hasCad && (
        <div className="card" style={{marginBottom:20}}>
          <div className="stit">Cadencia promedio (rpm)</div>
          <div style={{fontSize:11,color:'var(--text3)',marginTop:2,marginBottom:8}}>Banda verde = rango óptimo 80-100 rpm (Lucia et al. 2001)</div>
          <div style={{height:200}}>
            <canvas ref={cadRef}/>
          </div>
          {cads.filter(c=>c>0).length > 0 && (
            <div style={{fontSize:11,color:'var(--text3)',marginTop:8,fontFamily:'var(--fm)'}}>
              Promedio: <strong style={{color:'var(--text)'}}>{Math.round(cads.filter(c=>c>0).reduce((a,b)=>a+b,0)/cads.filter(c=>c>0).length)} rpm</strong>
              {rides.some(r=>r.cadPctOptimal>0) && (
                <span style={{marginLeft:16}}>% tiempo óptimo prom: <strong style={{color:'var(--text)'}}>{Math.round(rides.filter(r=>r.cadPctOptimal>0).reduce((a,r)=>a+r.cadPctOptimal,0)/rides.filter(r=>r.cadPctOptimal>0).length)}%</strong></span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Watts chart */}
      {hasWatts && (
        <div className="card" style={{marginBottom:20}}>
          <div className="stit">Potencia estimada (W)</div>
          <div style={{fontSize:11,color:'var(--text3)',marginTop:2,marginBottom:8}}>Calculada por física: resistencia rodadura + aerodinámica + gravedad</div>
          <div style={{height:180,marginTop:4}}>
            <LineChart labels={labels} datasets={[{data:watts,borderColor:'#e09850',backgroundColor:'rgba(224,152,80,0.15)',fill:true,tension:0.3,pointRadius:3,pointBackgroundColor:'#e09850'}]}/>
          </div>
        </div>
      )}

      <div className="g2" style={{marginBottom:20}}>
        <div className="card">
          <div className="stit">Duración semanal (min)</div>
          <div style={{height:200,marginTop:12}}>
            <LineChart labels={wks} datasets={[{data:wks.map(w=>Math.round(wd[w])),borderColor:'#7ab8e8',backgroundColor:'rgba(122,184,232,0.2)',fill:true,tension:0.3,pointRadius:3,pointBackgroundColor:'#7ab8e8'}]}
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
        <div style={{fontSize:11,color:'var(--text3)',marginTop:2,marginBottom:8}}>
          Polarización actual: <strong style={{color:'var(--text)'}}>{tzAvg[0]+tzAvg[1]}%</strong> baja intensidad / <strong style={{color:'var(--text)'}}>{tzAvg[3]+tzAvg[4]}%</strong> alta · ideal 80/20 (Seiler 2010)
        </div>
        <div style={{height:200,marginTop:4}}>
          <BarChart
            labels={['Z1 recuperación','Z2 base aeróbica','Z3 tempo','Z4 umbral','Z5 VO2max']}
            data={tzAvg} colors={ZC}
            opts={{...CO,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#5c5a55',font:{size:10}},grid:{color:'rgba(255,255,255,0.04)'},beginAtZero:true},y:{ticks:{color:'#9a9690',font:{size:11}},grid:{color:'rgba(255,255,255,0.04)'}}}}}/>
        </div>
      </div>

      {(iaText||rides.length>=5) && <IABox text={iaText} label="Análisis de tendencia IA" loading={iaText==='Analizando...'}/>}
    </div>
  )
}
