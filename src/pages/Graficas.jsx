import React, { useEffect, useRef, useState } from 'react'
import { Chart, registerables } from 'chart.js'
import IABox from '../components/IABox'
import { callIA, buildTrendPrompt } from '../hooks/useIA'
Chart.register(...registerables)

const ZC = ['#6db86a','#a8d5a2','#e8c97a','#e09850','#e07070']
const ZL = ['Z1 Recuperación','Z2 Base aeróbica','Z3 Tempo','Z4 Umbral','Z5 VO2max']

const CO = {
  responsive:true, maintainAspectRatio:false,
  plugins:{ legend:{ display:false } },
  scales:{
    x:{ ticks:{color:'#5c5a55',font:{size:10}}, grid:{color:'rgba(255,255,255,0.04)'} },
    y:{ ticks:{color:'#5c5a55',font:{size:10}}, grid:{color:'rgba(255,255,255,0.04)'}, beginAtZero:false }
  }
}

// Helper: read cadence regardless of field name (Grok uses 'cadence', we use 'cad')
function getCad(r) { return Math.round(r.cad || r.cadence || 0) }

// Helper: read zones regardless of format
function getZP(r) {
  if (Array.isArray(r.zp) && r.zp.length === 5) return r.zp
  if (Array.isArray(r.zones) && r.zones.length === 5) return r.zones
  return null
}

// Helper: read FC
function getHR(r) { return Math.round(r.hrAvg || r.hr_avg || r.averageHr || 0) }

function MiniChart({ type='line', data, labels, color, fill=false, height=180, opts={} }) {
  const ref  = useRef()
  const inst = useRef()
  useEffect(() => {
    if (!ref.current) return
    inst.current?.destroy()
    const datasets = [{
      data,
      borderColor: color,
      backgroundColor: fill ? color+'22' : 'transparent',
      fill,
      tension: 0.35,
      pointRadius: 3,
      pointBackgroundColor: color,
      borderRadius: type==='bar' ? 4 : undefined,
    }]
    inst.current = new Chart(ref.current, {
      type,
      data: { labels, datasets },
      options: { ...CO, ...opts }
    })
    return () => inst.current?.destroy()
  }, [JSON.stringify(data), JSON.stringify(labels)])
  return <div style={{height,marginTop:8}}><canvas ref={ref}/></div>
}

function DualLineChart({ labels, data1, data2, color1, color2, label1, label2, height=180 }) {
  const ref  = useRef()
  const inst = useRef()
  useEffect(() => {
    if (!ref.current) return
    inst.current?.destroy()
    inst.current = new Chart(ref.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { data:data1, borderColor:color1, backgroundColor:'transparent', tension:0.3, pointRadius:3, pointBackgroundColor:color1, label:label1 },
          { data:data2, borderColor:color2, backgroundColor:'transparent', tension:0.3, pointRadius:3, pointBackgroundColor:color2, label:label2, borderDash:[4,3] }
        ]
      },
      options: { ...CO, plugins:{ legend:{ display:true, labels:{ color:'#9a9690', font:{size:11} } } } }
    })
    return () => inst.current?.destroy()
  }, [JSON.stringify(data1), JSON.stringify(data2)])
  return <div style={{height,marginTop:8}}><canvas ref={ref}/></div>
}

function CadenceChart({ labels, cads, height=180 }) {
  const ref  = useRef()
  const inst = useRef()
  useEffect(() => {
    if (!ref.current) return
    inst.current?.destroy()
    const validCads = cads.filter(c=>c>0)
    const minY = validCads.length ? Math.max(0, Math.min(...validCads)-15) : 0
    const maxY = validCads.length ? Math.max(...validCads)+15 : 120

    inst.current = new Chart(ref.current, {
      type: 'line',
      data: {
        labels,
        datasets:[{
          data: cads,
          borderColor:'#e8c97a',
          backgroundColor:'transparent',
          tension:0.3,
          pointRadius: cads.map(c => c !== null ? 4 : 0),
          pointBackgroundColor: cads.map(c => c !== null && c>=80&&c<=100?'#6db86a':'#e8c97a'),
          spanGaps: true,
          label:'Cadencia'
        }]
      },
      options: {
        ...CO,
        scales:{
          x: CO.scales.x,
          y: { ...CO.scales.y, min:minY, max:maxY }
        }
      },
      plugins:[{
        id:'optimalBand',
        beforeDraw(chart) {
          const { ctx, chartArea, scales:{ y } } = chart
          if (!chartArea) return
          const y80  = y.getPixelForValue(80)
          const y100 = y.getPixelForValue(100)
          ctx.save()
          ctx.fillStyle = 'rgba(109,184,106,0.1)'
          ctx.fillRect(chartArea.left, Math.min(y80,y100), chartArea.width, Math.abs(y100-y80))
          ctx.strokeStyle = 'rgba(109,184,106,0.4)'
          ctx.lineWidth = 1
          ctx.setLineDash([4,3])
          ;[y80,y100].forEach(y => {
            ctx.beginPath(); ctx.moveTo(chartArea.left,y); ctx.lineTo(chartArea.right,y); ctx.stroke()
          })
          ctx.restore()
        }
      }]
    })
    return () => inst.current?.destroy()
  }, [JSON.stringify(cads), JSON.stringify(labels)])
  return <div style={{height,marginTop:8}}><canvas ref={ref}/></div>
}

function ZoneBarChart({ tzAvg, height=200 }) {
  const ref  = useRef()
  const inst = useRef()
  useEffect(() => {
    if (!ref.current) return
    inst.current?.destroy()
    inst.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels: ZL,
        datasets:[{ data:tzAvg, backgroundColor:ZC, borderRadius:4 }]
      },
      options:{
        ...CO,
        indexAxis:'y',
        plugins:{ legend:{ display:false } },
        scales:{
          x:{ ticks:{color:'#5c5a55',font:{size:10}}, grid:{color:'rgba(255,255,255,0.04)'}, beginAtZero:true },
          y:{ ticks:{color:'#9a9690',font:{size:11}}, grid:{color:'rgba(255,255,255,0.04)'} }
        }
      }
    })
    return () => inst.current?.destroy()
  }, [JSON.stringify(tzAvg)])
  return <div style={{height,marginTop:8}}><canvas ref={ref}/></div>
}

export default function Graficas({ rides }) {
  const [iaText, setIaText]     = useState('')
  const [iaLoaded, setIaLoaded] = useState(false)

  useEffect(() => {
    if (rides.length >= 5 && !iaLoaded) {
      setIaLoaded(true)
      setIaText('Analizando...')
      callIA(buildTrendPrompt(rides), 350).then(t => setIaText(t))
    }
  }, [rides.length])

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

  // Speed — handle both field names
  const speeds = last.map(r => {
    const s = r.speed || r.average_speed
    if (s && s > 0) return parseFloat(parseFloat(s).toFixed(1))
    return r.dur>0 ? parseFloat(((r.dist||0)/(r.dur/60)).toFixed(1)) : 0
  })

  // HR
  const hrsRaw = last.map(r => getHR(r))
  const hasHR  = hrsRaw.some(h => h > 0)
  // Replace 0 FC with null so Chart.js skips those points (no distortion)
  const hrs    = hrsRaw.map(h => h > 0 ? h : null)

  // Cadence — dual field support
  const cadsRaw = last.map(r => getCad(r))
  const hasCad  = cadsRaw.some(c => c > 0)
  const cads    = cadsRaw.map(c => c > 0 ? c : null)

  // Estimate cadPctOptimal for rides that only have avg cadence
  function estimateCadPct(cadAvg) {
    if (!cadAvg || cadAvg < 20) return 0
    const std = 12
    function erf(x) { const a=0.147,s=x<0?-1:1,x2=x*x; return s*Math.sqrt(1-Math.exp(-x2*(4/Math.PI+a*x2)/(1+a*x2))) }
    function ncdf(x) { return 0.5*(1+erf((x-cadAvg)/(std*Math.SQRT2))) }
    return Math.round(Math.max(0,Math.min(100,(ncdf(100)-ncdf(80))*100)))
  }
  const ridesWithCadPct = rides.filter(r => getCad(r) > 0).map(r => ({
    ...r, cadPctOptimal: r.cadPctOptimal > 0 ? r.cadPctOptimal : estimateCadPct(getCad(r))
  }))

  // RPE & zones
  const rpes = last.map(r => r.rpe || 0)
  const z45s = last.map(r => {
    const zp = getZP(r)
    return zp ? (zp[3]||0)+(zp[4]||0) : 0
  })

  // Watts
  const watts    = last.map(r => r.watts || r.average_watts || 0)
  const hasWatts = watts.some(w => w > 0)

  // Weekly volume
  const wd = {}
  rides.forEach(r => {
    const d   = new Date(r.iso)
    const mon = new Date(d); mon.setDate(d.getDate()-((d.getDay()+6)%7))
    const wk  = mon.toLocaleDateString('es-MX',{day:'numeric',month:'short'})
    wd[wk] = (wd[wk]||0)+(r.dur||0)
  })
  const wks = Object.keys(wd).slice(-8)

  // Zone distribution — accumulate across all rides
  const tz = [0,0,0,0,0]
  let ridesWithZones = 0
  rides.forEach(r => {
    const zp = getZP(r)
    if (zp && zp.some(v=>v>0)) {
      zp.forEach((p,i) => tz[i]+=p)
      ridesWithZones++
    }
  })
  const tzAvg       = ridesWithZones > 0 ? tz.map(v => Math.round(v/ridesWithZones)) : []
  const hasZoneData = tzAvg.length > 0 && tzAvg.some(v => v > 0)

  // Polarization
  const lowPct  = hasZoneData ? tzAvg[0]+tzAvg[1] : 0
  const highPct = hasZoneData ? tzAvg[3]+tzAvg[4] : 0

  return (
    <div className="page">
      <div className="ph">
        <h1>Gráficas de <em>progreso</em></h1>
        <p>Detecta mejoras, estancamiento y distribución de carga</p>
      </div>

      {/* Speed + HR */}
      <div className="g2" style={{marginBottom:20}}>
        <div className="card">
          <div className="stit">Velocidad promedio (km/h)</div>
          <MiniChart labels={labels} data={speeds} color="#a8d5a2" fill height={180}/>
        </div>
        <div className="card">
          <div className="stit">FC promedio por rodada (lpm)</div>
          {hasHR
            ? <MiniChart labels={labels} data={hrs} color="#7ab8e8" fill height={180}/>
            : <div style={{height:180,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text3)',fontSize:13}}>Sin datos de FC en estas rodadas</div>
          }
        </div>
      </div>

      {/* Cadence */}
      {hasCad ? (
        <div className="card" style={{marginBottom:20}}>
          <div className="stit">Cadencia promedio (rpm)</div>
          <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>Banda verde = rango óptimo 80-100 rpm · puntos verdes = dentro del rango (Lucia et al. 2001)</div>
          <CadenceChart labels={labels} cads={cads} height={190}/>
          <div style={{display:'flex',gap:20,marginTop:8,fontSize:11,fontFamily:'var(--fm)',color:'var(--text3)'}}>
            <span>Promedio: <strong style={{color:'var(--text)'}}>{Math.round(cads.filter(c=>c>0).reduce((a,b)=>a+b,0)/Math.max(cads.filter(c=>c>0).length,1))} rpm</strong></span>
            <span>En rango óptimo: <strong style={{color:'#6db86a'}}>{cads.filter(c=>c>=80&&c<=100).length}/{cads.filter(c=>c>0).length} rodadas</strong></span>
          </div>
        </div>
      ) : (
        <div className="card" style={{marginBottom:20,padding:'14px 18px'}}>
          <div className="stit">Cadencia</div>
          <p style={{fontSize:13,color:'var(--text3)',marginTop:8}}>Sin datos de cadencia aún. Se mostrará cuando sincronices rodadas con sensor de cadencia.</p>
        </div>
      )}

      {/* Watts */}
      {hasWatts && (
        <div className="card" style={{marginBottom:20}}>
          <div className="stit">Potencia estimada (W)</div>
          <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>Calculada por física: resistencia rodadura + aerodinámica + gravedad</div>
          <MiniChart labels={labels} data={watts} color="#e09850" fill={true} height={160}
            opts={{...CO,scales:{...CO.scales,y:{...CO.scales.y,beginAtZero:true}}}}/>
        </div>
      )}

      {/* Weekly + RPE vs Z45 */}
      <div className="g2" style={{marginBottom:20}}>
        <div className="card">
          <div className="stit">Duración semanal acumulada (min)</div>
          <MiniChart type="bar" labels={wks} data={wks.map(w=>Math.round(wd[w]))}
            color="#7ab8e8" height={180}
            opts={{...CO,scales:{...CO.scales,y:{...CO.scales.y,beginAtZero:true}}}}/>
        </div>
        <div className="card">
          <div className="stit">RPE vs Zona alta (Z4+Z5 % ÷10)</div>
          <DualLineChart labels={labels} data1={rpes} data2={z45s.map(v=>v/10)}
            color1="#e09850" color2="#e07070" label1="RPE" label2="Z4+Z5/10" height={180}/>
        </div>
      </div>

      {/* Zone distribution */}
      <div className="card" style={{marginBottom:20}}>
        <div className="stit">Distribución de zonas FC — promedio acumulado</div>
        {hasZoneData ? (
          <>
            <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>
              Basado en <strong style={{color:'var(--text)'}}>{ridesWithZones}</strong> rodadas con FC ·
              Polarización: <strong style={{color:lowPct>=70?'#6db86a':'#e09850'}}>{lowPct}%</strong> baja /
              <strong style={{color:highPct>40?'#e09850':'var(--text2)',marginLeft:4}}>{highPct}%</strong> alta · ideal 80/20 (Seiler 2010)
            </div>
            <ZoneBarChart tzAvg={tzAvg} height={200}/>
          </>
        ) : (
          <div style={{padding:'20px 0',color:'var(--text3)',fontSize:13}}>
            Sin datos de zonas FC aún. Se mostrarán cuando sincronices rodadas con sensor de FC o importes GPX con datos de ritmo cardíaco.
          </div>
        )}
      </div>

      {(iaText||rides.length>=5) && (
        <IABox text={iaText} label="Análisis de tendencia IA" loading={iaText==='Analizando...'}/>
      )}
    </div>
  )
}
