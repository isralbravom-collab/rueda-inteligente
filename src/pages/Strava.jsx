function calculateZones(hrAvg, fcmax = 185) {
  if (!hrAvg || hrAvg < 50) return [0, 0, 0, 0, 0];

  const zones = [0, 0, 0, 0, 0];
  const pct = (hrAvg / fcmax) * 100;

  if (pct < 60) zones[0] = 100;           // Z1
  else if (pct < 70) zones[1] = 100;      // Z2
  else if (pct < 80) zones[2] = 100;      // Z3
  else if (pct < 90) zones[3] = 100;      // Z4
  else zones[4] = 100;                    // Z5

  return zones;
}

// Dentro de saveOne:
function saveOne(ride) {
  if (!rpeInputs[ride.stravaId] || !senInputs[ride.stravaId]) {
    return alert('Falta RPE o sensación');
  }

  const dupe = isDuplicate(ride);
  if (dupe && !confirm(`Ya tienes una rodada similar el ${dupe.fecha}. ¿Guardar?`)) return;

  const zp = calculateZones(ride.hrAvg, profile.fcmax || 185);

  addRide({
    ...ride,
    id: ride.stravaId || Date.now().toString(),
    rpe: rpeInputs[ride.stravaId],
    sen: senInputs[ride.stravaId],
    zp: zp   // ← Esto es lo que faltaba
  });

  setPendingRides(prev => prev.filter(r => r.stravaId !== ride.stravaId));
}
