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
    { label:'Beta-alanina', n:'Beta-alanina', d:'3.2g', t:'diario', o:'Reducir fatiga muscular en esfuerzos de alta intensidad' },
  ]},
  { group:'Recuperación', items:[
    { label:'Proteína whey', n:'Proteína de suero (Whey)', d:'25-30g', t:'post-entreno', o:'Síntesis muscular post-ejercicio' },
    { label:'Creatina monohidrato', n:'Creatina monohidrato', d:'5g', t:'diario', o:'Potencia en sprints y recuperación' },
    { label:'Magnesio', n:'Magnesio', d:'300-400mg', t:'antes de dormir', o:'Mejorar sueño y reducir calambres' },
    { label:'Omega-3', n:'Omega-3', d:'2-3g', t:'con desayuno', o:'Reducir inflamación y mejorar recuperación' },
    { label:'Vitamina D3', n:'Vitamina D3', d:'2000-4000 UI', t:'con desayuno', o:'Función muscular e inmune' },
    { label:'Ashwagandha', n:'Ashwagandha', d:'300-600mg', t:'antes de dormir', o:'Reducir cortisol y mejorar recuperación' },
  ]},
  { group:'Hidratación', items:[
    { label:'Sales de rehidratación', n:'Sales de rehidratación', d:'1 sobre', t:'durante', o:'Rehidratación en rodadas con calor intenso' },
    { label:'Bebida isotónica', n:'Bebida isotónica', d:'500ml', t:'durante', o:'Carbohidratos + electrolitos en esfuerzos largos' },
  ]},
]

const EVIDENCE = {
  'sólida': { color:'#6db86a', label:'Evidencia sólida' },
  'moderada': { color:'#e8c97a', label:'Evidencia moderada' },
  'débil': { color:'#e07070', label:'Evidencia débil' },
}

export default function Suplementos({ supps, addSupp, deleteSupp, profile, rides = [] }) {
  const [sel, setSel] = useState('')
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [timing, setTiming] = useState('pre-entreno')
  const [goal, setGoal] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [iaLoading, setIaLoading] = useState(false)
  // Seguimiento diario: { [suppId]: { [dateKey]: bool } }
  const [tracking, setTracking] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ri3_supp_track') || '{}') } catch { return {} }
  })

  function saveTracking(t) {
    setTracking(t)
    localStorage.setItem('ri3_supp_track', JSON.stringify(t))
  }

  function toggleTrack(suppId) {
    const today = new Date().toISOString().slice(0, 10)
    const t = { ...tracking }
    if (!t[suppId]) t[suppId] = {}
    t[suppId][today] = !t[suppId][today]
    saveTracking(t)
  }

  function getStreak(suppId) {
    const log = tracking[suppId] || {}
    let streak = 0
    const d = new Date()
    while (true) {
      const key = d.toISOString().slice(0, 10)
      if (log[key]) { streak++; d.setDate(d.getDate() - 1) }
      else break
    }
    return streak
  }

  function isTodayTracked(suppId) {
    const today = new Date().toISOString().slice(0, 10)
    return !!(tracking[suppId]?.[today])
  }

  function selectCatalog(val) {
    setSel(val)
    if (!val) return
    const found = CATALOG.flatMap(g => g.items).find(i => i.label === val)
    if (found) { setName(found.n); setDose(found.d); setTiming(found.t); setGoal(found.o) }
  }

  async function add() {
    if (!name.trim()) return alert('Ingresa el nombre del suplemento')
    const newSupp = { n: name.trim(), d: dose.trim(), t: timing, o: goal.trim() }
    addSupp(newSupp)
    setSel(''); setName(''); setDose(''); setGoal('')
    analyzeStack([...supps, newSupp])
  }

  async function analyzeStack(stack) {
    if (!stack.length) return
    setIaLoading(true)
    setAnalysis(null)
    const raw = await callIA(buildSuppPrompt(stack, profile, rides), 600)
    try {
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
      setAnalysis(parsed)
    } catch {
      setAnalysis({ analisis_general: raw })
    }
    setIaLoading(false)
  }

  useEffect(() => {
    if (supps.length > 0) analyzeStack(supps)
  }, [supps.length])

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="page">
      <div className="ph">
        <h1><em>Suplementación</em></h1>
        <p>Protocolo personalizado según tu estado de forma y tipo de sesión</p>
      </div>

      <div className="g2" style={{marginBottom:20}}>
        {/* FORM */}
        <div className="card">
          <div className="stit" style={{marginBottom:16}}>Agregar suplemento</div>
          <div className="fg">
            <label className="fl">Selecciona del catálogo</label>
            <select value={sel} onChange={e => selectCatalog(e.target.value)}>
              <option value="">— Elige un suplemento —</option>
              {CATALOG.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map(i => <option key={i.label} value={i.label}>{i.label}</option>)}
                </optgroup>
              ))}
              <option value="otro">Otro (personalizado)</option>
            </select>
          </div>
          <div className="fg">
            <label className="fl">Nombre</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del suplemento"/>
          </div>
          <div className="fr">
            <div className="fg" style={{marginBottom:0}}>
              <label className="fl">Dosis</label>
              <input type="text" value={dose} onChange={e => setDose(e.target.value)} placeholder="ej. 5g, 200mg"/>
            </div>
            <div className="fg" style={{marginBottom:0}}>
              <label className="fl">Momento</label>
              <select value={timing} onChange={e => setTiming(e.target.value)}>
                {['pre-entreno','durante','post-entreno','antes de dormir','con desayuno','diario'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="fg" style={{marginTop:14,marginBottom:16}}>
            <label className="fl">Objetivo</label>
            <input type="text" value={goal} onChange={e => setGoal(e.target.value)} placeholder="ej. recuperación, energía, sueño..."/>
          </div>
          <button className="btn bp btn-full" onClick={add}>Agregar al stack</button>
        </div>

        {/* STACK + TRACKING */}
        <div>
          <div className="stit">Stack actual — seguimiento de hoy</div>
          {supps.length === 0
            ? <p style={{color:'var(--text3)',fontSize:13}}>Sin suplementos registrados.</p>
            : supps.map(s => {
              const tracked = isTodayTracked(s.id)
              const streak = getStreak(s.id)
              return (
                <div key={s.id} className="supc" style={{flexDirection:'column',alignItems:'stretch',gap:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                    <div>
                      <div className="supn">{s.n}{s.d ? ` · ${s.d}` : ''}</div>
                      <div className="supd">{s.o || ''}</div>
                      <div className="supt">{s.t}</div>
                    </div>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      {streak > 0 && (
                        <span style={{fontSize:10,fontFamily:'var(--fm)',color:'var(--amber)',border:'1px solid rgba(232,201,122,0.3)',padding:'2px 7px',borderRadius:20}}>
                          {streak}d racha
                        </span>
                      )}
                      <button
                        onClick={() => toggleTrack(s.id)}
                        style={{background: tracked ? 'var(--green3)' : 'var(--bg4)', border:`1px solid ${tracked ? 'var(--green2)' : 'var(--border2)'}`, borderRadius:'var(--r)', padding:'5px 12px', cursor:'pointer', fontSize:12, color: tracked ? '#fff' : 'var(--text2)', transition:'all .15s', fontFamily:'var(--fb)'}}
                      >
                        {tracked ? '✓ Tomado hoy' : 'Marcar hoy'}
                      </button>
                      <button className="suprm" onClick={() => deleteSupp(s.id)}>×</button>
                    </div>
                  </div>
                </div>
              )
            })
          }
        </div>
      </div>

      {/* IA ANALYSIS */}
      {iaLoading && (
        <div className="iab" style={{marginBottom:20}}>
          <div className="iah"><div className="iad"/><span className="iat">Analizando tu stack...</span></div>
          <div className="iatx"><span className="spin" style={{marginRight:8}}/>Generando análisis personalizado</div>
        </div>
      )}

      {analysis && !iaLoading && (
        <>
          {/* Análisis general */}
          <div className="iab" style={{marginBottom:16}}>
            <div className="iah"><div className="iad"/><span className="iat">Análisis de tu stack</span></div>
            <div className="iatx">{analysis.analisis_general}</div>
          </div>

          {/* Por suplemento */}
          {analysis.por_suplemento?.length > 0 && (
            <div style={{marginBottom:16}}>
              <div className="stit" style={{marginBottom:12}}>Análisis por suplemento</div>
              {analysis.por_suplemento.map((s, i) => {
                const ev = EVIDENCE[s.evidencia] || EVIDENCE['moderada']
                return (
                  <div key={i} className="card" style={{marginBottom:10,padding:'14px 18px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                      <div style={{fontSize:14,fontWeight:500}}>{s.nombre}</div>
                      <span style={{fontSize:10,fontFamily:'var(--fm)',color:ev.color,border:`1px solid ${ev.color}40`,padding:'2px 9px',borderRadius:20,background:`${ev.color}12`}}>{ev.label}</span>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,fontSize:12}}>
                      <div>
                        <div style={{color:'var(--text3)',fontFamily:'var(--fm)',fontSize:10,marginBottom:2}}>TIMING ÓPTIMO</div>
                        <div style={{color:'var(--text)'}}>{s.timing_optimo}</div>
                      </div>
                      <div>
                        <div style={{color:'var(--text3)',fontFamily:'var(--fm)',fontSize:10,marginBottom:2}}>AJUSTE SUGERIDO</div>
                        <div style={{color:'var(--text)'}}>{s.ajuste_sugerido || 'Sin cambios'}</div>
                      </div>
                    </div>
                    {s.con_este_perfil && (
                      <div style={{marginTop:8,fontSize:12,color:'var(--green2)',borderTop:'1px solid var(--border)',paddingTop:8}}>
                        {s.con_este_perfil}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Protocolo por tipo de día */}
          {analysis.protocolo_semana && (
            <div className="card" style={{marginBottom:20}}>
              <div className="stit" style={{marginBottom:14}}>Protocolo según tipo de sesión</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
                {[
                  {key:'dia_intenso', label:'Día de intensidad', color:'#e09850'},
                  {key:'dia_z2', label:'Día aeróbico / Z2', color:'#a8d5a2'},
                  {key:'dia_descanso', label:'Día de descanso', color:'#7ab8e8'},
                ].map(({key, label, color}) => (
                  <div key={key} style={{background:'var(--bg3)',borderRadius:'var(--r)',padding:'12px 14px',borderTop:`3px solid ${color}`}}>
                    <div style={{fontSize:11,fontFamily:'var(--fm)',color,marginBottom:8,textTransform:'uppercase',letterSpacing:'0.5px'}}>{label}</div>
                    {(analysis.protocolo_semana[key] || []).map((item, i) => (
                      <div key={i} style={{fontSize:12,color:'var(--text)',marginBottom:4,paddingLeft:8,borderLeft:`2px solid ${color}40`}}>{item}</div>
                    ))}
                    {(!analysis.protocolo_semana[key] || analysis.protocolo_semana[key].length === 0) && (
                      <div style={{fontSize:12,color:'var(--text3)'}}>Solo hidratación</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.referencias && (
            <div style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--fm)',padding:'10px 0',borderTop:'1px solid var(--border)'}}>
              {analysis.referencias}
            </div>
          )}
        </>
      )}

      {/* Evidencia base */}
      <div className="card" style={{marginTop:20}}>
        <div className="stit">Base de evidencia científica</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,marginTop:8}}>
          <div className="al ai"><strong>Cafeína 3–6 mg/kg</strong> — Mejora resistencia y reduce RPE en ejercicio &gt;1h. (Burke 2008, Spriet 2014)</div>
          <div className="al ai"><strong>Nitratos / remolacha</strong> — Mejora eficiencia metabólica ~2-3%. Consumir 2-3h antes. (Jones 2014)</div>
          <div className="al ai"><strong>Proteína 1.6–2 g/kg/día</strong> — Esencial para recuperación muscular post-sesión intensa.</div>
          <div className="al ai"><strong>Creatina 5g/día</strong> — Beneficios en sprints. Débil evidencia en resistencia pura. (Lanhers 2017)</div>
          <div className="al aw"><strong>Beta-alanina 3.2g/día</strong> — Reduce fatiga en esfuerzos 1-10min. Sensación de hormigueo normal.</div>
          <div className="al aw"><strong>Magnesio 200–400mg</strong> — Deficiencia común en deportistas. Mejora sueño y reduce calambres.</div>
        </div>
      </div>
    </div>
  )
}
