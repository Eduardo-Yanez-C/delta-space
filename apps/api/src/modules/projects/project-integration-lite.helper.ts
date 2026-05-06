import { PrismaService } from "../../infra/prisma/prisma.service";
import { weightedRealProgressWithHierarchy } from "./plan-vs-real.helper";

const CLOSED_RISK = new Set(["CLOSED", "MITIGATED", "cerrado"]);
const HIGH_SEV = new Set(["ALTA", "HIGH", "CRÍTICO", "CRITICAL", "3"]);

export function isRiskOpenStatus(status: string): boolean {
  return !CLOSED_RISK.has(String(status).toUpperCase());
}

export function isHighSeverity(severity: string): boolean {
  return HIGH_SEV.has(String(severity).toUpperCase());
}

const COMMITMENT_CLOSED = new Set(["DONE", "CANCELLED", "CANCELED"]);

export function isCommitmentOpenStatus(status: string): boolean {
  return !COMMITMENT_CLOSED.has(String(status || "").toUpperCase());
}

export async function weightedTaskProgress(prisma: PrismaService, projectId: string): Promise<number> {
  const tasks = await prisma.task.findMany({
    where: { projectId },
    select: {
      id: true,
      parentTaskId: true,
      progress: true,
      weight: true,
      isCritical: true,
    },
  });
  return weightedRealProgressWithHierarchy(tasks);
}

export async function countOverdueTasks(
  prisma: PrismaService,
  projectId: string,
  now = new Date(),
): Promise<number> {
  return prisma.task.count({
    where: { projectId, endDate: { lt: now }, status: { not: "DONE" } },
  });
}
