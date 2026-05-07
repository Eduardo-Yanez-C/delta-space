/** Mensajes rotativos para SAM / panel comercial (misma lógica que el panel de ventas). */

const WEEKLY_MESSAGES = [
  "Cada cotización clara y bien presentada acelera el cierre comercial.",
  "La consistencia semanal convierte buenos resultados en resultados predecibles.",
  "Pequeñas mejoras diarias en el flujo comercial generan grandes diferencias mensuales.",
  "El seguimiento oportuno vale tanto como una buena propuesta técnica.",
  "Un proceso ordenado hoy evita retrabajo mañana.",
  "La calidad documental también vende confianza.",
  "Lo que se mide se mejora: mantenga foco en avances concretos.",
  "La velocidad importa, pero la claridad comercial sostiene el cierre.",
];

function getIsoWeek(date: Date): number {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function getSuiteAgentWeeklyTip(now = new Date()): { weekNumber: number; text: string } {
  const weekNumber = getIsoWeek(now);
  const text = WEEKLY_MESSAGES[(weekNumber - 1) % WEEKLY_MESSAGES.length];
  return { weekNumber, text };
}
