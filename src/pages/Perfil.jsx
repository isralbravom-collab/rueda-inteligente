import React, { useState } from 'react'

const ZC = ['#6db86a','#a8d5a2','#e8c97a','#e09850','#e07070']

export default function Perfil({ profile, saveProfile }) {
  const [form, setForm] = useState({ ...profile })
  const [saved, setSaved] = useState(false)
  const [detecting, setDetecting] = useState(false)

  function set(k, v) { setForm(f=>({...f,[k]:v})); setSaved(false) }

  function save() {
    saveProfile({
      ...form,
      edad:  parseInt(form.edad)  || 0,
      peso:  parseFloat(form.peso)|| 70,
      fcmax: parseInt(form.fcmax) || 185,
      fcrest:parseInt(form.fcrest)|| 55,
      dias:  parseInt(form.dias)  || 3,
      altitud: parseInt(form.altitud) || 0,
      ftp:   parseInt(form.ftp)   || 0,
    })
    setSaved(true)
    setTimeout(()=>setSaved(false), 2500)
  }

  const ftpEstimado = form.ftp > 0 ? form.ftp : (() => {
    const base = { novato:1.5, recreativo:2.2, amateur:3.0, avanzado:3.8 }[form.nivel||'recreativo']
    return Math.round((form.peso||70) * base)
  })()

  const fm = parseInt(form.fcmax)||185
  const zonas = [
    { z:'Z1', label:'Recuperación',   pct:'< 60%',  color:ZC[0], lpm:`< ${Math.round(fm*0.60)}` },
    { z:'Z2', label:'Base aeróbica',  pct:'60–70%', color:ZC[1], lpm:`${Math.round(fm*0.60)}–${Math.round(fm*0.70)}` },
    { z:'Z3', label:'Tempo',          pct:'70–80%', color:ZC[2], lpm:`${Math.round(fm*0.70)}–${Math.round(fm*0.80)}` },
    { z:'Z4', label:'Umbral',         pct:'80–90%', color:ZC[3], lpm:`${Math.round(fm*0.80)}–${Math.round(fm*0.90)}` },
    { z:'Z5', label:'VO2max',         pct:'> 90%',  color:ZC[4], lpm:`> ${Math.round(fm*0.90)}` },
  ]

  const zonasWatts = form.tienePotenciometro && ftpEstimado > 0 ? [
    { z:'Z1', pct:'< 55%',    w:`< ${Math.round(ftpEstimado*0.55)}W` },
    { z:'Z2', pct:'55–75%',   w:`${Math.round(ftpEstimado*0.55)}–${Math.round(ftpEstimado*0.75)}W` },
    { z:'Z3', pct:'75–90%',   w:`${Math.round(ftpEstimado*0.75)}–${Math.round(ftpEstimado*0.90)}W` },
    { z:'Z4', pct:'90–105%',  w:`${Math.round(ftpEstimado*0.90)}–${Math.round(ftpEstimado*1.05)}W` },
    { z:'Z5', pct:'> 105%',   w:`> ${Math.round(ftpEstimado*1.05)}W` },
  ] : null

  return (
    <div className="page">
      <div className="ph">
        <h1>Mi <em>perfil</em></h1>
        <p>La IA usa estos datos para personalizar cada análisis, plan y protocolo de nutrición</p>
      </div>

      <div className="g2" style={{marginBottom:20}}>
        <div className="card">
          <div className="stit" style={{marginBottom:16}}>Datos personales</div>
          <div className="fg">
            <label className="fl">Nombre</label>
            <input type="text" value={form.nombre||''} onChange={e=>set('nombre',e.target.value)} placeholder="Tu nombre"/>
          </div>
          <div className="fr">
            <div className="fg" style={{marginBottom:0}}>
              <label className="fl">Edad</label>
              <input type="number" value={form.edad||''} onChange={e=>set('edad',e.target.value)} placeholder="30" min="10" max="100"/>
            </div>
            <div className="fg" style={{marginBottom:0}}>
              <label className="fl">Peso (kg)</label>
              <input type="number" value={form.peso||''} onChange={e=>set('peso',e.target.value)} placeholder="70" step="0.5"/>
            </div>
          </div>
          <div className="fr" style={{marginTop:14}}>
            <div className="fg" style={{marginBottom:0}}>
              <label className="fl">FC máxima (lpm)</label>
              <input type="number" value={form.fcmax||185} onChange={e=>set('fcmax',e.target.value)} placeholder="185"/>
            </div>
            <div className="fg" style={{marginBottom:0}}>
              <label className="fl">FC reposo (lpm)</label>
              <input type="number" value={form.fcrest||55} onChange={e=>set('fcrest',e.target.value)} placeholder="55"/>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="stit" style={{marginBottom:16}}>Entrenamiento</div>
          <div className="fg">
            <label className="fl">Nivel</label>
            <select value={form.nivel||'recreativo'} onChange={e=>set('nivel',e.target.value)}>
              <option value="novato">Novato (menos de 6 meses)</option>
              <option value="recreativo">Recreativo (6m–2 años)</option>
              <option value="amateur">Amateur (2+ años)</option>
              <option value="avanzado">Avanzado / competitivo</option>
            </select>
          </div>
          <div className="fg">
            <label className="fl">Objetivo principal</label>
            <select value={form.objetivo||'salud y adherencia'} onChange={e=>set('objetivo',e.target.value)}>
              <option value="salud y adherencia">Salud general y adherencia</option>
              <option value="composición corporal">Composición corporal</option>
              <option value="resistencia">Mejorar resistencia aeróbica</option>
              <option value="velocidad">Mejorar velocidad / potencia</option>
              <option value="competir">Preparación para evento</option>
            </select>
          </div>
          <div className="fg">
            <label className="fl">Días disponibles / semana</label>
            <select value={form.dias||3} onChange={e=>set('dias',e.target.value)}>
              {[2,3,4,5,6].map(n=><option key={n} value={n}>{n} días</option>)}
            </select>
          </div>
          <div className="fg" style={{marginBottom:0}}>
            <label className="fl">Horarios preferidos</label>
            <select value={form.horariosDisponibles||'mañana'} onChange={e=>set('horariosDisponibles',e.target.value)}>
              <option value="mañana">Mañana (antes del trabajo)</option>
              <option value="mediodía">Mediodía</option>
              <option value="tarde">Tarde / noche</option>
              <option value="fin de semana">Solo fines de semana</option>
              <option value="flexible">Flexible</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card" style={{marginBottom:20}}>
        <div className="stit" style={{marginBottom:4}}>Dónde entrenas</div>
        <p style={{fontSize:12,color:'var(--text2)',marginBottom:14,lineHeight:1.6}}>
          La IA ajusta automáticamente las zonas de FC, hidratación y esfuerzo esperado según tu altitud y clima.
        </p>
        <div className="fr">
          <div className="fg" style={{flex:2,marginBottom:0}}>
            <label className="fl">Ciudad o lugar habitual</label>
            <input type="text" value={form.ciudad||''} onChange={e=>set('ciudad',e.target.value)}
              placeholder="ej. Villahermosa, Zumpango, Ciudad de México, París..."/>
          </div>
          <div className="fg" style={{marginBottom:0}}>
            <label className="fl">Altitud (msnm)</label>
            <input type="number" value={form.altitud||''} onChange={e=>set('altitud',e.target.value)} placeholder="ej. 2200"/>
          </div>
        </div>
        <div className="fr" style={{marginTop:14}}>
          <div className="fg" style={{marginBottom:0}}>
            <label className="fl">Clima típico</label>
            <select value={form.clima||'templado'} onChange={e=>set('clima',e.target.value)}>
              <option value="tropical caluroso">Tropical / caluroso y húmedo (+30°C)</option>
              <option value="cálido seco">Cálido seco (25-35°C, baja humedad)</option>
              <option value="templado">Templado (15-25°C)</option>
              <option value="frío">Frío (&lt; 15°C)</option>
              <option value="variable">Variable / según temporada</option>
            </select>
          </div>
          <div className="fg" style={{marginBottom:0}}>
            <label className="fl">Tipo de ruta habitual</label>
            <input type="text" value={form.ruta||''} onChange={e=>set('ruta',e.target.value)}
              placeholder="ej. carretera plana, calles urbanas, lomeríos..."/>
          </div>
        </div>

        {form.ciudad && (
          <div style={{marginTop:14,padding:'10px 14px',background:'var(--bg4)',borderRadius:'var(--r)',fontSize:12,color:'var(--text2)',lineHeight:1.7}}>
            <strong style={{color:'var(--text)'}}>La IA usará "{form.ciudad}" para:</strong> ajustar las zonas de FC por altitud
            {form.altitud > 1500 ? ` (a ${form.altitud}m el VO2max baja ~${Math.round((form.altitud-500)/300)*3}% vs nivel del mar)` : ''},
            calcular hidratación por clima {form.clima === 'tropical caluroso' ? '(+200-300ml/hora por calor y humedad)' : ''},
            y dar recomendaciones de horario.
            {form.clima === 'tropical caluroso' && <span style={{color:'#e09850'}}> · Ideal rodar antes de las 8am o después de las 5pm.</span>}
          </div>
        )}
      </div>

      <div className="card" style={{marginBottom:20}}>
        <div className="stit" style={{marginBottom:4}}>Equipamiento de medición</div>
        <p style={{fontSize:12,color:'var(--text2)',marginBottom:14,lineHeight:1.6}}>
          Con potenciómetro el plan es más preciso — pero funciona perfectamente solo con FC.
        </p>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16}}>
          <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:14}}>
            <input type="checkbox" checked={!!form.tienePotenciometro}
              onChange={e=>set('tienePotenciometro',e.target.checked)}
              style={{width:16,height:16,cursor:'pointer'}}/>
            Tengo potenciómetro
          </label>
          {form.tienePotenciometro && (
            <span style={{fontSize:11,color:'var(--green2)',fontFamily:'var(--fm)'}}>
              El plan usará vatios en lugar de FC
            </span>
          )}
        </div>

        {form.tienePotenciometro && (
          <div className="fr">
            <div className="fg" style={{marginBottom:0}}>
              <label className="fl">FTP (vatios)</label>
              <input type="number" value={form.ftp||''} onChange={e=>set('ftp',e.target.value)}
                placeholder={`estimado: ${ftpEstimado}W`}/>
            </div>
            <div style={{flex:1,padding:'8px 12px',background:'var(--bg4)',borderRadius:'var(--r)',fontSize:12,color:'var(--text2)',alignSelf:'flex-end'}}>
              {form.ftp > 0
                ? `FTP: ${form.ftp}W · ${(form.ftp/(form.peso||70)).toFixed(1)} W/kg · ${form.ftp > 250 ? 'Muy bueno' : form.ftp > 180 ? 'Bueno' : 'En desarrollo'}`
                : `Sin FTP registrado — usaremos ${ftpEstimado}W estimado por tu nivel y peso`
              }
            </div>
          </div>
        )}

        {form.tienePotenciometro && zonasWatts && (
          <div style={{marginTop:14}}>
            <div style={{fontSize:11,fontFamily:'var(--fm)',color:'var(--text3)',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.5px'}}>
              Tus zonas de potencia (FTP: {ftpEstimado}W)
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6}}>
              {zonasWatts.map((z,i)=>(
                <div key={z.z} style={{background:'var(--bg4)',borderRadius:'var(--r)',padding:'10px 12px',borderTop:`3px solid ${ZC[i]}`}}>
                  <div style={{fontSize:10,fontFamily:'var(--fm)',color:ZC[i],marginBottom:3}}>{z.z}</div>
                  <div style={{fontSize:11,fontWeight:500,marginBottom:2}}>{z.w}</div>
                  <div style={{fontSize:10,color:'var(--text3)'}}>{z.pct} FTP</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{marginBottom:24}}>
        <div className="stit" style={{marginBottom:4}}>Zonas de frecuencia cardíaca</div>
        <p style={{fontSize:12,color:'var(--text2)',marginBottom:12}}>
          Calculadas con tu FCmax de <strong style={{color:'var(--text)'}}>{fm} lpm</strong>
          {form.altitud > 1500 && <span style={{color:'#e09850'}}> · A {form.altitud}m de altitud tu FC se eleva — confía más en la sensación que en los números exactos</span>}
        </p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8}}>
          {zonas.map(z=>(
            <div key={z.z} style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'var(--r)',padding:'12px 14px',borderTop:`3px solid ${z.color}`}}>
              <div style={{fontSize:10,fontFamily:'var(--fm)',color:z.color,marginBottom:4}}>{z.z}</div>
              <div style={{fontSize:13,fontWeight:500,marginBottom:2}}>{z.label}</div>
              <div style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--fm)'}}>{z.lpm} lpm</div>
              <div style={{fontSize:10,color:'var(--text3)'}}>{z.pct}</div>
            </div>
          ))}
        </div>
      </div>

      <button className="btn bp" onClick={save} style={{padding:'11px 28px'}}>Guardar perfil</button>
      {saved && <span style={{fontSize:12,color:'var(--green)',marginLeft:14}}>Perfil guardado ✓</span>}
    </div>
  )
}
