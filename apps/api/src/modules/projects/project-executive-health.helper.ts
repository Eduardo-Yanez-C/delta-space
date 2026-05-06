/** Semáforo ejecutivo PMO — misma lógica que Software de Mejora. */
export type ExecutiveHealthStatus = "GREEN" | "YELLOW" | "RED";

export interface ExecutiveHealthFactors {
  overdueTasks: number;
  criticalOpenRisks: number;
  openRisks: number;
  nonOperationalResources: number;
  activeDangerAlerts: number;
  activeWarningAlerts: number;
  progressReal: number;
  tasksTotal: number;
  tasksDone: number;
  criticalMilestonesOverdue: number;
  milestonesOverdue: number;
  openCommitmentsOverdue: number;
}

export function isResourceNonOperationalStatus(status: string): boolean {
  const st = String(status || "").toUpperCase();
  return ["MAINTENANCE", "BROKEN", "DAMAGED", "UNAVAILABLE", "OUT_OF_SERVICE"].some((b) => st.includes(b));
}

const ACHIEVED = new Set(["ACHIEVED", "DONE", "COMPLETED"]);
const CANCELLED = new Set(["CANCELLED", "CANCELED"]);

export function isMilestoneOpenStatus(status: string): boolean {
  const s = String(status || "").toUpperCase();
  return !ACHIEVED.has(s) && !CANCELLED.has(s);
}

export function isMilestoneHighCriticality(criticality: string): boolean {
  const c = String(criticality || "").toUpperCase();
  return c === "HIGH" || c === "CRITICAL" || c === "CRÍTICO" || c === "ALTA";
}

export function computeExecutiveHealth(f: ExecutiveHealthFactors): {
  status: ExecutiveHealthStatus;
  reasons: string[];
} {
  const reasons: string[] = [];

  const red =
    f.criticalOpenRisks > 0 ||
    f.nonOperationalResources > 0 ||
    f.activeDangerAlerts > 0 ||
    f.criticalMilestonesOverdue > 0 ||
    f.overdueTasks >= 5 ||
    f.openCommitmentsOverdue >= 5;

  if (f.criticalOpenRisks > 0) reasons.push("CRITICAL_RISKS_OPEN");
  if (f.nonOperationalResources > 0) reasons.push("NON_OPERATIONAL_RESOURCES");
  if (f.activeDangerAlerts > 0) reasons.push("ACTIVE_DANGER_ALERTS");
  if (f.criticalMilestonesOverdue > 0) reasons.push("CRITICAL_MILESTONES_OVERDUE");
  if (f.overdueTasks >= 5) reasons.push("MANY_OVERDUE_TASKS");
  if (f.openCommitmentsOverdue >= 5) reasons.push("MANY_COMMITMENTS_OVERDUE");

  if (red) {
    return { status: "RED", reasons };
  }

  const yellow =
    f.overdueTasks > 0 ||
    f.activeWarningAlerts > 0 ||
    f.milestonesOverdue > 0 ||
    f.openCommitmentsOverdue > 0 ||
    f.openRisks >= 2 ||
    (f.tasksTotal >= 5 &&
      f.tasksDone / f.tasksTotal < 0.15 &&
      f.progressReal < 25 &&
      f.overdueTasks === 0);

  if (f.overdueTasks > 0) reasons.push("OVERDUE_TASKS");
  if (f.activeWarningAlerts > 0) reasons.push("WARNING_ALERTS");
  if (f.milestonesOverdue > 0) reasons.push("MILESTONES_OVERDUE");
  if (f.openCommitmentsOverdue > 0) reasons.push("COMMITMENTS_OVERDUE");
  if (f.openRisks >= 2) reasons.push("ELEVATED_OPEN_RISKS");
  if (
    f.tasksTotal >= 5 &&
    f.tasksDone / f.tasksTotal < 0.15 &&
    f.progressReal < 25 &&
    f.overdueTasks === 0
  ) {
    reasons.push("LOW_PROGRESS_VS_EFFORT");
  }

  if (yellow) {
    return { status: "YELLOW", reasons };
  }

  return { status: "GREEN", reasons: ["OK"] };
}
