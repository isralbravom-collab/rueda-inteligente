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

export function extractJSON(raw) {
  if (!raw) return null
  // Try direct parse first
  try { return JSON.parse(raw.trim()) } catch {}
  // Strip markdown code blocks
  const stripped = raw.replace(/```json|```/g, '').trim()
  try { return JSON.parse(stripped) } catch {}
  // Find the largest {...} block
  const m = stripped.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) } catch {} }
  // Try to find and fix truncated JSON by finding last complete object
  const start = stripped.indexOf('{')
  if (start >= 0) {
    // Try progressively shorter substrings to find valid JSON
    for (let end = stripped.length; end > start+10; end--) {
      const sub = stripped.slice(start, end)
      try { return JSON.parse(sub) } catch {}
      // Try closing open structures
      const closes = ['}', ']}', ']}', '"}]}', '"]}']
      for (const close of closes) {
        try { return JSON.parse(sub + close) } catch {}
      }
    }
  }
  return null
}

export const RPE_LABELS = {1:'Reposo',2:'Muy fácil',3:'Fácil',4:'Fácil+',5:'Moderado',6:'Moderado+',7:'Difícil',8:'Muy difícil',9:'Extremo',10:'Máximo'}

export function tssOf(r) {
  if (r.wattsNorm && r.wattsNorm > 0 && r.hasPower) {
    const ftp = r.ftp || 150
    const IF  = r.wattsNorm / ftp
    return Math.round((r.dur * 60) * r.wattsNorm * IF / (ftp * 3600) * 100)
  }
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

  return { atl, ctl, tsb, trend, zAvg, daysSinceLast, maxWeekTSS, avgWeekTSS, weekLoad, monthLoad,
    totalRides, totalTSS, totalKm:Math.round(totalKm), totalHours:Math.round(totalHours*10)/10 }
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

function rideStr(r) {
  const d   = Math.round((Date.now()-new Date(r.iso).getTime())/86400000)
  const sp  = r.speed||(r.dur>0?(r.dist/(r.dur/60)).toFixed(1):'?')
  const cad = r.cad>0 ? `cad:${Math.round(r.cad)}rpm` : ''
  const pow = r.watts>0 ? `${r.watts}W` : ''
  const dec = r.decoupling!=null ? `dec:${r.decoupling}%` : ''
  return `[hace ${d}d·${r.fecha}] ${Math.round(r.dur)}min ${(r.dist||0).toFixed(1)}km ${sp}km/h FC:${Math.round(r.hrAvg||0)}lpm ${cad} ${pow} ${dec} RPE:${r.rpe} sen:${r.sen} TSS:${tssOf(r)}`
}

export function buildRidePrompt(ride, history, supps, profile) {
  const fit     = calcFitness([ride, ...history])
  const hist    = history.slice(0,5).map(r => rideStr(r)).join('\n')
  const suppStr = supps.length ? supps.map(s=>`${s.n} ${s.d}(${s.t})`).join(', ') : 'ninguna'
  const cadCtx  = ride.cad > 0 ? `${Math.round(ride.cad)}rpm · ${ride.cadPctOptimal||0}% en rango óptimo` : 'no registrada'
  const powCtx  = ride.watts > 0 ? `${ride.watts}W ${ride.hasPower?'real':'estimada'}` : 'sin datos'

  return `Analiza esta rodada.

PERFIL: ${profile.nivel} FCmax:${profile.fcmax||185} Peso:${profile.peso||70}kg
SUPLEMENTACIÓN: ${suppStr}
FORMA: ATL=${fit.atl} CTL=${fit.ctl} TSB=${fit.tsb} hace ${fit.daysSinceLast}d sin entrenar

RODADA — ${ride.name} · ${ride.fecha}
• ${Math.round(ride.dur)}min · ${(ride.dist||0).toFixed(1)}km · ${ride.speed||(ride.dur>0?((ride.dist||0)/(ride.dur/60)).toFixed(1):'?')}km/h
• FC: ${Math.round(ride.hrAvg||0)}/${ride.hrMax||'?'}lpm · Elevación: +${Math.round(ride.eg||0)}m
• Zonas: Z1:${(ride.zp||[])[0]||0}% Z2:${(ride.zp||[])[1]||0}% Z3:${(ride.zp||[])[2]||0}% Z4:${(ride.zp||[])[3]||0}% Z5:${(ride.zp||[])[4]||0}%
• Cadencia: ${cadCtx} · Potencia: ${powCtx}
• RPE: ${ride.rpe}/10 · Sensación: ${ride.sen}
${ride.com ? '• Comentario: '+ride.com : ''}

HISTORIAL: ${hist||'Primera rodada'}

Evalúa en 150 palabras: coherencia FC vs RPE, zonas, cadencia si aplica, carga acumulada, riesgo sobreentrenamiento. Da UNA sugerencia concreta para próxima rodada.`
}

export function buildPlanPrompt(rides, supps, profile, context = '') {
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

  const dias     = profile.dias || 3
  const hist     = rides.slice(0,8).map(r => rideStr(r)).join('\n')
  const suppStr  = supps.length ? supps.map(s=>`${s.n} ${s.d}(${s.t}): ${s.o}`).join(' | ') : 'ninguna'
  const ciudad   = profile.ciudad || 'no especificada'
  const altitud  = parseInt(profile.altitud)||0
  const clima    = profile.clima || 'templado'
  const horario  = profile.horariosDisponibles || 'flexible'
  const fcmax    = profile.fcmax || 185
  const peso     = profile.peso || 70
  const tienePow = !!profile.tienePotenciometro
  const ftpEst   = parseInt(profile.ftp)||Math.round(peso*({novato:1.5,recreativo:2.2,amateur:3.0,avanzado:3.8}[profile.nivel||'recreativo']||2.2))

  const wHistory = Object.entries(fit.weekLoad).sort(([a],[b])=>a.localeCompare(b)).slice(-6)
    .map(([,v])=>`  ${v.label}: ${v.count} rodadas TSS=${v.tss}`).join('\n')

  const tsbAdv = fit.tsb>10?'FRESCO: incrementar carga 5-10%':fit.tsb<-15?'FATIGADO: reducir volumen 15-20%':'NEUTRO: mantener volumen'
  const polAdv = (fit.zAvg[3]+fit.zAvg[4])>40?'Alta intensidad acumulada — priorizar Z1-Z2 esta semana.':'Mantener distribución actual.'

  const mlHour  = Math.round(peso*7+300)
  const mlHour2 = Math.round(peso*8+400)
  const calima   = clima.includes('tropical')||clima.includes('caluroso')

  const daysStr  = weekDays.slice(0,dias).join(' · ')
  const z1 = weekDays[0]||'lunes'
  const z2 = weekDays[1]||weekDays[0]||'martes'
  const z3 = weekDays[2]||weekDays[1]||'miércoles'

  const fcZ2low  = Math.round(fcmax*.65)
  const fcZ2hi   = Math.round(fcmax*.75)
  const fcZ3low  = Math.round(fcmax*.75)
  const fcZ3hi   = Math.round(fcmax*.83)
  const climaNota = calima ? 'Rodar temprano. Añade sal al agua.' : altitud>2000 ? 'Bebe aunque no tengas sed.' : ''

  const schemaHead = '{"sesiones":['
  const s1 = `{"dia":"${z1}","titulo":"...","tipo":"rodaje suave","descripcion":"CALENTAMIENTO: 10min suave. PRINCIPAL: 40min cómodo. VUELTA CALMA: 10min.","duracion_min":60,"zona_principal":"Z2","lenguaje_simple":"Rueda cómodo, puedes mantener una conversación","fc_objetivo":"${fcZ2low}-${fcZ2hi} lpm","cadencia_objetivo":"85-95 rpm","rpe_objetivo":5,"tss_estimado":35,"por_que_hoy":"...","hidratacion_nutricion":{"llevar":"700ml agua","protocolo":"Sorbo cada 15min","nota_clima":"${climaNota}"},"suplementacion":{"pre":"...","durante":"...","post":"..."},"razon_cientifica":"Seiler 2010"}`
  const s2 = `{"dia":"${z2}","titulo":"...","tipo":"rodaje continuo","descripcion":"CALENTAMIENTO: 10min. PRINCIPAL: 50min zona moderada. VUELTA CALMA: 10min.","duracion_min":70,"zona_principal":"Z2","lenguaje_simple":"...","fc_objetivo":"${fcZ2low}-${fcZ2hi} lpm","cadencia_objetivo":"85-95 rpm","rpe_objetivo":5,"tss_estimado":45,"por_que_hoy":"...","hidratacion_nutricion":{"llevar":"800ml agua + electrolito","protocolo":"Sorbo cada 12min. A los 50min: gel o plátano si llevas más de 70min.","nota_clima":"${climaNota}"},"suplementacion":{"pre":"...","durante":"...","post":"..."},"razon_cientifica":"Foster 2001"}`
  const s3 = `{"dia":"${z3}","titulo":"...","tipo":"rodaje progresivo","descripcion":"CALENTAMIENTO: 10min. PRINCIPAL: 40min moderado-alto. VUELTA CALMA: 10min.","duracion_min":60,"zona_principal":"Z3","lenguaje_simple":"...","fc_objetivo":"${fcZ3low}-${fcZ3hi} lpm","cadencia_objetivo":"88-95 rpm","rpe_objetivo":6,"tss_estimado":55,"por_que_hoy":"...","hidratacion_nutricion":{"llevar":"800ml agua + 1 gel","protocolo":"Sorbo cada 10min. Gel a los 45min.","nota_clima":"${climaNota}"},"suplementacion":{"pre":"...","durante":"...","post":"..."},"razon_cientifica":"Bompa 2018"}`
  const schemaTail = `],"diagnostico_semana":"...","consejo_semana":"...","tss_semana_total":135,"referencias":"Foster 2001, Seiler 2010, Bompa 2018"}`

  return `Eres coach de ciclismo experto. Genera plan PERSONALIZADO en lenguaje SIMPLE para ciclista sin coach personal.

PERFIL: ${profile.nombre||'atleta'} · ${profile.nivel} · ${profile.edad||'?'}años · ${peso}kg · ${dias}días/sem · horario:${horario}
MEDICIÓN: ${tienePow?`Potenciómetro FTP=${ftpEst}W (${(ftpEst/peso).toFixed(1)}W/kg)`:`FC máx=${fcmax}lpm`}
LUGAR: ${ciudad} · ${altitud}msnm · clima:${clima} · ruta:${profile.ruta||'no especificada'}
${altitud>1500?`ALTITUD: VO2max baja ~${Math.round((altitud-500)/300)*3}% vs nivel del mar. FC +5-8lpm para mismo esfuerzo.`:''}
${calima?`CALOR: +250ml/hora. Rodar en ${horario==='mañana'?'la mañana temprano':horario}.`:''}

FORMA: ATL=${fit.atl} CTL=${fit.ctl} TSB=${fit.tsb} → ${tsbAdv}
Zonas 4sem: Z1:${fit.zAvg[0]}% Z2:${fit.zAvg[1]}% Z3:${fit.zAvg[2]}% Z4:${fit.zAvg[3]}% Z5:${fit.zAvg[4]}% · ${polAdv}
Última rodada: hace ${fit.daysSinceLast}d · TSS prom/sem: ${fit.avgWeekTSS}

HISTORIAL:
${hist||'sin datos'}

CARGA SEMANAL:
${wHistory||'sin datos'}

SUPLEMENTACIÓN: ${suppStr}
CONTEXTO: ${context||'ninguno'}

SEMANA: ${weekDays.join(' | ')}
DÍAS DISPONIBLES: ${dias} → usar: ${daysStr}

REGLAS:
1. EXACTAMENTE ${dias} sesiones — una por día disponible: ${daysStr}
2. Al menos ${Math.ceil(dias*0.6)} sesiones en Z1-Z2 (80/20 Seiler 2010)
3. TSS total semana: máx ${Math.round((fit.avgWeekTSS||50)*1.10)} (Bompa 2018)
4. Hidratación por sesión: <60min=${Math.round(peso*5+200)}-${Math.round(peso*5+400)}ml agua · 60-90min=${mlHour}ml/h+electrolitos · >90min=${mlHour2}ml/h+30-60g carbos/h
5. Expresar "sorbo cada Xmin (cada Xkm)" según velocidad histórica ~${Math.round(fit.avgWeekTSS>0?(rides.slice(0,10).reduce((a,r)=>a+(r.speed||(r.dur>0?(r.dist||0)/(r.dur/60):0)),0)/Math.min(10,rides.length)):20)}km/h
6. Cadencia 80-100rpm en sesiones Z2+ (Lucia 2001)
7. Lenguaje SIMPLE: no usar jerga técnica, hablar de sensaciones

Responde SOLO con JSON válido (sin texto antes ni después):
${schemaHead}${s1},${s2},${s3}${schemaTail}`
}

export function buildCompetitionPlan(rides, supps, profile, competition) {
  const fit    = calcFitness(rides)
  const now    = new Date()
  const daysTo = Math.round((new Date(competition.date)-now)/86400000)
  const weeksTo= Math.ceil(daysTo/7)
  const hist   = rides.slice(0,6).map(r => rideStr(r)).join('\n')
  const suppStr= supps.length ? supps.map(s=>`${s.n} ${s.d}`).join(', ') : 'ninguna'
  const baseW  = Math.max(1, weeksTo-3)
  const intW1  = Math.max(2, weeksTo-2)
  const intW2  = Math.max(2, weeksTo-1)

  const schema = JSON.stringify({
    resumen_estrategia: "...",
    fases: [
      { fase:"Base", semanas:`1-${baseW}`, objetivo:"...", tss_objetivo_semana: fit.avgWeekTSS+15, sesiones_tipo:["..."], nota:"..." },
      { fase:"Intensificación", semanas:`${intW1}-${intW2}`, objetivo:"...", tss_objetivo_semana: fit.avgWeekTSS+5, sesiones_tipo:["..."], nota:"..." },
      { fase:"Tapering", semanas:`${weeksTo}`, objetivo:"Llegar fresco", tss_objetivo_semana: Math.round(fit.avgWeekTSS*0.5), sesiones_tipo:["..."], nota:"..." }
    ],
    proxima_semana: {
      descripcion: "...",
      sesiones: [{ dia:"...", titulo:"...", duracion_min:60, intensidad:"Z2", rpe_objetivo:5, descripcion:"..." }]
    },
    suplementacion_competencia: "...",
    referencias: "Bompa 2018, Seiler 2010"
  })

  return `Entrenador de ciclismo experto. Plan de periodización hacia competencia.

ATLETA: ${profile.nivel} · FCmax:${profile.fcmax||185} · Peso:${profile.peso||70}kg · ${profile.dias||3}días/sem
FORMA: ATL=${fit.atl} CTL=${fit.ctl} TSB=${fit.tsb} · TSS prom/sem:${fit.avgWeekTSS}
COMPETENCIA: "${competition.name}" · en ${daysTo} días (${weeksTo} semanas) · ${competition.distance||'?'}km · ${competition.type||'gran fondo'} · meta: ${competition.goal||'terminar'}
SUPLEMENTACIÓN: ${suppStr}
HISTORIAL:
${hist||'sin datos'}

Fases: Base (sem 1-${baseW}) → Intensificación (sem ${intW1}-${intW2}) → Tapering (sem ${weeksTo})

Responde SOLO con este JSON (completa todos los "..." con contenido real):
${schema}`
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
{"analisis_general":"...","por_suplemento":[{"nombre":"...","evidencia":"solida|moderada|debil","timing_optimo":"...","con_este_perfil":"...","ajuste_sugerido":"..."}],"protocolo_semana":{"dia_intenso":["..."],"dia_z2":["..."],"dia_descanso":["..."]},"referencias":"..."}`
}

export function buildCompetitionPlanDetailed(rides, supps, profile, competition) {
  const fit    = calcFitness(rides)
  const now    = new Date()
  const daysTo = Math.round((new Date(competition.date)-now)/86400000)
  const weeksTo= Math.ceil(daysTo/7)
  const dias   = profile.dias || 3
  const fcmax  = profile.fcmax || 185
  const peso   = profile.peso || 70
  const calima = (profile.clima||'').includes('tropical')||(profile.clima||'').includes('caluroso')
  const hist   = rides.slice(0,5).map(r => {
    const d = Math.round((Date.now()-new Date(r.iso).getTime())/86400000)
    return `[hace ${d}d] ${Math.round(r.dur)}min ${(r.dist||0).toFixed(1)}km RPE:${r.rpe} TSS:${tssOf(r)}`
  }).join('\n')

  const fcZ2  = `${Math.round(fcmax*.65)}-${Math.round(fcmax*.75)}`
  const fcZ3  = `${Math.round(fcmax*.75)}-${Math.round(fcmax*.83)}`
  const fcZ4  = `${Math.round(fcmax*.83)}-${Math.round(fcmax*.90)}`
  const nota  = calima ? 'Rodar temprano. Añade sal al agua.' : ''
  const mlH   = Math.round(peso*7+300)
  const mlHL  = Math.round(peso*8+400)
  const baseW = Math.max(1, weeksTo-3)

  // Días de la semana según disponibilidad
  const allDays = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo']
  const trainingDays = allDays.slice(0, dias)

  // Generar sesiones de ejemplo con los días reales
  const sesionesEjemplo = trainingDays.map((dia, i) => {
    const isIntense = i === Math.floor(dias/2)
    return JSON.stringify({
      dia,
      titulo: isIntense ? "Intervalo o tempo" : i === dias-1 ? "Salida larga" : "Rodaje base",
      tipo: isIntense ? "intervalos" : i === dias-1 ? "salida larga" : "rodaje suave",
      descripcion: `CALENTAMIENTO: 10min suave. PRINCIPAL: ${isIntense ? "5×5min en zona 4 con 3min descanso" : "45min a ritmo cómodo constante"}. VUELTA CALMA: 10min.`,
      duracion_min: isIntense ? 70 : i === dias-1 ? 90 : 60,
      zona: isIntense ? "Z4" : i === dias-1 ? "Z2" : "Z2",
      lenguaje_simple: isIntense ? "Esfuerzo alto pero controlado, no al máximo" : "Ritmo cómodo, puedes hablar",
      fc_objetivo: isIntense ? `${fcZ4} lpm` : `${fcZ2} lpm`,
      rpe_objetivo: isIntense ? 7 : 5,
      hidratacion: i === dias-1 ? `${mlHL}ml/hora + gel a los 45min` : `${mlH}ml agua. Sorbo cada 15min.`,
      nota_clima: nota
    })
  }).join(',')

  const tssBase  = Math.round(fit.avgWeekTSS * 1.0)
  const tssInt   = Math.round(fit.avgWeekTSS * 1.1)
  const tssTaper = Math.round(fit.avgWeekTSS * 0.55)

  return `Eres coach de ciclismo experto. Genera plan de periodización COMPLETO semana por semana.

ATLETA: ${profile.nombre||'atleta'} · ${profile.nivel} · ${peso}kg · FCmax:${fcmax}lpm · ${dias}días/sem
FORMA: ATL=${fit.atl} CTL=${fit.ctl} TSB=${fit.tsb} · TSS prom/sem:${fit.avgWeekTSS}
COMPETENCIA: "${competition.name}" · ${daysTo} días · ${weeksTo} semanas · ${competition.distance||'?'}km · meta: "${competition.goal||'terminar'}"
${calima ? 'CLIMA: tropical — rodar temprano, +250ml/hora extra' : ''}
HISTORIAL:
${hist||'sin datos'}

FASES:
- Semanas 1-${baseW}: BASE (${dias} sesiones Z2 dominante, volumen creciente, TSS ~${tssBase}/sem)
- Semanas ${baseW+1}-${weeksTo-1}: INTENSIFICACIÓN (${dias} sesiones, intervalos, TSS ~${tssInt}/sem)
- Semana ${weeksTo}: TAPERING (${dias} sesiones suaves, TSS ~${tssTaper}/sem, llegar fresco)

DÍAS DE ENTRENAMIENTO: ${trainingDays.join(', ')}
CADA SEMANA DEBE TENER EXACTAMENTE ${dias} SESIONES — una para cada día: ${trainingDays.join(', ')}

ZONAS FC: Z2=${fcZ2}lpm · Z3=${fcZ3}lpm · Z4=${fcZ4}lpm
HIDRATACIÓN: <60min=${Math.round(peso*5+200)}ml · 60-90min=${mlH}ml/h · >90min=${mlHL}ml/h+gel cada 45min

Responde SOLO con JSON válido (sin texto antes ni después):
{"competencia":"${competition.name}","fecha_competencia":"${competition.date}","distancia_km":${competition.distance||135},"meta":"${competition.goal||'terminar'}","resumen":"2 oraciones sobre la estrategia en lenguaje simple","consejo_general":"consejo específico para este atleta","semanas":[{"numero":1,"fase":"Base","objetivo":"objetivo de esta semana en lenguaje simple","tss_objetivo":${tssBase},"sesiones":[${sesionesEjemplo}],"nota_semana":"qué enfatizar esta semana"}],"protocolo_competencia":{"dia_antes":"qué comer y descansar el día previo","manana_carrera":"desayuno 2-3h antes de la carrera","durante":"cada cuánto comer y beber en ${competition.distance||135}km","post":"recuperación al terminar"},"referencias":"Bompa 2018, Seiler 2010"}

IMPORTANTE: el ejemplo muestra 1 semana pero debes generar las ${weeksTo} semanas completas, cada una con ${dias} sesiones (${trainingDays.join(', ')}). No omitas ninguna semana ni sesión.`
}
