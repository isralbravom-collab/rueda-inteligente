import React, { useState } from 'react'
import IABox from '../components/IABox'
import { callIA, buildPlanPrompt } from '../hooks/useIA'
import { useNavigate } from 'react-router-dom'

const IC = {Z1:'#6db86a',Z2:'#a8d5a2',Z3:'#e8c97a',Z4:'#e09850',Z5:'#e07070',alta:'#e09850',moderada:'#e8c97a',baja:'#a8d5a2',muy_alta:'#e07070'}

export default function Plan({ rides, supps, profile }) {
  const nav = useNavigate()
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState('')

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
    const raw = await callIA(buildPlanPrompt(rides, supps, profile), 1400)
    try {
      const parsed = JSON.parse(raw.replace(/```json|```/g,'').trim())
      setPlan(parsed)
      setNote(parsed.nota_general||'')
    } catch {
      setPlan(null)
      setNote('Error generando el plan. Intenta de nuevo.')
    }
    setLoading(false)
  }

  return (
    <div className="page">
      <div className="ph">
        <h1>Plan de <em>entrenamiento</em></h1>
        <p>Generado por IA con principios científicos, adaptado a tu historial real</p>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div style={{fontSize:13,color:'var(--text2)'}}>
          {plan ? `Semana del ${new Date().toLocaleDateString('es-MX',{day:'numeric',month:'long'})} · ${plan.sesiones?.length||0} sesiones` : 'Genera tu plan semanal personalizado'}
        </div>
        <button className="btn bp bs" onClick={genPlan} disabled={loading}>
          {loading && <span className="spin"/>}
          {plan ? 'Regenerar plan' : 'Generar plan'}
        </button>
      </div>

      {loading && <div style={{textAlign:'center',padding:'40px',color:'var(--text2)',fontSize:14}}><span className="spin" style={{marginRight:10}}/>Generando tu plan personalizado...</div>}

      {plan?.sesiones?.map(s => (
        <div key={s.dia} className="pc">
          <div className="pd">{s.dia}</div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
            <div className="pt">{s.titulo}</div>
            <span className="badge" style={{color:IC[s.intensidad]||'var(--text2)',borderColor:(IC[s.intensidad]||'var(--border2)')+'40',background:(IC[s.intensidad]||'var(--border)')+'18',marginLeft:10,whiteSpace:'nowrap'}}>{s.intensidad}</span>
          </div>
          <div className="pdesc">{s.descripcion}</div>
          <div className="pm">
            <span className="pmi">Duración: <strong>{s.duracion_min}min</strong></span>
            <span className="pmi">RPE objetivo: <strong>{s.rpe_objetivo}/10</strong></span>
            <span className="pmi">Tipo: <strong>{s.tipo}</strong></span>
          </div>
          {s.suplementacion && s.suplementacion!=='ninguna' && s.suplementacion!=='N/A' && (
            <div className="al ai" style={{marginTop:10,fontSize:12}}>{s.suplementacion}</div>
          )}
          <div className="psc">{s.razon_cientifica}</div>
        </div>
      ))}

      {note && !loading && <IABox text={note} label="Nota del entrenador IA"/>}
      {plan?.referencias && <div style={{fontSize:11,color:'var(--text3)',marginTop:12,fontFamily:'var(--fm)'}}>{plan.referencias}</div>}
    </div>
  )
}
