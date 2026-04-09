function haversine(a1,o1,a2,o2){
  const R=6371,d=Math.PI/180
  const da=(a2-a1)*d,dlo=(o2-o1)*d
  const x=Math.sin(da/2)**2+Math.cos(a1*d)*Math.cos(a2*d)*Math.sin(dlo/2)**2
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))
}

function calcZones(hrArr, fcmax) {
  const valid = hrArr.filter(h => h > 40)
  if (!valid.length) return [0,0,0,0,0]
  const z = [0,0,0,0,0]
  valid.forEach(h => {
    const p = h/fcmax*100
    if (p < 60) z[0]++
    else if (p < 70) z[1]++
    else if (p < 80) z[2]++
    else if (p < 90) z[3]++
    else z[4]++
  })
  const tot = z.reduce((a,b)=>a+b,0)||1
  return z.map(v => Math.round(v/tot*100))
}

function calcCadenceMetrics(cadArr) {
  const active = cadArr.filter(c => c > 20)
  if (!active.length) return { avg:0, pctOptimal:0, stdDev:0 }
  const avg = Math.round(active.reduce((a,b)=>a+b,0)/active.length)
  const optimal = active.filter(c => c >= 80 && c <= 100).length
  const pctOptimal = Math.round(optimal/active.length*100)
  const mean = active.reduce((a,b)=>a+b,0)/active.length
  const stdDev = Math.round(Math.sqrt(active.reduce((a,b)=>a+Math.pow(b-mean,2),0)/active.length))
  return { avg, pctOptimal, stdDev }
}

function calcDecoupling(hrArr, velArr) {
  const len = Math.min(hrArr.length, velArr.length)
  if (len < 100) return null
  const mid = Math.floor(len/2)
  const ratio = (hrs, vels) => {
    const pairs = hrs.map((h,i)=>[h,vels[i]]).filter(([h,v])=>h>40&&v>0.5)
    return pairs.length ? pairs.reduce((a,[h,v])=>a+h/v,0)/pairs.length : 0
  }
  const r1 = ratio(hrArr.slice(0,mid), velArr.slice(0,mid))
  const r2 = ratio(hrArr.slice(mid), velArr.slice(mid))
  return r1 ? Math.round(((r2-r1)/r1)*1000)/10 : null
}

function estimatePower(velArr, altArr, weightKg=75) {
  if (!velArr?.length) return 0
  const Crr=0.004, CdA=0.35, rho=1.1, g=9.81
  const mass = weightKg + 8
  const powers = []
  for (let i=1; i<Math.min(velArr.length, altArr?.length||9999); i++) {
    const v = velArr[i]
    if (v < 0.5) continue
    const dAlt = altArr ? altArr[i]-altArr[i-1] : 0
    const slope = Math.max(-0.15, Math.min(0.15, dAlt/Math.max(v,0.1)))
    const P = (Crr*mass*g + 0.5*CdA*rho*v*v + mass*g*slope) * v
    if (P > 0 && P < 2000) powers.push(P)
  }
  return powers.length ? Math.round(powers.reduce((a,b)=>a+b,0)/powers.length) : 0
}

function analyzePauses(velArr, timeArr) {
  if (!velArr?.length || !timeArr?.length) return { pauseMin:0, longPauses:0 }
  let pauseSeconds=0, longPauses=0, inPause=false, pauseStart=0
  for (let i=0; i<velArr.length; i++) {
    const stopped = velArr[i] < 0.5
    if (stopped && !inPause) { inPause=true; pauseStart=timeArr[i] }
    else if (!stopped && inPause) {
      const dur = timeArr[i]-pauseStart
      pauseSeconds += dur
      if (dur > 1800) longPauses++
      inPause = false
    }
  }
  return { pauseMin:Math.round(pauseSeconds/60), longPauses }
}

export function parseGPX(text, fcmax=185, weightKg=75) {
  const doc = new DOMParser().parseFromString(text,'application/xml')
  const ns  = 'http://www.topografix.com/GPX/1/1'
  const pts = doc.getElementsByTagNameNS(ns,'trkpt')
  const nameEl = doc.getElementsByTagNameNS(ns,'n')[0]
  const name   = nameEl?.textContent || 'Rodada'

  let la=[],lo=[],ti=[],hr=[],cd=[],el=[],tm=[],vel=[]

  for (let p of pts) {
    la.push(parseFloat(p.getAttribute('lat')))
    lo.push(parseFloat(p.getAttribute('lon')))
    const t=p.getElementsByTagNameNS(ns,'time')[0]?.textContent
    if (t) ti.push(new Date(t))
    const e=p.getElementsByTagNameNS(ns,'ele')[0]?.textContent
    if (e) el.push(parseFloat(e))
    const h=p.querySelector('hr')?.textContent
    if (h) hr.push(parseInt(h))
    const c=p.querySelector('cad')?.textContent
    if (c) cd.push(parseInt(c))
    const tp=p.querySelector('atemp')?.textContent
    if (tp) tm.push(parseInt(tp))
  }

  // Calculate velocity m/s from GPS points
  for (let i=1; i<la.length; i++) {
    const distKm = haversine(la[i-1],lo[i-1],la[i],lo[i])
    const dtSec  = ti.length > i ? (ti[i]-ti[i-1])/1000 : 1
    vel.push(dtSec > 0 ? (distKm*1000)/dtSec : 0)
  }

  // Time array in seconds from start
  const timeArr = ti.map(t => (t-ti[0])/1000)

  const movingTime = ti.length > 1 ? (ti[ti.length-1]-ti[0])/60000 : 0
  const { pauseMin, longPauses } = analyzePauses(vel, timeArr)

  // Distance
  let dist=0
  for (let i=0;i<la.length-1;i++) dist+=haversine(la[i],lo[i],la[i+1],lo[i+1])

  // Speed: Strava-style (moving distance / moving time)
  const movingVel = vel.filter(v=>v>0.5)
  const avgSpeedMs = movingVel.length ? movingVel.reduce((a,b)=>a+b,0)/movingVel.length : 0
  const speed = Math.round(avgSpeedMs*3.6*10)/10  // km/h

  // HR
  const hv = hr.filter(h=>h>40)
  const hrAvg = hv.length ? Math.round(hv.reduce((a,b)=>a+b,0)/hv.length) : 0
  const hrMax  = hv.length ? Math.max(...hv) : 0

  // Cadence metrics
  const cadMetrics = calcCadenceMetrics(cd)

  // Elevation
  let eg=0
  for (let i=0;i<el.length-1;i++) eg+=Math.max(0,el[i+1]-el[i])

  // Zones from real HR stream
  const zp = calcZones(hr, fcmax)

  // Aerobic decoupling
  const decoupling = calcDecoupling(hr, vel)

  // Power estimation
  const watts = estimatePower(vel, el, weightKg)

  // Calories estimate
  const calories = hrAvg > 0
    ? Math.round((hrAvg * 0.4 + 0.174 * weightKg - 55.0969) * movingTime / 4.184)
    : Math.round(watts * (movingTime/60) * 3.6 / 0.24)

  const temp = tm.length ? Math.round(tm.reduce((a,b)=>a+b,0)/tm.length) : null

  return {
    name, dist: Math.round(dist*100)/100,
    dur:  Math.round(movingTime*10)/10,
    elapsedMin: Math.round(movingTime + pauseMin),
    pauseMin, longPauses,
    speed, hrAvg, hrMax,
    cad: cadMetrics.avg,
    cadPctOptimal: cadMetrics.pctOptimal,
    cadStdDev: cadMetrics.stdDev,
    eg: Math.round(eg),
    zp, temp,
    watts, hasPower: false,
    decoupling,
    calories,
    kilojoules: Math.round(watts * (movingTime/60) * 60 / 1000),
    fecha: ti[0]?.toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short'}) || new Date().toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short'}),
    iso:   ti[0]?.toISOString() || new Date().toISOString()
  }
}
