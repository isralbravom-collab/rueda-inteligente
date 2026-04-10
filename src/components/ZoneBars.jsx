import React from 'react'

const ZC     = ['#6db86a','#a8d5a2','#e8c97a','#e09850','#e07070']
const LABELS = ['Z1','Z2','Z3','Z4','Z5']
const FULL   = ['Z1 Recuperación','Z2 Base aeróbica','Z3 Tempo','Z4 Umbral','Z5 VO2max']

// Bell-curve distribution from hrAvg when no stream data available
export function estimateZonesFromHR(hrAvg, fcmax = 185) {
  if (!hrAvg || hrAvg < 40) return [0,0,0,0,0]
  const pct = hrAvg / fcmax * 100
  const std = pct > 85 ? 7 : pct > 75 ? 10 : pct > 65 ? 14 : 18

  function erf(x) {
    const a = 0.147
    const s = x < 0 ? -1 : 1
    const x2 = x * x
    return s * Math.sqrt(1 - Math.exp(-x2 * (4/Math.PI + a*x2) / (1 + a*x2)))
  }
  function ncdf(x) { return 0.5 * (1 + erf((x - pct) / (std * Math.SQRT2))) }

  const bounds = [0, 60, 70, 80, 90, 120]
  const raw = bounds.slice(0,-1).map((b,i) => Math.max(0, ncdf(bounds[i+1]) - ncdf(b)))
  const total = raw.reduce((a,b)=>a+b, 0) || 1
  const zones = raw.map(v => Math.round(v/total*100))
  const diff  = 100 - zones.reduce((a,b)=>a+b, 0)
  zones[zones.indexOf(Math.max(...zones))] += diff
  return zones
}

// Detect if zp is the naive "one zone 100%" fallback
function isNaiveZP(zp) {
  if (!Array.isArray(zp) || zp.length !== 5) return true
  return zp.filter(v => v > 0).length === 1  // exactly one zone has all the %
}

export default function ZoneBars({ zp, hrAvg, fcmax = 185, compact = false }) {
  // Resolve best available zone data
  let zones = Array.isArray(zp) && zp.length === 5 ? zp : [0,0,0,0,0]

  // If naively assigned (100% in one zone) and we have hrAvg, recalculate
  if (isNaiveZP(zones) && hrAvg > 40) {
    zones = estimateZonesFromHR(hrAvg, fcmax)
  }

  const hasData = zones.some(v => v > 0)
  const maxIdx  = hasData ? zones.indexOf(Math.max(...zones)) : -1

  if (!hasData) return (
    <div style={{fontSize:12,color:'var(--text3)',padding:'4px 0'}}>
      Sin datos de FC — zonas no disponibles
    </div>
  )

  if (compact) {
    // Donut + horizontal bars side by side
    const size = 100, cx = 50, cy = 50, R = 40, r = 24
    let angle  = -90
    const paths = []

    zones.forEach((val, i) => {
      if (val <= 0) return
      const sweep = (val / 100) * 360
      const toRad = a => a * Math.PI / 180
      const x1 = cx + R * Math.cos(toRad(angle))
      const y1 = cy + R * Math.sin(toRad(angle))
      const x2 = cx + R * Math.cos(toRad(angle + sweep))
      const y2 = cy + R * Math.sin(toRad(angle + sweep))
      const xi1 = cx + r * Math.cos(toRad(angle))
      const yi1 = cy + r * Math.sin(toRad(angle))
      const xi2 = cx + r * Math.cos(toRad(angle + sweep))
      const yi2 = cy + r * Math.sin(toRad(angle + sweep))
      const large = sweep > 180 ? 1 : 0
      paths.push(
        <path key={i}
          d={`M${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2} L${xi2},${yi2} A${r},${r} 0 ${large} 0 ${xi1},${yi1}Z`}
          fill={ZC[i]}/>
      )
      angle += sweep
    })

    return (
      <div style={{display:'flex',alignItems:'center',gap:12,marginTop:8}}>
        {/* Donut */}
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{flexShrink:0}}>
          {paths}
          <text x={cx} y={cy-4} textAnchor="middle" fontSize="13" fontWeight="600"
            fill={ZC[maxIdx]} fontFamily="var(--fm)">Z{maxIdx+1}</text>
          <text x={cx} y={cy+10} textAnchor="middle" fontSize="11"
            fill={ZC[maxIdx]} fontFamily="var(--fm)">{zones[maxIdx]}%</text>
        </svg>

        {/* Horizontal bars */}
        <div style={{flex:1,display:'flex',flexDirection:'column',gap:5}}>
          {zones.map((p, i) => p > 0 ? (
            <div key={i} style={{display:'flex',alignItems:'center',gap:6}}>
              <span style={{fontSize:10,fontFamily:'var(--fm)',color:ZC[i],width:20,flexShrink:0}}>{LABELS[i]}</span>
              <div style={{flex:1,height:6,background:'var(--bg4)',borderRadius:3,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${p}%`,background:ZC[i],borderRadius:3}}/>
              </div>
              <span style={{fontSize:10,fontFamily:'var(--fm)',color:ZC[i],width:28,textAlign:'right'}}>{p}%</span>
            </div>
          ) : null)}
        </div>
      </div>
    )
  }

  // Vertical bars (Registrar preview)
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6,margin:'8px 0'}}>
      {zones.map((p, i) => (
        <div key={i} style={{textAlign:'center'}}>
          <div style={{height:60,display:'flex',alignItems:'flex-end',justifyContent:'center',marginBottom:4}}>
            <div style={{width:'100%',background:ZC[i],borderRadius:'3px 3px 0 0',
              height:`${Math.max(p>0?8:0,p)}%`,opacity:p>0?0.9:0.15,
              minHeight:p>0?4:0,transition:'height .4s'}}/>
          </div>
          <div style={{fontSize:10,fontFamily:'var(--fm)',color:ZC[i]}}>{LABELS[i]}</div>
          <div style={{fontSize:10,color:p>0?ZC[i]:'var(--text3)'}}>{p}%</div>
        </div>
      ))}
    </div>
  )
}
