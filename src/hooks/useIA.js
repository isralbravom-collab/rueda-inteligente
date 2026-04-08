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

// ── Calcula ATL/CTL/TSB correctamente como promedios diarios (no sumas)
// TSS estimado: (horas) × (rpe/10)² × 67  → calibrado para ciclista recreativo
// 1h RPE 6 ≈ 24 TSS, 1h RPE 8 ≈ 43 TSS, 1.5h RPE 7 ≈ 49 TSS (valores realistas)
// ATL = promedio diario TSS últimos 7 días (carga aguda / fatiga)
// CTL = promedio diario TSS últimos 42 días (carga crónica / forma base)
// TSB = CTL - ATL (balance: positivo=fresco, negativo=fatigado)
export function calcFitness(rides) {
  const now = Date.now()

  // TSS calibrado: constante 67 en lugar de 100 para valores más realistas
  const tssOf = r => Math.round((r.dur / 60) * Math.pow((r.rpe || 5) / 10, 2) * 67)

  // Suma TSS de cada ventana, dividida entre los días del período = promedio diario
  const rides7  = rides.filter(r => (now - new Date(r.iso).getTime()) <  7 * 86400000)
  const rides42 = rides.filter(r => (now - new Date(r.iso).getTime()) < 42 * 86400000)

  const atl = Math.round(rides7.reduce((a, r)  => a + tssOf(r), 0) / 7)   // promedio diario 7d
  const ctl = Math.round(rides42.reduce((a, r) => a + tssOf(r), 0) / 42)  // promedio diario 42d
  const tsb = ctl - atl

  // Carga semanal real (para referencia y comparación)
  const weekLoad = {}
  rides42.forEach(r => {
    const d = new Date(r.iso)
    const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const wk = mon.toISOString().slice(0, 10)
    weekLoad[wk] = (weekLoad[wk] || 0) + tssOf(r)
  })
  const weekValues = Object.values(weekLoad)
  const maxWeekTSS = Math.round(Math.max(...weekValues, 0))
  const avgWeekTSS = weekValues.length
    ? Math.round(weekValues.reduce((a, b) => a + b, 0) / weekValues.length)
    : 0

  // Tendencia velocidad: últimas 3 rodadas vs 3 anteriores
  const withSpeed = rides.filter(r => r.dur > 0 && r.dist > 0)
  const recentSpeeds = withSpeed.slice(0, 3).map(r => r.dist / (r.dur / 60))
  const oldSpeeds    = withSpeed.slice(3, 6).map(r => r.dist / (r.dur / 60))
  const recentAvg = recentSpeeds.length ? recentSpeeds.reduce((a,b) => a+b,0) / recentSpeeds.length : 0
  const oldAvg    = oldSpeeds.length    ? oldSpeeds.reduce((a,b) => a+b,0)    / oldSpeeds.length    : 0
  const trend = oldAvg > 0 ? parseFloat(((recentAvg - oldAvg) / oldAvg * 100).toFixed(1)) : 0

  // Zonas últimas 4 semanas
  const rides28 = rides.filter(r => (now - new Date(r.iso).getTime()) < 28 * 86400000)
  const zTot = [0, 0, 0, 0, 0]
  rides28.forEach(r => (r.zp || []).forEach((p, i) => zTot[i] += p))
  const zSum = zTot.reduce((a, b) => a + b, 0) || 1
  const zAvg = zTot.map(v => Math.round(v / zSum * 100))

  const lastRide = rides[0]
  const daysSinceLast = lastRide
    ? Math.round((now - new Date(lastRide.iso).getTime()) / 86400000)
    : 99

  return { atl, ctl, tsb, trend, zAvg, daysSinceLast, maxWeekTSS, avgWeekTSS }
}

// ── Interpreta ATL/CTL/TSB en lenguaje humano
export function interpretFitness(fit) {
  const atlStatus =
    fit.atl > 60 ? { label:'Carga alta', color:'#e07070', tip:'Descansa o reduce intensidad' } :
    fit.atl > 35 ? { label:'Carga moderada-alta', color:'#e09850', tip:'Ritmo sostenible, monitorea sensaciones' } :
    fit.atl > 15 ? { label:'Carga normal', color:'#e8c97a', tip:'Nivel de entrenamiento saludable' } :
                   { label:'Carga baja', color:'#6db86a', tip:'Bien recuperado, puedes aumentar volumen' }

  const ctlStatus =
    fit.ctl > 70 ? { label:'Forma alta', color:'#6db86a', tip:'Base aeróbica sólida' } :
    fit.ctl > 40 ? { label:'Forma moderada', color:'#a8d5a2', tip:'Base en desarrollo' } :
    fit.ctl > 15 ? { label:'Forma inicial', color:'#e8c97a', tip:'Sigue siendo consistente' } :
                   { label:'Base mínima', color:'#e09850', tip:'Aumenta gradualmente el volumen' }

  const tsbStatus =
    fit.tsb > 15  ? { label:'Muy fresco', color:'#6db86a', tip:'Puedes cargar más esta semana' } :
    fit.tsb > -5  ? { label:'Fresco / óptimo', color:'#a8d5a2', tip:'Momento ideal para rendir' } :
    fit.tsb > -20 ? { label:'Algo fatigado', color:'#e8c97a', tip:'Normal si vienes de semana cargada' } :
    fit.tsb > -35 ? { label:'Fatigado', color:'#e09850', tip:'Considera sesión de recuperación' } :
                    { label:'Muy fatigado', color:'#e07070', tip:'Prioriza descanso esta semana' }

  return { atlStatus, ctlStatus, tsbStatus }
}

export function buildRidePrompt(ride, history, supps, profile) {
  const hist = history.slice(0, 6).map(r => {
    const daysAgo = Math.round((Date.now() - new Date(r.iso).getTime()) / 86400000)
    return `- ${r.fecha} (hace ${daysAgo}d): ${Math.round(r.dur)}min, ${(r.dist||0).toFixed(1)}km, FC ${Math.round(r.hrAvg||0)}lpm, RPE ${r.rpe}, sensación:${r.sen}, Z4+Z5:${((r.zp||[])[3]||0)+((r.zp||[])[4]||0)}%`
  }).join('\n')
  const suppStr = supps.length ? supps.map(s => `${s.n} ${s.d} (${s.t})`).join(', ') : 'ninguna'
  const pf = `Nivel:${profile.nivel}, objetivo:${profile.objetivo}, FCmax:${profile.fcmax||185}, peso:${profile.peso||'?'}kg, ${profile.dias||3}días/sem`
  const speed = ride.dur > 0 ? ((ride.dist||0) / (ride.dur / 60)).toFixed(1) : '?'
  const fit = calcFitness([ride, ...history])

  return `Analiza esta rodada con todos sus datos.

PERFIL: ${pf}
SUPLEMENTACIÓN: ${suppStr}
ESTADO DE FORMA: ATL(fatiga 7d)=${fit.atl} TSS, CTL(forma 42d)=${fit.ctl} TSS/sem, TSB(balance)=${fit.tsb} (positivo=fresco, negativo=fatigado), días desde última rodada: ${fit.daysSinceLast}d

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

Evalúa: coherencia datos objetivos vs subjetivos, impacto de suplementación si aplica, carga acumulada según ATL/CTL/TSB, riesgo de sobreentrenamiento. Da UNA sugerencia concreta para la próxima rodada con tipo, duración e intensidad específicos.`
}

export function buildPlanPrompt(rides, supps, profile, context = '') {
  const fit = calcFitness(rides)
  const now = Date.now()

  // Historial estructurado con gaps de descanso visibles
  const hist = rides.slice(0, 10).map(r => {
    const daysAgo = Math.round((now - new Date(r.iso).getTime()) / 86400000)
    const tss = Math.round((r.dur / 60) * Math.pow((r.rpe || 5) / 10, 2) * 100)
    return `  [hace ${daysAgo}d] ${r.fecha}: ${Math.round(r.dur)}min, RPE ${r.rpe}, sen:${r.sen}, Z4+Z5:${((r.zp||[])[3]||0)+((r.zp||[])[4]||0)}%, TSS≈${tss}`
  }).join('\n')

  // Días sin entrenar (gaps > 2d)
  const gaps = []
  for (let i = 0; i < rides.slice(0, 8).length - 1; i++) {
    const gap = Math.round((new Date(rides[i].iso) - new Date(rides[i+1].iso)) / 86400000)
    if (gap > 2) gaps.push(`${gap}d de descanso entre ${rides[i+1].fecha} y ${rides[i].fecha}`)
  }

  const suppStr = supps.length
    ? supps.map(s => `${s.n} ${s.d} (${s.t}) — ${s.o}`).join('\n    ')
    : 'ninguna'

  const nextWeekDays = []
  for (let i = 1; i <= 7; i++) {
    const d = new Date(); d.setDate(d.getDate() + i)
    nextWeekDays.push(d.toLocaleDateString('es-MX', {weekday:'long', day:'numeric', month:'short'}))
  }

  return `Eres un entrenador de ciclismo con acceso completo al historial del atleta. Genera un plan semanal ALTAMENTE personalizado, no genérico.

══ PERFIL DEL ATLETA ══
- Nivel: ${profile.nivel} | Objetivo: ${profile.objetivo}
- FCmax: ${profile.fcmax||185}lpm | Peso: ${profile.peso||70}kg
- Días disponibles/sem: ${profile.dias||3}
- Condiciones de ruta: ${profile.ruta||'calles urbanas'}

══ ESTADO DE FORMA ACTUAL (calculado) ══
- ATL (carga aguda 7d): ${fit.atl} TSS/día → ${fit.atl > 60 ? 'MUY ALTA — priorizar recuperación' : fit.atl > 35 ? 'moderada-alta — monitorea sensaciones' : fit.atl > 15 ? 'normal' : 'baja — puede aumentar carga'}
- CTL (forma base 42d): ${fit.ctl} TSS/día → ${fit.ctl > 70 ? 'forma alta — base sólida' : fit.ctl > 40 ? 'forma moderada' : fit.ctl > 15 ? 'forma inicial' : 'base mínima — priorizar volumen bajo'}
- TSB (balance frescura): ${fit.tsb} → ${fit.tsb > 15 ? 'MUY FRESCO — puede cargar bien esta semana' : fit.tsb > -5 ? 'ÓPTIMO — momento ideal para rendir' : fit.tsb > -20 ? 'algo fatigado — normal tras semana activa' : fit.tsb > -35 ? 'FATIGADO — sesión recuperación esta semana' : 'MUY FATIGADO — prioriza descanso'}
- Tendencia velocidad reciente: ${fit.trend > 2 ? `+${fit.trend}% ↑ mejorando` : fit.trend < -2 ? `${fit.trend}% ↓ bajando` : 'estable'}
- Días desde última rodada: ${fit.daysSinceLast}
- TSS semana más cargada: ${fit.maxWeekTSS} | TSS promedio semanal: ${fit.avgWeekTSS}
- Distribución zonas últimas 4 semanas: Z1:${fit.zAvg[0]}% Z2:${fit.zAvg[1]}% Z3:${fit.zAvg[2]}% Z4:${fit.zAvg[3]}% Z5:${fit.zAvg[4]}%
- Balance polarizado: ${fit.zAvg[0]+fit.zAvg[1]}% baja intensidad / ${fit.zAvg[3]+fit.zAvg[4]}% alta intensidad (ideal: 80/20)

══ HISTORIAL DE RODADAS (más reciente primero) ══
${hist || '  Sin historial previo'}
${gaps.length ? '\nGaps de descanso detectados:\n  ' + gaps.join('\n  ') : ''}

══ SUPLEMENTACIÓN ACTUAL ══
    ${suppStr}

══ CONTEXTO ADICIONAL DEL ATLETA ══
${context || 'Ninguno indicado'}

══ PRÓXIMOS 7 DÍAS DISPONIBLES ══
${nextWeekDays.join(', ')}

INSTRUCCIONES:
1. Analiza el TSB antes de cualquier decisión: si está fatigado, la semana debe ser más suave que la anterior.
2. Aplica modelo polarizado (Seiler 2010): si Z4+Z5 > 40% en historial, agregar más Z2. Si < 20%, puede añadir algo de intensidad.
3. Considera los gaps: si descansó >4 días, la primera sesión debe ser suave.
4. Conecta suplementación con tipo de sesión (cafeína solo en sesiones de intensidad, no en Z1/Z2).
5. El plan debe sentirse como continuidad del historial, no como reinicio.

Responde SOLO con JSON válido, sin texto adicional ni bloques de código:
{"sesiones":[{"dia":"Lunes 7 abr","titulo":"...","tipo":"...","descripcion":"Instrucciones detalladas y ejecutables en calle real, no en pista ideal...","duracion_min":60,"intensidad":"Z2","rpe_objetivo":5,"por_que_hoy":"Razón específica basada en el TSB y el historial de este atleta...","suplementacion_dia":{"pre":"...","durante":"...","post":"..."},"razon_cientifica":"Referencia específica..."}],"diagnostico_semana":"Análisis del estado de forma actual y por qué la semana está estructurada así...","ajuste_vs_semana_anterior":"Cómo y por qué difiere del historial reciente...","referencias":"..."}

Exactamente ${profile.dias||3} sesiones. Los días de descanso NO van en el JSON (solo sesiones activas).`
}

export function buildTrendPrompt(rides) {
  const fit = calcFitness(rides)
  const last = rides.slice(0, 20).reverse()
  const speeds = last.map(r => r.dur > 0 ? ((r.dist||0)/(r.dur/60)).toFixed(1) : '0')
  const hrs = last.map(r => Math.round(r.hrAvg||0))
  const rpes = last.map(r => r.rpe||0)
  const z45s = last.map(r => ((r.zp||[])[3]||0)+((r.zp||[])[4]||0))

  return `Analiza este historial de ciclismo en 90 palabras. ¿Hay progreso real, estancamiento o riesgo de sobreentrenamiento? Basa en Seiler y Coggan.

Estado calculado: ATL=${fit.atl}, CTL=${fit.ctl}, TSB=${fit.tsb}, tendencia velocidad: ${fit.trend > 0 ? '+' : ''}${fit.trend}%
Velocidades: ${speeds.join(', ')} km/h
FC promedio: ${hrs.join(', ')} lpm
RPE: ${rpes.join(', ')}
Z4+Z5%: ${z45s.join(', ')}`
}

export function buildSuppPrompt(supps, profile, rides = []) {
  const stack = supps.map(s => `- ${s.n} ${s.d} (${s.t}) — objetivo: ${s.o}`).join('\n')
  const fit = rides.length ? calcFitness(rides) : null
  const fitCtx = fit ? `\nEstado de forma: ATL=${fit.atl}, TSB=${fit.tsb}, Z4+Z5 reciente=${fit.zAvg[3]+fit.zAvg[4]}%` : ''

  return `Eres nutricionista deportivo especializado en ciclismo. Analiza este stack de suplementación de forma personalizada.

PERFIL: Ciclista ${profile.nivel}, objetivo "${profile.objetivo}", peso ${profile.peso||70}kg${fitCtx}

STACK ACTUAL:
${stack}

Responde SOLO con JSON válido:
{"analisis_general":"2-3 oraciones sobre el stack completo, sinergia y gaps evidentes","por_suplemento":[{"nombre":"...","evidencia":"sólida|moderada|débil","timing_optimo":"cuándo exactamente según la ciencia","con_este_perfil":"cómo aplica específicamente a este ciclista y su estado de forma actual","ajuste_sugerido":"si cambiarías algo en dosis o timing"}],"protocolo_semana":{"dia_intenso":["suplementos recomendados para sesión de alta intensidad"],"dia_z2":["suplementos para sesión aeróbica larga"],"dia_descanso":["suplementos de recuperación"]},"referencias":"..."}`
}
