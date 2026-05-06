/**
 * Calcula el fin del día local del enésimo día hábil (lun–vie) desde la fecha de activación.
 * - Si la activación cae en sábado o domingo, el primer día hábil es el lunes siguiente.
 * - Cuenta 5 días hábiles inclusive (el 5.º es el último día de la prueba).
 */

/**
 * @param {Date} activationDate
 * @param {number} businessDays número de días hábiles (p. ej. 5)
 * @returns {Date} fin local del último día hábil (23:59:59.999)
 */
function endOfNthBusinessDayFromActivation(activationDate, businessDays) {
  const d = new Date(activationDate);
  d.setHours(0, 0, 0, 0);
  let wd = d.getDay();
  if (wd === 0) d.setDate(d.getDate() + 1);
  if (wd === 6) d.setDate(d.getDate() + 2);

  let count = 0;
  while (count < businessDays) {
    const day = d.getDay();
    if (day >= 1 && day <= 5) {
      count++;
      if (count === businessDays) break;
    }
    d.setDate(d.getDate() + 1);
  }
  d.setHours(23, 59, 59, 999);
  return d;
}

module.exports = { endOfNthBusinessDayFromActivation };
