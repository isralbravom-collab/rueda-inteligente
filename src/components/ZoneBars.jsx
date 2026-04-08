import React from 'react'
const ZC = ['#6db86a','#a8d5a2','#e8c97a','#e09850','#e07070']

export default function ZoneBars({ zp = [0,0,0,0,0] }) {
  return (
    <div className="zw">
      {zp.map((p, i) => (
        <div className="zc" key={i}>
          <div className="zn">Z{i+1}</div>
          <div className="zt">
            <div className="zf" style={{ height:`${Math.max(3,p)}%`, background:ZC[i] }} />
          </div>
          <div className="zp" style={{ color:ZC[i] }}>{p}%</div>
        </div>
      ))}
    </div>
  )
}
