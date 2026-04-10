import React, { useEffect, useRef } from 'react'

const ZC     = ['#6db86a','#a8d5a2','#e8c97a','#e09850','#e07070']
const LABELS = ['Z1 Recup.','Z2 Base','Z3 Tempo','Z4 Umbral','Z5 VO2']
const FULL   = ['Z1 Recuperación','Z2 Base aeróbica','Z3 Tempo','Z4 Umbral anaeróbico','Z5 VO2max']

function DonutChart({ zp }) {
  const ref  = useRef()
  const size = 120
  const cx   = size / 2
  const cy   = size / 2
  const R    = 46
  const r    = 28

  // Filter out zero zones for cleaner display
  const hasData = zp.some(v => v > 0)
  if (!hasData) return (
    <div style={{width:size,height:size,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
      <div style={{width:R*2,height:R*2,borderRadius:'50%',border:'3px solid var(--bg4)',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <span style={{fontSize:10,color:'var(--text3)',textAlign:'center',lineHeight:1.3}}>Sin<br/>FC</span>
      </div>
    </div>
  )

  // Build SVG arcs
  const total     = zp.reduce((a,b)=>a+b,0) || 1
  const segments  = []
  let angle       = -90  // start at top

  zp.forEach((val, i) => {
    if (val <= 0) return
    const sweep = (val / total) * 360
    const start = (angle * Math.PI) / 180
    const end   = ((angle + sweep) * Math.PI) / 180

    const x1 = cx + R * Math.cos(start)
    const y1 = cy + R * Math.sin(start)
    const x2 = cx + R * Math.cos(end)
    const y2 = cy + R * Math.sin(end)

    const xi1 = cx + r * Math.cos(start)
    const yi1 = cy + r * Math.sin(start)
    const xi2 = cx + r * Math.cos(end)
    const yi2 = cy + r * Math.sin(end)

    const large = sweep > 180 ? 1 : 0

    segments.push(
      <path
        key={i}
        d={`M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${r} ${r} 0 ${large} 0 ${xi1} ${yi1} Z`}
        fill={ZC[i]}
        opacity={0.9}
      />
    )
    angle += sweep
  })

  // Find dominant zone
  const maxVal  = Math.max(...zp)
  const maxIdx  = zp.indexOf(maxVal)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{flexShrink:0}}>
      {segments}
      {/* Center text: dominant zone */}
      <text x={cx} y={cy-5} textAnchor="middle" fontSize="11" fontWeight="600"
        fill={ZC[maxIdx]} fontFamily="var(--fm)">
        Z{maxIdx+1}
      </text>
      <text x={cx} y={cy+8} textAnchor="middle" fontSize="10"
        fill={ZC[maxIdx]} fontFamily="var(--fm)">
        {maxVal}%
      </text>
    </svg>
  )
}

export default function ZoneBars({ zp = [0,0,0,0,0], compact = false }) {
  const hasData = zp.some(v => v > 0)

  if (compact) {
    // Compact horizontal bar used in historial cards
    return (
      <div style={{display:'flex',gap:6,alignItems:'center'}}>
        <DonutChart zp={zp}/>
        <div style={{flex:1,display:'flex',flexDirection:'column',gap:4}}>
          {zp.map((p, i) => p > 0 ? (
            <div key={i} style={{display:'flex',alignItems:'center',gap:6}}>
              <span style={{fontSize:10,fontFamily:'var(--fm)',color:ZC[i],width:52,flexShrink:0}}>{LABELS[i]}</span>
              <div style={{flex:1,height:6,background:'var(--bg4)',borderRadius:3,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${p}%`,background:ZC[i],borderRadius:3,transition:'width .4s'}}/>
              </div>
              <span style={{fontSize:10,fontFamily:'var(--fm)',color:ZC[i],width:28,textAlign:'right'}}>{p}%</span>
            </div>
          ) : null)}
          {!hasData && <span style={{fontSize:11,color:'var(--text3)'}}>Sin datos de FC</span>}
        </div>
      </div>
    )
  }

  // Full vertical bars (used in Registrar preview)
  return (
    <div style={{display:'flex',gap:10,alignItems:'flex-end'}}>
      {/* Donut on the left */}
      <DonutChart zp={zp}/>
      {/* Bars on the right */}
      <div style={{flex:1}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6,alignItems:'flex-end',height:72}}>
          {zp.map((p, i) => (
            <div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,height:'100%',justifyContent:'flex-end'}}>
              <span style={{fontSize:9,fontFamily:'var(--fm)',color:ZC[i]}}>{p > 0 ? p+'%' : ''}</span>
              <div style={{width:'100%',background:'var(--bg4)',borderRadius:'3px 3px 0 0',
                height:`${Math.max(p > 0 ? 6 : 0, p)}%`,
                minHeight: p > 0 ? 4 : 0,
                background:ZC[i],opacity: p > 0 ? 0.9 : 0,
                transition:'height .4s cubic-bezier(.4,0,.2,1)'}}/>
            </div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6,marginTop:4}}>
          {zp.map((p, i) => (
            <div key={i} style={{textAlign:'center',fontSize:9,color:p>0?ZC[i]:'var(--text3)',fontFamily:'var(--fm)'}}>
              Z{i+1}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
