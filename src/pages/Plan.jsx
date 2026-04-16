import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { callIA, buildPlanPrompt, buildCompetitionPlanDetailed, calcFitness, interpretFitness, tssOf, extractJSON } from '../hooks/useIA'

const IC = {Z1:'#6db86a',Z2:'#a8d5a2',Z3:'#e8c97a',Z3:'#e8c97a',Z4:'#e09850',Z5:'#e07070'}
const ZC = {Z1:'#6db86a',Z2:'#a8d5a2',Z3:'#e8c97a',Z4:'#e09850',Z5:'#e07070',
            'rodaje suave':'#a8d5a2','rodaje continuo':'#a8d5a2','intervalos':'#e07070',
            'salida larga':'#e8c97a','recuperación activa':'#6db86a'}

function FitnessBar({ label, value, max, color, hint }) {
  const pct = Math.min(Math.max((value/max)*100, 0), 100)
  return (
    <div style={{marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:4}}>
        <span style={{fontSize:11,fontFamily:'var(--fm)',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px'}}>{label}</span>
        <span style={{fontSize:13,fontWeight:500,color}}>{value}</span>
      </div>
      <div style={{height:4,background:'var(--bg4)',borderRadius:2,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct}%`,background:color,borderRadius:2,transition:'width .6s'}}/>
      </div>
      {hint && <div style={{fontSize:10,color:'var(--text3)',marginTop:3,lineHeight:1.4}}>{hint}</div>}
    </div>
  )
}

function WeeklyBars({ rides, mode }) {
  const now = new Date()
  if (mode === 'month') {
    const months = []
    for (let m=11;m>=0;m--) {
      const d  = new Date(now.getFullYear(), now.getMonth()-m, 1)
      const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      const mRides = rides.filter(r=>r.iso.startsWith(mk))
      const tss = mRides.reduce((a,r)=>a+tssOf(r),0)
      months.push({ label:d.toLocaleDateString('es-MX',{month:'short'}), tss, current:m===0 })
    }
    const mx = Math.max(...months.map(m=>m.tss),1)
    return (
      <div style={{marginTop:14}}>
        <div style={{fontSize:10,fontFamily:'var(--fm)',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>TSS por mes (últimos 12)</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(12,1fr)',gap:3,alignItems:'flex-end',height:64}}>
          {months.map((m,i)=>(
            <div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
              <div style={{fontSize:8,color:'var(--text3)'}}>{m.tss||''}</div>
              <div style={{width:'100%',background:m.current?'#3a7a38':'var(--bg4)',borderRadius:'2px 2px 0 0',height:`${Math.max(m.tss/mx*48,m.tss>0?4:0)}px`}}/>
              <div style={{fontSize:7,color:'var(--text3)'}}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (mode === 'year') {
    const ym = {}
    rides.forEach(r=>{ const y=new Date(r.iso).getFullYear(); ym[y]=(ym[y]||0)+tssOf(r) })
    const years = Object.entries(ym).sort(([a],[b])=>a-b)
    const mx = Math.max(...years.map(([,t])=>t),1)
    return (
      <div style={{marginTop:14}}>
        <div style={{fontSize:10,fontFamily:'var(--fm)',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>TSS por año</div>
        <div style={{display:'flex',gap:8,alignItems:'flex-end',height:64}}>
          {years.map(([y,tss])=>(
            <div key={y} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,flex:1}}>
              <div style={{fontSize:9,color:'var(--text3)'}}>{tss}</div>
              <div style={{width:'100%',background:String(y)===String(now.getFullYear())?'#3a7a38':'var(--bg4)',borderRadius:'2px 2px 0 0',height:`${Math.max(tss/mx*48,4)}px`}}/>
              <div style={{fontSize:9,color:'var(--text3)'}}>{y}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  const weeks = []
  for (let w=7;w>=0;w--) {
    const wEnd=new Date(now); wEnd.setDate(now.getDate()-w*7)
    const wStart=new Date(wEnd); wStart.setDate(wEnd.getDate()-7)
    const mo=(wStart.getDay()+6)%7; wStart.setDate(wStart.getDate()-mo+7)
    const wr=rides.filter(r=>{ const d=new Date(r.iso); return d>=wStart&&d<wEnd })
    const tss=wr.reduce((a,r)=>a+tssOf(r),0)
    weeks.push({ label:wStart.toLocaleDateString('es-MX',{day:'numeric',month:'short'}), tss, current:w===0 })
  }
  const mx=Math.max(...weeks.map(w=>w.tss),1)
  return (
    <div style={{marginTop:14}}>
      <div style={{fontSize:10,fontFamily:'var(--fm)',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>TSS por semana (últimas 8)</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(8,1fr)',gap:4,alignItems:'flex-end',height:64}}>
        {weeks.map((w,i)=>(
          <div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
            <div style={{fontSize:9,color:'var(--text3)'}}>{w.tss||''}</div>
            <div style={{width:'100%',background:w.current?'#3a7a38':'var(--bg4)',borderRadius:'2px 2px 0 0',height:`${Math.max(w.tss/mx*48,w.tss>0?4:0)}px`}}/>
            <div style={{fontSize:8,color:'var(--text3)',textAlign:'center',lineHeight:1.2}}>{w.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function NextWeekRange() {
  const now=new Date(),dow=now.getDay(),toMon=dow===0?1:dow===1?7:8-dow
  const nm=new Date(now); nm.setDate(now.getDate()+toMon)
  const ns=new Date(nm); ns.setDate(nm.getDate()+6)
  const fmt=d=>d.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'short'})
  return <span style={{color:'var(--text)',fontWeight:500}}>{fmt(nm)} → {fmt(ns)}</span>
}

// ── Tarjeta de sesión con check de completado
function SesionCard({ s, weekIdx, sesionIdx, planType, onComplete }) {
  const color = ZC[s.zona||s.zona_principal||s.tipo] || '#a8d5a2'
  const done  = s.completada

  return (
    <div className="pc" style={{opacity: done ? 0.6 : 1, position:'relative'}}>
      {done && (
        <div style={{position:'absolute',top:12,right:12,background:'#6db86a',color:'#fff',
          borderRadius:20,padding:'2px 10px',fontSize:11,fontFamily:'var(--fm)'}}>
          ✓ Completada
        </div>
      )}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
        <div className="pd">{s.dia}</div>
        <span style={{fontSize:11,padding:'2px 10px',borderRadius:20,
          border:`1px solid ${color}40`,background:`${color}15`,color,fontFamily:'var(--fm)'}}>
          {s.zona||s.zona_principal||s.intensidad||'Z2'}
        </span>
      </div>
      <div className="pt">{s.titulo}</div>
      {s.lenguaje_simple && (
        <div style={{fontSize:13,color:'var(--text)',margin:'6px 0',padding:'8px 12px',
          background:'var(--bg4)',borderRadius:'var(--r)',borderLeft:'3px solid var(--green2)'}}>
          "{s.lenguaje_simple}"
        </div>
      )}
      <div className="pdesc">{s.descripcion}</div>
      <div className="pm" style={{marginBottom:10}}>
        <span className="pmi">Duración: <strong>{s.duracion_min}min</strong></span>
        <span className="pmi">RPE: <strong>{s.rpe_objetivo}/10</strong></span>
        {s.fc_objetivo && <span className="pmi">FC: <strong>{s.fc_objetivo}</strong></span>}
      </div>
      {s.hidratacion && (
        <div style={{background:'rgba(122,184,232,0.06)',border:'1px solid rgba(122,184,232,0.2)',
          borderRadius:'var(--r)',padding:'10px 14px',marginBottom:10}}>
          <div style={{fontSize:10,color:'#7ab8e8',fontFamily:'var(--fm)',marginBottom:4,textTransform:'uppercase'}}>
            💧 Hidratación
          </div>
          <div style={{fontSize:12,color:'var(--text2)'}}>{s.hidratacion}</div>
          {s.nota_clima && <div style={{fontSize:11,color:'#e09850',marginTop:4,fontStyle:'italic'}}>{s.nota_clima}</div>}
        </div>
      )}
      {s.hidratacion_nutricion && (
        <div style={{background:'rgba(122,184,232,0.06)',border:'1px solid rgba(122,184,232,0.2)',
          borderRadius:'var(--r)',padding:'10px 14px',marginBottom:10}}>
          <div style={{fontSize:10,color:'#7ab8e8',fontFamily:'var(--fm)',marginBottom:4,textTransform:'uppercase'}}>
            💧 Hidratación y nutrición
          </div>
          <div style={{fontSize:13,fontWeight:500,color:'var(--text)',marginBottom:4}}>{s.hidratacion_nutricion.llevar}</div>
          <div style={{fontSize:12,color:'var(--text2)'}}>{s.hidratacion_nutricion.protocolo}</div>
          {s.hidratacion_nutricion.nota_clima && <div style={{fontSize:11,color:'#e09850',marginTop:4,fontStyle:'italic'}}>{s.hidratacion_nutricion.nota_clima}</div>}
        </div>
      )}
      {!done && (
        <button onClick={()=>onComplete(weekIdx, sesionIdx)}
          style={{width:'100%',padding:'9px',borderRadius:'var(--r)',cursor:'pointer',
            border:'1px solid var(--green2)',background:'transparent',color:'var(--green2)',
            fontSize:13,marginTop:4,transition:'all .15s'}}
          onMouseOver={e=>{e.currentTarget.style.background='rgba(109,184,106,0.1)'}}
          onMouseOut={e=>{e.currentTarget.style.background='transparent'}}>
          ✓ Marcar como completada
        </button>
      )}
    </div>
  )
}

export default function Plan({ rides, supps, profile, activePlan, savePlan, clearPlan, completeSesion }) {
  const nav = useNavigate()
  const [planMode, setPlanMode]     = useState('weekly')
  const [barMode, setBarMode]       = useState('week')
  const [plan, setPlan]             = useState(null)
  const [compPlan, setCompPlan]     = useState(activePlan?.type === 'competition' ? activePlan : null)
  const [loading, setLoading]       = useState(false)
  const [context, setContext]       = useState('')
  const [diasSemana, setDiasSemana] = useState(profile.dias || 3)
  const [error, setError]           = useState('')
  const [expandedWeek, setExpandedWeek] = useState(0)

  // Competition fields
  const [compName, setCompName] = useState(activePlan?.competencia || '')
  const [compDate, setCompDate] = useState(activePlan?.fecha_competencia || '')
  const [compDist, setCompDist] = useState(activePlan?.distancia_km || '')
  const [compType, setCompType] = useState('cicloturismo / gran fondo')
  const [compGoal, setCompGoal] = useState(activePlan?.meta || '')

  const fit    = calcFitness(rides)
  const interp = interpretFitness(fit)
  const { atlStatus, ctlStatus, tsbStatus } = interp

  if (rides.length < 2) return (
    <div className="page">
      <div className="ph"><h1>Plan de <em>entrenamiento</em></h1></div>
      <div className="card" style={{textAlign:'center',padding:32}}>
        <p style={{color:'var(--text2)',fontSize:14,marginBottom:16}}>Necesitas al menos 2 rodadas para generar un plan.</p>
        <button className="btn bp" onClick={()=>nav('/registrar')}>Ir a registrar</button>
      </div>
    </div>
  )

  async function genWeeklyPlan() {
    setLoading(true); setError(''); setPlan(null)
    const pf  = { ...profile, dias: diasSemana }
    const raw = await callIA(buildPlanPrompt(rides, supps, pf, context), 2000)
    const parsed = extractJSON(raw)
    if (parsed) {
      const withType = { ...parsed, type:'weekly', generatedAt: new Date().toISOString() }
      setPlan(withType)
      savePlan(withType)
    } else {
      setError('La IA no devolvió un plan válido. Intenta de nuevo.')
    }
    setLoading(false)
  }

  async function genCompPlan() {
    if (!compName || !compDate) return alert('Ingresa nombre y fecha de la competencia')
    setLoading(true); setError(''); setCompPlan(null)
    const comp = { name:compName, date:compDate, distance:compDist, type:compType, goal:compGoal }
    const raw  = await callIA(buildCompetitionPlanDetailed(rides, supps, profile, comp), 3000)
    const parsed = extractJSON(raw)
    if (parsed) {
      const withType = { ...parsed, type:'competition', generatedAt: new Date().toISOString() }
      setCompPlan(withType)
      savePlan(withType)
      setExpandedWeek(0)
    } else {
      setError('La IA no devolvió un plan válido. Intenta de nuevo.')
    }
    setLoading(false)
  }

  function handleComplete(weekIdx, sesionIdx) {
    completeSesion(compPlan ? 'competition' : 'weekly', weekIdx, sesionIdx)
    // Update local state too
    if (compPlan) {
      setCompPlan(prev => {
        const updated = { ...prev }
        const semanas = [...(updated.semanas||[])]
        if (semanas[weekIdx]) {
          const sems = { ...semanas[weekIdx] }
          const sess = [...(sems.sesiones||[])]
          if (sess[sesionIdx]) sess[sesionIdx] = { ...sess[sesionIdx], completada:true }
          sems.sesiones = sess
          semanas[weekIdx] = sems
          updated.semanas = semanas
        }
        return updated
      })
    } else if (plan) {
      setPlan(prev => {
        const updated = { ...prev }
        const sesiones = [...(updated.sesiones||[])]
        if (sesiones[sesionIdx]) sesiones[sesionIdx] = { ...sesiones[sesionIdx], completada:true }
        updated.sesiones = sesiones
        return updated
      })
    }
  }

  // Progreso del plan de competencia
  const compProgress = compPlan?.semanas ? (() => {
    const total     = compPlan.semanas.reduce((a,s)=>a+(s.sesiones?.length||0),0)
    const completed = compPlan.semanas.reduce((a,s)=>a+(s.sesiones?.filter(x=>x.completada).length||0),0)
    return { total, completed, pct: total>0 ? Math.round(completed/total*100) : 0 }
  })() : null

  // Días hasta la competencia
  const daysToComp = compPlan?.fecha_competencia
    ? Math.round((new Date(compPlan.fecha_competencia)-new Date())/86400000)
    : null

  return (
    <div className="page">
      <div className="ph">
        <h1>Plan de <em>entrenamiento</em></h1>
        <p>Calculado sobre tu estado de forma real — no genérico</p>
      </div>

      {/* MODO SELECTOR */}
      <div style={{display:'flex',gap:6,marginBottom:20}}>
        {[['weekly','Plan semanal'],['competition','Plan para competencia']].map(([m,l])=>(
          <button key={m} onClick={()=>{setPlanMode(m);setError('')}}
            className={'btn'+(planMode===m?' bp':'')} style={{fontSize:13}}>
            {l}
          </button>
        ))}
      </div>

      {/* FITNESS + PANEL */}
      <div className="g2" style={{marginBottom:20}}>
        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div className="stit" style={{marginBottom:0}}>Estado de forma</div>
            <div style={{display:'flex',gap:4}}>
              {[['week','Sem'],['month','Mes'],['year','Año']].map(([m,l])=>(
                <button key={m} onClick={()=>setBarMode(m)}
                  style={{padding:'3px 10px',borderRadius:'var(--r)',fontSize:11,cursor:'pointer',
                    background:barMode===m?'var(--green3)':'var(--bg4)',
                    border:`1px solid ${barMode===m?'var(--green2)':'var(--border2)'}`,
                    color:barMode===m?'#fff':'var(--text2)'}}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <FitnessBar label="ATL — Carga aguda 7d" value={fit.atl} max={80} color={atlStatus.color} hint={`${atlStatus.label} · ${atlStatus.tip}`}/>
          <FitnessBar label="CTL — Forma base 42d" value={fit.ctl} max={100} color={ctlStatus.color} hint={`${ctlStatus.label} · ${ctlStatus.tip}`}/>
          <FitnessBar label="TSB — Balance" value={Math.abs(fit.tsb)} max={40} color={tsbStatus.color} hint={`${fit.tsb>0?'+':''}${fit.tsb} · ${tsbStatus.label} · ${tsbStatus.tip}`}/>
          <div style={{display:'flex',gap:14,flexWrap:'wrap',marginTop:8,fontSize:11,fontFamily:'var(--fm)',color:'var(--text3)'}}>
            <span>Último: <strong style={{color:'var(--text)'}}>hace {fit.daysSinceLast}d</strong></span>
            <span>TSS prom: <strong style={{color:'var(--text)'}}>{fit.avgWeekTSS}</strong></span>
            <span>TSS max: <strong style={{color:'var(--text)'}}>{fit.maxWeekTSS}</strong></span>
          </div>
          <WeeklyBars rides={rides} mode={barMode}/>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginTop:12}}>
            {[['Rodadas',fit.totalRides,'total'],['Kilómetros',fit.totalKm,'km'],['Horas',fit.totalHours,'h'],['TSS total',fit.totalTSS,'pts']].map(([l,v,u])=>(
              <div key={l} style={{background:'var(--bg4)',borderRadius:'var(--r)',padding:'8px 10px',textAlign:'center'}}>
                <div style={{fontSize:10,color:'var(--text3)',marginBottom:2,fontFamily:'var(--fm)'}}>{l}</div>
                <div style={{fontSize:16,fontWeight:500}}>{v}<span style={{fontSize:10,color:'var(--text2)',marginLeft:2}}>{u}</span></div>
              </div>
            ))}
          </div>
          <div style={{marginTop:10,padding:'8px 12px',background:'var(--bg4)',borderRadius:'var(--r)',fontSize:10,color:'var(--text3)'}}>
            <em>Foster (2001), Allen &amp; Coggan (2010). Estimación por RPE y duración.</em>
          </div>
        </div>

        {/* PANEL DERECHO */}
        <div className="card">
          {planMode === 'weekly' ? (
            <>
              <div className="stit" style={{marginBottom:12}}>Esta semana</div>
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,color:'var(--text2)',marginBottom:8}}>
                  ¿Cuántos días puedes entrenar <strong style={{color:'var(--text)'}}>esta semana</strong>?
                </div>
                <div style={{display:'flex',gap:8}}>
                  {[2,3,4,5,6].map(n=>(
                    <button key={n} onClick={()=>setDiasSemana(n)}
                      style={{flex:1,padding:'10px 0',borderRadius:'var(--r)',cursor:'pointer',fontSize:16,fontWeight:500,
                        border:diasSemana===n?'2px solid var(--green2)':'1px solid var(--border)',
                        background:diasSemana===n?'rgba(109,184,106,0.15)':'var(--bg4)',
                        color:diasSemana===n?'var(--green2)':'var(--text2)',transition:'all .15s'}}>
                      {n}
                    </button>
                  ))}
                </div>
                <div style={{fontSize:11,color:'var(--text3)',marginTop:6,textAlign:'center'}}>
                  {diasSemana===2&&'Semana de recuperación o muy ocupada'}
                  {diasSemana===3&&'Mínimo recomendado para progresar'}
                  {diasSemana===4&&'Buena frecuencia — permite polarización correcta'}
                  {diasSemana===5&&'Alta frecuencia — incluye sesión de recuperación'}
                  {diasSemana===6&&'Carga alta — incluye sesión muy suave obligatoria'}
                </div>
              </div>
              <div style={{background:'var(--bg4)',borderRadius:'var(--r)',padding:'8px 12px',marginBottom:12,fontSize:12,color:'var(--text2)'}}>
                El plan cubrirá: <NextWeekRange/>
              </div>
              <textarea value={context} onChange={e=>setContext(e.target.value)}
                placeholder="Algo extra para la IA: rodada grupal el sábado, me duele la rodilla, máx 45min por sesión..."
                style={{minHeight:70,marginBottom:10}}/>
              <div style={{fontSize:11,color:'var(--text3)',marginBottom:12,fontStyle:'italic'}}>
                Polarización: <strong style={{color:'var(--text)'}}>{fit.zAvg[0]+fit.zAvg[1]}%</strong> baja / <strong style={{color:'var(--text)'}}>{fit.zAvg[3]+fit.zAvg[4]}%</strong> alta · ideal 80/20
              </div>
              <button className="btn bp btn-full" onClick={genWeeklyPlan} disabled={loading}>
                {loading&&<span className="spin"/>}
                {plan?'Regenerar plan':'Generar plan semanal'}
              </button>
            </>
          ) : (
            <>
              <div className="stit" style={{marginBottom:14}}>Datos de la competencia</div>
              <div className="fg">
                <label className="fl">Nombre del evento</label>
                <input type="text" value={compName} onChange={e=>setCompName(e.target.value)} placeholder="L'Étape, Gran Fondo, Cicloturista..."/>
              </div>
              <div className="fr">
                <div className="fg" style={{marginBottom:0}}>
                  <label className="fl">Fecha</label>
                  <input type="date" value={compDate} onChange={e=>setCompDate(e.target.value)}/>
                </div>
                <div className="fg" style={{marginBottom:0}}>
                  <label className="fl">Distancia (km)</label>
                  <input type="number" value={compDist} onChange={e=>setCompDist(e.target.value)} placeholder="135"/>
                </div>
              </div>
              <div className="fg" style={{marginTop:14}}>
                <label className="fl">Tipo de evento</label>
                <select value={compType} onChange={e=>setCompType(e.target.value)}>
                  {['cicloturismo / gran fondo','criterium / carrera','contrarreloj','enduro / XCO','challenge de resistencia'].map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="fg" style={{marginBottom:14}}>
                <label className="fl">Meta personal</label>
                <input type="text" value={compGoal} onChange={e=>setCompGoal(e.target.value)} placeholder="Terminar en menos de 5 horas..."/>
              </div>
              {compPlan && (
                <button onClick={()=>{setCompPlan(null);clearPlan()}}
                  style={{width:'100%',padding:'8px',borderRadius:'var(--r)',cursor:'pointer',marginBottom:10,
                    border:'1px solid var(--border)',background:'transparent',color:'var(--text3)',fontSize:12}}>
                  Borrar plan actual y regenerar
                </button>
              )}
              <button className="btn bp btn-full" onClick={genCompPlan} disabled={loading}>
                {loading&&<span className="spin"/>}
                {compPlan?'Regenerar plan':'Generar plan de periodización'}
              </button>
            </>
          )}
        </div>
      </div>

      {loading&&(
        <div className="card" style={{textAlign:'center',padding:40}}>
          <span className="spin" style={{marginRight:10}}/>
          <span style={{color:'var(--text2)',fontSize:14}}>
            {planMode==='competition'?'Generando plan semana por semana — puede tardar 20-30 segundos...':'Calculando plan óptimo...'}
          </span>
        </div>
      )}

      {error&&<div className="al ar" style={{marginBottom:16}}>{error}</div>}

      {/* ── PLAN SEMANAL */}
      {plan&&!loading&&planMode==='weekly'&&(
        <>
          {plan.diagnostico_semana&&(
            <div className="iab" style={{marginBottom:16}}>
              <div className="iah"><div className="iad"/><span className="iat">Diagnóstico</span></div>
              <div className="iatx">{plan.diagnostico_semana}</div>
              {plan.tss_semana_total&&(
                <div style={{marginTop:6,fontSize:11,fontFamily:'var(--fm)',color:'var(--text3)'}}>
                  TSS planificado: <strong style={{color:'var(--text)'}}>{plan.tss_semana_total}</strong> · Promedio histórico: {fit.avgWeekTSS}
                </div>
              )}
            </div>
          )}
          {plan.sesiones?.map((s,i)=>(
            <SesionCard key={i} s={s} weekIdx={null} sesionIdx={i} planType="weekly" onComplete={handleComplete}/>
          ))}
          {plan.consejo_semana&&(
            <div style={{marginBottom:12,padding:'12px 16px',background:'rgba(109,184,106,0.08)',border:'1px solid rgba(109,184,106,0.2)',borderRadius:'var(--r)'}}>
              <div style={{fontSize:10,fontFamily:'var(--fm)',color:'var(--green2)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.5px'}}>Consejo de la semana</div>
              <div style={{fontSize:13,color:'var(--text)'}}>{plan.consejo_semana}</div>
            </div>
          )}
          {plan.referencias&&<div style={{fontSize:11,color:'var(--text3)',marginTop:8,fontFamily:'var(--fm)',padding:'8px 0',borderTop:'1px solid var(--border)'}}>{plan.referencias}</div>}
        </>
      )}

      {/* ── PLAN COMPETENCIA DETALLADO */}
      {compPlan&&!loading&&planMode==='competition'&&(
        <>
          {/* Header del plan */}
          <div className="card" style={{marginBottom:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
              <div>
                <div style={{fontSize:16,fontWeight:600}}>{compPlan.competencia}</div>
                <div style={{fontSize:12,color:'var(--text3)',marginTop:2}}>
                  {compPlan.distancia_km}km · Meta: {compPlan.meta}
                  {daysToComp !== null && <span style={{marginLeft:10,color:daysToComp<14?'#e07070':daysToComp<30?'#e09850':'var(--green2)',fontWeight:500}}> · {daysToComp} días restantes</span>}
                </div>
              </div>
              {compProgress && (
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:22,fontWeight:600,color:'var(--green2)'}}>{compProgress.pct}%</div>
                  <div style={{fontSize:11,color:'var(--text3)'}}>{compProgress.completed}/{compProgress.total} sesiones</div>
                </div>
              )}
            </div>
            {/* Barra de progreso */}
            {compProgress && (
              <div style={{height:6,background:'var(--bg4)',borderRadius:3,overflow:'hidden',marginBottom:10}}>
                <div style={{height:'100%',width:`${compProgress.pct}%`,background:'var(--green2)',borderRadius:3,transition:'width .5s'}}/>
              </div>
            )}
            <div style={{fontSize:13,color:'var(--text2)',lineHeight:1.6}}>{compPlan.resumen}</div>
            {compPlan.consejo_general&&(
              <div style={{marginTop:10,padding:'8px 12px',background:'rgba(109,184,106,0.08)',borderRadius:'var(--r)',fontSize:12,color:'var(--text)',borderLeft:'3px solid var(--green2)'}}>
                {compPlan.consejo_general}
              </div>
            )}
          </div>

          {/* Semanas acordeón */}
          {compPlan.semanas?.map((semana, wi) => {
            const sesTotal = semana.sesiones?.length || 0
            const sesDone  = semana.sesiones?.filter(s=>s.completada).length || 0
            const isOpen   = expandedWeek === wi
            const faseColor = semana.fase==='Base'?'#a8d5a2':semana.fase==='Intensificación'?'#e09850':'#e07070'

            return (
              <div key={wi} style={{marginBottom:8,border:'1px solid var(--border)',borderRadius:'var(--rl)',overflow:'hidden'}}>
                {/* Header semana */}
                <button onClick={()=>setExpandedWeek(isOpen?-1:wi)}
                  style={{width:'100%',background:isOpen?'var(--bg3)':'var(--bg2)',border:'none',cursor:'pointer',
                    padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',textAlign:'left'}}>
                  <div style={{display:'flex',alignItems:'center',gap:12}}>
                    <div style={{width:4,height:36,background:faseColor,borderRadius:2,flexShrink:0}}/>
                    <div>
                      <div style={{fontSize:14,fontWeight:600,color:'var(--text)'}}>Semana {semana.numero}</div>
                      <div style={{fontSize:11,color:'var(--text3)',marginTop:1}}>
                        <span style={{color:faseColor,fontFamily:'var(--fm)'}}>{semana.fase}</span>
                        {semana.objetivo && <span style={{marginLeft:8}}>· {semana.objetivo}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:12,color:'var(--text2)'}}>{sesDone}/{sesTotal} sesiones</div>
                      {sesDone===sesTotal&&sesTotal>0&&<div style={{fontSize:10,color:'var(--green2)'}}>✓ Completa</div>}
                    </div>
                    <span style={{color:'var(--text3)',fontSize:18}}>{isOpen?'▲':'▼'}</span>
                  </div>
                </button>

                {/* Sesiones expandidas */}
                {isOpen && (
                  <div style={{padding:'0 16px 16px'}}>
                    {semana.nota_semana&&(
                      <div style={{padding:'10px 14px',background:'var(--bg4)',borderRadius:'var(--r)',margin:'12px 0',fontSize:12,color:'var(--text2)',fontStyle:'italic'}}>
                        {semana.nota_semana}
                      </div>
                    )}
                    {semana.sesiones?.map((s,si)=>(
                      <SesionCard key={si} s={s} weekIdx={wi} sesionIdx={si} planType="competition" onComplete={handleComplete}/>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Protocolo día de competencia */}
          {compPlan.protocolo_competencia&&(
            <div className="card" style={{marginTop:16}}>
              <div className="stit" style={{marginBottom:12}}>🏁 Protocolo día de competencia</div>
              {[
                ['Día anterior', compPlan.protocolo_competencia.dia_antes],
                ['Mañana de la carrera', compPlan.protocolo_competencia.manana_carrera],
                ['Durante la carrera', compPlan.protocolo_competencia.durante],
                ['Al terminar', compPlan.protocolo_competencia.post],
              ].filter(([,v])=>v).map(([label,val])=>(
                <div key={label} style={{marginBottom:12,paddingBottom:12,borderBottom:'1px solid var(--border)'}}>
                  <div style={{fontSize:11,fontFamily:'var(--fm)',color:'var(--text3)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.5px'}}>{label}</div>
                  <div style={{fontSize:13,color:'var(--text2)',lineHeight:1.6}}>{val}</div>
                </div>
              ))}
            </div>
          )}

          {compPlan.referencias&&<div style={{fontSize:11,color:'var(--text3)',marginTop:12,fontFamily:'var(--fm)',padding:'8px 0',borderTop:'1px solid var(--border)'}}>{compPlan.referencias}</div>}
        </>
      )}
    </div>
  )
}
