import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { callIA, buildPlanPrompt, buildCompetitionPlanDetailed, calcFitness, interpretFitness, tssOf, extractJSON } from '../hooks/useIA'

const ZC = {Z1:'#6db86a',Z2:'#a8d5a2',Z3:'#e8c97a',Z4:'#e09850',Z5:'#e07070',
  'rodaje suave':'#a8d5a2','rodaje continuo':'#a8d5a2','intervalos':'#e07070',
  'salida larga':'#e8c97a','recuperación activa':'#6db86a','base':'#a8d5a2',
  'intensificación':'#e09850','tapering':'#e07070'}

function zoneColor(s) {
  return ZC[s?.zona||s?.zona_principal||s?.intensidad||s?.tipo||''] || '#a8d5a2'
}

// ── Barra de forma
function FitnessBar({ label, value, max, color, hint }) {
  const pct = Math.min(Math.max((value/max)*100,0),100)
  return (
    <div style={{marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
        <span style={{fontSize:11,fontFamily:'var(--fm)',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px'}}>{label}</span>
        <span style={{fontSize:13,fontWeight:500,color}}>{value}</span>
      </div>
      <div style={{height:4,background:'var(--bg4)',borderRadius:2,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct}%`,background:color,borderRadius:2,transition:'width .6s'}}/>
      </div>
      {hint&&<div style={{fontSize:10,color:'var(--text3)',marginTop:3,lineHeight:1.4}}>{hint}</div>}
    </div>
  )
}

// ── Mini barras TSS
function WeeklyBars({ rides, mode }) {
  const now=new Date()
  if (mode==='month') {
    const months=[]; for(let m=11;m>=0;m--){const d=new Date(now.getFullYear(),now.getMonth()-m,1);const mk=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;const t=rides.filter(r=>r.iso.startsWith(mk)).reduce((a,r)=>a+tssOf(r),0);months.push({label:d.toLocaleDateString('es-MX',{month:'short'}),tss:t,current:m===0})}
    const mx=Math.max(...months.map(m=>m.tss),1)
    return(<div style={{marginTop:14}}><div style={{fontSize:10,fontFamily:'var(--fm)',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>TSS mensual</div><div style={{display:'grid',gridTemplateColumns:'repeat(12,1fr)',gap:3,alignItems:'flex-end',height:56}}>{months.map((m,i)=><div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}><div style={{width:'100%',background:m.current?'#3a7a38':'var(--bg4)',borderRadius:'2px 2px 0 0',height:`${Math.max(m.tss/mx*44,m.tss>0?4:0)}px`}}/><div style={{fontSize:7,color:'var(--text3)'}}>{m.label}</div></div>)}</div></div>)
  }
  if (mode==='year') {
    const ym={}; rides.forEach(r=>{const y=new Date(r.iso).getFullYear();ym[y]=(ym[y]||0)+tssOf(r)}); const years=Object.entries(ym).sort(([a],[b])=>a-b); const mx=Math.max(...years.map(([,t])=>t),1)
    return(<div style={{marginTop:14}}><div style={{fontSize:10,fontFamily:'var(--fm)',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>TSS anual</div><div style={{display:'flex',gap:8,alignItems:'flex-end',height:56}}>{years.map(([y,tss])=><div key={y} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,flex:1}}><div style={{fontSize:9,color:'var(--text3)'}}>{tss}</div><div style={{width:'100%',background:String(y)===String(now.getFullYear())?'#3a7a38':'var(--bg4)',borderRadius:'2px 2px 0 0',height:`${Math.max(tss/mx*44,4)}px`}}/><div style={{fontSize:9,color:'var(--text3)'}}>{y}</div></div>)}</div></div>)
  }
  const weeks=[]; for(let w=7;w>=0;w--){const wE=new Date(now);wE.setDate(now.getDate()-w*7);const wS=new Date(wE);wS.setDate(wE.getDate()-7);const mo=(wS.getDay()+6)%7;wS.setDate(wS.getDate()-mo+7);const wr=rides.filter(r=>{const d=new Date(r.iso);return d>=wS&&d<wE});const tss=wr.reduce((a,r)=>a+tssOf(r),0);weeks.push({label:wS.toLocaleDateString('es-MX',{day:'numeric',month:'short'}),tss,current:w===0})}
  const mx=Math.max(...weeks.map(w=>w.tss),1)
  return(<div style={{marginTop:14}}><div style={{fontSize:10,fontFamily:'var(--fm)',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>TSS semanal (últimas 8)</div><div style={{display:'grid',gridTemplateColumns:'repeat(8,1fr)',gap:4,alignItems:'flex-end',height:56}}>{weeks.map((w,i)=><div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}><div style={{fontSize:9,color:'var(--text3)'}}>{w.tss||''}</div><div style={{width:'100%',background:w.current?'#3a7a38':'var(--bg4)',borderRadius:'2px 2px 0 0',height:`${Math.max(w.tss/mx*44,w.tss>0?4:0)}px`}}/><div style={{fontSize:8,color:'var(--text3)',textAlign:'center',lineHeight:1.2}}>{w.label}</div></div>)}</div></div>)
}

function NextWeekRange() {
  const now=new Date(),dow=now.getDay(),toMon=dow===0?1:dow===1?7:8-dow
  const nm=new Date(now);nm.setDate(now.getDate()+toMon)
  const ns=new Date(nm);ns.setDate(nm.getDate()+6)
  const fmt=d=>d.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'short'})
  return <span style={{color:'var(--text)',fontWeight:500}}>{fmt(nm)} → {fmt(ns)}</span>
}

// ── Tarjeta de sesión
function SesionCard({ s, onComplete }) {
  const color = zoneColor(s)
  const done  = s.completada
  return (
    <div style={{background:'var(--bg3)',border:`1px solid ${done?'rgba(109,184,106,0.3)':'var(--border)'}`,borderRadius:'var(--rl)',padding:'16px 18px',marginBottom:10,opacity:done?.75:1}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
        <div>
          <div style={{fontSize:11,fontFamily:'var(--fm)',color:'var(--text3)',marginBottom:3}}>{s.dia?.toUpperCase()}</div>
          <div style={{fontSize:15,fontWeight:600}}>{s.titulo}</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
          <span style={{fontSize:11,padding:'2px 10px',borderRadius:20,border:`1px solid ${color}40`,background:`${color}15`,color,fontFamily:'var(--fm)'}}>
            {s.zona||s.zona_principal||s.intensidad||'Z2'}
          </span>
          {done&&<span style={{fontSize:11,color:'#6db86a',fontFamily:'var(--fm)'}}>✓</span>}
        </div>
      </div>

      {s.lenguaje_simple&&(
        <div style={{fontSize:13,color:'var(--text)',margin:'8px 0',padding:'8px 12px',background:'var(--bg4)',borderRadius:'var(--r)',borderLeft:'3px solid var(--green2)'}}>
          "{s.lenguaje_simple}"
        </div>
      )}
      <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.7,marginBottom:10}}>{s.descripcion}</div>

      <div style={{display:'flex',gap:16,flexWrap:'wrap',fontSize:11,fontFamily:'var(--fm)',color:'var(--text3)',marginBottom:10}}>
        <span>⏱ <strong style={{color:'var(--text)'}}>{s.duracion_min}min</strong></span>
        <span>RPE <strong style={{color:'var(--text)'}}>{s.rpe_objetivo}/10</strong></span>
        {s.fc_objetivo&&<span>FC <strong style={{color:'var(--text)'}}>{s.fc_objetivo}</strong></span>}
      </div>

      {/* Hidratación */}
      {(s.hidratacion||s.hidratacion_nutricion)&&(
        <div style={{background:'rgba(122,184,232,0.06)',border:'1px solid rgba(122,184,232,0.2)',borderRadius:'var(--r)',padding:'10px 14px',marginBottom:10}}>
          <div style={{fontSize:10,color:'#7ab8e8',fontFamily:'var(--fm)',marginBottom:4,textTransform:'uppercase'}}>💧 Hidratación</div>
          <div style={{fontSize:12,color:'var(--text2)'}}>
            {s.hidratacion || `${s.hidratacion_nutricion?.llevar} — ${s.hidratacion_nutricion?.protocolo}`}
          </div>
          {(s.nota_clima||s.hidratacion_nutricion?.nota_clima)&&(
            <div style={{fontSize:11,color:'#e09850',marginTop:4,fontStyle:'italic'}}>{s.nota_clima||s.hidratacion_nutricion?.nota_clima}</div>
          )}
        </div>
      )}

      {onComplete&&!done&&(
        <button onClick={onComplete}
          style={{width:'100%',padding:'8px',borderRadius:'var(--r)',cursor:'pointer',
            border:'1px solid var(--green2)',background:'transparent',color:'var(--green2)',fontSize:12,transition:'all .15s'}}
          onMouseOver={e=>e.currentTarget.style.background='rgba(109,184,106,0.1)'}
          onMouseOut={e=>e.currentTarget.style.background='transparent'}>
          ✓ Marcar como completada
        </button>
      )}
    </div>
  )
}

// ── Vista del plan guardado (seguimiento)
function ActivePlanView({ plan, onComplete, onClear }) {
  const [expandedWeek, setExpandedWeek] = useState(0)
  const isComp = plan.type === 'competition'
  const daysToComp = plan.fecha_competencia
    ? Math.round((new Date(plan.fecha_competencia)-new Date())/86400000) : null

  // Progreso
  const allSessions = isComp
    ? (plan.semanas||[]).flatMap(s=>s.sesiones||[])
    : (plan.sesiones||[])
  const done     = allSessions.filter(s=>s.completada).length
  const total    = allSessions.length
  const progress = total>0 ? Math.round(done/total*100) : 0

  return (
    <div>
      {/* Header del plan activo */}
      <div className="card" style={{marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
          <div>
            <div style={{fontSize:11,fontFamily:'var(--fm)',color:'var(--text3)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.5px'}}>
              Plan activo · {isComp ? 'Competencia' : 'Semanal'}
            </div>
            <div style={{fontSize:17,fontWeight:600}}>{isComp ? plan.competencia : 'Plan semanal'}</div>
            {isComp && (
              <div style={{fontSize:12,color:'var(--text3)',marginTop:2}}>
                {plan.distancia_km}km · Meta: {plan.meta}
                {daysToComp!==null&&(
                  <span style={{marginLeft:10,fontWeight:500,color:daysToComp<14?'#e07070':daysToComp<30?'#e09850':'#6db86a'}}>
                    · {daysToComp} días restantes
                  </span>
                )}
              </div>
            )}
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:24,fontWeight:700,color:'var(--green2)'}}>{progress}%</div>
            <div style={{fontSize:11,color:'var(--text3)'}}>{done}/{total} sesiones</div>
          </div>
        </div>

        {/* Barra de progreso */}
        <div style={{height:6,background:'var(--bg4)',borderRadius:3,overflow:'hidden',marginBottom:12}}>
          <div style={{height:'100%',width:`${progress}%`,background:'var(--green2)',borderRadius:3,transition:'width .5s'}}/>
        </div>

        {plan.resumen&&<div style={{fontSize:13,color:'var(--text2)',lineHeight:1.6,marginBottom:10}}>{plan.resumen}</div>}
        {plan.diagnostico_semana&&<div style={{fontSize:13,color:'var(--text2)',lineHeight:1.6,marginBottom:10}}>{plan.diagnostico_semana}</div>}

        <button onClick={()=>{ if(confirm('¿Borrar el plan activo? Perderás el progreso.')) onClear() }}
          style={{fontSize:12,color:'var(--text3)',background:'none',border:'none',cursor:'pointer',padding:0,textDecoration:'underline'}}>
          Borrar plan activo
        </button>
      </div>

      {/* PLAN SEMANAL — sesiones directas */}
      {!isComp && (
        <>
          {plan.sesiones?.map((s,i)=>(
            <SesionCard key={i} s={s} onComplete={()=>onComplete(null,i)}/>
          ))}
          {plan.consejo_semana&&(
            <div style={{padding:'12px 16px',background:'rgba(109,184,106,0.08)',border:'1px solid rgba(109,184,106,0.2)',borderRadius:'var(--r)',marginBottom:16}}>
              <div style={{fontSize:10,fontFamily:'var(--fm)',color:'var(--green2)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.5px'}}>Consejo de la semana</div>
              <div style={{fontSize:13,color:'var(--text)'}}>{plan.consejo_semana}</div>
            </div>
          )}
        </>
      )}

      {/* PLAN COMPETENCIA — semanas acordeón */}
      {isComp && plan.semanas?.map((sem,wi)=>{
        const sesDone = sem.sesiones?.filter(s=>s.completada).length||0
        const sesTotal= sem.sesiones?.length||0
        const isOpen  = expandedWeek===wi
        const faseColor = sem.fase==='Base'?'#a8d5a2':sem.fase==='Intensificación'?'#e09850':'#e07070'
        return (
          <div key={wi} style={{marginBottom:8,border:'1px solid var(--border)',borderRadius:'var(--rl)',overflow:'hidden'}}>
            <button onClick={()=>setExpandedWeek(isOpen?-1:wi)}
              style={{width:'100%',background:isOpen?'var(--bg3)':'var(--bg2)',border:'none',cursor:'pointer',
                padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',textAlign:'left'}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:4,height:36,background:faseColor,borderRadius:2,flexShrink:0}}/>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:'var(--text)'}}>Semana {sem.numero}</div>
                  <div style={{fontSize:11,color:'var(--text3)',marginTop:1}}>
                    <span style={{color:faseColor,fontFamily:'var(--fm)'}}>{sem.fase}</span>
                    {sem.objetivo&&<span style={{marginLeft:8}}>· {sem.objetivo}</span>}
                  </div>
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:12,color:'var(--text2)'}}>{sesDone}/{sesTotal}</div>
                  {sesDone===sesTotal&&sesTotal>0&&<div style={{fontSize:10,color:'var(--green2)'}}>✓ Lista</div>}
                </div>
                <span style={{color:'var(--text3)',fontSize:16}}>{isOpen?'▲':'▼'}</span>
              </div>
            </button>
            {isOpen&&(
              <div style={{padding:'12px 16px 16px'}}>
                {sem.nota_semana&&<div style={{padding:'8px 12px',background:'var(--bg4)',borderRadius:'var(--r)',marginBottom:10,fontSize:12,color:'var(--text2)',fontStyle:'italic'}}>{sem.nota_semana}</div>}
                {sem.sesiones?.map((s,si)=>(
                  <SesionCard key={si} s={s} onComplete={()=>onComplete(wi,si)}/>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Protocolo competencia */}
      {isComp&&plan.protocolo_competencia&&(
        <div className="card" style={{marginTop:16}}>
          <div className="stit" style={{marginBottom:12}}>🏁 Protocolo día de competencia</div>
          {[['Día anterior',plan.protocolo_competencia.dia_antes],['Mañana de la carrera',plan.protocolo_competencia.manana_carrera],['Durante',plan.protocolo_competencia.durante],['Al terminar',plan.protocolo_competencia.post]].filter(([,v])=>v).map(([l,v])=>(
            <div key={l} style={{marginBottom:10,paddingBottom:10,borderBottom:'1px solid var(--border)'}}>
              <div style={{fontSize:10,fontFamily:'var(--fm)',color:'var(--text3)',marginBottom:3,textTransform:'uppercase',letterSpacing:'0.5px'}}>{l}</div>
              <div style={{fontSize:13,color:'var(--text2)',lineHeight:1.6}}>{v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Plan({ rides, supps, profile, activePlan, savePlan, clearPlan, completeSesion }) {
  const nav = useNavigate()
  const [tab, setTab]           = useState(activePlan ? 'active' : 'generate')
  const [genMode, setGenMode]   = useState('weekly')
  const [barMode, setBarMode]   = useState('week')
  const [preview, setPreview]   = useState(null)   // plan generado pero NO guardado aún
  const [loading, setLoading]   = useState(false)
  const [context, setContext]   = useState('')
  const [diasSemana, setDiasSemana] = useState(profile.dias || 3)
  const [error, setError]       = useState('')

  const [compName, setCompName] = useState('')
  const [compDate, setCompDate] = useState('')
  const [compDist, setCompDist] = useState('')
  const [compType, setCompType] = useState('cicloturismo / gran fondo')
  const [compGoal, setCompGoal] = useState('')

  const fit    = calcFitness(rides)
  const interp = interpretFitness(fit)
  const { atlStatus, ctlStatus, tsbStatus } = interp

  // Cambiar a "mi plan" automáticamente si hay plan activo
  React.useEffect(() => { if (activePlan) setTab('active') }, [activePlan])

  if (rides.length < 2) return (
    <div className="page">
      <div className="ph"><h1>Plan de <em>entrenamiento</em></h1></div>
      <div className="card" style={{textAlign:'center',padding:32}}>
        <p style={{color:'var(--text2)',fontSize:14,marginBottom:16}}>Necesitas al menos 2 rodadas para generar un plan.</p>
        <button className="btn bp" onClick={()=>nav('/registrar')}>Ir a registrar</button>
      </div>
    </div>
  )

  async function genWeekly() {
    setLoading(true); setError(''); setPreview(null)
    const pf  = { ...profile, dias: diasSemana }
    const raw = await callIA(buildPlanPrompt(rides, supps, pf, context), 2200)
    const parsed = extractJSON(raw)
    if (parsed) setPreview({ ...parsed, type:'weekly', generatedAt:new Date().toISOString() })
    else setError('La IA no devolvió un plan válido. Intenta de nuevo.')
    setLoading(false)
  }

  async function genComp() {
    if (!compName||!compDate) return alert('Ingresa nombre y fecha de la competencia')
    setLoading(true); setError(''); setPreview(null)
    const comp = { name:compName, date:compDate, distance:compDist, type:compType, goal:compGoal }
    const raw  = await callIA(buildCompetitionPlanDetailed(rides, supps, profile, comp), 3500)
    const parsed = extractJSON(raw)
    if (parsed) setPreview({ ...parsed, type:'competition', generatedAt:new Date().toISOString() })
    else setError('La IA no devolvió un plan válido. Intenta de nuevo.')
    setLoading(false)
  }

  function savePlanAndSwitch() {
    savePlan(preview)
    setPreview(null)
    setTab('active')
  }

  function handleComplete(weekIdx, sesionIdx) {
    completeSesion(activePlan?.type==='competition'?'competition':'weekly', weekIdx, sesionIdx)
  }

  return (
    <div className="page">
      <div className="ph">
        <h1>Plan de <em>entrenamiento</em></h1>
        <p>Calculado sobre tu estado de forma real — no genérico</p>
      </div>

      {/* TABS PRINCIPALES */}
      <div style={{display:'flex',gap:0,marginBottom:24,borderBottom:'1px solid var(--border)'}}>
        {[
          ['active', activePlan ? '📋 Mi plan activo' : '📋 Sin plan activo'],
          ['generate','➕ Generar nuevo plan'],
        ].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{padding:'10px 20px',background:'none',border:'none',cursor:'pointer',fontSize:13,fontWeight:500,
              color:tab===t?'var(--green2)':'var(--text3)',
              borderBottom:tab===t?'2px solid var(--green2)':'2px solid transparent',
              marginBottom:-1,transition:'all .15s'}}>
            {l}
          </button>
        ))}
      </div>

      {/* ── TAB: MI PLAN ACTIVO */}
      {tab==='active' && (
        activePlan
          ? <ActivePlanView plan={activePlan} onComplete={handleComplete} onClear={()=>{clearPlan();setTab('generate')}}/>
          : <div className="card" style={{textAlign:'center',padding:40}}>
              <div style={{fontSize:32,marginBottom:12}}>📋</div>
              <div style={{fontSize:15,fontWeight:500,marginBottom:8}}>No tienes un plan activo</div>
              <div style={{fontSize:13,color:'var(--text2)',marginBottom:20}}>Genera un plan semanal o de competencia y guárdalo para darle seguimiento aquí.</div>
              <button className="btn bp" onClick={()=>setTab('generate')}>Generar mi primer plan</button>
            </div>
      )}

      {/* ── TAB: GENERAR */}
      {tab==='generate' && (
        <>
          {/* Estado de forma + generador */}
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
              <FitnessBar label="TSB — Balance" value={Math.abs(fit.tsb)} max={40} color={tsbStatus.color} hint={`${fit.tsb>0?'+':''}${fit.tsb} · ${tsbStatus.label}`}/>
              <div style={{display:'flex',gap:14,flexWrap:'wrap',marginTop:8,fontSize:11,fontFamily:'var(--fm)',color:'var(--text3)'}}>
                <span>Último: <strong style={{color:'var(--text)'}}>hace {fit.daysSinceLast}d</strong></span>
                <span>TSS prom/sem: <strong style={{color:'var(--text)'}}>{fit.avgWeekTSS}</strong></span>
              </div>
              <WeeklyBars rides={rides} mode={barMode}/>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginTop:12}}>
                {[['Rodadas',fit.totalRides,''],['Km',fit.totalKm,'km'],['Horas',fit.totalHours,'h'],['TSS',fit.totalTSS,'pts']].map(([l,v,u])=>(
                  <div key={l} style={{background:'var(--bg4)',borderRadius:'var(--r)',padding:'8px',textAlign:'center'}}>
                    <div style={{fontSize:10,color:'var(--text3)',marginBottom:2,fontFamily:'var(--fm)'}}>{l}</div>
                    <div style={{fontSize:15,fontWeight:500}}>{v}<span style={{fontSize:10,color:'var(--text2)',marginLeft:1}}>{u}</span></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Panel generador */}
            <div className="card">
              <div style={{display:'flex',gap:6,marginBottom:16}}>
                {[['weekly','Semanal'],['competition','Competencia']].map(([m,l])=>(
                  <button key={m} onClick={()=>{setGenMode(m);setPreview(null);setError('')}}
                    className={'btn'+(genMode===m?' bp':'')} style={{fontSize:12,flex:1}}>
                    {l}
                  </button>
                ))}
              </div>

              {genMode==='weekly' ? (
                <>
                  <div style={{fontSize:12,color:'var(--text2)',marginBottom:8}}>¿Cuántos días esta semana?</div>
                  <div style={{display:'flex',gap:6,marginBottom:14}}>
                    {[2,3,4,5,6].map(n=>(
                      <button key={n} onClick={()=>setDiasSemana(n)}
                        style={{flex:1,padding:'9px 0',borderRadius:'var(--r)',cursor:'pointer',fontSize:15,fontWeight:500,
                          border:diasSemana===n?'2px solid var(--green2)':'1px solid var(--border)',
                          background:diasSemana===n?'rgba(109,184,106,0.15)':'var(--bg4)',
                          color:diasSemana===n?'var(--green2)':'var(--text2)'}}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <div style={{background:'var(--bg4)',borderRadius:'var(--r)',padding:'8px 12px',marginBottom:10,fontSize:11,color:'var(--text2)'}}>
                    Semana: <NextWeekRange/>
                  </div>
                  <textarea value={context} onChange={e=>setContext(e.target.value)}
                    placeholder="Algo extra: rodada grupal el sábado, me duele la rodilla, máx 45min..."
                    style={{minHeight:60,marginBottom:10,fontSize:12}}/>
                  <button className="btn bp btn-full" onClick={genWeekly} disabled={loading}>
                    {loading&&<span className="spin"/>} Generar plan semanal
                  </button>
                </>
              ) : (
                <>
                  <div className="fg"><label className="fl">Nombre del evento</label>
                    <input type="text" value={compName} onChange={e=>setCompName(e.target.value)} placeholder="L'Étape, Gran Fondo..."/>
                  </div>
                  <div className="fr">
                    <div className="fg" style={{marginBottom:0}}><label className="fl">Fecha</label>
                      <input type="date" value={compDate} onChange={e=>setCompDate(e.target.value)}/>
                    </div>
                    <div className="fg" style={{marginBottom:0}}><label className="fl">Distancia (km)</label>
                      <input type="number" value={compDist} onChange={e=>setCompDist(e.target.value)} placeholder="135"/>
                    </div>
                  </div>
                  <div className="fg" style={{marginTop:14}}>
                    <label className="fl">Tipo</label>
                    <select value={compType} onChange={e=>setCompType(e.target.value)}>
                      {['cicloturismo / gran fondo','criterium / carrera','contrarreloj','enduro / XCO','challenge de resistencia'].map(t=><option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="fg" style={{marginBottom:14}}><label className="fl">Meta</label>
                    <input type="text" value={compGoal} onChange={e=>setCompGoal(e.target.value)} placeholder="Terminar en menos de 5 horas..."/>
                  </div>
                  <button className="btn bp btn-full" onClick={genComp} disabled={loading}>
                    {loading&&<span className="spin"/>} Generar plan de periodización
                  </button>
                </>
              )}
            </div>
          </div>

          {loading&&(
            <div className="card" style={{textAlign:'center',padding:32}}>
              <span className="spin" style={{marginRight:10}}/>
              <span style={{color:'var(--text2)',fontSize:13}}>
                {genMode==='competition'?'Generando plan semana por semana — puede tardar 20-30 seg...':'Calculando plan óptimo...'}
              </span>
            </div>
          )}

          {error&&<div className="al ar" style={{marginBottom:16}}>{error}</div>}

          {/* PREVIEW DEL PLAN GENERADO */}
          {preview&&!loading&&(
            <>
              {/* Banner para guardar */}
              <div style={{background:'rgba(109,184,106,0.1)',border:'2px solid var(--green2)',borderRadius:'var(--rl)',padding:'16px 20px',marginBottom:20,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:'var(--green2)',marginBottom:3}}>
                    ✓ Plan generado — revísalo abajo
                  </div>
                  <div style={{fontSize:12,color:'var(--text2)'}}>
                    Si te convence, guárdalo para darle seguimiento. Puedes regenerar si quieres otro.
                  </div>
                </div>
                <div style={{display:'flex',gap:10,flexShrink:0}}>
                  <button onClick={genMode==='weekly'?genWeekly:genComp} disabled={loading}
                    style={{padding:'8px 16px',borderRadius:'var(--r)',border:'1px solid var(--border)',background:'var(--bg4)',color:'var(--text2)',cursor:'pointer',fontSize:12}}>
                    Regenerar
                  </button>
                  <button onClick={savePlanAndSwitch}
                    className="btn bp" style={{fontSize:13}}>
                    Guardar este plan →
                  </button>
                </div>
              </div>

              {/* Preview semanal */}
              {preview.type==='weekly'&&(
                <>
                  {preview.diagnostico_semana&&(
                    <div className="iab" style={{marginBottom:16}}>
                      <div className="iah"><div className="iad"/><span className="iat">Diagnóstico</span></div>
                      <div className="iatx">{preview.diagnostico_semana}</div>
                    </div>
                  )}
                  {preview.sesiones?.map((s,i)=><SesionCard key={i} s={s}/>)}
                  {preview.consejo_semana&&(
                    <div style={{padding:'12px 16px',background:'rgba(109,184,106,0.08)',border:'1px solid rgba(109,184,106,0.2)',borderRadius:'var(--r)',marginBottom:16}}>
                      <div style={{fontSize:10,fontFamily:'var(--fm)',color:'var(--green2)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.5px'}}>Consejo de la semana</div>
                      <div style={{fontSize:13,color:'var(--text)'}}>{preview.consejo_semana}</div>
                    </div>
                  )}
                </>
              )}

              {/* Preview competencia */}
              {preview.type==='competition'&&(
                <>
                  <div className="card" style={{marginBottom:16}}>
                    <div style={{fontSize:16,fontWeight:600,marginBottom:6}}>{preview.competencia}</div>
                    <div style={{fontSize:12,color:'var(--text3)',marginBottom:10}}>{preview.distancia_km}km · Meta: {preview.meta}</div>
                    <div style={{fontSize:13,color:'var(--text2)',lineHeight:1.6}}>{preview.resumen}</div>
                  </div>
                  {preview.semanas?.map((sem,wi)=>(
                    <div key={wi} style={{marginBottom:8,border:'1px solid var(--border)',borderRadius:'var(--rl)',overflow:'hidden'}}>
                      <div style={{padding:'12px 18px',background:'var(--bg3)',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div>
                          <span style={{fontSize:13,fontWeight:600}}>Semana {sem.numero}</span>
                          <span style={{fontSize:11,color:'var(--text3)',marginLeft:10}}>{sem.fase}</span>
                          {sem.objetivo&&<span style={{fontSize:11,color:'var(--text2)',marginLeft:10}}>· {sem.objetivo}</span>}
                        </div>
                        <span style={{fontSize:11,fontFamily:'var(--fm)',color:'var(--text3)'}}>TSS ~{sem.tss_objetivo}</span>
                      </div>
                      <div style={{padding:'12px 16px'}}>
                        {sem.sesiones?.map((s,si)=><SesionCard key={si} s={s}/>)}
                      </div>
                    </div>
                  ))}
                  {preview.protocolo_competencia&&(
                    <div className="card" style={{marginTop:12}}>
                      <div className="stit" style={{marginBottom:10}}>🏁 Protocolo día de competencia</div>
                      {[['Día anterior',preview.protocolo_competencia.dia_antes],['Mañana',preview.protocolo_competencia.manana_carrera],['Durante',preview.protocolo_competencia.durante],['Al terminar',preview.protocolo_competencia.post]].filter(([,v])=>v).map(([l,v])=>(
                        <div key={l} style={{marginBottom:8,paddingBottom:8,borderBottom:'1px solid var(--border)'}}>
                          <div style={{fontSize:10,fontFamily:'var(--fm)',color:'var(--text3)',marginBottom:2,textTransform:'uppercase'}}>{l}</div>
                          <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.6}}>{v}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Botón guardar al final también */}
              <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
                <button onClick={genMode==='weekly'?genWeekly:genComp}
                  style={{padding:'9px 20px',borderRadius:'var(--r)',border:'1px solid var(--border)',background:'var(--bg4)',color:'var(--text2)',cursor:'pointer',fontSize:13}}>
                  Regenerar
                </button>
                <button onClick={savePlanAndSwitch} className="btn bp" style={{fontSize:13}}>
                  Guardar este plan →
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
