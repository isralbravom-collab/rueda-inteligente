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

// Extrae JSON de una respuesta aunque venga con texto antes/después
export function extractJSON(raw) {
  try { return JSON.parse(raw) } catch {}
  const m = raw.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) } catch {} }
  return null
}

export const RPE_LABELS = {1:'Reposo',2:'Muy fácil',3:'Fácil',4:'Fácil+',5:'Moderado',6:'Moderado+',7:'Difícil',8:'Muy difícil',9:'Extremo',10:'Máximo'}

export function tssOf(r) {
  if (r.wattsNorm && r.wattsNorm > 0 && r.hasPower) {
    // TSS real con potencia: (seg × NP × IF) / (FTP × 3600) × 100
    const ftp = r.ftp || 150
    const IF  = r.wattsNorm / ftp
    return Math.round((r.dur * 60) * r.wattsNorm * IF / (ftp * 3600) * 100)
  }
  // TSS estimado por RPE y duración
  return Math.round((r.dur / 60) * Math.pow((r.rpe || 5) / 10, 2) * 67)
}

export function calcFitness(rides) {
  const now = Date.now()
  const rides7  = rides.filter(r => (now - new Date(r.iso).getTime()) <  7 * 86400000)
  const rides28 = rides.filter(r => (now - new Date(r.iso).getTime()) < 28 * 86400000)
  const rides42 = rides.filter(r => (now - new Date(r.iso).getTime()) < 42 * 86400000)

  const atl = Math.round(rides7.reduce((a, r)  => a + tssOf(r), 0) / 7)
  const ctl = Math.round(rides42.reduce((a, r) => a + tssOf(r), 0) / 42)
  const tsb = ctl - atl

  const weekLoad = {}
  rides.filter(r => (now - new Date(r.iso).getTime()) < 84 * 86400000).forEach(r => {
    const d = new Date(r.iso)
    const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay()+6)%7)); mon.setHours(0,0,0,0)
    const wk = mon.toISOString().slice(0,10)
    if (!weekLoad[wk]) weekLoad[wk] = { tss:0, count:0, label:mon.toLocaleDateString('es-MX',{day:'numeric',month:'short'}) }
    weekLoad[wk].tss   += tssOf(r)
    weekLoad[wk].count += 1
  })

  const monthLoad = {}
  rides.forEach(r => {
    const d  = new Date(r.iso)
    const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    if (!monthLoad[mk]) monthLoad[mk] = { tss:0, count:0, label:d.toLocaleDateString('es-MX',{month:'short',year:'numeric'}) }
    monthLoad[mk].tss   += tssOf(r)
    monthLoad[mk].count += 1
  })

  const weekValues = Object.values(weekLoad).map(w => w.tss)
  const maxWeekTSS = Math.round(Math.max(...weekValues, 0))
  const avgWeekTSS = weekValues.length ? Math.round(weekValues.reduce((a,b)=>a+b,0)/weekValues.length) : 0

  const withSpeed = rides.filter(r => r.dur > 0 && r.dist > 0)
  const rSpd = withSpeed.slice(0,3).map(r => r.dist/(r.dur/60))
  const oSpd = withSpeed.slice(3,6).map(r => r.dist/(r.dur/60))
  const rAvg = rSpd.length ? rSpd.reduce((a,b)=>a+b,0)/rSpd.length : 0
  const oAvg = oSpd.length ? oSpd.reduce((a,b)=>a+b,0)/oSpd.length : 0
  const trend = oAvg > 0 ? parseFloat(((rAvg-oAvg)/oAvg*100).toFixed(1)) : 0

  const zTot = [0,0,0,0,0]
  rides28.forEach(r => (r.zp||[]).forEach((p,i) => zTot[i]+=p))
  const zSum = zTot.reduce((a,b)=>a+b,0)||1
  const zAvg = zTot.map(v => Math.round(v/zSum*100))

  const lastRide = rides[0]
  const daysSinceLast = lastRide ? Math.round((now-new Date(lastRide.iso).getTime())/86400000) : 99

  const totalRides  = rides.length
  const totalTSS    = rides.reduce((a,r)=>a+tssOf(r),0)
  const totalKm     = rides.reduce((a,r)=>a+(r.dist||0),0)
  const totalHours  = rides.reduce((a,r)=>a+(r.dur||0),0)/60

  return { atl, ctl, tsb, trend, zAvg, daysSinceLast, maxWeekTSS, avgWeekTSS, weekLoad, monthLoad, totalRides, totalTSS, totalKm:Math.round(totalKm), totalHours:Math.round(totalHours*10)/10 }
}

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

// ── Formato enriquecido de rodada para prompt
function rideStr(r, idx = '') {
  const d    = Math.round((Date.now()-new Date(r.iso).getTime())/86400000)
  const sp   = r.speed || (r.dur>0 ? (r.dist/(r.dur/60)).toFixed(1) : '?')
  const cad  = r.cad > 0 ? `cad:${Math.round(r.cad)}rpm(${r.cadPctOptimal||'?'}%opt)` : 'sin cadencia'
  const pow  = r.watts > 0 ? `${r.watts}W${r.hasPower?'real':'est'}` : ''
  const dec  = r.decoupling != null ? `dec:${r.decoupling}%` : ''
  const zstr = (r.zp||[]).map((p,i)=>`Z${i+1}:${p}%`).join(' ')
  return `[hace ${d}d · ${r.fecha}] ${Math.round(r.dur)}min mov ${(r.dist||0).toFixed(1)}km ${sp}km/h FC:${Math.round(r.hrAvg||0)}/${r.hrMax||'?'}lpm ${cad} ${pow} ${dec} TSS≈${tssOf(r)} ${zstr} RPE:${r.rpe} sen:${r.sen}`
}

export function buildRidePrompt(ride, history, supps, profile) {
  const fit     = calcFitness([ride, ...history])
  const hist    = history.slice(0,5).map(r => rideStr(r)).join('\n')
  const suppStr = supps.length ? supps.map(s=>`${s.n} ${s.d}(${s.t})`).join(', ') : 'ninguna'

  const cadCtx = ride.cad > 0
    ? `Cadencia: ${Math.round(ride.cad)}rpm · ${ride.cadPctOptimal||0}% en rango óptimo (80-100rpm) · variabilidad σ=${ride.cadStdDev||'?'}rpm`
    : 'Cadencia: no registrada'

  const powCtx = ride.watts > 0
    ? `Potencia: ${ride.watts}W ${ride.hasPower?'(potenciómetro real)':'(estimada por física)'} · ${ride.kilojoules||0}kJ · ${ride.calories||0}kcal`
    : 'Potencia: sin datos'

  const decCtx = ride.decoupling != null
    ? `Desacoplamiento aeróbico: ${ride.decoupling}% ${Math.abs(ride.decoupling)>5?'(significativo — base Z2 necesita desarrollo)':'(aceptable)'}`
    : ''

  const pauseCtx = (ride.pauseMin||0) > 10
    ? `Incluye pausa de ${ride.pauseMin}min${ride.longPauses>0?' (pausa larga intencional detectada)':''} — métricas calculadas sobre tiempo en movimiento`
    : ''

  return `Analiza esta rodada con todos sus datos disponibles.

PERFIL: Nivel:${profile.nivel} Objetivo:${profile.objetivo} FCmax:${profile.fcmax||185}lpm Peso:${profile.peso||70}kg ${profile.dias||3}días/sem
SUPLEMENTACIÓN: ${suppStr}
FORMA: ATL=${fit.atl}TSS/día CTL=${fit.ctl}TSS/día TSB=${fit.tsb} hace ${fit.daysSinceLast}d sin entrenar

RODADA — ${ride.name} · ${ride.fecha}
• Tiempo: ${Math.round(ride.dur)}min en movimiento${ride.elapsedMin?` / ${ride.elapsedMin}min total`:''} ${pauseCtx}
• Distancia: ${(ride.dist||0).toFixed(1)}km · Velocidad: ${ride.speed||(ride.dur>0?((ride.dist||0)/(ride.dur/60)).toFixed(1):'?')}km/h
• FC: ${Math.round(ride.hrAvg||0)}/${ride.hrMax||'?'}lpm · Elevación: +${Math.round(ride.eg||0)}m
• Zonas: Z1:${(ride.zp||[])[0]||0}% Z2:${(ride.zp||[])[1]||0}% Z3:${(ride.zp||[])[2]||0}% Z4:${(ride.zp||[])[3]||0}% Z5:${(ride.zp||[])[4]||0}%
• ${cadCtx}
• ${powCtx}
${decCtx ? '• ' + decCtx : ''}
${ride.temp ? '• Temperatura: '+Math.round(ride.temp)+'°C' : ''}
• RPE: ${ride.rpe}/10 (${RPE_LABELS[ride.rpe]}) · Sensación: ${ride.sen}
${ride.com ? '• Comentario: '+ride.com : ''}

HISTORIAL RECIENTE:
${hist || 'Primera rodada'}

Evalúa en 150 palabras, párrafo corrido sin bullet points:
1) Coherencia FC vs RPE y calidad de las zonas
2) Si cadencia < 80rpm o variabilidad alta: recomendar trabajo de cadencia
3) Desacoplamiento aeróbico si aplica
4) Carga acumulada (ATL/TSB) y riesgo sobreentrenamiento
5) UNA sugerencia concreta para próxima rodada con tipo, duración, intensidad y RPE objetivo`
}

export function buildPlanPrompt(rides, supps, profile, context = '', competition = null) {
  const fit  = calcFitness(rides)
  const now  = new Date()
  const dow  = now.getDay()
  const toMon = dow===0?1:dow===1?7:8-dow
  const nextMon = new Date(now); nextMon.setDate(now.getDate()+toMon); nextMon.setHours(0,0,0,0)
  const dayNames = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo']
  const weekDays = dayNames.map((name,i) => {
    const d = new Date(nextMon); d.setDate(nextMon.getDate()+i)
    return `${name} ${d.getDate()} ${d.toLocaleDateString('es-MX',{month:'short'})}`
  })

  const hist = rides.slice(0,8).map(r => rideStr(r)).join('\n')

  const wHistory = Object.entries(fit.weekLoad)
    .sort(([a],[b]) => a.localeCompare(b)).slice(-6)
    .map(([,v]) => `  ${v.label}: ${v.count} rodadas TSS=${v.tss}`)
    .join('\n')

  const suppStr = supps.length ? supps.map(s=>`${s.n} ${s.d}(${s.t}): ${s.o}`).join(' | ') : 'ninguna'

  const compStr = competition?.date
    ? (() => {
        const dTo = Math.round((new Date(competition.date)-now)/86400000)
        return `COMPETENCIA: "${competition.name}" en ${dTo} días · ${competition.distance||'?'}km · meta: ${competition.goal||'terminar'}`
      })() : ''

  const tsbAdvice = fit.tsb > 10 ? 'FRESCO: puede incrementar carga 5-10%' : fit.tsb < -15 ? 'FATIGADO: reducir volumen esta semana' : 'NEUTRO: mantener volumen similar'

  return `Eres entrenador de ciclismo experto. Genera plan semanal personalizado basado en datos reales.

PERFIL: ${profile.nivel} | ${profile.objetivo} | FCmax:${profile.fcmax||185} | Peso:${profile.peso||70}kg | ${profile.dias||3}días/sem | ${profile.ruta||'calles urbanas'}
FORMA: ATL=${fit.atl} CTL=${fit.ctl} TSB=${fit.tsb}(${tsbAdvice}) | Último entreno: hace ${fit.daysSinceLast}d | TSS prom/sem: ${fit.avgWeekTSS}
ZONAS 4sem: Z1:${fit.zAvg[0]}% Z2:${fit.zAvg[1]}% Z3:${fit.zAvg[2]}% Z4:${fit.zAvg[3]}% Z5:${fit.zAvg[4]}% | Polarización: ${fit.zAvg[0]+fit.zAvg[1]}%baja/${fit.zAvg[3]+fit.zAvg[4]}%alta
SUPLEMENTACIÓN: ${suppStr}
${compStr}
CONTEXTO: ${context||'ninguno'}

HISTORIAL (más reciente primero):
${hist||'sin historial'}

CARGA SEMANAL:
${wHistory||'sin datos'}

SEMANA A PLANIFICAR — exactamente estos días:
${weekDays.join(' | ')}
Días de entreno disponibles: ${profile.dias||3}

Responde SOLO con este JSON (sin texto antes ni después):
{"sesiones":[{"dia":"${weekDays[0]}","titulo":"...","tipo":"rodaje continuo|rodaje progresivo|intervalos cortos|salida larga|recuperación activa","descripcion":"Calentamiento Xmin. Principal: [detalle concreto]. Vuelta calma Xmin.","duracion_min":60,"intensidad":"Z1|Z2|Z3|Z4|Z5","rpe_objetivo":5,"tss_estimado":30,"por_que_hoy":"razón basada en TSB=${fit.tsb} e historial","suplementacion_dia":{"pre":"...","durante":"...","post":"..."},"razon_cientifica":"referencia autor año"}],"diagnostico_semana":"análisis concreto del estado de forma","ajuste_vs_semana_anterior":"diferencia con números vs historial","tss_semana_total":0,"referencias":"..."}`
}

export function buildCompetitionPlan(rides, supps, profile, competition) {
  const fit    = calcFitness(rides)
  const now    = new Date()
  const daysTo = Math.round((new Date(competition.date)-now)/86400000)
  const weeksTo= Math.ceil(daysTo/7)
  const hist   = rides.slice(0,6).map(r => rideStr(r)).join('\n')
  const suppStr= supps.length ? supps.map(s=>`${s.n} ${s.d}`).join(', ') : 'ninguna'

  return `Entrenador de ciclismo experto. Plan de periodización hacia competencia.

ATLETA: ${profile.nivel} | FCmax:${profile.fcmax||185} | Peso:${profile.peso||70}kg | ${profile.dias||3}días/sem | ${profile.ruta||'calles'}
FORMA: ATL=${fit.atl} CTL=${fit.ctl} TSB=${fit.tsb} | TSS prom/sem:${fit.avgWeekTSS}
COMPETENCIA: "${competition.name}" · ${daysTo} días · ${weeksTo} semanas · ${competition.distance||'?'}km · ${competition.type||'gran fondo'} · meta: ${competition.goal||'terminar'}
SUPLEMENTACIÓN: ${suppStr}
HISTORIAL: ${hist||'sin datos'}

Responde SOLO con este JSON:
{"resumen_estrategia":"...","fases":[{"fase":"Base","semanas":"1-${Math.max(1,weeksTo-3)}","objetivo":"...","tss_objetivo_semana":${fit.avgWeekTSS+15},"sesiones_tipo":["..."],"nota":"..."},{"fase":"Intensificación","semanas":"${Math.max(2,weeksTo-2)}-${Math.max(2,weeksTo-1)}","objetivo":"...","tss_objetivo_semana":${fit.avgWeekTSS+5},"sesiones_tipo":["..."],"nota":"..."},{"fase":"Tapering","semanas":"${weeksTo}","objetivo":"Llegar fresco","tss_objetivo_semana":${Math.round(fit.avgWeekTSS*0.5)},"sesiones_tipo":["..."],"nota":"..."}],"proxima_semana":{"descripcion":"...","sesiones":[{"dia":"...","titulo":"...","duracion_min":60,"intensidad":"Z2","rpe_objetivo":5,"descripcion":"..."}]},"suplementacion_competencia":"protocolo día de carrera con stack actual","referencias":"Bompa 2018, Seiler 2010"}`
}

export function buildTrendPrompt(rides) {
  const fit  = calcFitness(rides)
  const last = rides.slice(0,20).reverse()
  return `Analiza historial ciclismo en 90 palabras. ¿Progreso, estancamiento o sobreentrenamiento? Basa en Seiler y Coggan.
ATL=${fit.atl} CTL=${fit.ctl} TSB=${fit.tsb} tendencia:${fit.trend>0?'+':''}${fit.trend}%
Velocidades: ${last.map(r=>r.speed||(r.dur>0?((r.dist||0)/(r.dur/60)).toFixed(1):'0')).join(',')}km/h
FC: ${last.map(r=>Math.round(r.hrAvg||0)).join(',')}lpm
RPE: ${last.map(r=>r.rpe||0).join(',')}
Cadencia: ${last.map(r=>Math.round(r.cad||0)).join(',')}rpm
Watts: ${last.map(r=>r.watts||0).join(',')}W
Z4+Z5%: ${last.map(r=>((r.zp||[])[3]||0)+((r.zp||[])[4]||0)).join(',')}`
}

export function buildSuppPrompt(supps, profile, rides=[]) {
  const fit    = rides.length ? calcFitness(rides) : null
  const fitCtx = fit ? `ATL=${fit.atl} TSB=${fit.tsb} Z4+Z5=${fit.zAvg[3]+fit.zAvg[4]}%` : ''
  const stack  = supps.map(s=>`- ${s.n} ${s.d}(${s.t}): ${s.o}`).join('\n')
  return `Nutricionista deportivo ciclismo. Analiza stack personalizado.
PERFIL: ${profile.nivel} peso:${profile.peso||70}kg objetivo:"${profile.objetivo}" ${fitCtx}
STACK:\n${stack}
Responde SOLO con JSON:
{"analisis_general":"...","por_suplemento":[{"nombre":"...","evidencia":"sólida|moderada|débil","timing_optimo":"...","con_este_perfil":"...","ajuste_sugerido":"..."}],"protocolo_semana":{"dia_intenso":["..."],"dia_z2":["..."],"dia_descanso":["..."]},"referencias":"..."}`
}
