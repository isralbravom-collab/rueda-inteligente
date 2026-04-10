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

  // ── Historial enriquecido
  const hist = rides.slice(0,10).map(r => {
    const d   = Math.round((Date.now()-new Date(r.iso).getTime())/86400000)
    const sp  = r.speed||(r.dur>0?((r.dist||0)/(r.dur/60)).toFixed(1):'?')
    const pow = r.watts>0 ? `${r.watts}W${r.hasPower?'':'est'}` : ''
    const cad = r.cad>0 ? `cad:${Math.round(r.cad)}rpm` : ''
    const dec = r.decoupling!=null ? `dec:${r.decoupling}%` : ''
    return `  [hace ${d}d · ${r.fecha}] ${Math.round(r.dur)}min ${(r.dist||0).toFixed(1)}km ${sp}km/h FC:${Math.round(r.hrAvg||0)}lpm ${cad} ${pow} ${dec} RPE:${r.rpe} sen:${r.sen} TSS≈${tssOf(r)}`
  }).join('\n')

  // ── Carga semanal últimas 6 semanas
  const wHistory = Object.entries(fit.weekLoad)
    .sort(([a],[b])=>a.localeCompare(b)).slice(-6)
    .map(([,v])=>`  sem ${v.label}: ${v.count} rodadas TSS=${v.tss}`)
    .join('\n')

  // ── Suplementación
  const suppStr = supps.length
    ? supps.map(s=>`${s.n} ${s.d}(${s.t}): ${s.o}`).join(' | ')
    : 'ninguna registrada'

  // ── Geografía y clima
  const ciudad   = profile.ciudad || 'no especificada'
  const altitud  = parseInt(profile.altitud)||0
  const clima    = profile.clima || 'templado'
  const horario  = profile.horariosDisponibles || 'flexible'
  const altAdj   = altitud > 1500
    ? `AJUSTE ALTITUD: a ${altitud}m el VO2max baja ~${Math.round((altitud-500)/300)*3}% vs nivel del mar. Las zonas de FC se elevan 5-8 lpm para el mismo esfuerzo. Esperar velocidades ~10% menores que a nivel del mar.`
    : 'Altitud baja — sin ajuste necesario.'
  const climaAdj = clima.includes('tropical') || clima.includes('caluroso')
    ? `AJUSTE CALOR/HUMEDAD: añadir +200-300ml agua/hora. Rodar idealmente en ${horario==='mañana'?'la mañana temprano':horario} para evitar el pico de calor. El RPE percibido será 1-2 puntos mayor que en climas frescos.`
    : clima.includes('frío')
    ? 'AJUSTE FRÍO: calentamiento de 15min antes de intensidad. Hidratación regular aunque no se sienta sed.'
    : 'Clima favorable para entrenar.'

  // ── Potenciómetro y FTP
  const tienePow  = !!profile.tienePotenciometro
  const ftp       = parseInt(profile.ftp)||0
  const ftpEst    = ftp > 0 ? ftp : Math.round((profile.peso||70) * ({novato:1.5,recreativo:2.2,amateur:3.0,avanzado:3.8}[profile.nivel||'recreativo']||2.2))
  const powerMode = tienePow
    ? `MODO POTENCIA: FTP=${ftpEst}W (${(ftpEst/(profile.peso||70)).toFixed(1)}W/kg). El plan incluirá rangos de vatios por zona: Z1<${Math.round(ftpEst*.55)}W Z2:${Math.round(ftpEst*.55)}-${Math.round(ftpEst*.75)}W Z3:${Math.round(ftpEst*.75)}-${Math.round(ftpEst*.90)}W Z4:${Math.round(ftpEst*.90)}-${Math.round(ftpEst*1.05)}W Z5:>${Math.round(ftpEst*1.05)}W`
    : `MODO FC: FCmax=${profile.fcmax||185}lpm. Zonas: Z1<${Math.round((profile.fcmax||185)*.60)} Z2:${Math.round((profile.fcmax||185)*.60)}-${Math.round((profile.fcmax||185)*.70)} Z3:${Math.round((profile.fcmax||185)*.70)}-${Math.round((profile.fcmax||185)*.80)} Z4:${Math.round((profile.fcmax||185)*.80)}-${Math.round((profile.fcmax||185)*.90)} Z5:>${Math.round((profile.fcmax||185)*.90)} lpm`

  // ── Polarización actual
  const lowPct  = fit.zAvg[0]+fit.zAvg[1]
  const highPct = fit.zAvg[3]+fit.zAvg[4]
  const polAdj  = highPct > 40
    ? 'ATENCIÓN: distribución de zonas muy polarizada hacia intensidad alta. Esta semana priorizar Z2.'
    : lowPct < 60
    ? 'La mayoría de sesiones deben ser Z1-Z2 (principio 80/20, Seiler 2010).'
    : 'Distribución correcta — mantener.'

  // ── TSB advice
  const tsbAdvice = fit.tsb > 10
    ? 'FRESCO: puede incrementar carga 5-10% sobre promedio'
    : fit.tsb < -15
    ? 'FATIGADO: esta semana debe ser más suave — reducir TSS 15-20%'
    : 'NEUTRO: mantener volumen similar al promedio'

  // ── Competencia
  const compStr = competition?.date
    ? (() => {
        const dTo = Math.round((new Date(competition.date)-now)/86400000)
        const phase = dTo > 21 ? 'Base' : dTo > 7 ? 'Intensificación' : 'Tapering'
        return `COMPETENCIA: "${competition.name}" en ${dTo} días · ${competition.distance||'?'}km · Fase actual: ${phase} · meta: ${competition.goal||'terminar'}`
      })() : ''

  return `Eres un coach de ciclismo experto con conocimiento científico de fisiología del ejercicio, nutrición deportiva y periodización. Tu misión es generar un plan ALTAMENTE PERSONALIZADO para un ciclista que no puede pagar un coach personal — el plan debe ser tan bueno como el que daría un entrenador profesional.

FILOSOFÍA: El plan usa lenguaje SIMPLE y ACCIONABLE. En lugar de "sesión Z2", di "rueda suave donde puedas hablar". En lugar de "TSS objetivo 80", di "60-70 minutos sin llegar a fatigarte". El usuario no necesita entender las métricas — solo necesita saber qué hacer.

══ PERFIL DEL ATLETA ══
Nombre: ${profile.nombre||'atleta'} | Nivel: ${profile.nivel} | Edad: ${profile.edad||'?'} | Peso: ${profile.peso||70}kg
Objetivo: ${profile.objetivo} | Días disponibles: ${profile.dias||3}/sem | Horario: ${horario}
${powerMode}

══ GEOGRAFÍA Y CONDICIONES ══
Ciudad: ${ciudad} | Altitud: ${altitud}msnm | Clima: ${clima} | Ruta habitual: ${profile.ruta||'no especificada'}
${altAdj}
${climaAdj}

══ ESTADO DE FORMA ACTUAL ══
ATL (carga 7d): ${fit.atl} TSS/día | CTL (forma 42d): ${fit.ctl} TSS/día | TSB: ${fit.tsb} → ${tsbAdvice}
Última rodada: hace ${fit.daysSinceLast} días | TSS sem. promedio: ${fit.avgWeekTSS} | TSS sem. máxima: ${fit.maxWeekTSS}
Zonas 4 semanas: Z1:${fit.zAvg[0]}% Z2:${fit.zAvg[1]}% Z3:${fit.zAvg[2]}% Z4:${fit.zAvg[3]}% Z5:${fit.zAvg[4]}%
${polAdj}
Tendencia velocidad: ${fit.trend>2?`+${fit.trend}% mejorando`:fit.trend<-2?`${fit.trend}% bajando`:'estable'}

══ HISTORIAL RECIENTE (más reciente primero) ══
${hist||'Sin historial previo'}

══ CARGA SEMANAL (últimas 6 semanas) ══
${wHistory||'Sin datos'}

══ SUPLEMENTACIÓN REGISTRADA ══
${suppStr}

${compStr ? `══ COMPETENCIA ══\n${compStr}\n` : ''}
══ CONTEXTO ADICIONAL ══
${context||'Ninguno'}

══ SEMANA A PLANIFICAR ══
${weekDays.join(' | ')}
Días de entreno disponibles: ${profile.dias||3}

══ REGLAS CIENTÍFICAS OBLIGATORIAS ══
1. PROGRESIÓN: TSS de esta semana no supere ${Math.round((fit.avgWeekTSS||50)*1.10)} (máx +10% sobre promedio, Bompa 2018)
2. POLARIZACIÓN 80/20: al menos ${Math.ceil((profile.dias||3)*0.6)} de las ${profile.dias||3} sesiones deben ser Z1-Z2 (Seiler 2010)
3. RECUPERACIÓN: si TSB=${fit.tsb} < -15, una sesión debe ser recuperación activa Z1 (<45min)
4. ALTITUD: ${altitud>1500?`a ${altitud}m, esperar FC ${Math.round((altitud-500)/300)*3-5}-${Math.round((altitud-500)/300)*3+5}lpm más alta que a nivel del mar para mismo esfuerzo`:'sin ajuste de altitud necesario'}
5. CADENCIA: siempre mencionar rango 80-100rpm en sesiones Z2+ (Lucia et al. 2001)
6. HIDRATACIÓN Y NUTRICIÓN: cada sesión DEBE incluir protocolo específico calculado así:
   - <60min: solo agua, ${Math.round((profile.peso||70)*5+200)}-${Math.round((profile.peso||70)*5+400)}ml total, sin carbohidratos necesarios
   - 60-90min: agua + electrolitos, ${Math.round((profile.peso||70)*7+200)}-${Math.round((profile.peso||70)*7+400)}ml/hora, 1 gel o plátano a los 45-50min
   - >90min: ${Math.round((profile.peso||70)*8+200)}-${Math.round((profile.peso||70)*8+400)}ml/hora, 30-60g carbohidratos/hora cada 45min, electrolitos cada hora
   - CLIMA: ${clima.includes('tropical')||clima.includes('caluroso')?'sumar +250ml/hora por calor y humedad':'hidratación estándar'}
   - ALTITUD: ${altitud>2000?'sumar +15% agua por aire más seco y respiración acelerada':'sin ajuste'}
   Expresar hidratación en ml Y en "cada cuántos km" basado en velocidad promedio histórica de ${Math.round(fit.avgWeekTSS>0?(rides.slice(0,10).reduce((a,r)=>a+(r.speed||(r.dur>0?(r.dist||0)/(r.dur/60):0)),0)/Math.min(10,rides.length)):20)}km/h del atleta.

CRÍTICO: genera EXACTAMENTE ${profile.dias||3} sesiones en el array. Una por cada día disponible.
Días a usar: ${weekDays.slice(0, profile.dias||3).join(' · ')}

Responde SOLO con JSON (sin texto antes ni después, sin markdown):
{"sesiones":[{"dia":"${weekDays[0]}","titulo":"...","tipo":"rodaje suave","descripcion":"CALENTAMIENTO: 10min suave. PRINCIPAL: descripción concreta. VUELTA CALMA: 5min.","duracion_min":60,"zona_principal":"Z2","lenguaje_simple":"Frase simple de 1 línea para cualquier ciclista","fc_objetivo":"${Math.round((profile.fcmax||185)*.65)}-${Math.round((profile.fcmax||185)*.75)} lpm","cadencia_objetivo":"85-95 rpm pedaleo suave","rpe_objetivo":5,"tss_estimado":40,"por_que_hoy":"Razón específica para este atleta","hidratacion_nutricion":{"llevar":"Xml agua...","protocolo":"Sorbo cada Xmin (cada Xkm a tu ritmo)","nota_clima":"${clima.includes('tropical')||clima.includes('caluroso')?'Rodar temprano. Añade sal al agua.':altitud>2000?'Bebe aunque no tengas sed.':''}"},"suplementacion":{"pre":"...","durante":"...","post":"..."},"razon_cientifica":"Autor año"},{"dia":"${weekDays[1] || weekDays[0]}","titulo":"...","tipo":"...","descripcion":"...","duracion_min":60,"zona_principal":"Z2","lenguaje_simple":"...","fc_objetivo":"...","cadencia_objetivo":"85-95 rpm","rpe_objetivo":5,"tss_estimado":40,"por_que_hoy":"...","hidratacion_nutricion":{"llevar":"...","protocolo":"...","nota_clima":""},"suplementacion":{"pre":"...","durante":"...","post":"..."},"razon_cientifica":"..."},{"dia":"${weekDays[2] || weekDays[1] || weekDays[0]}","titulo":"...","tipo":"...","descripcion":"...","duracion_min":60,"zona_principal":"Z3","lenguaje_simple":"...","fc_objetivo":"...","cadencia_objetivo":"85-95 rpm","rpe_objetivo":6,"tss_estimado":50,"por_que_hoy":"...","hidratacion_nutricion":{"llevar":"...","protocolo":"...","nota_clima":""},"suplementacion":{"pre":"...","durante":"...","post":"..."},"razon_cientifica":"..."}],"diagnostico_semana":"2-3 oraciones sobre el estado de forma en lenguaje simple.","consejo_semana":"Consejo concreto y específico para esta semana.","tss_semana_total":130,"referencias":"Foster 2001, Seiler 2010, Bompa 2018"}`
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
