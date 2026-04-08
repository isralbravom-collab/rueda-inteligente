import React, { useState, useEffect } from 'react'
import IABox from '../components/IABox'
import { callIA, buildPlanPrompt, calcFitness, interpretFitness } from '../hooks/useIA'
import { useNavigate } from 'react-router-dom'

const IC = {Z1:'#6db86a',Z2:'#a8d5a2',Z3:'#e8c97a',Z4:'#e09850',Z5:'#e07070',alta:'#e09850',moderada:'#e8c97a',baja:'#a8d5a2',muy_alta:'#e07070'}

function FitnessBar({ label, value, max, color, hint }) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100)
  return (
    <div style={{marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:4}}>
        <span style={{fontSize:11,fontFamily:'var(--fm)',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px'}}>{label}</span>
        <span style={{fontSize:13,fontWeight:500,color}}>{value}</span>
      </div>
      <div style={{height:4,background:'var(--bg4)',borderRadius:2,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct}%`,background:color,borderRadius:2,transition:'width .5s'}}/>
      </div>
      {hint && <div style={{fontSize:10,color:'var(--text3)',marginTop:3}}>{hint}</div>}
    </div>
  )
}

export default function Plan({ rides, supps, profile }) {
  const nav = useNavigate()
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState('')
  const [error, setError] = useState('')

  const fit = calcFitness(rides)
  const interp = interpretFitness(fit)

  const { atlStatus, ctlStatus, tsbStatus } = interp

  if (rides.length < 2) return (
    <div className="page">
      <div className="ph"><h1>Plan de <em>entrenamiento</em></h1></div>
      <div className="card" style={{textAlign:'center',padding:32}}>
        <p style={{color:'var(--text2)',fontSize:14,marginBottom:16}}>Necesitas al menos 2 rodadas para generar un plan personalizado.</p>
        <button className="btn bp" onClick={()=>nav('/registrar')}>Ir a registrar</button>
      </div>
    </div>
  )

  async function genPlan() {
    setLoading(true)
    setError('')
    const raw = await callIA(buildPlanPrompt(rides, supps, profile, context), 1800)
    try {
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
      setPlan(parsed)
    } catch {
      setError('Error parseando el plan. Respuesta IA: ' + raw.slice(0, 200))
    }
    setLoading(false)
  }

  return (
    <div className="page">
      <div className="ph">
        <h1>Plan de <em>entrenamiento</em></h1>
        <p>Calculado sobre tu estado de forma real, no genérico</p>
      </div>

      {/* FITNESS STATUS */}
      <div className="g2" style={{marginBottom:20}}>
        <div className="card">
          <div className="stit" style={{marginBottom:16}}>Estado de forma actual</div>
          <FitnessBar label="ATL — Carga aguda (7 días)" value={fit.atl} max={80} color={atlStatus.color} hint={`${fit.atl} TSS/día · ${atlStatus.label} · ${atlStatus.tip}`}/>
          <FitnessBar label="CTL — Forma base (42 días)" value={fit.ctl} max={100} color={ctlStatus.color} hint={`${fit.ctl} TSS/día · ${ctlStatus.label} · ${ctlStatus.tip}`}/>
          <FitnessBar label="TSB — Balance frescura / fatiga" value={Math.abs(fit.tsb)} max={40} color={tsbStatus.color} hint={`${fit.tsb > 0 ? '+' : ''}${fit.tsb} · ${tsbStatus.label} · ${tsbStatus.tip}`}/>
          <div style={{display:'flex',gap:12,marginTop:10,flexWrap:'wrap'}}>
            <span style={{fontSize:11,fontFamily:'var(--fm)',color:'var(--text3)'}}>TSS sem. prom: <strong style={{color:'var(--text)'}}>{fit.avgWeekTSS}</strong></span>
            <span style={{fontSize:11,fontFamily:'var(--fm)',color:'var(--text3)'}}>Sem. más cargada: <strong style={{color:'var(--text)'}}>{fit.maxWeekTSS}</strong></span>
            <span style={{fontSize:11,fontFamily:'var(--fm)',color:'var(--text3)'}}>Último entreno: hace <strong style={{color:'var(--text)'}}>{fit.daysSinceLast}d</strong></span>
            <span style={{fontSize:11,fontFamily:'var(--fm)',color:fit.trend > 2 ? '#6db86a' : fit.trend < -2 ? '#e07070' : 'var(--text3)'}}>
              Velocidad: {fit.trend > 0 ? '+' : ''}{fit.trend}% {fit.trend > 2 ? '↑' : fit.trend < -2 ? '↓' : '→'}
            </span>
          </div>
          {/* Reference table */}
          <div style={{marginTop:14,padding:'10px 12px',background:'var(--bg4)',borderRadius:'var(--r)'}}>
            <div style={{fontSize:10,fontFamily:'var(--fm)',color:'var(--text3)',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.5px'}}>Guía de referencia (TSS/día · ciclista recreativo)</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
              <div>
                <div style={{fontSize:10,color:'var(--text3)',marginBottom:3}}>ATL (fatiga)</div>
                {[['< 15','Muy baja'],['15–35','Normal'],['35–60','Alta'],['> 60','Muy alta']].map(([r,l])=>(
                  <div key={r} style={{fontSize:10,color:'var(--text2)'}}><span style={{fontFamily:'var(--fm)',color:'var(--text)'}}>{r}</span> {l}</div>
                ))}
              </div>
              <div>
                <div style={{fontSize:10,color:'var(--text3)',marginBottom:3}}>CTL (forma)</div>
                {[['< 15','Inicial'],['15–40','Moderada'],['40–70','Buena'],['> 70','Alta']].map(([r,l])=>(
                  <div key={r} style={{fontSize:10,color:'var(--text2)'}}><span style={{fontFamily:'var(--fm)',color:'var(--text)'}}>{r}</span> {l}</div>
                ))}
              </div>
              <div>
                <div style={{fontSize:10,color:'var(--text3)',marginBottom:3}}>TSB (balance)</div>
                {[['> +15','Muy fresco'],['+5 a -5','Óptimo'],['-5 a -20','Algo fatigado'],['< -20','Descansa']].map(([r,l])=>(
                  <div key={r} style={{fontSize:10,color:'var(--text2)'}}><span style={{fontFamily:'var(--fm)',color:'var(--text)'}}>{r}</span> {l}</div>
                ))}
              </div>
            </div>
            <div style={{fontSize:10,color:'var(--text3)',marginTop:6,fontStyle:'italic'}}>TSS = Training Stress Score. Basado en Foster (2001) y Allen & Coggan (2010). Calibrado para ciclistas recreativos sin potenciómetro.</div>
          </div>
        </div>

        <div className="card">
          <div className="stit" style={{marginBottom:12}}>Contexto para esta semana</div>
          <p style={{fontSize:12,color:'var(--text2)',marginBottom:10,lineHeight:1.6}}>
            Cuéntale a la IA algo específico que deba considerar al armar el plan.
          </p>
          <textarea
            value={context}
            onChange={e=>setContext(e.target.value)}
            placeholder="Ej: 'Esta semana tengo una gran rodada el domingo con amigos', 'me duele un poco la rodilla izquierda', 'quiero enfocarme en resistencia', 'tengo poco tiempo, máx 45 min por sesión'..."
            style={{minHeight:100,marginBottom:12}}
          />
          <div style={{fontSize:11,color:'var(--text3)',marginBottom:12,fontStyle:'italic'}}>
            Polarización actual: <strong style={{color:'var(--text)'}}>{fit.zAvg[0]+fit.zAvg[1]}%</strong> baja / <strong style={{color:'var(--text)'}}>{fit.zAvg[3]+fit.zAvg[4]}%</strong> alta (4 sem.) · ideal: 80/20
          </div>
          <button className="btn bp btn-full" onClick={genPlan} disabled={loading}>
            {loading && <span className="spin"/>}
            {plan ? 'Regenerar plan' : 'Generar plan personalizado'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="card" style={{textAlign:'center',padding:40}}>
          <span className="spin" style={{marginRight:10}}/>
          <span style={{color:'var(--text2)',fontSize:14}}>Analizando tu historial y calculando carga óptima...</span>
        </div>
      )}

      {error && <div className="al ar">{error}</div>}

      {/* DIAGNOSTICO */}
      {plan?.diagnostico_semana && !loading && (
        <div className="iab" style={{marginBottom:20}}>
          <div className="iah"><div className="iad"/><span className="iat">Diagnóstico de la semana</span></div>
          <div className="iatx">{plan.diagnostico_semana}</div>
          {plan.ajuste_vs_semana_anterior && (
            <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)',fontSize:12,color:'var(--text2)'}}>
              <strong style={{color:'var(--green2)'}}>vs. semana anterior: </strong>{plan.ajuste_vs_semana_anterior}
            </div>
          )}
        </div>
      )}

      {/* SESIONES */}
      {plan?.sesiones?.map((s, idx) => (
        <div key={idx} className="pc">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
            <div className="pd">{s.dia}</div>
            <span className="badge" style={{color:IC[s.intensidad]||'var(--text2)',borderColor:(IC[s.intensidad]||'var(--border2)')+'50',background:(IC[s.intensidad]||'var(--border)')+'18'}}>{s.intensidad}</span>
          </div>
          <div className="pt">{s.titulo}</div>

          {s.por_que_hoy && (
            <div style={{fontSize:12,color:'var(--green2)',margin:'6px 0 8px',fontStyle:'italic'}}>
              ↳ {s.por_que_hoy}
            </div>
          )}

          <div className="pdesc">{s.descripcion}</div>

          <div className="pm" style={{marginBottom:10}}>
            <span className="pmi">Duración: <strong>{s.duracion_min}min</strong></span>
            <span className="pmi">RPE objetivo: <strong>{s.rpe_objetivo}/10</strong></span>
            <span className="pmi">Tipo: <strong>{s.tipo}</strong></span>
          </div>

          {/* Suplementación por sesión */}
          {s.suplementacion_dia && (Object.values(s.suplementacion_dia).some(v => v && v !== 'ninguno' && v !== 'N/A' && v !== '')) && (
            <div style={{background:'rgba(168,213,162,0.06)',border:'1px solid rgba(168,213,162,0.15)',borderRadius:'var(--r)',padding:'10px 14px',marginBottom:10}}>
              <div style={{fontSize:10,fontFamily:'var(--fm)',color:'var(--green2)',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.5px'}}>Protocolo de suplementación</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                {['pre','durante','post'].map(k => s.suplementacion_dia[k] && s.suplementacion_dia[k] !== 'ninguno' && s.suplementacion_dia[k] !== 'N/A' ? (
                  <div key={k}>
                    <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--fm)',marginBottom:2}}>{k === 'pre' ? 'Pre-entreno' : k === 'durante' ? 'Durante' : 'Post-entreno'}</div>
                    <div style={{fontSize:12,color:'var(--text)'}}>{s.suplementacion_dia[k]}</div>
                  </div>
                ) : null)}
              </div>
            </div>
          )}

          <div className="psc">{s.razon_cientifica}</div>
        </div>
      ))}

      {plan?.referencias && !loading && (
        <div style={{fontSize:11,color:'var(--text3)',marginTop:12,fontFamily:'var(--fm)',padding:'10px 0',borderTop:'1px solid var(--border)'}}>
          {plan.referencias}
        </div>
      )}
    </div>
  )
}
