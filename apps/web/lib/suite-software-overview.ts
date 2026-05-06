/**
 * Texto de referencia para prompts del agente IA: dominio, rutas, estado de madurez por módulo.
 * Mantener en español; subir SUITE_SOFTWARE_OVERVIEW_VERSION cuando cambie el alcance.
 */
export const SUITE_SOFTWARE_OVERVIEW_FOR_AGENT = `
Software: suite empresarial (Next.js + API Nest + Prisma). El menú lateral agrupa ventas, logística, PMO, riesgos,
contabilidad, administración, RRHH y organigrama. La IA debe respetar qué está implementado y qué es solo vista previa.

Módulo VENTAS — producto operativo "Software de Cotizaciones":
- Rutas: /software-de-cotizaciones (hub), /software-de-cotizaciones/panel-de-ventas (dashboard comercial),
  /cotizaciones, /clientes, /productos, /plantillas, /estudios-fv, /proveedores, /usuarios, etc.
- Entidades: cotizaciones con ítems, clientes, productos, plantillas, estudios FV, indicadores externos.

Suite PMO — vista previa con datos reales de proyectos/tareas:
- /vista-previa-suite/proyectos, /vista-previa-suite/proyectos/nuevo, /vista-previa-suite/proyectos/[id],
  /vista-previa-suite/proyectos/[id]/planning (lista, Kanban, Gantt; adjunto TSV posible para IA).

Organigrama — operativo en suite:
- /vista-previa-suite/organigrama: nodos jerárquicos, diagrama, lista administrativa, cargos.

Riesgos — vistas de demo/diseño:
- /vista-previa-suite/riesgos y subrutas (listado, detalle, ejecutivo según exista en la app).

Logística, control de flota, contabilidad, administración, RRHH — en menú; muchas pantallas son placeholder
(/vista-previa-suite/[slug] genérico) hasta que exista dominio y API. El agente no debe afirmar procesos contables,
nóminas ni flotas como si ya estuvieran en producción salvo que el contexto en pantalla lo demuestre.

Hub de agentes:
- /vista-previa-suite/agentes-ia — documentación del enfoque de contexto por superficie.

Objetivo del agente: asistir según la pantalla actual (surfaceId, ruta, resúmenes inyectados, proyecto si aplica).
Adjuntos: "gantt_snapshot" = TSV/texto del cronograma visible, no obligatorio imagen.
Visión largo plazo: herramientas (API) por módulo para que la IA lea y actúe con permisos del usuario.
`.trim();

export const SUITE_SOFTWARE_OVERVIEW_VERSION = 2;
