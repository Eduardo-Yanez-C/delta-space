import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { computePlanVsRealFromSlices, planVsRealRootSlicesFromTasks } from "./plan-vs-real.helper";
import {
  computeExecutiveHealth,
  isMilestoneHighCriticality,
  isMilestoneOpenStatus,
  isResourceNonOperationalStatus,
} from "./project-executive-health.helper";
import {
  isCommitmentOpenStatus,
  isHighSeverity,
  isRiskOpenStatus,
  weightedTaskProgress,
} from "./project-integration-lite.helper";

type ComputedAlert = { type: string; severity: "DANGER" | "WARNING"; message: string; relatedEntityId: string | null };

function severityToLevel(sev: string): "danger" | "warning" | "info" {
  if (sev === "DANGER") return "danger";
  if (sev === "WARNING") return "warning";
  return "info";
}

function milestoneExecutiveBuckets(
  rows: Array<{
    id: string;
    name: string;
    description: string | null;
    plannedDate: Date;
    actualDate: Date | null;
    status: string;
    criticality: string;
  }>,
  now: Date,
) {
  const open = rows.filter((m) => isMilestoneOpenStatus(m.status));
  const overdue = open.filter((m) => m.plannedDate < now);
  const upcoming = open.filter((m) => m.plannedDate >= now).slice(0, 8);
  const toDto = (m: (typeof rows)[0]) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    plannedDate: m.plannedDate.toISOString(),
    actualDate: m.actualDate?.toISOString() ?? null,
    status: m.status,
    criticality: m.criticality,
  });
  return {
    overdue: overdue.map(toDto),
    upcoming: upcoming.map(toDto),
    delayed: overdue.map(toDto),
    counts: {
      total: rows.length,
      open: open.length,
      overdue: overdue.length,
      upcoming: open.filter((m) => m.plannedDate >= now).length,
    },
  };
}

export async function buildProjectWorkspacePayload(prisma: PrismaService, id: string) {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      commercialLinks: { orderBy: { createdAt: "desc" } },
      locations: { orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }] },
      _count: {
        select: { tasks: true, risks: true, documents: true, commitments: true, resources: true },
      },
    },
  });
  if (!project) throw new NotFoundException("Proyecto no encontrado");

  const now = new Date();
  const [
    tasks,
    taskDeps,
    milestones,
    commitmentRows,
    documents,
    resources,
    decisionsAll,
    risksAll,
  ] = await Promise.all([
    prisma.task.findMany({ where: { projectId: id } }),
    prisma.taskDependency.findMany({ where: { projectId: id } }),
    prisma.milestone.findMany({ where: { projectId: id }, orderBy: { plannedDate: "asc" } }),
    prisma.projectCommitment.findMany({ where: { projectId: id } }),
    prisma.projectDocument.findMany({ where: { projectId: id }, orderBy: { uploadedAt: "desc" } }),
    prisma.projectResource.findMany({ where: { assignedProjectId: id } }),
    prisma.projectDecision.findMany({ where: { projectId: id }, orderBy: { decisionDate: "desc" } }),
    prisma.risk.findMany({ where: { projectId: id } }),
  ]);

  const activeRisks = risksAll.filter((r) => isRiskOpenStatus(r.status));
  const criticalRisks = activeRisks.filter((r) => isHighSeverity(r.severity));
  const risksPastDue = activeRisks.filter((r) => r.dueDate && new Date(r.dueDate) < now).length;

  const overdueCount = tasks.filter((t) => t.endDate < now && t.status !== "DONE").length;
  const tasksDone = tasks.filter((t) => t.status === "DONE").length;
  const progressFromTasks = await weightedTaskProgress(prisma, id);

  const documentsByType: Record<string, number> = {};
  for (const d of documents) {
    const key = d.type?.trim() || "(sin tipo)";
    documentsByType[key] = (documentsByType[key] ?? 0) + 1;
  }

  const computedForUi: ComputedAlert[] = [];
  for (const t of tasks) {
    if (t.endDate < now && t.status !== "DONE") {
      computedForUi.push({
        type: "TASK_OVERDUE",
        severity: "DANGER",
        message: `Tarea "${t.name}" venció el ${t.endDate.toISOString().slice(0, 10)} (${t.status}).`,
        relatedEntityId: t.id,
      });
    }
  }
  if (project.endDate) {
    const end = new Date(project.endDate);
    if (end < now && String(project.status).toUpperCase() !== "COMPLETED") {
      computedForUi.push({
        type: "PROJECT_PAST_END",
        severity: "WARNING",
        message: "Fecha de término del proyecto superada sin estado COMPLETED.",
        relatedEntityId: null,
      });
    }
  }
  for (const r of activeRisks) {
    if (isHighSeverity(r.severity)) {
      const short = r.description.length > 100 ? `${r.description.slice(0, 100)}…` : r.description;
      computedForUi.push({
        type: "RISK_CRITICAL_OPEN",
        severity: "DANGER",
        message: `Riesgo crítico abierto: ${short}`,
        relatedEntityId: r.id,
      });
    }
    if (r.dueDate && new Date(r.dueDate) < now) {
      const short = r.description.length > 100 ? `${r.description.slice(0, 100)}…` : r.description;
      computedForUi.push({
        type: "RISK_PAST_DUE",
        severity: "WARNING",
        message: `Seguimiento de riesgo vencido: ${short}`,
        relatedEntityId: r.id,
      });
    }
  }

  const soonEnd = new Date(now);
  soonEnd.setDate(soonEnd.getDate() + 14);
  let openCommitmentsOverdue = 0;
  let commitmentsDueNext14Days = 0;
  for (const cm of commitmentRows) {
    if (!isCommitmentOpenStatus(cm.status)) continue;
    if (cm.dueDate < now) {
      openCommitmentsOverdue += 1;
      computedForUi.push({
        type: "COMMITMENT_OVERDUE",
        severity: "WARNING",
        message: `Compromiso vencido: "${cm.title}" (vence ${cm.dueDate.toISOString().slice(0, 10)})`,
        relatedEntityId: cm.id,
      });
    } else if (cm.dueDate <= soonEnd) {
      commitmentsDueNext14Days += 1;
    }
  }

  const milestonesExecutive = milestoneExecutiveBuckets(milestones, now);
  const milestonesOverdue = milestonesExecutive.counts.overdue;
  const criticalMilestonesOverdue = milestonesExecutive.overdue.filter((m) =>
    isMilestoneHighCriticality(m.criticality),
  ).length;

  const activeDangerAlerts = computedForUi.filter((a) => a.severity === "DANGER").length;
  const activeWarningAlerts = computedForUi.filter((a) => a.severity === "WARNING").length;
  const nonOperationalResources = resources.filter((r) => isResourceNonOperationalStatus(r.status)).length;

  const healthFactors = {
    overdueTasks: overdueCount,
    criticalOpenRisks: criticalRisks.length,
    openRisks: activeRisks.length,
    nonOperationalResources,
    activeDangerAlerts,
    activeWarningAlerts,
    progressReal: progressFromTasks,
    tasksTotal: tasks.length,
    tasksDone,
    criticalMilestonesOverdue,
    milestonesOverdue,
    openCommitmentsOverdue,
  };
  const executiveHealth = computeExecutiveHealth(healthFactors);

  const taskPlanRows = tasks.map((t) => ({
    id: t.id,
    parentTaskId: t.parentTaskId,
    startDate: t.startDate,
    endDate: t.endDate,
    baselineStartDate: t.baselineStartDate,
    baselineEndDate: t.baselineEndDate,
    progress: t.progress,
    weight: t.weight,
    isCritical: t.isCritical,
  }));
  const planVsReal = computePlanVsRealFromSlices(
    project.startDate,
    project.endDate,
    planVsRealRootSlicesFromTasks(taskPlanRows),
    now,
  );

  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const predecessorIdsFor = (taskId: string): string[] => {
    const s = new Set<string>();
    const row = taskById.get(taskId);
    if (row?.dependencyTaskId) s.add(row.dependencyTaskId);
    for (const d of taskDeps) {
      if (d.successorTaskId === taskId) s.add(d.predecessorTaskId);
    }
    return [...s];
  };
  let blockedTaskCount = 0;
  const edgeKeys = new Set<string>();
  for (const d of taskDeps) {
    edgeKeys.add(`${d.predecessorTaskId}->${d.successorTaskId}`);
  }
  for (const t of tasks) {
    if (t.dependencyTaskId) {
      edgeKeys.add(`${t.dependencyTaskId}->${t.id}`);
    }
    const preds = predecessorIdsFor(t.id);
    if (preds.some((pid) => String(taskById.get(pid)?.status).toUpperCase() !== "DONE")) {
      blockedTaskCount += 1;
    }
  }

  const assigneeKey = (t: (typeof tasks)[0]) =>
    (t.assigneeUserId && String(t.assigneeUserId).trim()) || (t.assignedTo && t.assignedTo.trim()) || "";
  const assigneeKeys = new Set(tasks.map((t) => assigneeKey(t)).filter(Boolean));
  let assigneesWithOverdue = 0;
  let assigneesWithBlocked = 0;
  for (const key of assigneeKeys) {
    const subset = tasks.filter((t) => assigneeKey(t) === key);
    const hasOverdue = subset.some((t) => t.endDate < now && String(t.status).toUpperCase() !== "DONE");
    const hasBlocked = subset.some((t) => {
      const preds = predecessorIdsFor(t.id);
      return (
        preds.length > 0 && preds.some((pid) => String(taskById.get(pid)?.status).toUpperCase() !== "DONE")
      );
    });
    if (hasOverdue) assigneesWithOverdue += 1;
    if (hasBlocked) assigneesWithBlocked += 1;
  }
  type WorstSignal = "ok" | "warning" | "danger";
  let worstSignal: WorstSignal = "ok";
  if (nonOperationalResources > 0) worstSignal = "danger";
  else if (assigneesWithOverdue > 0 || assigneesWithBlocked > 0 || blockedTaskCount >= 3) worstSignal = "warning";

  type UiAlert = { level: "warning" | "danger" | "info"; code: string; message: string; id?: string };
  const alerts: UiAlert[] = computedForUi.map((a, i) => ({
    level: severityToLevel(a.severity),
    code: a.type,
    message: a.message,
    id: `computed-${i}-${a.type}`,
  }));
  if (alerts.length === 0) {
    alerts.push({
      level: "info",
      code: "OK",
      message: "Sin alertas activas en este momento.",
    });
  }

  const recentDecisions = decisionsAll.slice(0, 8).map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    decisionDate: d.decisionDate.toISOString(),
    responsible: d.responsible,
    impact: d.impact,
    category: d.category,
    status: d.status,
  }));

  const recentCommitments = [...commitmentRows]
    .sort((a, b) => {
      const aOpen = isCommitmentOpenStatus(a.status);
      const bOpen = isCommitmentOpenStatus(b.status);
      const aLate = aOpen && a.dueDate < now;
      const bLate = bOpen && b.dueDate < now;
      if (aLate !== bLate) return aLate ? -1 : 1;
      return a.dueDate.getTime() - b.dueDate.getTime();
    })
    .slice(0, 8)
    .map((cm) => ({
      id: cm.id,
      title: cm.title,
      description: cm.description,
      dueDate: cm.dueDate.toISOString(),
      status: cm.status,
      owner: cm.owner,
      sourceType: cm.sourceType,
      decisionId: cm.decisionId,
      milestoneId: cm.milestoneId,
      riskId: cm.riskId,
    }));

  type TimelineItem = { at: string; kind: string; title: string; detail?: string };
  const timeline: TimelineItem[] = [];
  for (const dec of recentDecisions) {
    timeline.push({
      at: dec.decisionDate,
      kind: "decision",
      title: `Decisión: ${dec.title}`,
      detail: `${dec.category} · ${dec.responsible ?? "—"} · ${dec.status}`,
    });
  }
  for (const cm of commitmentRows) {
    timeline.push({
      at: cm.dueDate.toISOString(),
      kind: "commitment",
      title: `Compromiso: ${cm.title}`,
      detail: `${cm.owner ?? "—"} · ${cm.status} · ${cm.sourceType}`,
    });
  }
  for (const a of computedForUi.slice(0, 12)) {
    timeline.push({
      at: now.toISOString(),
      kind: "alert",
      title: `Alerta ${a.type}`,
      detail: a.message.slice(0, 120),
    });
  }
  timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const topRisks = activeRisks.slice(0, 6).map((r) => ({
    id: r.id,
    description: r.description,
    severity: r.severity,
    status: r.status,
    dueDate: r.dueDate?.toISOString() ?? null,
    owner: r.owner,
  }));

  return {
    generatedAt: now.toISOString(),
    project: {
      id: project.id,
      name: project.name,
      code: project.code,
      status: project.status,
      progress: project.progress,
      client: project.client,
      location: project.location,
      description: project.description,
      startDate: project.startDate.toISOString(),
      endDate: project.endDate?.toISOString() ?? null,
      locations: project.locations.map((l) => ({
        id: l.id,
        projectId: l.projectId,
        kind: l.kind,
        label: l.label,
        address: l.address,
        latitude: l.latitude,
        longitude: l.longitude,
        notes: l.notes,
        isPrimary: l.isPrimary,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
      })),
      commercialLinks: project.commercialLinks.map((l) => ({
        id: l.id,
        externalSystem: l.externalSystem,
        externalRef: l.externalRef,
        metadata: l.metadata,
        createdAt: l.createdAt.toISOString(),
      })),
      counts: {
        tasks: project._count.tasks,
        risks: project._count.risks,
        documents: project._count.documents,
        commitments: project._count.commitments,
        resources: project._count.resources,
      },
    },
    executive: {
      health: executiveHealth.status,
      reasons: executiveHealth.reasons,
      factors: healthFactors,
    },
    milestonesExecutive,
    planVsReal: {
      ...planVsReal,
      projectStart: project.startDate.toISOString(),
    },
    taskDependencies: {
      dependencyEdgeCount: edgeKeys.size,
      blockedTaskCount,
    },
    decisionsCount: decisionsAll.length,
    commitmentsSummary: {
      total: commitmentRows.length,
      openOverdue: openCommitmentsOverdue,
      dueNext14Days: commitmentsDueNext14Days,
    },
    recentCommitments,
    recentDecisions,
    kpis: {
      progressFromTasks,
      progressWeighted: progressFromTasks,
      overdueTasks: overdueCount,
      tasksTotal: tasks.length,
      tasksDone,
      tasksInProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
      tasksCritical: tasks.filter((t) => t.isCritical).length,
      activeRisks: activeRisks.length,
      criticalRisks: criticalRisks.length,
      risksPastDue,
      documentsTotal: documents.length,
      documentsByType,
      resourcesAssigned: resources.length,
      resourceOperational: resources.filter((r) => !isResourceNonOperationalStatus(r.status)).length,
    },
    alerts,
    alertsHistory: [] as Array<{
      id: string;
      type: string;
      message: string;
      severity: string;
      status: string;
      createdAt: string;
      resolvedAt?: string | null;
    }>,
    recentDocuments: documents.slice(0, 8).map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      uploadedAt: d.uploadedAt.toISOString(),
    })),
    topRisks,
    assignedResources: resources.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      status: r.status,
      notes: r.notes,
    })),
    timeline: timeline.slice(0, 40),
    recentChanges: [] as Array<{
      id: string;
      at: string;
      entityType: string;
      action: string;
      user: string;
      summary: string;
    }>,
    workloadBrief: {
      assigneeBuckets: assigneeKeys.size,
      assigneesWithOverdue,
      assigneesWithBlocked,
      worstSignal,
    },
  };
}
