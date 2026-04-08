function haversine(a1, o1, a2, o2) {
  const R = 6371, d = Math.PI / 180
  const da = (a2-a1)*d, dlo = (o2-o1)*d
  const x = Math.sin(da/2)**2 + Math.cos(a1*d)*Math.cos(a2*d)*Math.sin(dlo/2)**2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x))
}

export function parseGPX(text, fcmax = 185) {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  const ns = 'http://www.topografix.com/GPX/1/1'
  const pts = doc.getElementsByTagNameNS(ns, 'trkpt')
  const nameEl = doc.getElementsByTagNameNS(ns, 'n')[0]
  const name = nameEl?.textContent || 'Rodada'

  let la=[], lo=[], ti=[], hr=[], cd=[], el=[], tm=[]
  for (let p of pts) {
    la.push(parseFloat(p.getAttribute('lat')))
    lo.push(parseFloat(p.getAttribute('lon')))
    const t = p.getElementsByTagNameNS(ns,'time')[0]?.textContent
    if (t) ti.push(new Date(t))
    const e = p.getElementsByTagNameNS(ns,'ele')[0]?.textContent
    if (e) el.push(parseFloat(e))
    const h = p.querySelector('hr')?.textContent
    if (h) hr.push(parseInt(h))
    const c = p.querySelector('cad')?.textContent
    if (c) cd.push(parseInt(c))
    const tp = p.querySelector('atemp')?.textContent
    if (tp) tm.push(parseInt(tp))
  }

  const dur = ti.length>1 ? (ti[ti.length-1]-ti[0])/60000 : 0
  let dist = 0
  for (let i=0; i<la.length-1; i++) dist += haversine(la[i],lo[i],la[i+1],lo[i+1])

  const hv = hr.filter(h=>h>40)
  const hrAvg = hv.length ? hv.reduce((a,b)=>a+b,0)/hv.length : 0
  const hrMax = hv.length ? Math.max(...hv) : 0
  const ca = cd.filter(c=>c>0)
  const cad = ca.length ? ca.reduce((a,b)=>a+b,0)/ca.length : 0
  let eg = 0
  for (let i=0; i<el.length-1; i++) eg += Math.max(0, el[i+1]-el[i])

  const z = [0,0,0,0,0]
  hv.forEach(h => {
    const p = h/fcmax*100
    if (p<60) z[0]++; else if (p<70) z[1]++; else if (p<80) z[2]++; else if (p<90) z[3]++; else z[4]++
  })
  const tot = z.reduce((a,b)=>a+b,0) || 1
  const zp = z.map(v => Math.round(v/tot*100))
  const temp = tm.length ? tm.reduce((a,b)=>a+b,0)/tm.length : null

  return {
    name, dur, dist, hrAvg, hrMax, cad, eg, zp, temp,
    fecha: ti[0]?.toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short'}) || new Date().toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short'}),
    iso: ti[0]?.toISOString() || new Date().toISOString()
  }
}
