import React, { useState } from 'react'

export default function Perfil({ profile, saveProfile }) {
  const [form, setForm] = useState({ ...profile })
  const [saved, setSaved] = useState(false)

  function set(k, v) { setForm(f=>({...f,[k]:v})); setSaved(false) }

  function save() {
    saveProfile({
      ...form,
      edad: parseInt(form.edad)||0,
      peso: parseFloat(form.peso)||0,
      fcmax: parseInt(form.fcmax)||185,
      fcrest: parseInt(form.fcrest)||55,
      dias: parseInt(form.dias)||3,
    })
    setSaved(true)
    setTimeout(()=>setSaved(false), 2500)
  }

  return (
    <div className="page">
      <div className="ph">
        <h1>Mi <em>perfil</em></h1>
        <p>La IA usa estos datos para personalizar cada análisis y plan</p>
      </div>

      <div className="g2" style={{marginBottom:24}}>
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
          <div className="stit" style={{marginBottom:16}}>Contexto de entrenamiento</div>
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
            <label className="fl">Condiciones de ruta habituales</label>
            <input type="text" value={form.ruta||''} onChange={e=>set('ruta',e.target.value)} placeholder="ej. calles planas urbanas, calor, tráfico..."/>
          </div>
        </div>
      </div>

      <div className="card" style={{marginBottom:24}}>
        <div className="stit" style={{marginBottom:16}}>Zonas de FC personalizadas</div>
        <p style={{fontSize:13,color:'var(--text2)',marginBottom:12}}>
          Con tu FCmax de <strong style={{color:'var(--text)'}}>{form.fcmax||185} lpm</strong>, tus zonas de entrenamiento son:
        </p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8}}>
          {[
            {z:'Z1',label:'Recuperación',pct:'< 60%',color:'#6db86a'},
            {z:'Z2',label:'Base aeróbica',pct:'60–70%',color:'#a8d5a2'},
            {z:'Z3',label:'Tempo',pct:'70–80%',color:'#e8c97a'},
            {z:'Z4',label:'Umbral',pct:'80–90%',color:'#e09850'},
            {z:'Z5',label:'VO2max',pct:'> 90%',color:'#e07070'},
          ].map(z=>{
            const fm = parseInt(form.fcmax)||185
            const ranges = {Z1:`< ${Math.round(fm*0.6)}`,Z2:`${Math.round(fm*0.6)}–${Math.round(fm*0.7)}`,Z3:`${Math.round(fm*0.7)}–${Math.round(fm*0.8)}`,Z4:`${Math.round(fm*0.8)}–${Math.round(fm*0.9)}`,Z5:`> ${Math.round(fm*0.9)}`}
            return (
              <div key={z.z} style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'var(--r)',padding:'12px 14px',borderTop:`3px solid ${z.color}`}}>
                <div style={{fontSize:10,fontFamily:'var(--fm)',color:z.color,marginBottom:4}}>{z.z}</div>
                <div style={{fontSize:13,fontWeight:500,marginBottom:2}}>{z.label}</div>
                <div style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--fm)'}}>{ranges[z.z]} lpm</div>
                <div style={{fontSize:10,color:'var(--text3)'}}>{z.pct}</div>
              </div>
            )
          })}
        </div>
      </div>

      <button className="btn bp" onClick={save} style={{padding:'11px 28px'}}>Guardar perfil</button>
      {saved && <span style={{fontSize:12,color:'var(--green)',marginLeft:14}}>Perfil guardado ✓</span>}
    </div>
  )
}
