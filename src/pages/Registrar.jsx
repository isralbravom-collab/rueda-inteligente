import React, { useState, useRef } from 'react'
import ZoneBars from '../components/ZoneBars'
import IABox from '../components/IABox'
import { parseGPX } from '../hooks/useGPX'
import { callIA, buildRidePrompt } from '../hooks/useIA'

const RPE_LABELS = {1:'Reposo absoluto',2:'Muy muy fácil',3:'Muy fácil',4:'Fácil',5:'Moderado',6:'Algo difícil',7:'Difícil',8:'Muy difícil',9:'Extremo',10:'Máximo esfuerzo'}
const ZC = ['#6db86a','#a8d5a2','#e8c97a','#e09850','#e07070']

export default function Registrar({ rides, supps, profile, addRide, isDuplicate }) {
  const [mode, setMode] = useState('gpx')
  const [gpx, setGpx] = useState(null)
  const [drag, setDrag] = useState(false)
  const [rpe, setRpe] = useState(null)
  const [sen, setSen] = useState(null)
  const [com, setCom] = useState('')
  const [loading, setLoading] = useState(false)
  const [iaText, setIaText] = useState('')
  const [dupe, setDupe] = useState(null)
  const [saved, setSaved] = useState(false)
  const fileRef = useRef()

  // Manual fields
  const [mTipo, setMTipo] = useState('rodaje continuo')
  const [mDur, setMDur] = useState('')
  const [mDist, setMDist] = useState('')
  const [mFC, setMFC] = useState('')

  function handleFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = parseGPX(e.target.result, profile.fcmax || 185)
        data.fn = file.name
        setGpx(data)
        setIaText('')
        setSaved(false)
        setDupe(null)
      } catch { alert('No se pudo leer el GPX. Asegúrate de exportarlo desde Strava.') }
    }
    reader.readAsText(file)
  }

  async function guardar(forceSave = false) {
    if (!rpe) return alert('Selecciona tu RPE')
    if (!sen) return alert('Selecciona tu sensación posterior')

    let rideData = {}
    if (mode === 'gpx') {
      if (!gpx) return alert('Sube un archivo GPX')
      rideData = { name:gpx.name, dur:gpx.dur, dist:gpx.dist, hrAvg:gpx.hrAvg, hrMax:gpx.hrMax, cad:gpx.cad, eg:gpx.eg, zp:gpx.zp, temp:gpx.temp, fecha:gpx.fecha, iso:gpx.iso }
    } else {
      const dur = parseFloat(mDur)
      if (!dur || dur < 5) return alert('Ingresa la duración')
      const fc = parseInt(mFC) || 0
      const fm = profile.fcmax || 185
      const z = [0,0,0,0,0]
      if (fc>40) { const p=fc/fm*100; if(p<60)z[0]=100; else if(p<70)z[1]=100; else if(p<80)z[2]=100; else if(p<90)z[3]=100; else z[4]=100 }
      rideData = { name:mTipo, dur, dist:parseFloat(mDist)||0, hrAvg:fc, hrMax:fc, cad:0, eg:0, zp:z, temp:null, fecha:new Date().toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short'}), iso:new Date().toISOString() }
    }

    // Dupe detection
    if (!forceSave) {
      const existing = isDuplicate(rideData)
      if (existing) { setDupe(existing); return }
    }

    setLoading(true)
    setIaText('')
    setDupe(null)

    const ride = { ...rideData, rpe, sen, com, ia:'', id:Date.now() }
    const text = await callIA(buildRidePrompt(ride, rides, supps, profile), 450)
    ride.ia = text
    addRide(ride)
    setIaText(text)
    setLoading(false)
    setSaved(true)
    // Reset
    setGpx(null); setRpe(null); setSen(null); setCom(''); setMDur(''); setMDist(''); setMFC('')
  }

  return (
    <div className="page">
      <div className="ph">
        <h1>Registrar <em>rodada</em></h1>
        <p>Importa tu GPX de Strava o registra manualmente</p>
      </div>

      {/* DUPE WARNING */}
      {dupe && (
        <div className="dupe-alert">
          <h3>⚠ Posible rodada duplicada detectada</h3>
          <p>Ya existe una rodada similar registrada el <strong>{dupe.fecha}</strong> ({Math.round(dupe.dur)} min, {(dupe.dist||0).toFixed(1)} km). ¿Es la misma rodada?</p>
          <div style={{display:'flex',gap:10}}>
            <button className="btn bp" onClick={() => guardar(true)}>No, guardar de todas formas</button>
            <button className="btn" onClick={() => setDupe(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* MODE TABS */}
      <div className="itabs" style={{display:'flex',gap:2,marginBottom:20,background:'var(--bg3)',borderRadius:'var(--r)',padding:3,width:'fit-content'}}>
        {['gpx','manual'].map(m => (
          <button key={m} onClick={()=>setMode(m)} className={'itab'+(mode===m?' active':'')}
            style={{padding:'6px 16px',borderRadius:7,fontSize:12,cursor:'pointer',color:mode===m?'var(--text)':'var(--text2)',background:mode===m?'var(--bg4)':'none',border:'none',fontFamily:'var(--fb)',transition:'all .15s'}}>
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
            <button className="btn bs" onClick={()=>{setGpx(null);setSaved(false);setIaText('');setDupe(null)}}>Cambiar</button>
          </div>
          <div className="g4" style={{marginBottom:16}}>
            {[
              ['Duración',`${Math.round(gpx.dur)} min`],
              ['Distancia',`${gpx.dist.toFixed(1)} km`],
              ['Velocidad',`${gpx.dur>0?((gpx.dist||0)/(gpx.dur/60)).toFixed(1):'?'} km/h`],
              ['FC promedio',`${Math.round(gpx.hrAvg)||'—'} lpm`],
            ].map(([l,v])=>(
              <div className="sc" key={l}><div className="sl">{l}</div><div className="sv" style={{fontSize:18}}>{v}</div></div>
            ))}
          </div>
          <div className="stit" style={{marginBottom:8}}>Distribución por zonas FC</div>
          <ZoneBars zp={gpx.zp}/>
          {(gpx.zp[3]+gpx.zp[4])>55 && <div className="al aw" style={{marginTop:10}}>Más del 55% en Z4-Z5. Alta carga de intensidad acumulada.</div>}
          {(gpx.zp[0]+gpx.zp[1])>60 && <div className="al ai" style={{marginTop:10}}>Rodada predominantemente aeróbica (Z1-Z2). Ideal para construir base.</div>}
        </div>
      )}

      {/* MANUAL MODE */}
      {mode==='manual' && (
        <div className="card" style={{marginBottom:16}}>
          <div className="fr">
            <div className="fg" style={{marginBottom:0}}>
              <label className="fl">Tipo</label>
              <select value={mTipo} onChange={e=>setMTipo(e.target.value)}>
                {['rodaje continuo','rodaje progresivo','salida larga','rodaje suave','intervalos','libre'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="fg" style={{marginBottom:0}}>
              <label className="fl">Duración (min)</label>
              <input type="number" value={mDur} onChange={e=>setMDur(e.target.value)} placeholder="60" min="5"/>
            </div>
          </div>
          <div className="fr" style={{marginTop:14}}>
            <div className="fg" style={{marginBottom:0}}>
              <label className="fl">Distancia (km)</label>
              <input type="number" value={mDist} onChange={e=>setMDist(e.target.value)} placeholder="25" step="0.1"/>
            </div>
            <div className="fg" style={{marginBottom:0}}>
              <label className="fl">FC promedio (lpm)</label>
              <input type="number" value={mFC} onChange={e=>setMFC(e.target.value)} placeholder="145"/>
            </div>
          </div>
        </div>
      )}

      {/* COMMON FIELDS */}
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
              <button key={s} className={`sb2${sen===s?' sel':''}`} onClick={()=>setSen(s)}>{s.charAt(0).toUpperCase()+s.slice(1)}</button>
            ))}
          </div>
        </div>
        <div className="fg" style={{marginBottom:0}}>
          <label className="fl">Comentarios <span style={{color:'var(--text3)',fontSize:10,textTransform:'none'}}>(opcional)</span></label>
          <textarea value={com} onChange={e=>setCom(e.target.value)} placeholder="¿Algo notable? condiciones, cómo te sentiste..."/>
        </div>
      </div>

      <button className="btn bp btn-full" onClick={()=>guardar(false)} disabled={loading}>
        {loading && <span className="spin"/>}
        {loading ? 'Analizando con IA...' : 'Analizar con IA y guardar'}
      </button>

      {saved && <div className="al ai" style={{marginTop:12}}>Rodada guardada correctamente.</div>}
      <IABox text={iaText} loading={loading} label="Análisis de tu entrenador IA"/>
    </div>
  )
}
