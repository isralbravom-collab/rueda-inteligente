import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { callIA, buildPlanPrompt, buildCompetitionPlan, calcFitness, interpretFitness, tssOf, extractJSON } from '../hooks/useIA'

const IC = {Z1:'#6db86a',Z2:'#a8d5a2',Z3:'#e8c97a',Z4:'#e09850',Z5:'#e07070',alta:'#e09850',moderada:'#e8c97a',baja:'#a8d5a2',muy_alta:'#e07070'}

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
  const now  = new Date()

  if (mode === 'month') {
    // Últimos 12 meses
    const months = []
    for (let m = 11; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth()-m, 1)
      const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      const label = d.toLocaleDateString('es-MX',{month:'short'})
      const mRides = rides.filter(r => r.iso.startsWith(mk))
      const tss = mRides.reduce((a,r)=>a+tssOf(r),0)
      months.push({ label, tss, count:mRides.length, current: m===0 })
    }
    const maxTSS = Math.max(...months.map(m=>m.tss),1)
    return (
      <div style={{marginTop:14}}>
        <div style={{fontSize:10,fontFamily:'var(--fm)',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>TSS por mes (últimos 12)</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(12,1fr)',gap:3,alignItems:'flex-end',height:64}}>
          {months.map((m,i)=>(
            <div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
              <div style={{fontSize:8,fontFamily:'var(--fm)',color:'var(--text3)'}}>{m.tss||''}</div>
              <div style={{width:'100%',background:m.current?'#3a7a38':'var(--bg4)',borderRadius:'2px 2px 0 0',height:`${Math.max(m.tss/maxTSS*48,m.tss>0?4:0)}px`,transition:'height .4s'}}/>
              <div style={{fontSize:7,color:'var(--text3)',textAlign:'center'}}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (mode === 'year') {
    // Por año
    const yearMap = {}
    rides.forEach(r => {
      const y = new Date(r.iso).getFullYear()
      yearMap[y] = (yearMap[y]||0) + tssOf(r)
    })
    const years = Object.entries(yearMap).sort(([a],[b])=>a-b)
    const maxTSS = Math.max(...years.map(([,t])=>t),1)
    return (
      <div style={{marginTop:14}}>
        <div style={{fontSize:10,fontFamily:'var(--fm)',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>TSS por año</div>
        <div style={{display:'flex',gap:8,alignItems:'flex-end',height:64}}>
          {years.map(([y,tss])=>(
            <div key={y} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,flex:1}}>
              <div style={{fontSize:9,fontFamily:'var(--fm)',color:'var(--text3)'}}>{tss}</div>
              <div style={{width:'100%',background:String(y)===String(now.getFullYear())?'#3a7a38':'var(--bg4)',borderRadius:'2px 2px 0 0',height:`${Math.max(tss/maxTSS*48,4)}px`}}/>
              <div style={{fontSize:9,color:'var(--text3)'}}>{y}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Default: últimas 8 semanas (lunes-domingo)
  const weeks = []
  for (let w=7; w>=0; w--) {
    const wEnd   = new Date(now); wEnd.setDate(now.getDate()-w*7)
    const wStart = new Date(wEnd); wStart.setDate(wEnd.getDate()-7)
    // Align to Monday
    const monOffset = (wStart.getDay()+6)%7
    wStart.setDate(wStart.getDate()-monOffset+7)
    const wr  = rides.filter(r=>{ const d=new Date(r.iso); return d>=wStart&&d<wEnd })
    const tss = wr.reduce((a,r)=>a+tssOf(r),0)
    weeks.push({ label:wStart.toLocaleDateString('es-MX',{day:'numeric',month:'short'}), tss, count:wr.length, current:w===0 })
  }
  const maxTSS = Math.max(...weeks.map(w=>w.tss),1)
  return (
    <div style={{marginTop:14}}>
      <div style={{fontSize:10,fontFamily:'var(--fm)',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>TSS por semana (últimas 8)</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(8,1fr)',gap:4,alignItems:'flex-end',height:64}}>
        {weeks.map((w,i)=>(
          <div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
            <div style={{fontSize:9,fontFamily:'var(--fm)',color:'var(--text3)'}}>{w.tss||''}</div>
            <div style={{width:'100%',background:w.current?'#3a7a38':'var(--bg4)',borderRadius:'2px 2px 0 0',height:`${Math.max(w.tss/maxTSS*48,w.tss>0?4:0)}px`,transition:'height .4s'}}/>
            <div style={{fontSize:8,color:'var(--text3)',textAlign:'center',lineHeight:1.2}}>{w.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function NextWeekRange() {
  const now     = new Date()
  const dow     = now.getDay()
  const toMon   = dow===0?1:dow===1?7:8-dow
  const nextMon = new Date(now); nextMon.setDate(now.getDate()+toMon)
  const nextSun = new Date(nextMon); nextSun.setDate(nextMon.getDate()+6)
  const fmt = d => d.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'short'})
  return <span style={{color:'var(--text)',fontWeight:500}}>{fmt(nextMon)} → {fmt(nextSun)}</span>
}

export default function Plan({ rides, supps, profile }) {
  const nav = useNavigate()
  const [planMode, setPlanMode]       = useState('weekly')  // 'weekly' | 'competition'
  const [barMode, setBarMode]         = useState('week')    // 'week' | 'month' | 'year'
  const [plan, setPlan]               = useState(null)
  const [compPlan, setCompPlan]       = useState(null)
  const [loading, setLoading]         = useState(false)
  const [context, setContext]         = useState('')
  const [diasSemana, setDiasSemana]   = useState(profile.dias || 3)
  const [error, setError]             = useState('')

  // Competition fields
  const [compName, setCompName]       = useState('')
  const [compDate, setCompDate]       = useState('')
  const [compDist, setCompDist]       = useState('')
  const [compType, setCompType]       = useState('cicloturismo / gran fondo')
  const [compGoal, setCompGoal]       = useState('')

  const fit   = calcFitness(rides)
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
    const profileWithDias = { ...profile, dias: diasSemana }
    const raw = await callIA(buildPlanPrompt(rides, supps, profileWithDias, context), 2000)
    const parsed = extractJSON(raw)
    if (parsed) { setPlan(parsed) }
    else { setError('La IA no devolvió un plan válido. Intenta de nuevo. Respuesta: ' + raw.slice(0,200)) }
    setLoading(false)
  }

  async function genCompPlan() {
    if (!compName || !compDate) return alert('Ingresa nombre y fecha de la competencia')
    setLoading(true); setError(''); setCompPlan(null)
    const comp = { name:compName, date:compDate, distance:compDist, type:compType, goal:compGoal }
    const raw = await callIA(buildCompetitionPlan(rides, supps, profile, comp), 2000)
    const parsed = extractJSON(raw)
    if (parsed) { setCompPlan(parsed) }
    else { setError('La IA no devolvió un plan válido. Intenta de nuevo. Respuesta: ' + raw.slice(0,200)) }
    setLoading(false)
  }

  return (
    <div className="page">
      <div className="ph">
        <h1>Plan de <em>entrenamiento</em></h1>
        <p>Calculado sobre tu estado de forma real — no genérico</p>
      </div>

      {/* MODO SELECTOR */}
      <div style={{display:'flex',gap:6,marginBottom:20}}>
        {[['weekly','Plan semanal'],['competition','Plan para competencia']].map(([m,l])=>(
          <button key={m} onClick={()=>{setPlanMode(m);setPlan(null);setCompPlan(null);setError('')}}
            className={'btn'+(planMode===m?' bp':'')} style={{fontSize:13}}>
            {l}
          </button>
        ))}
      </div>

      {/* FITNESS STATUS */}
      <div className="g2" style={{marginBottom:20}}>
        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div className="stit" style={{marginBottom:0}}>Estado de forma</div>
            <div style={{display:'flex',gap:4}}>
              {[['week','Sem'],['month','Mes'],['year','Año']].map(([m,l])=>(
                <button key={m} onClick={()=>setBarMode(m)}
                  style={{padding:'3px 10px',borderRadius:'var(--r)',fontSize:11,cursor:'pointer',fontFamily:'var(--fm)',
                    background:barMode===m?'var(--green3)':'var(--bg4)',
                    border:`1px solid ${barMode===m?'var(--green2)':'var(--border2)'}`,
                    color:barMode===m?'#fff':'var(--text2)'}}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <FitnessBar label="ATL — Carga aguda 7 días" value={fit.atl} max={80} color={atlStatus.color} hint={`${atlStatus.label} · ${atlStatus.tip}`}/>
          <FitnessBar label="CTL — Forma base 42 días" value={fit.ctl} max={100} color={ctlStatus.color} hint={`${ctlStatus.label} · ${ctlStatus.tip}`}/>
          <FitnessBar label="TSB — Balance frescura/fatiga" value={Math.abs(fit.tsb)} max={40} color={tsbStatus.color} hint={`${fit.tsb>0?'+':''}${fit.tsb} · ${tsbStatus.label} · ${tsbStatus.tip}`}/>

          <div style={{display:'flex',gap:14,flexWrap:'wrap',marginTop:8,fontSize:11,fontFamily:'var(--fm)',color:'var(--text3)'}}>
            <span>Último entreno: <strong style={{color:'var(--text)'}}>hace {fit.daysSinceLast}d</strong></span>
            <span>TSS sem. prom: <strong style={{color:'var(--text)'}}>{fit.avgWeekTSS}</strong></span>
            <span>Sem. más cargada: <strong style={{color:'var(--text)'}}>{fit.maxWeekTSS}</strong></span>
            <span style={{color:fit.trend>2?'#6db86a':fit.trend<-2?'#e07070':'var(--text3)'}}>
              Velocidad: {fit.trend>0?'+':''}{fit.trend}% {fit.trend>2?'↑':fit.trend<-2?'↓':'→'}
            </span>
          </div>

          <WeeklyBars rides={rides} mode={barMode}/>

          {/* Totales */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginTop:12}}>
            {[
              ['Rodadas',fit.totalRides,'total'],
              ['Kilómetros',fit.totalKm,'km'],
              ['Horas',fit.totalHours,'h'],
              ['TSS total',fit.totalTSS,'pts'],
            ].map(([l,v,u])=>(
              <div key={l} style={{background:'var(--bg4)',borderRadius:'var(--r)',padding:'8px 10px',textAlign:'center'}}>
                <div style={{fontSize:10,color:'var(--text3)',marginBottom:2,fontFamily:'var(--fm)'}}>{l}</div>
                <div style={{fontSize:16,fontWeight:500}}>{v}<span style={{fontSize:10,fontWeight:400,color:'var(--text2)',marginLeft:2}}>{u}</span></div>
              </div>
            ))}
          </div>

          {/* Referencia */}
          <div style={{marginTop:12,padding:'8px 12px',background:'var(--bg4)',borderRadius:'var(--r)',fontSize:10,color:'var(--text3)'}}>
            <strong style={{color:'var(--text2)'}}>Referencia TSS/día (ciclista recreativo): </strong>
            &lt;15 bajo · 15-35 normal · 35-60 alto · &gt;60 muy alto &nbsp;|&nbsp;
            <strong style={{color:'var(--text2)'}}>TSB: </strong>
            &gt;+15 fresco · 0 a -15 normal · &lt;-20 fatigado
            <br/>
            <em>Foster (2001), Allen &amp; Coggan (2010). Sin potenciómetro: estimación por RPE y duración.</em>
          </div>
        </div>

        {/* PANEL DERECHO */}
        <div className="card">
          {planMode === 'weekly' ? (
            <>
              <div className="stit" style={{marginBottom:12}}>Esta semana</div>

              {/* Días disponibles — selector prominente */}
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,color:'var(--text2)',marginBottom:8}}>
                  ¿Cuántos días puedes entrenar <strong style={{color:'var(--text)'}}>esta semana</strong>?
                </div>
                <div style={{display:'flex',gap:8}}>
                  {[2,3,4,5,6].map(n => (
                    <button key={n} onClick={()=>setDiasSemana(n)}
                      style={{
                        flex:1, padding:'10px 0', borderRadius:'var(--r)', cursor:'pointer',
                        fontSize:16, fontWeight:500,
                        border: diasSemana===n ? '2px solid var(--green2)' : '1px solid var(--border)',
                        background: diasSemana===n ? 'rgba(109,184,106,0.15)' : 'var(--bg4)',
                        color: diasSemana===n ? 'var(--green2)' : 'var(--text2)',
                        transition:'all .15s'
                      }}>
                      {n}
                    </button>
                  ))}
                </div>
                <div style={{fontSize:11,color:'var(--text3)',marginTop:6,textAlign:'center'}}>
                  {diasSemana === 2 && 'Ideal para semana de recuperación o semana muy ocupada'}
                  {diasSemana === 3 && 'Lo mínimo recomendado para progresión continua'}
                  {diasSemana === 4 && 'Buena frecuencia — permite polarización 80/20 correcta'}
                  {diasSemana === 5 && 'Alta frecuencia — incluye sesión de recuperación activa'}
                  {diasSemana === 6 && 'Carga alta — el plan incluirá una sesión muy suave obligatoria'}
                </div>
              </div>

              {/* Semana a planificar */}
              <div style={{background:'var(--bg4)',borderRadius:'var(--r)',padding:'8px 12px',marginBottom:12,fontSize:12,color:'var(--text2)'}}>
                El plan cubrirá: <NextWeekRange/>
              </div>

              {/* Contexto libre */}
              <textarea value={context} onChange={e=>setContext(e.target.value)}
                placeholder="Algo más que deba saber la IA: 'tengo rodada grupal el sábado', 'me duele la rodilla', 'máx 45 min por sesión'..."
                style={{minHeight:80,marginBottom:10}}/>

              <div style={{fontSize:11,color:'var(--text3)',marginBottom:12,fontStyle:'italic'}}>
                Polarización actual: <strong style={{color:'var(--text)'}}>{fit.zAvg[0]+fit.zAvg[1]}%</strong> baja / <strong style={{color:'var(--text)'}}>{fit.zAvg[3]+fit.zAvg[4]}%</strong> alta · ideal 80/20
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
                <input type="text" value={compName} onChange={e=>setCompName(e.target.value)} placeholder="Gran Fondo Veracruz, Sportive, Cicloturista..."/>
              </div>
              <div className="fr">
                <div className="fg" style={{marginBottom:0}}>
                  <label className="fl">Fecha</label>
                  <input type="date" value={compDate} onChange={e=>setCompDate(e.target.value)}/>
                </div>
                <div className="fg" style={{marginBottom:0}}>
                  <label className="fl">Distancia (km)</label>
                  <input type="number" value={compDist} onChange={e=>setCompDist(e.target.value)} placeholder="80"/>
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
                <input type="text" value={compGoal} onChange={e=>setCompGoal(e.target.value)} placeholder="Terminar sin problemas, bajar de X horas, completar el reto..."/>
              </div>
              <button className="btn bp btn-full" onClick={genCompPlan} disabled={loading}>
                {loading&&<span className="spin"/>}
                Generar plan de periodización
              </button>
            </>
          )}
        </div>
      </div>

      {loading&&(
        <div className="card" style={{textAlign:'center',padding:40}}>
          <span className="spin" style={{marginRight:10}}/>
          <span style={{color:'var(--text2)',fontSize:14}}>
            {planMode==='competition'?'Calculando periodización completa...':'Analizando historial y calculando carga óptima...'}
          </span>
        </div>
      )}

      {error&&<div className="al ar">{error}</div>}

      {/* PLAN SEMANAL */}
      {plan&&!loading&&(
        <>
          {plan.diagnostico_semana&&(
            <div className="iab" style={{marginBottom:16}}>
              <div className="iah"><div className="iad"/><span className="iat">Diagnóstico de la semana</span></div>
              <div className="iatx">{plan.diagnostico_semana}</div>
              {plan.ajuste_vs_semana_anterior&&(
                <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)',fontSize:12,color:'var(--text2)'}}>
                  <strong style={{color:'var(--green2)'}}>vs. semana anterior: </strong>{plan.ajuste_vs_semana_anterior}
                </div>
              )}
              {plan.tss_semana_total&&(
                <div style={{marginTop:6,fontSize:11,fontFamily:'var(--fm)',color:'var(--text3)'}}>
                  TSS total planificado: <strong style={{color:'var(--text)'}}>{plan.tss_semana_total}</strong> · Promedio histórico: {fit.avgWeekTSS}
                </div>
              )}
            </div>
          )}

          {plan.sesiones?.map((s,i)=>(
            <div key={i} className="pc">
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <div className="pd">{s.dia}</div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  {s.tss_estimado&&<span style={{fontSize:10,fontFamily:'var(--fm)',color:'var(--text3)'}}>TSS≈{s.tss_estimado}</span>}
                  <span className="badge" style={{color:IC[s.intensidad]||'var(--text2)',borderColor:(IC[s.intensidad]||'var(--border2)')+'40',background:(IC[s.intensidad]||'var(--border)')+'15'}}>{s.intensidad}</span>
                </div>
              </div>
              <div className="pt">{s.titulo}</div>
              {s.lenguaje_simple && <div style={{fontSize:14,color:'var(--text)',margin:'6px 0',padding:'8px 12px',background:'var(--bg4)',borderRadius:'var(--r)',borderLeft:'3px solid var(--green2)'}}>"{s.lenguaje_simple}"</div>}
              {s.por_que_hoy&&<div style={{fontSize:12,color:'var(--green2)',margin:'5px 0 8px',fontStyle:'italic'}}>↳ {s.por_que_hoy}</div>}
              <div className="pdesc">{s.descripcion}</div>
              <div className="pm" style={{marginBottom:10}}>
                <span className="pmi">Duración: <strong>{s.duracion_min}min</strong></span>
                <span className="pmi">RPE objetivo: <strong>{s.rpe_objetivo}/10</strong></span>
                <span className="pmi">Tipo: <strong>{s.tipo}</strong></span>
                  {s.fc_objetivo && <span className="pmi">FC: <strong>{s.fc_objetivo}</strong></span>}
                  {s.watts_objetivo && <span className="pmi">Potencia: <strong>{s.watts_objetivo}</strong></span>}
                  {s.cadencia_objetivo && <span className="pmi" style={{color:'var(--text3)',fontSize:11}}>🔄 {s.cadencia_objetivo}</span>}
              </div>
              {/* Hidratación y nutrición */}
              {s.hidratacion_nutricion && (
                <div style={{background:'rgba(122,184,232,0.06)',border:'1px solid rgba(122,184,232,0.2)',borderRadius:'var(--r)',padding:'12px 14px',marginBottom:10}}>
                  <div style={{fontSize:10,fontFamily:'var(--fm)',color:'#7ab8e8',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.5px'}}>💧 Hidratación y nutrición</div>
                  <div style={{fontSize:13,fontWeight:500,color:'var(--text)',marginBottom:4}}>{s.hidratacion_nutricion.llevar}</div>
                  <div style={{fontSize:12,color:'var(--text2)',marginBottom: s.hidratacion_nutricion.nota_clima?6:0}}>{s.hidratacion_nutricion.protocolo}</div>
                  {s.hidratacion_nutricion.nota_clima && <div style={{fontSize:11,color:'#e09850',fontStyle:'italic'}}>{s.hidratacion_nutricion.nota_clima}</div>}
                </div>
              )}
              {/* Suplementación */}
              {(s.suplementacion||s.suplementacion_dia) && Object.values(s.suplementacion||s.suplementacion_dia||{}).some(v=>v&&v!=='ninguno'&&v!=='N/A'&&v!=='')&&(
                <div style={{background:'rgba(168,213,162,0.06)',border:'1px solid rgba(168,213,162,0.15)',borderRadius:'var(--r)',padding:'10px 14px',marginBottom:10}}>
                  <div style={{fontSize:10,fontFamily:'var(--fm)',color:'var(--green2)',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.5px'}}>Suplementación</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                    {['pre','durante','post'].map(k=>{const supp=s.suplementacion||s.suplementacion_dia||{}; return supp[k]&&supp[k]!=='ninguno'&&supp[k]!=='N/A'?(
                      <div key={k}>
                        <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--fm)',marginBottom:2}}>{k==='pre'?'Pre':k==='durante'?'Durante':'Post'}</div>
                        <div style={{fontSize:12,color:'var(--text)'}}>{supp[k]}</div>
                      </div>
                    ):null})}
                  </div>
                </div>
              )}
              <div className="psc">{s.razon_cientifica}</div>
            </div>
          ))}
          {plan.consejo_semana && (
            <div style={{marginBottom:12,padding:'12px 16px',background:'rgba(109,184,106,0.08)',border:'1px solid rgba(109,184,106,0.2)',borderRadius:'var(--r)'}}>
              <div style={{fontSize:10,fontFamily:'var(--fm)',color:'var(--green2)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.5px'}}>Consejo de la semana</div>
              <div style={{fontSize:13,color:'var(--text)'}}>{plan.consejo_semana}</div>
            </div>
          )}
          {plan.referencias&&<div style={{fontSize:11,color:'var(--text3)',marginTop:12,fontFamily:'var(--fm)',padding:'10px 0',borderTop:'1px solid var(--border)'}}>{plan.referencias}</div>}
        </>
      )}

      {/* PLAN COMPETENCIA */}
      {compPlan&&!loading&&(
        <>
          <div className="iab" style={{marginBottom:16}}>
            <div className="iah"><div className="iad"/><span className="iat">Estrategia de periodización</span></div>
            <div className="iatx">{compPlan.resumen_estrategia}</div>
          </div>

          {compPlan.fases?.map((f,i)=>(
            <div key={i} className="pc" style={{borderLeft:`3px solid ${i===0?'#a8d5a2':i===1?'#e09850':'#e07070'}`,borderRadius:'0 var(--rl) var(--rl) 0'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                <div>
                  <div className="pd">Fase {i+1}: {f.fase}</div>
                  <div className="pt">{f.objetivo}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:10,fontFamily:'var(--fm)',color:'var(--text3)'}}>semanas {f.semanas}</div>
                  <div style={{fontSize:13,fontWeight:500,color:'var(--green)'}}>TSS obj. {f.tss_objetivo_semana}/sem</div>
                </div>
              </div>
              <div className="pdesc">{f.nota}</div>
              {f.sesiones_tipo?.length>0&&(
                <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:8}}>
                  {f.sesiones_tipo.map((s,j)=>(
                    <span key={j} style={{fontSize:11,padding:'3px 10px',borderRadius:20,border:'1px solid var(--border2)',color:'var(--text2)'}}>{s}</span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {compPlan.proxima_semana&&(
            <div style={{marginTop:20}}>
              <div className="stit" style={{marginBottom:12}}>Próxima semana (inicio del plan)</div>
              <div style={{fontSize:13,color:'var(--text2)',marginBottom:12}}>{compPlan.proxima_semana.descripcion}</div>
              {compPlan.proxima_semana.sesiones?.map((s,i)=>(
                <div key={i} className="pc" style={{padding:'14px 18px'}}>
                  <div className="pd">{s.dia}</div>
                  <div className="pt">{s.titulo}</div>
                  <div className="pdesc" style={{margin:'6px 0'}}>{s.descripcion}</div>
                  <div className="pm">
                    <span className="pmi">Duración: <strong>{s.duracion_min}min</strong></span>
                    <span className="pmi">RPE: <strong>{s.rpe_objetivo}/10</strong></span>
                    <span className="pmi">Intensidad: <strong>{s.intensidad}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {compPlan.suplementacion_competencia&&(
            <div className="iab" style={{marginTop:16}}>
              <div className="iah"><div className="iad"/><span className="iat">Protocolo suplementación — día de competencia</span></div>
              <div className="iatx">{compPlan.suplementacion_competencia}</div>
            </div>
          )}
          {compPlan.referencias&&<div style={{fontSize:11,color:'var(--text3)',marginTop:12,fontFamily:'var(--fm)',padding:'10px 0',borderTop:'1px solid var(--border)'}}>{compPlan.referencias}</div>}
        </>
      )}
    </div>
  )
}
