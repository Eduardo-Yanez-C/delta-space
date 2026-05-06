/**
 * Proyecto demo CSO + PMO (tareas, riesgos, documentos, recursos, compromisos).
 * Reutilizable desde `seed.ts` y desde `seed-mejora-demo-project.ts`.
 */
import type { PrismaClient } from "@prisma/client";
import { CSO_TASK_SPECS } from "./cso-task-specs";

const CODE = "CSO";

function daysInclusive(startIso: string, endIso: string): number {
  const s = new Date(startIso + "T12:00:00").getTime();
  const e = new Date(endIso + "T12:00:00").getTime();
  const d = Math.round((e - s) / 86400000) + 1;
  return Math.max(0, d);
}

async function clearProjectPmo(prisma: PrismaClient, projectId: string) {
  await prisma.projectCommitment.deleteMany({ where: { projectId } });
  await prisma.risk.deleteMany({ where: { projectId } });
  await prisma.projectDocument.deleteMany({ where: { projectId } });
  await prisma.projectResource.deleteMany({ where: { assignedProjectId: projectId } });
  await prisma.taskDependency.deleteMany({ where: { projectId } });
  await prisma.task.updateMany({
    where: { projectId },
    data: { parentTaskId: null, dependencyTaskId: null },
  });
  await prisma.task.deleteMany({ where: { projectId } });
  await prisma.milestone.deleteMany({ where: { projectId } });
  await prisma.projectDecision.deleteMany({ where: { projectId } });
  await prisma.projectCommercialLink.deleteMany({ where: { projectId } });
}

async function seedPmoForProject(prisma: PrismaClient, projectId: string) {
  await clearProjectPmo(prisma, projectId);

  const decMontaje = await prisma.projectDecision.create({
    data: {
      projectId,
      title: "No iniciar montaje FV sin cierre de fundaciones críticas",
      description:
        "Comité PMO: se mantiene dependencia dura entre movimiento de tierras / fundaciones y montaje de estructura FV según WBS cartilla CSO.",
      decisionDate: new Date("2026-03-10T12:00:00"),
      responsible: "Director de proyecto",
      impact: "HIGH",
      category: "SCHEDULE",
      status: "APPROVED",
    },
  });

  await prisma.projectDecision.create({
    data: {
      projectId,
      title: "Integración eléctrica y SCADA en paralelo con comisionamiento",
      description:
        "Autorizado con registro de riesgos residuales en matriz HSEC y seguimiento semanal en comité.",
      decisionDate: new Date("2026-08-01T12:00:00"),
      responsible: "PMO corporativo",
      impact: "MEDIUM",
      category: "RISK",
      status: "APPROVED",
    },
  });

  const milKick = await prisma.milestone.create({
    data: {
      projectId,
      name: "Línea base PMO y kickoff de obra",
      description: "Alineado a paquete 1 — cartilla CSO.",
      plannedDate: new Date("2026-01-20T12:00:00"),
      actualDate: new Date("2026-01-19T12:00:00"),
      status: "ACHIEVED",
      criticality: "NORMAL",
    },
  });

  const milTopo = await prisma.milestone.create({
    data: {
      projectId,
      name: "Cierre topografía base aprobada",
      plannedDate: new Date("2026-02-28T12:00:00"),
      status: "PLANNED",
      criticality: "HIGH",
    },
  });

  await prisma.milestone.create({
    data: {
      projectId,
      name: "Primer string energizado (SAT)",
      plannedDate: new Date("2026-09-20T12:00:00"),
      status: "PLANNED",
      criticality: "CRITICAL",
    },
  });

  await prisma.milestone.create({
    data: {
      projectId,
      name: "Recepción definitiva y cierre de proyecto",
      plannedDate: new Date("2026-10-12T12:00:00"),
      status: "PLANNED",
      criticality: "NORMAL",
    },
  });

  const sorted = [...CSO_TASK_SPECS].sort((a, b) => a.sortOrder - b.sortOrder);
  const idByWbs: Record<string, string> = {};

  for (const row of sorted) {
    const parentId = row.parentWbs ? idByWbs[row.parentWbs] : null;
    const isMilestone = !!row.isMilestone;
    const startD = new Date(row.start + "T12:00:00");
    const endD = new Date(row.end + "T12:00:00");
    const durationDays = isMilestone ? 0 : daysInclusive(row.start, row.end);

    const created = await prisma.task.create({
      data: {
        projectId,
        wbsCode: row.wbs,
        sortOrder: row.sortOrder,
        isMilestone,
        name: row.name,
        startDate: startD,
        endDate: isMilestone ? startD : endD,
        duration: durationDays,
        progress: row.progress ?? 0,
        status: row.status ?? "TODO",
        parentTaskId: parentId,
        weight: row.weight ?? 1,
        isCritical: !!row.isCritical,
        baselineStartDate: startD,
        baselineEndDate: isMilestone ? startD : endD,
        baselineDurationDays: durationDays,
        description: row.summary ? "Paquete resumen (WBS) — barra tipo proyecto en Gantt." : null,
      },
    });
    idByWbs[row.wbs] = created.id;
  }

  for (const row of sorted) {
    if (!row.predWbs) continue;
    const succId = idByWbs[row.wbs];
    const predId = idByWbs[row.predWbs];
    if (!succId || !predId) continue;
    await prisma.task.update({
      where: { id: succId },
      data: { dependencyTaskId: predId },
    });
    try {
      await prisma.taskDependency.create({
        data: { projectId, predecessorTaskId: predId, successorTaskId: succId },
      });
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") continue;
      throw e;
    }
  }

  const assigneeByWbs: Record<string, string> = {
    "4.1": "Supervisor de obra FV",
    "4.2": "Supervisor de obra FV",
    "5.1": "Jefe de montaje",
    "5.2": "Jefe de montaje",
    "7.1": "Ingeniería de campo",
  };
  for (const [wbs, assignedTo] of Object.entries(assigneeByWbs)) {
    await prisma.task.updateMany({
      where: { projectId, wbsCode: wbs },
      data: { assignedTo },
    });
  }

  const risksSeed = [
    {
      description:
        "Ventana climática y logística en Magallanes — riesgo a plazo de caminos y arribo de estructuras FV.",
      severity: "MEDIA",
      probability: "MEDIA",
      status: "OPEN",
      mitigation: "Plan de contingencia logística, buffers en cronograma y seguimiento meteorológico semanal.",
      owner: "Jefe de obra",
      dueDate: new Date("2026-06-01T12:00:00"),
    },
    {
      description: "Disponibilidad de equipos de elevación para montaje inversores / transformadores.",
      severity: "MEDIA",
      probability: "BAJA",
      status: "OPEN",
      mitigation: "Contrato de arriendo con opción de extensión; ventana FAT coordinada con fabricante.",
      owner: "Ingeniería de campo",
      dueDate: new Date("2026-08-15T12:00:00"),
    },
    {
      description: "Homologación y pruebas con operador de red — condicionan energización.",
      severity: "ALTA",
      probability: "MEDIA",
      status: "OPEN",
      mitigation: "Oficina técnica y asuntos regulatorios con hitos explícitos en cronograma CSO.",
      owner: "Asuntos regulatorios",
      dueDate: new Date("2026-09-25T12:00:00"),
    },
  ];

  const createdRisks: { id: string }[] = [];
  for (let i = 0; i < risksSeed.length; i++) {
    const r = risksSeed[i];
    createdRisks.push(
      await prisma.risk.create({
        data: {
          projectId,
          description: r.description,
          severity: r.severity,
          probability: r.probability,
          status: r.status,
          mitigation: r.mitigation,
          owner: r.owner,
          dueDate: r.dueDate,
          riskCategory: "OPERATIONAL",
          matrixKind: i === risksSeed.length - 1 ? "HSEC" : "MRB",
        },
      }),
    );
  }

  const sevRot = ["MEDIA", "ALTA", "BAJA"];
  const probRot = ["MEDIA", "BAJA", "ALTA"];
  for (let n = 1; n <= 18; n++) {
    await prisma.risk.create({
      data: {
        projectId,
        description: `[Demo CSO] Riesgo operacional sintético #${n} — cartera matriz (demo).`,
        severity: sevRot[n % 3],
        probability: probRot[n % 3],
        status: "OPEN",
        mitigation: "Mitigación de demostración; sustituir por plan real del proyecto.",
        owner: "PMO",
        riskCategory: "OPERATIONAL",
        matrixKind: n % 6 === 0 ? "HSEC" : "MRB",
      },
    });
  }

  await prisma.projectCommitment.create({
    data: {
      projectId,
      title: "Entregar informe topografía base firmado",
      description: "Compromiso de comité vinculado a paquete 2.",
      dueDate: new Date("2026-03-01T12:00:00"),
      status: "OPEN",
      owner: "Oficina técnica",
      sourceType: "DECISION",
      decisionId: decMontaje.id,
      milestoneId: milTopo.id,
    },
  });

  await prisma.projectCommitment.create({
    data: {
      projectId,
      title: "Publicar acta kickoff y baseline en documental",
      dueDate: new Date("2026-01-25T12:00:00"),
      status: "DONE",
      owner: "PMO",
      sourceType: "MEETING",
      milestoneId: milKick.id,
    },
  });

  await prisma.projectCommitment.create({
    data: {
      projectId,
      title: "Seguimiento riesgo logística Magallanes — informe quincenal",
      dueDate: new Date("2026-07-15T12:00:00"),
      status: "OPEN",
      owner: "Jefe de obra",
      sourceType: "RISK",
      riskId: createdRisks[0].id,
    },
  });

  const docs = [
    {
      name: "Carta Gantt CSO 06-04 (referencia cronograma)",
      fileUrl: "/references/carta-gantt-cso-06-04.pdf",
      version: "1.0",
      type: "Cronograma",
      uploadedBy: "seed@pmo",
      notes: "Referencia obligatoria de WBS y fechas del proyecto Cerro Sombrero.",
    },
    {
      name: "Plan maestro de obra FV — rev. control",
      fileUrl: "/uploads/documents/demo/cso-plan-maestro-revC.pdf",
      version: "1.0",
      type: "Ingeniería",
      uploadedBy: "seed@pmo",
      notes: "Documento de respaldo; sustituir por URL real en despliegue.",
    },
    {
      name: "Matriz HSEC faena y permisos de trabajo",
      fileUrl: "/uploads/documents/demo/cso-matriz-hsec.xlsx",
      version: "1.0",
      type: "HSEC / SSOMA",
      uploadedBy: "seed@pmo",
      notes: "Plantilla de seguimiento HSEC.",
    },
  ];

  for (const d of docs) {
    await prisma.projectDocument.create({
      data: {
        projectId,
        name: d.name,
        fileUrl: d.fileUrl,
        version: d.version,
        type: d.type,
        uploadedBy: d.uploadedBy,
        notes: d.notes,
      },
    });
  }

  const resourceSpecs = [
    {
      name: "CSO · Supervisor de obra FV",
      type: "PERSONAL",
      status: "ASSIGNED",
      notes: "Supervisión faena Cerro Sombrero.",
    },
    {
      name: "CSO · Supervisor de obra",
      type: "PERSONAL",
      status: "ASSIGNED",
      notes: "Coordinación diaria mandante / contratista.",
    },
    {
      name: "CSO · Grúa todo terreno 100 t",
      type: "EQUIPO",
      status: "ASSIGNED",
      notes: "Montaje estructura e inversores.",
    },
    {
      name: "CSO · Grúa todo terreno 80 t",
      type: "EQUIPO",
      status: "ASSIGNED",
      notes: "Apoyo montaje y descarga.",
    },
    {
      name: "CSO · Rodillo compactador",
      type: "EQUIPO",
      status: "AVAILABLE",
      notes: "Camino de acceso y plataforma.",
    },
    {
      name: "CSO · Compresor eléctrico",
      type: "EQUIPO",
      status: "AVAILABLE",
      notes: "Herramientas neumáticas faena.",
    },
  ];

  for (const spec of resourceSpecs) {
    const existing = await prisma.projectResource.findFirst({ where: { name: spec.name } });
    if (existing) {
      await prisma.projectResource.update({
        where: { id: existing.id },
        data: {
          assignedProjectId: projectId,
          type: spec.type,
          status: spec.status,
          notes: spec.notes,
        },
      });
    } else {
      await prisma.projectResource.create({
        data: {
          name: spec.name,
          type: spec.type,
          status: spec.status,
          assignedProjectId: projectId,
          notes: spec.notes,
        },
      });
    }
  }

  await prisma.projectCommercialLink.create({
    data: {
      projectId,
      externalSystem: "COTIZACIONES_PFV",
      externalRef: "suite-vista-previa",
      metadata: JSON.stringify({
        note: "Vínculo de ejemplo; líneas transferidas desde cotización de venta se modelan en Software de Mejora (ProjectSupplyItem).",
      }),
    },
  });
}

export type MejoraCsoDemoSeedResult = { projectId: string; code: string; name: string };

/**
 * Crea o actualiza el proyecto CSO y vuelve a sembrar todo el PMO (idempotente por `code`).
 */
export async function runMejoraCsoDemoSeed(prisma: PrismaClient): Promise<MejoraCsoDemoSeedResult> {
  const project = await prisma.project.upsert({
    where: { code: CODE },
    create: {
      code: CODE,
      name: "PARQUE FOTOVOLTAICO CERRO SOMBRERO",
      client: "Mandante / SPV proyecto FV (referencia CSO)",
      location: "Cerro Sombrero, Magallanes, Chile",
      startDate: new Date("2026-01-07T12:00:00"),
      endDate: new Date("2026-10-12T12:00:00"),
      status: "IN_PROGRESS",
      progress: 20,
      description:
        "Línea base de planificación alineada a la Carta Gantt CSO 06-04: WBS con paquetes resumen, tareas detalle, hitos de 0 días y campos de baseline en base de datos. Una sola fuente de verdad vía API NestJS + PostgreSQL.",
    },
    update: {
      name: "PARQUE FOTOVOLTAICO CERRO SOMBRERO",
      client: "Mandante / SPV proyecto FV (referencia CSO)",
      location: "Cerro Sombrero, Magallanes, Chile",
      startDate: new Date("2026-01-07T12:00:00"),
      endDate: new Date("2026-10-12T12:00:00"),
      status: "IN_PROGRESS",
      progress: 20,
      description:
        "Línea base de planificación alineada a la Carta Gantt CSO 06-04: WBS con paquetes resumen, tareas detalle, hitos de 0 días y campos de baseline en base de datos. Una sola fuente de verdad vía API NestJS + PostgreSQL.",
    },
  });

  await seedPmoForProject(prisma, project.id);

  const nTasks = await prisma.task.count({ where: { projectId: project.id } });
  const nRisks = await prisma.risk.count({ where: { projectId: project.id } });
  console.log(
    `  Proyecto demo CSO + PMO: id=${project.id} code=${project.code} (tareas=${nTasks}, riesgos=${nRisks}, documentos/recursos/compromisos sincronizados).`,
  );

  return { projectId: project.id, code: project.code, name: project.name };
}
