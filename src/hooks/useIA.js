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

export const RPE_LABELS = {1:'Reposo',2:'Muy fácil',3:'Fácil',4:'Fácil+',5:'Moderado',6:'Moderado+',7:'Difícil',8:'Muy difícil',9:'Extremo',10:'Máximo'}

// ─────────────────────────────────────────────────────
// TSS estimado sin potenciómetro
// Fórmula: (horas) × (rpe/10)² × 67
// Calibrada para que 1h RPE6=24, 1h RPE7=33, 1h RPE8=43
// ─────────────────────────────────────────────────────
export function tssOf(r) {
  return Math.round((r.dur / 60) * Math.pow((r.rpe || 5) / 10, 2) * 67)
}

// ─────────────────────────────────────────────────────
// calcFitness — ATL/CTL/TSB correctos como promedios diarios
//
// ATL (Acute Training Load) = promedio TSS/día últimos 7d  → fatiga reciente
// CTL (Chronic Training Load) = promedio TSS/día últimos 42d → forma base
// TSB (Training Stress Balance) = CTL - ATL
//   positivo = fresco, negativo = fatigado
//
// Referencia: Allen & Coggan (2010), Foster (2001)
// ─────────────────────────────────────────────────────
export function calcFitness(rides) {
  const now = Date.now()

  const rides7  = rides.filter(r => (now - new Date(r.iso).getTime()) <  7 * 86400000)
  const rides28 = rides.filter(r => (now - new Date(r.iso).getTime()) < 28 * 86400000)
  const rides42 = rides.filter(r => (now - new Date(r.iso).getTime()) < 42 * 86400000)

  const atl = Math.round(rides7.reduce((a, r)  => a + tssOf(r), 0) / 7)
  const ctl = Math.round(rides42.reduce((a, r) => a + tssOf(r), 0) / 42)
  const tsb = ctl - atl

  // Carga por semana (lunes a domingo) — últimas 12 semanas
  const weekLoad = {}
  rides.filter(r => (now - new Date(r.iso).getTime()) < 84 * 86400000).forEach(r => {
    const d = new Date(r.iso)
    const mon = new Date(d)
    mon.setDate(d.getDate() - ((d.getDay() + 6) % 7))  // lunes de esa semana
    mon.setHours(0,0,0,0)
    const wk = mon.toISOString().slice(0, 10)
    if (!weekLoad[wk]) weekLoad[wk] = { tss:0, count:0, label: mon.toLocaleDateString('es-MX',{day:'numeric',month:'short'}) }
    weekLoad[wk].tss   += tssOf(r)
    weekLoad[wk].count += 1
  })

  // Carga por mes — últimos 12 meses
  const monthLoad = {}
  rides.forEach(r => {
    const d = new Date(r.iso)
    const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    if (!monthLoad[mk]) monthLoad[mk] = { tss:0, count:0, label: d.toLocaleDateString('es-MX',{month:'short',year:'numeric'}) }
    monthLoad[mk].tss   += tssOf(r)
    monthLoad[mk].count += 1
  })

  const weekValues = Object.values(weekLoad).map(w => w.tss)
  const maxWeekTSS = Math.round(Math.max(...weekValues, 0))
  const avgWeekTSS = weekValues.length ? Math.round(weekValues.reduce((a,b)=>a+b,0) / weekValues.length) : 0

  // Velocidad: compara últimas 3 rodadas vs 3 anteriores
  const withSpeed = rides.filter(r => r.dur > 0 && r.dist > 0)
  const rSpd = withSpeed.slice(0,3).map(r => r.dist/(r.dur/60))
  const oSpd = withSpeed.slice(3,6).map(r => r.dist/(r.dur/60))
  const rAvg = rSpd.length ? rSpd.reduce((a,b)=>a+b,0)/rSpd.length : 0
  const oAvg = oSpd.length ? oSpd.reduce((a,b)=>a+b,0)/oSpd.length : 0
  const trend = oAvg > 0 ? parseFloat(((rAvg-oAvg)/oAvg*100).toFixed(1)) : 0

  // Zonas últimas 4 semanas
  const zTot = [0,0,0,0,0]
  rides28.forEach(r => (r.zp||[]).forEach((p,i) => zTot[i]+=p))
  const zSum = zTot.reduce((a,b)=>a+b,0)||1
  const zAvg = zTot.map(v => Math.round(v/zSum*100))

  const lastRide = rides[0]
  const daysSinceLast = lastRide ? Math.round((now - new Date(lastRide.iso).getTime())/86400000) : 99

  // Carga mensual y anual
  const monthValues = Object.values(monthLoad)
  const totalRides  = rides.length
  const totalTSS    = rides.reduce((a,r) => a+tssOf(r), 0)
  const totalKm     = rides.reduce((a,r) => a+(r.dist||0), 0)
  const totalHours  = rides.reduce((a,r) => a+(r.dur||0), 0) / 60

  return {
    atl, ctl, tsb, trend, zAvg, daysSinceLast,
    maxWeekTSS, avgWeekTSS,
    weekLoad, monthLoad,
    totalRides, totalTSS, totalKm: Math.round(totalKm), totalHours: Math.round(totalHours*10)/10,
    monthValues
  }
}

// ─────────────────────────────────────────────────────
// interpretFitness — etiquetas en lenguaje humano
// ─────────────────────────────────────────────────────
export function interpretFitness(fit) {
  const atlStatus =
    fit.atl > 60 ? { label:'Carga muy alta', color:'#e07070', tip:'Prioriza recuperación esta semana' } :
    fit.atl > 35 ? { label:'Carga alta', color:'#e09850', tip:'Monitorea sensaciones, no incrementes volumen' } :
    fit.atl > 15 ? { label:'Carga normal', color:'#e8c97a', tip:'Nivel de entrenamiento saludable' } :
                   { label:'Carga baja', color:'#6db86a', tip:'Bien recuperado — puedes aumentar volumen' }

  const ctlStatus =
    fit.ctl > 70 ? { label:'Forma alta', color:'#6db86a', tip:'Base aeróbica sólida' } :
    fit.ctl > 40 ? { label:'Forma moderada', color:'#a8d5a2', tip:'Base en buen desarrollo' } :
    fit.ctl > 15 ? { label:'Forma inicial', color:'#e8c97a', tip:'Sigue siendo consistente' } :
                   { label:'Base mínima', color:'#e09850', tip:'Prioriza consistencia antes que intensidad' }

  const tsbStatus =
    fit.tsb > 15  ? { label:'Muy fresco', color:'#6db86a', tip:'Puedes cargar bien esta semana' } :
    fit.tsb > -5  ? { label:'Óptimo', color:'#a8d5a2', tip:'Momento ideal para rendir' } :
    fit.tsb > -20 ? { label:'Algo fatigado', color:'#e8c97a', tip:'Normal tras semana activa' } :
    fit.tsb > -35 ? { label:'Fatigado', color:'#e09850', tip:'Incluye sesión de recuperación' } :
                    { label:'Muy fatigado', color:'#e07070', tip:'Prioriza descanso esta semana' }

  return { atlStatus, ctlStatus, tsbStatus }
}

// ─────────────────────────────────────────────────────
// buildRidePrompt
// ─────────────────────────────────────────────────────
export function buildRidePrompt(ride, history, supps, profile) {
  const fit = calcFitness([ride, ...history])
  const hist = history.slice(0,6).map(r => {
    const d = Math.round((Date.now()-new Date(r.iso).getTime())/86400000)
    return `- ${r.fecha} (hace ${d}d): ${Math.round(r.dur)}min, ${(r.dist||0).toFixed(1)}km, FC ${Math.round(r.hrAvg||0)}lpm, RPE ${r.rpe}, sensación:${r.sen}, Z4+Z5:${((r.zp||[])[3]||0)+((r.zp||[])[4]||0)}%, TSS≈${tssOf(r)}`
  }).join('\n')
  const suppStr = supps.length ? supps.map(s=>`${s.n} ${s.d} (${s.t})`).join(', ') : 'ninguna'
  const speed = ride.dur > 0 ? ((ride.dist||0)/(ride.dur/60)).toFixed(1) : '?'

  return `Analiza esta rodada con todos sus datos.

PERFIL: Nivel:${profile.nivel}, objetivo:${profile.objetivo}, FCmax:${profile.fcmax||185}, peso:${profile.peso||'?'}kg, ${profile.dias||3}días/sem
SUPLEMENTACIÓN: ${suppStr}
ESTADO DE FORMA: ATL=${fit.atl} TSS/día (${fit.atl>35?'carga alta':fit.atl>15?'carga normal':'carga baja'}), CTL=${fit.ctl} TSS/día, TSB=${fit.tsb} (${fit.tsb>5?'fresco':fit.tsb<-15?'fatigado':'neutro'}), días desde última rodada: ${fit.daysSinceLast}d

RODADA DE HOY:
- ${ride.name} · ${ride.fecha}
- ${Math.round(ride.dur)}min · ${(ride.dist||0).toFixed(1)}km · ${speed}km/h · TSS≈${tssOf(ride)}
- FC: ${Math.round(ride.hrAvg||0)}/${ride.hrMax||'?'}lpm · cadencia: ${ride.cad>0?Math.round(ride.cad)+'rpm':'no registrada'} · elevación: +${Math.round(ride.eg||0)}m
- Zonas: Z1:${(ride.zp||[])[0]||0}% Z2:${(ride.zp||[])[1]||0}% Z3:${(ride.zp||[])[2]||0}% Z4:${(ride.zp||[])[3]||0}% Z5:${(ride.zp||[])[4]||0}%
${ride.temp?`- Temperatura: ${Math.round(ride.temp)}°C`:''}
- RPE: ${ride.rpe}/10 (${RPE_LABELS[ride.rpe]}) · Sensación: ${ride.sen}
${ride.com?`- Comentario: ${ride.com}`:''}

HISTORIAL RECIENTE:
${hist||'Primera rodada registrada'}

Evalúa: coherencia FC vs RPE, impacto suplementación si aplica, carga acumulada según ATL/CTL, riesgo sobreentrenamiento. Da UNA sugerencia concreta para próxima rodada: tipo, duración, intensidad específicos.`
}

// ─────────────────────────────────────────────────────
// buildPlanPrompt — plan semanal lunes a domingo
// ─────────────────────────────────────────────────────
export function buildPlanPrompt(rides, supps, profile, context = '', competition = null) {
  const fit  = calcFitness(rides)
  const now  = new Date()

  // Calcular el lunes de la próxima semana correctamente
  const dow       = now.getDay()                            // 0=dom,1=lun,...6=sab
  const daysToMon = dow === 0 ? 1 : dow === 1 ? 7 : 8-dow // días hasta el próximo lunes
  const nextMon   = new Date(now); nextMon.setDate(now.getDate() + daysToMon); nextMon.setHours(0,0,0,0)

  const dayNames = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo']
  const weekDays = dayNames.map((name,i) => {
    const d = new Date(nextMon); d.setDate(nextMon.getDate()+i)
    return { name, date: d.getDate(), month: d.toLocaleDateString('es-MX',{month:'short'}), iso: d.toISOString().slice(0,10) }
  })
  const weekLabel = weekDays.map(d => `${d.name} ${d.date} ${d.month}`).join(' | ')

  // Historial estructurado
  const hist = rides.slice(0,10).map(r => {
    const d = Math.round((Date.now()-new Date(r.iso).getTime())/86400000)
    return `  [hace ${d}d · ${r.fecha}] ${Math.round(r.dur)}min RPE${r.rpe} sen:${r.sen} Z4+Z5:${((r.zp||[])[3]||0)+((r.zp||[])[4]||0)}% TSS≈${tssOf(r)}`
  }).join('\n')

  // Gaps de descanso
  const gaps = []
  for (let i=0; i<Math.min(rides.length-1,7); i++) {
    const gap = Math.round((new Date(rides[i].iso)-new Date(rides[i+1].iso))/86400000)
    if (gap > 2) gaps.push(`${gap}d sin entrenar entre ${rides[i+1].fecha} y ${rides[i].fecha}`)
  }

  // Carga semanal últimas 8 semanas
  const wHistory = Object.entries(fit.weekLoad)
    .sort(([a],[b]) => a.localeCompare(b))
    .slice(-8)
    .map(([,v]) => `  sem ${v.label}: ${v.count} rodadas, TSS total=${v.tss}`)
    .join('\n')

  const suppStr = supps.length
    ? supps.map(s=>`- ${s.n} ${s.d} (${s.t}): ${s.o}`).join('\n  ')
    : 'ninguna'

  // Competencia próxima
  const compStr = competition?.date
    ? (() => {
        const daysTo = Math.round((new Date(competition.date)-now)/86400000)
        return `COMPETENCIA: "${competition.name}" en ${daysTo} días (${new Date(competition.date).toLocaleDateString('es-MX',{day:'numeric',month:'long'})}). Distancia: ${competition.distance||'?'}km. Esta semana es la ${competition.phase||'preparación'}.`
      })()
    : 'Sin competencia programada'

  return `Eres un entrenador de ciclismo experto. Genera un plan semanal ESPECÍFICO y PERSONALIZADO, no genérico.

══ PERFIL ══
Nivel: ${profile.nivel} | Objetivo: ${profile.objetivo} | FCmax: ${profile.fcmax||185}lpm | Peso: ${profile.peso||70}kg
Días disponibles: ${profile.dias||3}/semana | Ruta: ${profile.ruta||'calles urbanas'}

══ ESTADO DE FORMA ══
ATL (carga 7d):  ${fit.atl} TSS/día → ${fit.atl>60?'MUY ALTA — reducir':fit.atl>35?'alta — monitorear':fit.atl>15?'normal':'baja — puede incrementar'}
CTL (forma 42d): ${fit.ctl} TSS/día → ${fit.ctl>70?'forma alta':fit.ctl>40?'forma moderada':fit.ctl>15?'forma inicial':'base mínima'}
TSB (balance):   ${fit.tsb} → ${fit.tsb>15?'MUY FRESCO':fit.tsb>-5?'ÓPTIMO':fit.tsb>-20?'algo fatigado':fit.tsb>-35?'FATIGADO':'MUY FATIGADO'}
Última rodada: hace ${fit.daysSinceLast} días
TSS sem. promedio: ${fit.avgWeekTSS} | TSS sem. máxima: ${fit.maxWeekTSS}
Zonas 4 semanas: Z1:${fit.zAvg[0]}% Z2:${fit.zAvg[1]}% Z3:${fit.zAvg[2]}% Z4:${fit.zAvg[3]}% Z5:${fit.zAvg[4]}%
Polarización actual: ${fit.zAvg[0]+fit.zAvg[1]}% baja / ${fit.zAvg[3]+fit.zAvg[4]}% alta (ideal 80/20)

══ HISTORIAL RECIENTE ══
${hist||'Sin historial'}
${gaps.length?'\nGaps detectados:\n  '+gaps.join('\n  '):''}

══ CARGA SEMANAL (últimas 8 semanas) ══
${wHistory||'Sin datos'}

══ SUPLEMENTACIÓN ══
  ${suppStr}

══ COMPETENCIA / EVENTO ══
${compStr}

══ CONTEXTO ADICIONAL ══
${context||'Ninguno'}

══ SEMANA A PLANIFICAR ══
${weekLabel}
Días de entreno disponibles: ${profile.dias||3}

REGLAS ESTRICTAS:
1. Usa EXACTAMENTE los días de la lista de arriba. El formato del campo "dia" debe ser: "${weekDays[0].name} ${weekDays[0].date} ${weekDays[0].month}".
2. Distribuye los ${profile.dias||3} días respetando al menos 1 día de descanso entre sesiones intensas (RPE>7).
3. Si TSB=${fit.tsb} < -15: esta semana debe ser más suave que la anterior (reduce TSS total 10-20%).
4. Si TSB=${fit.tsb} > 10: puede incrementar carga 5-10% sobre el promedio semanal de ${fit.avgWeekTSS} TSS.
5. Corrige la polarización: si Z4+Z5>${fit.zAvg[3]+fit.zAvg[4]}% y supera 40%, la mayoría de sesiones deben ser Z1-Z2.
6. Cada "descripcion" debe tener: calentamiento (minutos), parte principal (con tiempos o distancias concretas), vuelta a la calma.
7. Suplementación: conecta cada suplemento al tipo de sesión (cafeína solo en intensidad).
${competition?.date ? `8. Esta semana debe contribuir al plan de periodización hacia la competencia en ${Math.round((new Date(competition.date)-now)/86400000)} días.` : ''}

Responde SOLO con JSON válido (sin texto adicional, sin bloques de código):
{"sesiones":[{"dia":"${weekDays[0].name} ${weekDays[0].date} ${weekDays[0].month}","titulo":"...","tipo":"rodaje continuo|rodaje progresivo|intervalos cortos|salida larga|recuperación activa","descripcion":"Calentamiento: X min suave. Principal: [detalle concreto con tiempos/distancias]. Vuelta calma: X min.","duracion_min":60,"intensidad":"Z1|Z2|Z3|Z4|Z5","rpe_objetivo":5,"tss_estimado":30,"por_que_hoy":"Razón específica basada en TSB=${fit.tsb} e historial...","suplementacion_dia":{"pre":"...","durante":"...","post":"..."},"razon_cientifica":"Referencia (autor año)"}],"diagnostico_semana":"Análisis concreto del estado de forma y estructura de la semana...","ajuste_vs_semana_anterior":"Diferencia concreta con números respecto al historial...","tss_semana_total":150,"referencias":"Allen & Coggan 2010, ..."}`
}

// ─────────────────────────────────────────────────────
// buildCompetitionPlan — plan de periodización hacia competencia
// ─────────────────────────────────────────────────────
export function buildCompetitionPlan(rides, supps, profile, competition) {
  const fit = calcFitness(rides)
  const now = new Date()
  const daysTo = Math.round((new Date(competition.date) - now) / 86400000)
  const weeksTo = Math.ceil(daysTo / 7)

  const hist = rides.slice(0,8).map(r => {
    const d = Math.round((Date.now()-new Date(r.iso).getTime())/86400000)
    return `  [hace ${d}d] ${Math.round(r.dur)}min RPE${r.rpe} TSS≈${tssOf(r)}`
  }).join('\n')

  return `Eres un entrenador de ciclismo de alto rendimiento. Diseña un plan de periodización COMPLETO hacia una competencia específica.

ATLETA:
- Nivel: ${profile.nivel} | FCmax: ${profile.fcmax||185}lpm | Peso: ${profile.peso||70}kg
- Días disponibles: ${profile.dias||3}/semana | Ruta: ${profile.ruta||'calles urbanas'}
- Objetivo general: ${profile.objetivo}

COMPETENCIA:
- Nombre: ${competition.name}
- Fecha: ${new Date(competition.date).toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
- Días restantes: ${daysTo} días (${weeksTo} semanas)
- Distancia: ${competition.distance||'?'} km
- Tipo: ${competition.type||'cicloturismo / gran fondo'}
- Meta personal: ${competition.goal||'terminar bien'}

ESTADO DE FORMA ACTUAL:
- ATL: ${fit.atl} | CTL: ${fit.ctl} | TSB: ${fit.tsb}
- TSS sem. prom: ${fit.avgWeekTSS} | Días sin entrenar: ${fit.daysSinceLast}
- Zonas: Z1:${fit.zAvg[0]}% Z2:${fit.zAvg[1]}% Z3:${fit.zAvg[2]}% Z4:${fit.zAvg[3]}% Z5:${fit.zAvg[4]}%

HISTORIAL RECIENTE:
${hist||'Sin historial'}

SUPLEMENTACIÓN: ${supps.length?supps.map(s=>`${s.n} ${s.d}`).join(', '):'ninguna'}

Diseña un plan de periodización de ${weeksTo} semanas con estas fases:
- Semanas 1 a ${Math.max(1,weeksTo-3)}: Construcción base (volumen creciente, Z2 predominante)
- Semanas ${Math.max(2,weeksTo-2)} a ${Math.max(2,weeksTo-1)}: Intensificación (intervalos, simulacros)
- Semana ${weeksTo}: Tapering (reducción 40-50% volumen, mantener intensidad breve)

Responde SOLO con JSON válido:
{"resumen_estrategia":"Plan de ${weeksTo} semanas hacia ${competition.name}...","fases":[{"fase":"Base","semanas":"1-${Math.max(1,weeksTo-3)}","objetivo":"...","tss_objetivo_semana":${fit.avgWeekTSS+20},"sesiones_tipo":["..."],"nota":"..."},{"fase":"Intensificación","semanas":"${Math.max(2,weeksTo-2)}-${Math.max(2,weeksTo-1)}","objetivo":"...","tss_objetivo_semana":${fit.avgWeekTSS+10},"sesiones_tipo":["..."],"nota":"..."},{"fase":"Tapering","semanas":"${weeksTo}","objetivo":"Llegar fresco a la competencia","tss_objetivo_semana":${Math.round(fit.avgWeekTSS*0.5)},"sesiones_tipo":["..."],"nota":"..."}],"semana_proxima":{"descripcion":"...","sesiones":[{"dia":"...","titulo":"...","duracion_min":60,"intensidad":"Z2","rpe_objetivo":5,"descripcion":"..."}]},"suplementacion_competencia":"Protocolo específico para el día de la carrera basado en su stack actual...","referencias":"Bompa 2018, Issurin 2010, Allen & Coggan 2010"}`
}

// ─────────────────────────────────────────────────────
// buildTrendPrompt
// ─────────────────────────────────────────────────────
export function buildTrendPrompt(rides) {
  const fit  = calcFitness(rides)
  const last = rides.slice(0,20).reverse()
  return `Analiza este historial de ciclismo en 90 palabras. ¿Progreso real, estancamiento o sobreentrenamiento? Basa en Seiler y Coggan.

ATL=${fit.atl} CTL=${fit.ctl} TSB=${fit.tsb} tendencia velocidad: ${fit.trend>0?'+':''}${fit.trend}%
Velocidades: ${last.map(r=>r.dur>0?((r.dist||0)/(r.dur/60)).toFixed(1):'0').join(', ')} km/h
FC: ${last.map(r=>Math.round(r.hrAvg||0)).join(', ')} lpm
RPE: ${last.map(r=>r.rpe||0).join(', ')}
Z4+Z5%: ${last.map(r=>((r.zp||[])[3]||0)+((r.zp||[])[4]||0)).join(', ')}`
}

// ─────────────────────────────────────────────────────
// buildSuppPrompt
// ─────────────────────────────────────────────────────
export function buildSuppPrompt(supps, profile, rides = []) {
  const fit    = rides.length ? calcFitness(rides) : null
  const fitCtx = fit ? `\nEstado: ATL=${fit.atl} TSS/día, TSB=${fit.tsb}, Z4+Z5 reciente=${fit.zAvg[3]+fit.zAvg[4]}%` : ''
  const stack  = supps.map(s=>`- ${s.n} ${s.d} (${s.t}): ${s.o}`).join('\n')

  return `Nutricionista deportivo especializado en ciclismo. Analiza este stack de forma personalizada.

PERFIL: Ciclista ${profile.nivel}, objetivo "${profile.objetivo}", peso ${profile.peso||70}kg${fitCtx}

STACK:
${stack}

Responde SOLO con JSON válido:
{"analisis_general":"2-3 oraciones sobre el stack, sinergia y gaps","por_suplemento":[{"nombre":"...","evidencia":"sólida|moderada|débil","timing_optimo":"...","con_este_perfil":"cómo aplica a este ciclista y su estado de forma","ajuste_sugerido":"..."}],"protocolo_semana":{"dia_intenso":["..."],"dia_z2":["..."],"dia_descanso":["..."]},"referencias":"..."}`
}
