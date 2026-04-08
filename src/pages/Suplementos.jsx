import React, { useState, useEffect } from 'react'
import IABox from '../components/IABox'
import { callIA, buildSuppPrompt } from '../hooks/useIA'

const CATALOG = [
  { group:'Energía y rendimiento', items:[
    { label:'Cafeína', n:'Cafeína', d:'200mg', t:'pre-entreno', o:'Reducir RPE y mejorar resistencia aeróbica' },
    { label:'Nitratos / jugo de remolacha', n:'Nitratos (remolacha)', d:'500ml jugo', t:'pre-entreno', o:'Mejorar eficiencia metabólica ~2-3%' },
    { label:'Geles de carbohidratos', n:'Carbohidratos en gel', d:'1 gel (25g)', t:'durante', o:'Mantener glucemia en rodadas +90min' },
    { label:'Electrolitos', n:'Electrolitos', d:'1 sobre', t:'durante', o:'Prevenir calambres e hiponatremia' },
    { label:'Taurina', n:'Taurina', d:'1-2g', t:'pre-entreno', o:'Antioxidante, posible mejora de rendimiento' },
  ]},
  { group:'Recuperación', items:[
    { label:'Proteína whey', n:'Proteína de suero (Whey)', d:'25-30g', t:'post-entreno', o:'Síntesis muscular post-ejercicio' },
    { label:'Creatina monohidrato', n:'Creatina monohidrato', d:'5g', t:'diario', o:'Potencia en sprints y recuperación' },
    { label:'Magnesio', n:'Magnesio', d:'300-400mg', t:'antes de dormir', o:'Mejorar sueño y reducir calambres' },
    { label:'Omega-3', n:'Omega-3', d:'2-3g', t:'con desayuno', o:'Reducir inflamación y mejorar recuperación' },
    { label:'Vitamina D3', n:'Vitamina D3', d:'2000-4000 UI', t:'con desayuno', o:'Función muscular e inmune' },
  ]},
  { group:'Hidratación', items:[
    { label:'Sales de rehidratación', n:'Sales de rehidratación', d:'1 sobre', t:'durante', o:'Rehidratación en rodadas con calor intenso' },
    { label:'Bebida isotónica', n:'Bebida isotónica', d:'500ml', t:'durante', o:'Carbohidratos + electrolitos en esfuerzos largos' },
  ]},
]

export default function Suplementos({ supps, addSupp, deleteSupp, profile }) {
  const [sel, setSel] = useState('')
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [timing, setTiming] = useState('pre-entreno')
  const [goal, setGoal] = useState('')
  const [iaText, setIaText] = useState('')
  const [iaLoading, setIaLoading] = useState(false)

  function selectCatalog(val) {
    setSel(val)
    if (!val) return
    const found = CATALOG.flatMap(g=>g.items).find(i=>i.label===val)
    if (found) { setName(found.n); setDose(found.d); setTiming(found.t); setGoal(found.o) }
  }

  async function add() {
    if (!name.trim()) return alert('Ingresa el nombre del suplemento')
    addSupp({ n:name.trim(), d:dose.trim(), t:timing, o:goal.trim() })
    setSel(''); setName(''); setDose(''); setGoal('')
    analyzeStack([...supps, { n:name.trim(), d:dose.trim(), t:timing, o:goal.trim() }])
  }

  async function analyzeStack(stack) {
    if (!stack.length) return
    setIaLoading(true)
    const t = await callIA(buildSuppPrompt(stack, profile), 280)
    setIaText(t)
    setIaLoading(false)
  }

  useEffect(() => { if (supps.length > 0) analyzeStack(supps) }, [])

  return (
    <div className="page">
      <div className="ph">
        <h1><em>Suplementación</em></h1>
        <p>La IA integra tu stack en cada análisis de entrenamiento y plan semanal</p>
      </div>

      <div className="g2" style={{marginBottom:20}}>
        <div className="card">
          <div className="stit" style={{marginBottom:16}}>Agregar suplemento</div>

          <div className="fg">
            <label className="fl">Selecciona del catálogo</label>
            <select value={sel} onChange={e=>selectCatalog(e.target.value)}>
              <option value="">— Elige un suplemento —</option>
              {CATALOG.map(g=>(
                <optgroup key={g.group} label={g.group}>
                  {g.items.map(i=><option key={i.label} value={i.label}>{i.label}</option>)}
                </optgroup>
              ))}
              <option value="otro">Otro (personalizado)</option>
            </select>
          </div>

          <div className="fg">
            <label className="fl">Nombre <span style={{color:'var(--text3)',fontSize:10,textTransform:'none'}}>(editable)</span></label>
            <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre del suplemento"/>
          </div>

          <div className="fr">
            <div className="fg" style={{marginBottom:0}}>
              <label className="fl">Dosis</label>
              <input type="text" value={dose} onChange={e=>setDose(e.target.value)} placeholder="ej. 5g, 200mg"/>
            </div>
            <div className="fg" style={{marginBottom:0}}>
              <label className="fl">Momento</label>
              <select value={timing} onChange={e=>setTiming(e.target.value)}>
                {['pre-entreno','durante','post-entreno','antes de dormir','con desayuno','diario'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="fg" style={{marginTop:14, marginBottom:16}}>
            <label className="fl">Objetivo</label>
            <input type="text" value={goal} onChange={e=>setGoal(e.target.value)} placeholder="ej. recuperación, energía, sueño..."/>
          </div>

          <button className="btn bp btn-full" onClick={add}>Agregar al stack</button>
        </div>

        <div>
          <div className="stit">Stack actual</div>
          {supps.length === 0
            ? <p style={{color:'var(--text3)',fontSize:13}}>Sin suplementos registrados.</p>
            : supps.map(s=>(
              <div key={s.id} className="supc">
                <div>
                  <div className="supn">{s.n}{s.d ? ` · ${s.d}` : ''}</div>
                  <div className="supd">{s.o||''}</div>
                  <div className="supt">{s.t}</div>
                </div>
                <button className="suprm" onClick={()=>deleteSupp(s.id)}>×</button>
              </div>
            ))
          }
          {(iaText || iaLoading) && (
            <IABox text={iaText} label="Análisis de tu stack" loading={iaLoading}/>
          )}
        </div>
      </div>

      <div className="card">
        <div className="stit">Evidencia científica en ciclismo</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,marginTop:8}}>
          <div className="al ai"><strong>Cafeína 3–6 mg/kg</strong> — Mejora resistencia y reduce RPE en ejercicio &gt;1h. (Burke 2008, Spriet 2014)</div>
          <div className="al ai"><strong>Nitratos / remolacha</strong> — Mejora eficiencia metabólica ~2-3%. Consumir 2-3h antes. (Jones 2014)</div>
          <div className="al ai"><strong>Proteína 1.6–2 g/kg/día</strong> — Esencial para recuperación muscular post-sesión intensa.</div>
          <div className="al ai"><strong>Creatina 5g/día</strong> — Beneficios en sprints. Débil evidencia en resistencia pura.</div>
          <div className="al aw"><strong>Bicarbonato de sodio</strong> — Útil en alta intensidad corta. Efectos GI variables — protocolo gradual.</div>
          <div className="al aw"><strong>Magnesio 200–400mg</strong> — Deficiencia común en deportistas. Mejora sueño y reduce calambres.</div>
        </div>
      </div>
    </div>
  )
}
