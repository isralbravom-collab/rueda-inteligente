import React, { useState, useRef } from 'react'
import ZoneBars from '../components/ZoneBars'
import IABox from '../components/IABox'
import { parseGPX } from '../hooks/useGPX'
import { callIA, buildRidePrompt } from '../hooks/useIA'

const RPE_LABELS = {1:'Reposo',2:'Muy fácil',3:'Fácil',4:'Fácil+',5:'Moderado',6:'Moderado+',7:'Difícil',8:'Muy difícil',9:'Extremo',10:'Máximo'}
const ZC = ['#6db86a','#a8d5a2','#e8c97a','#e09850','#e07070']

export default function Registrar({ rides, supps, profile, addRide, isDuplicate }) {
  const [mode, setMode]     = useState('gpx')
  const [gpx, setGpx]       = useState(null)
  const [drag, setDrag]     = useState(false)
  const [rpe, setRpe]       = useState(null)
  const [sen, setSen]       = useState(null)
  const [com, setCom]       = useState('')
  const [loading, setLoading] = useState(false)
  const [iaText, setIaText] = useState('')
  const [dupe, setDupe]     = useState(null)
  const [saved, setSaved]   = useState(false)
  const fileRef = useRef()

  const [mTipo, setMTipo] = useState('rodaje continuo')
  const [mDur, setMDur]   = useState('')
  const [mDist, setMDist] = useState('')
  const [mFC, setMFC]     = useState('')
  const [mCad, setMCad]   = useState('')

  function handleFile(file) {
    if (!file) return
    const fr = new FileReader()
    fr.onload = e => {
      try {
        const data = parseGPX(e.target.result, profile.fcmax||185, profile.peso||75)
        data.fn = file.name
        setGpx(data)
        setIaText('')
        setSaved(false)
        setDupe(null)
      } catch { alert('No se pudo leer el GPX.') }
    }
    fr.readAsText(file)
  }

  async function guardar(force = false) {
    if (!rpe) return alert('Selecciona tu RPE')
    if (!sen) return alert('Selecciona tu sensación posterior')

    let rideData = {}
    if (mode === 'gpx') {
      if (!gpx) return alert('Sube un archivo GPX')
      rideData = { ...gpx }
    } else {
      const dur = parseFloat(mDur)
      if (!dur || dur < 5) return alert('Ingresa la duración')
      const fc = parseInt(mFC)||0, fcmax = profile.fcmax||185
      const z = [0,0,0,0,0]
      if (fc>40) { const p=fc/fcmax*100; if(p<60)z[0]=100; else if(p<70)z[1]=100; else if(p<80)z[2]=100; else if(p<90)z[3]=100; else z[4]=100 }
      rideData = {
        name:mTipo, dur, dist:parseFloat(mDist)||0, hrAvg:fc, hrMax:fc,
        cad:parseInt(mCad)||0, cadPctOptimal:0, cadStdDev:0,
        eg:0, zp:z, temp:null, watts:0, hasPower:false,
        decoupling:null, calories:0, kilojoules:0,
        pauseMin:0, longPauses:0, elapsedMin:dur,
        speed: dur>0 ? parseFloat(((parseFloat(mDist)||0)/(dur/60)).toFixed(1)) : 0,
        fecha:new Date().toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short'}),
        iso:new Date().toISOString()
      }
    }

    if (!force) {
      const ex = isDuplicate(rideData)
      if (ex) { setDupe(ex); return }
    }

    setLoading(true)
    setIaText('')
    setDupe(null)
    const ride = { ...rideData, rpe, sen, com, ia:'', id:Date.now() }
    const text = await callIA(buildRidePrompt(ride, rides, supps, profile), 500)
    ride.ia = text
    addRide(ride)
    setIaText(text)
    setLoading(false)
    setSaved(true)
    setGpx(null); setRpe(null); setSen(null); setCom('')
    setMDur(''); setMDist(''); setMFC(''); setMCad('')
  }

  return (
    <div className="page">
      <div className="ph">
        <h1>Registrar <em>rodada</em></h1>
        <p>Importa tu GPX de Strava o registra manualmente</p>
      </div>

      <div className="itabs" style={{display:'flex',gap:2,marginBottom:20,background:'var(--bg3)',borderRadius:'var(--r)',padding:3,width:'fit-content'}}>
        {['gpx','manual'].map(m=>(
          <button key={m} onClick={()=>setMode(m)}
            style={{padding:'6px 16px',borderRadius:7,fontSize:12,cursor:'pointer',color:mode===m?'var(--text)':'var(--text2)',background:mode===m?'var(--bg4)':'none',border:'none',fontFamily:'var(--fb)'}}>
            {m==='gpx'?'Importar GPX':'Manual'}
          </button>
        ))}
      </div>

      {/* GPX MODE */}
      {mode==='gpx' && !gpx && (
        <div className={`uz${drag?' drag':''}`}
          onDragOver={e=>{e.preventDefault();setDrag(true)}}
          onDragLeave={()=>setDrag(false)}
          onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0])}}
          onClick={()=>fileRef.current.click()}>
          <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <div style={{fontSize:14,fontWeight:500,marginBottom:4}}>Arrastra tu .gpx de Strava</div>
          <div style={{fontSize:12,color:'var(--text3)'}}>o haz clic para seleccionar</div>
          <input ref={fileRef} type="file" accept=".gpx" style={{display:'none'}} onChange={e=>handleFile(e.target.files[0])}/>
        </div>
      )}

      {mode==='gpx' && gpx && (
        <div className="card" style={{marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div>
              <div style={{fontSize:15,fontWeight:500}}>{gpx.fn||gpx.name}</div>
              <div style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--fm)',marginTop:2}}>{gpx.fecha}</div>
            </div>
            <button className="btn bs" onClick={()=>{setGpx(null);setSaved(false);setIaText('')}}>Cambiar</button>
          </div>

          {/* Stats grid */}
          <div className="g4" style={{marginBottom:12}}>
            {[
              ['Tiempo en silla', `${Math.round(gpx.dur)} min`],
              ['Distancia', `${gpx.dist.toFixed(1)} km`],
              ['Velocidad', `${gpx.speed||((gpx.dur>0?(gpx.dist/(gpx.dur/60)).toFixed(1):'?'))} km/h`],
              ['FC promedio', `${Math.round(gpx.hrAvg)||'—'} lpm`],
            ].map(([l,v])=>(
              <div className="sc" key={l}><div className="sl">{l}</div><div className="sv" style={{fontSize:18}}>{v}</div></div>
            ))}
          </div>

          {/* Extra metrics */}
          <div style={{display:'flex',gap:16,flexWrap:'wrap',marginBottom:12,fontSize:12,color:'var(--text2)'}}>
            {gpx.cad>0 && <span>Cadencia <strong style={{color:'var(--text)'}}>{Math.round(gpx.cad)} rpm</strong>{gpx.cadPctOptimal>0&&<span style={{color:'#6db86a',marginLeft:4}}>({gpx.cadPctOptimal}% óptima)</span>}</span>}
            {gpx.watts>0 && <span>Potencia est. <strong style={{color:'var(--text)'}}>{gpx.watts} W</strong></span>}
            {gpx.calories>0 && <span>Calorías <strong style={{color:'var(--text)'}}>{gpx.calories} kcal</strong></span>}
            {gpx.eg>0 && <span>Elevación <strong style={{color:'var(--text)'}}>+{Math.round(gpx.eg)} m</strong></span>}
            {(gpx.pauseMin||0)>5 && <span style={{color:'var(--amber)'}}>Pausa {gpx.pauseMin}min{gpx.longPauses>0?' (pausa larga detectada)':''}</span>}
            {gpx.decoupling!=null && <span style={{color:Math.abs(gpx.decoupling)>5?'#e09850':'var(--text2)'}}>Desacoplamiento {gpx.decoupling}%</span>}
          </div>

          {/* Zonas */}
          <div className="stit" style={{marginBottom:8}}>Distribución por zonas FC {!gpx.hrAvg&&<span style={{color:'var(--text3)',fontWeight:400}}>(sin sensor FC)</span>}</div>
          {gpx.hrAvg > 0
            ? <ZoneBars zp={gpx.zp}/>
            : <div style={{fontSize:12,color:'var(--text3)',padding:'8px 0'}}>Sin datos de frecuencia cardíaca — zonas no disponibles para esta rodada</div>
          }
          {gpx.hrAvg>0 && (gpx.zp[3]+gpx.zp[4])>55 && <div className="al aw" style={{marginTop:8}}>Más del 55% en Z4-Z5. Alta carga de intensidad acumulada.</div>}
          {gpx.hrAvg>0 && (gpx.zp[0]+gpx.zp[1])>65 && <div className="al ai" style={{marginTop:8}}>Rodada predominantemente aeróbica (Z1-Z2). Ideal para base.</div>}

          {/* Cadence advice */}
          {gpx.cad>0 && gpx.cadPctOptimal < 50 && (
            <div className="al aw" style={{marginTop:8,fontSize:12}}>
              Solo {gpx.cadPctOptimal}% del tiempo en cadencia óptima (80-100 rpm). Trabajar cadencia alta en Z2 mejora economía de pedaleo (Lucia et al. 2001).
            </div>
          )}
        </div>
      )}

      {/* MANUAL MODE */}
      {mode==='manual' && (
        <div className="card" style={{marginBottom:16}}>
          <div className="fr">
            <div className="fg" style={{marginBottom:0}}><label className="fl">Tipo</label>
              <select value={mTipo} onChange={e=>setMTipo(e.target.value)}>
                {['rodaje continuo','rodaje progresivo','salida larga','rodaje suave','intervalos','libre'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="fg" style={{marginBottom:0}}><label className="fl">Duración (min)</label>
              <input type="number" value={mDur} onChange={e=>setMDur(e.target.value)} placeholder="60" min="5"/>
            </div>
          </div>
          <div className="fr" style={{marginTop:14}}>
            <div className="fg" style={{marginBottom:0}}><label className="fl">Distancia (km)</label>
              <input type="number" value={mDist} onChange={e=>setMDist(e.target.value)} placeholder="25" step="0.1"/>
            </div>
            <div className="fg" style={{marginBottom:0}}><label className="fl">FC promedio (lpm)</label>
              <input type="number" value={mFC} onChange={e=>setMFC(e.target.value)} placeholder="145"/>
            </div>
          </div>
          <div className="fr" style={{marginTop:14}}>
            <div className="fg" style={{marginBottom:0}}><label className="fl">Cadencia (rpm)</label>
              <input type="number" value={mCad} onChange={e=>setMCad(e.target.value)} placeholder="85"/>
            </div>
            <div className="fg" style={{marginBottom:0}}><label className="fl" style={{color:'var(--text3)'}}>Potencia estimada automáticamente</label>
              <input type="text" disabled value="Calculada al guardar" style={{opacity:.5}}/>
            </div>
          </div>
        </div>
      )}

      {/* Dupe warning */}
      {dupe && (
        <div className="dupe-alert" style={{marginBottom:16}}>
          <h3>Posible rodada duplicada</h3>
          <p>Ya existe una rodada similar el <strong>{dupe.fecha}</strong> ({Math.round(dupe.dur)} min, {(dupe.dist||0).toFixed(1)} km).</p>
          <div style={{display:'flex',gap:10}}>
            <button className="btn bp" onClick={()=>guardar(true)}>Guardar de todas formas</button>
            <button className="btn" onClick={()=>setDupe(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Common fields */}
      <div className="card" style={{marginBottom:16}}>
        <div className="fg">
          <label className="fl">Esfuerzo percibido (RPE)</label>
          <div className="rpe-row">
            {[1,2,3,4,5,6,7,8,9,10].map(n=>(
              <button key={n} className={`rb${rpe===n?' sel':''}`} onClick={()=>setRpe(n)}>{n}</button>
            ))}
          </div>
          <div className="rh">{rpe ? RPE_LABELS[rpe] : ''}</div>
        </div>
        <div className="fg">
          <label className="fl">Sensación posterior</label>
          <div className="sg">
            {['muy bien','bien','regular','cansado','muy cansado','con molestias'].map(s=>(
              <button key={s} className={`sb2${sen===s?' sel':''}`} onClick={()=>setSen(s)}>
                {s.charAt(0).toUpperCase()+s.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="fg" style={{marginBottom:0}}>
          <label className="fl">Comentarios <span style={{color:'var(--text3)',fontSize:10,textTransform:'none'}}>(opcional)</span></label>
          <textarea value={com} onChange={e=>setCom(e.target.value)} placeholder="¿Algo notable? condiciones, sensaciones..."/>
        </div>
      </div>

      <button className="btn bp btn-full" onClick={()=>guardar(false)} disabled={loading}>
        {loading&&<span className="spin"/>}
        {loading?'Analizando con IA...':'Analizar con IA y guardar'}
      </button>

      {saved && <div className="al ai" style={{marginTop:12}}>Rodada guardada correctamente.</div>}
      <IABox text={iaText} loading={loading} label="Análisis de tu entrenador IA"/>
    </div>
  )
}
