import React, { useState } from 'react'
import { estimateZonesFromHR } from '../components/ZoneBars'

const ZC     = ['#6db86a','#a8d5a2','#e8c97a','#e09850','#e07070']
const ZLABEL = ['Z1','Z2','Z3','Z4','Z5']

function getZP(r) {
  if (Array.isArray(r.zp)    && r.zp.length    === 5) return r.zp
  if (Array.isArray(r.zones) && r.zones.length  === 5) return r.zones
  return null
}
function getCad(r)  { return Math.round(r.cad || r.cadence || 0) }
function getHR(r)   { return Math.round(r.hrAvg || r.hr_avg || 0) }
function getSpeed(r){ return r.speed || (r.dur > 0 ? ((r.dist||0)/(r.dur/60)).toFixed(1) : 0) }

// Bell-curve estimate of cadence % in optimal range
function estimateCadPct(cadAvg) {
  if (!cadAvg || cadAvg < 20) return null // null = no data
  const std = 12
  function erf(x) {
    const a=0.147, s=x<0?-1:1, x2=x*x
    return s*Math.sqrt(1-Math.exp(-x2*(4/Math.PI+a*x2)/(1+a*x2)))
  }
  function ncdf(x) { return 0.5*(1+erf((x-cadAvg)/(std*Math.SQRT2))) }
  return Math.round(Math.max(0,Math.min(100,(ncdf(100)-ncdf(80))*100)))
}

// Donut chart SVG — only renders when there's real data
function DonutZones({ zp, size=88 }) {
  const cx=size/2, cy=size/2, R=size*0.42, r=size*0.26
  let angle=-90
  const paths=[]

  zp.forEach((val,i) => {
    if (val<=0) return
    const sweep=(val/100)*360
    const toRad=a=>a*Math.PI/180
    const x1=cx+R*Math.cos(toRad(angle)),   y1=cy+R*Math.sin(toRad(angle))
    const x2=cx+R*Math.cos(toRad(angle+sweep)), y2=cy+R*Math.sin(toRad(angle+sweep))
    const xi1=cx+r*Math.cos(toRad(angle)),  yi1=cy+r*Math.sin(toRad(angle))
    const xi2=cx+r*Math.cos(toRad(angle+sweep)), yi2=cy+r*Math.sin(toRad(angle+sweep))
    const large=sweep>180?1:0
    paths.push(<path key={i}
      d={`M${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2} L${xi2},${yi2} A${r},${r} 0 ${large} 0 ${xi1},${yi1}Z`}
      fill={ZC[i]} opacity={0.92}/>)
    angle+=sweep
  })

  const maxIdx=zp.indexOf(Math.max(...zp))
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{flexShrink:0}}>
      {paths}
      <text x={cx} y={cy-3} textAnchor="middle" fontSize={size*0.14} fontWeight="700"
        fill={ZC[maxIdx]} fontFamily="var(--fm)">Z{maxIdx+1}</text>
      <text x={cx} y={cy+11} textAnchor="middle" fontSize={size*0.12}
        fill={ZC[maxIdx]} fontFamily="var(--fm)">{zp[maxIdx]}%</text>
    </svg>
  )
}

// Horizontal zone bars
function ZoneBarsH({ zp }) {
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',gap:5}}>
      {zp.map((p,i) => p>0 ? (
        <div key={i} style={{display:'flex',alignItems:'center',gap:7}}>
          <span style={{fontSize:10,fontFamily:'var(--fm)',color:ZC[i],width:18,flexShrink:0}}>{ZLABEL[i]}</span>
          <div style={{flex:1,height:5,background:'var(--bg4)',borderRadius:3,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${p}%`,background:ZC[i],borderRadius:3,transition:'width .4s'}}/>
          </div>
          <span style={{fontSize:10,fontFamily:'var(--fm)',color:ZC[i],width:26,textAlign:'right'}}>{p}%</span>
        </div>
      ) : null)}
    </div>
  )
}

// Cadence zone bars (simplified: below/optimal/above)
function CadZones({ cadAvg, cadPct }) {
  if (!cadAvg || cadAvg < 20) return null
  const std = 12
  function erf(x) {
    const a=0.147, s=x<0?-1:1, x2=x*x
    return s*Math.sqrt(1-Math.exp(-x2*(4/Math.PI+a*x2)/(1+a*x2)))
  }
  function ncdf(x) { return 0.5*(1+erf((x-cadAvg)/(std*Math.SQRT2))) }
  const below   = Math.round(ncdf(80)*100)
  const optimal = cadPct
  const above   = Math.max(0, 100 - below - optimal)

  const zones = [
    { label:'< 80 rpm', pct:below,   color:'#e09850', hint:'Fuerza/baja cadencia' },
    { label:'80-100',   pct:optimal, color:'#6db86a', hint:'Rango óptimo' },
    { label:'> 100 rpm',pct:above,   color:'#7ab8e8', hint:'Alta cadencia' },
  ]

  return (
    <div style={{marginTop:10}}>
      <div style={{fontSize:10,fontFamily:'var(--fm)',color:'var(--text3)',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.5px'}}>
        Distribución de cadencia estimada
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:4}}>
        {zones.map(z => z.pct > 0 ? (
          <div key={z.label} style={{display:'flex',alignItems:'center',gap:7}}>
            <span style={{fontSize:10,color:z.color,width:60,flexShrink:0,fontFamily:'var(--fm)'}}>{z.label}</span>
            <div style={{flex:1,height:5,background:'var(--bg4)',borderRadius:3,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${z.pct}%`,background:z.color,borderRadius:3}}/>
            </div>
            <span style={{fontSize:10,color:z.color,width:26,textAlign:'right',fontFamily:'var(--fm)'}}>{z.pct}%</span>
          </div>
        ) : null)}
      </div>
    </div>
  )
}

export default function Historial({ rides, deleteRide, profile={} }) {
  const [expanded, setExpanded] = useState({})
  const fcmax = profile.fcmax || 185

  const toggle = id => setExpanded(prev => ({...prev, [id]: !prev[id]}))

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
        const hrAvg  = getHR(r)
        const hasFC  = hrAvg > 0
        const cad    = getCad(r)
        const hasCad = cad > 0
        const speed  = parseFloat(getSpeed(r))
        const rpeColor = r.rpe>=8?'#e07070':r.rpe>=6?'#e09850':'#6db86a'
        const isOpen = expanded[r.id]

        // Zones: use real zp, recalculate if naive (100% in one zone), or estimate from HR
        let rawZP   = getZP(r)
        const isNaive = rawZP && rawZP.filter(v=>v>0).length===1
        let zones   = null
        if (hasFC && rawZP && !isNaive) zones = rawZP
        else if (hasFC) zones = estimateZonesFromHR(hrAvg, fcmax)

        // Cadence optimal %
        const cadPct = r.cadPctOptimal > 0
          ? r.cadPctOptimal
          : estimateCadPct(cad)

        // Cadence message — only show when genuinely low
        const showCadWarning = hasCad && cadPct !== null && cadPct < 50 && cad < 78

        return (
          <div key={r.id} className="hc" style={{padding:0,overflow:'hidden'}}>
            {/* ── TOP BAR ── */}
            <div style={{padding:'14px 18px 10px',borderBottom:'1px solid var(--border)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <div style={{fontSize:15,fontWeight:600,marginBottom:2}}>{r.name||'Rodada'}</div>
                  <div style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--fm)'}}>{r.fecha}
                    {r.device && <span style={{marginLeft:8}}>{r.device}</span>}
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:7}}>
                  {r.rpe && <span style={{fontSize:11,fontFamily:'var(--fm)',color:rpeColor,border:`1px solid ${rpeColor}40`,borderRadius:20,padding:'2px 9px'}}>RPE {r.rpe}</span>}
                  {!hasFC && <span style={{fontSize:11,fontFamily:'var(--fm)',color:'var(--text3)',border:'1px solid var(--border)',borderRadius:20,padding:'2px 8px'}}>Sin FC</span>}
                  {r.sen && <span style={{fontSize:11,fontFamily:'var(--fm)',color:'#6db86a',border:'1px solid #6db86a40',borderRadius:20,padding:'2px 9px'}}>{r.sen}</span>}
                  <button onClick={()=>{if(confirm('¿Eliminar?'))deleteRide(r.id)}}
                    style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:19,padding:'0 4px',lineHeight:1,borderRadius:6}}
                    onMouseOver={e=>e.currentTarget.style.color='#e07070'}
                    onMouseOut={e=>e.currentTarget.style.color='var(--text3)'}>×</button>
                </div>
              </div>
            </div>

            {/* ── STATS ROW ── */}
            <div style={{padding:'10px 18px',display:'flex',gap:0,flexWrap:'wrap'}}>
              {[
                ['⏱', Math.round(r.dur)+'min', r.pauseMin>5?`+${r.pauseMin}min pausa`:null],
                ['📍', parseFloat(r.dist||0).toFixed(1)+'km', null],
                speed>0 ? ['💨', speed.toFixed(1)+'km/h', null] : null,
                hasFC   ? ['❤️', hrAvg+'lpm', null] : null,
                r.eg>0  ? ['⛰', '+'+Math.round(r.eg)+'m', null] : null,
                hasCad  ? ['🔄', cad+'rpm', cadPct!==null?`~${cadPct}% óptima`:null] : null,
                r.watts>0 ? ['⚡', r.watts+'W', r.hasPower?'real':'est.'] : null,
                r.calories>0 ? ['🔥', r.calories+'kcal', null] : null,
              ].filter(Boolean).map(([icon,val,sub],i) => (
                <div key={i} style={{minWidth:72,padding:'4px 10px 4px 0',marginRight:4}}>
                  <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{val}</div>
                  {sub && <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--fm)',marginTop:1}}>{sub}</div>}
                </div>
              ))}
            </div>

            {/* ── ZONES — only if FC data available ── */}
            {zones && (
              <div style={{padding:'0 18px 14px'}}>
                <div style={{display:'flex',alignItems:'center',gap:14}}>
                  <DonutZones zp={zones}/>
                  <ZoneBarsH zp={zones}/>
                </div>
              </div>
            )}

            {/* ── CADENCE ZONES — when cadence data available ── */}
            {hasCad && cadPct !== null && (
              <div style={{padding:'0 18px 14px'}}>
                <CadZones cadAvg={cad} cadPct={cadPct}/>
                {showCadWarning && (
                  <div style={{fontSize:11,color:'#e09850',marginTop:6,fontStyle:'italic'}}>
                    Cadencia predominantemente por debajo del rango óptimo — incluir series de cadencia alta en Z2
                  </div>
                )}
              </div>
            )}

            {/* ── EXPANDABLE: IA + comment ── */}
            {(r.ia || r.com || r.decoupling!=null) && (
              <>
                <button onClick={()=>toggle(r.id)}
                  style={{width:'100%',background:'var(--bg3)',border:'none',borderTop:'1px solid var(--border)',
                    padding:'8px 18px',cursor:'pointer',color:'var(--text3)',fontSize:11,
                    fontFamily:'var(--fm)',textAlign:'left',display:'flex',justifyContent:'space-between'}}>
                  <span>{isOpen?'Ocultar análisis':'Ver análisis IA'}</span>
                  <span>{isOpen?'▲':'▼'}</span>
                </button>
                {isOpen && (
                  <div style={{padding:'12px 18px 16px',borderTop:'1px solid var(--border)',background:'var(--bg3)'}}>
                    {r.decoupling!=null && Math.abs(r.decoupling)>5 && (
                      <div style={{fontSize:11,color:'#e09850',marginBottom:8,fontStyle:'italic'}}>
                        ⚠ Desacoplamiento aeróbico {r.decoupling}% — base Z2 necesita más volumen (Seiler 2010)
                      </div>
                    )}
                    {r.com && <div style={{fontSize:12,color:'var(--text2)',fontStyle:'italic',marginBottom:8}}>"{r.com}"</div>}
                    {r.ia  && <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.6}}>{r.ia}</div>}
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
