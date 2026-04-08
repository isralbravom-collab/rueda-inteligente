export async function callIA(prompt, maxTokens = 400) {
  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, maxTokens })
    })
    const data = await res.json()
    if (data.error) return `Error: ${data.error}`
    return data.text || 'Sin respuesta.'
  } catch (e) {
    return 'Error de conexión. Verifica tu internet.'
  }
}

const RPE_LABELS = {1:'Reposo absoluto',2:'Muy muy fácil',3:'Muy fácil',4:'Fácil',5:'Moderado',6:'Algo difícil',7:'Difícil',8:'Muy difícil',9:'Extremo',10:'Máximo esfuerzo'}

export function buildRidePrompt(ride, history, supps, profile) {
  const hist = history.slice(0, 6).map(r => {
    const daysAgo = Math.round((Date.now() - new Date(r.iso).getTime()) / 86400000)
    return `- ${r.fecha} (hace ${daysAgo}d): ${Math.round(r.dur)}min, ${(r.dist||0).toFixed(1)}km, FC ${Math.round(r.hrAvg||0)}lpm, RPE ${r.rpe}, sensación:${r.sen}, Z4+Z5:${((r.zp||[])[3]||0)+((r.zp||[])[4]||0)}%`
  }).join('\n')
  const suppStr = supps.length ? supps.map(s=>`${s.n} ${s.d} (${s.t})`).join(', ') : 'ninguna'
  const pf = `Nivel:${profile.nivel}, objetivo:${profile.objetivo}, FCmax:${profile.fcmax||185}, peso:${profile.peso||'?'}kg, ${profile.dias||3}días/sem`
  const speed = ride.dur > 0 ? ((ride.dist||0)/(ride.dur/60)).toFixed(1) : '?'

  return `Analiza esta rodada con todos sus datos.

PERFIL: ${pf}
SUPLEMENTACIÓN: ${suppStr}

RODADA DE HOY:
- Nombre: ${ride.name} | Fecha: ${ride.fecha}
- Duración: ${Math.round(ride.dur)}min | Distancia: ${(ride.dist||0).toFixed(1)}km | Velocidad: ${speed}km/h
- FC: ${Math.round(ride.hrAvg||0)}lpm prom / ${ride.hrMax||'?'}lpm max
- Cadencia: ${ride.cad > 0 ? Math.round(ride.cad)+'rpm' : 'no registrada'} | Elevación: ${Math.round(ride.eg||0)}m
- Zonas FC: Z1:${(ride.zp||[])[0]||0}% Z2:${(ride.zp||[])[1]||0}% Z3:${(ride.zp||[])[2]||0}% Z4:${(ride.zp||[])[3]||0}% Z5:${(ride.zp||[])[4]||0}%
${ride.temp ? `- Temperatura: ${Math.round(ride.temp)}°C` : ''}
- RPE: ${ride.rpe}/10 (${RPE_LABELS[ride.rpe]}) | Sensación: ${ride.sen}
${ride.com ? `- Comentario: ${ride.com}` : ''}

HISTORIAL RECIENTE:
${hist || 'Primera rodada registrada'}

Evalúa: coherencia datos objetivos vs subjetivos, impacto de suplementación si aplica, carga acumulada, riesgo de sobreentrenamiento. Da UNA sugerencia concreta para la próxima rodada con tipo, duración e intensidad específicos.`
}

export function buildPlanPrompt(rides, supps, profile) {
  const hist = rides.slice(0,8).map(r => {
    const daysAgo = Math.round((Date.now() - new Date(r.iso).getTime()) / 86400000)
    return `${r.fecha} (hace ${daysAgo}d): ${Math.round(r.dur)}min, RPE ${r.rpe}, sensación:${r.sen}, Z4+Z5:${((r.zp||[])[3]||0)+((r.zp||[])[4]||0)}%`
  }).join('\n')
  const suppStr = supps.length ? supps.map(s=>`${s.n} ${s.d}`).join(', ') : 'ninguna'

  return `Genera un plan semanal de entrenamiento ciclista personalizado.

PERFIL: Nivel ${profile.nivel}, objetivo "${profile.objetivo}", ${profile.dias||3}días/sem, FCmax ${profile.fcmax||185}lpm, peso ${profile.peso||70}kg.
RUTA: ${profile.ruta||'calles urbanas'}
SUPLEMENTACIÓN: ${suppStr}
HISTORIAL: ${hist}

Responde SOLO con JSON válido sin texto adicional ni bloques de código:
{"sesiones":[{"dia":"Lunes","titulo":"...","tipo":"...","descripcion":"...","duracion_min":60,"intensidad":"Z2","rpe_objetivo":5,"razon_cientifica":"...","suplementacion":"..."}],"nota_general":"...","referencias":"..."}

Tipos: rodaje continuo, rodaje progresivo, intervalos cortos, salida larga, recuperación activa, descanso.
Usa modelo polarizado (Seiler 2010), sobrecarga progresiva (Bompa), periodización (Issurin 2010). Exactamente ${profile.dias||3} sesiones.`
}

export function buildTrendPrompt(rides) {
  const last = rides.slice(0,20).reverse()
  const speeds = last.map(r => r.dur>0 ? ((r.dist||0)/(r.dur/60)).toFixed(1) : '0')
  const hrs = last.map(r => Math.round(r.hrAvg||0))
  const rpes = last.map(r => r.rpe||0)
  const z45s = last.map(r => ((r.zp||[])[3]||0)+((r.zp||[])[4]||0))

  return `Analiza este historial de ciclismo en 90 palabras. ¿Hay progreso real, estancamiento o riesgo de sobreentrenamiento? Basa en Seiler y Coggan.

Velocidades: ${speeds.join(', ')} km/h
FC promedio: ${hrs.join(', ')} lpm
RPE: ${rpes.join(', ')}
Z4+Z5%: ${z45s.join(', ')}`
}

export function buildSuppPrompt(supps, profile) {
  const stack = supps.map(s => `${s.n} ${s.d} (${s.t}) — objetivo: ${s.o}`).join('\n')
  return `Analiza este stack de suplementación para ciclista ${profile.nivel} en 80 palabras: sinergia, conflictos de timing, evidencia para ciclismo. Basa en Burke, Maughan, ISSN.\n\n${stack}`
}
