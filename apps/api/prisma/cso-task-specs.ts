/**
 * Copia de `Sofware de Mejora/apps/api/scripts/data/cso-cerro-sombrero-tasks.cjs`
 * (Carta Gantt CSO 06-04). Mantener alineado al sembrado Mejora.
 */
export type CsoTaskSpec = {
  wbs: string;
  parentWbs: string | null;
  name: string;
  start: string;
  end: string;
  progress: number;
  status: string;
  sortOrder: number;
  weight?: number;
  summary?: boolean;
  isCritical?: boolean;
  isMilestone?: boolean;
  predWbs?: string;
};

export const CSO_TASK_SPECS: CsoTaskSpec[] = [
  { wbs: "1", parentWbs: null, name: "GESTIÓN INICIAL Y CIERRE PREVIO DE ARRANQUE", start: "2026-01-07", end: "2026-02-18", progress: 35, status: "IN_PROGRESS", sortOrder: 1000, weight: 1.2, summary: true },
  { wbs: "2", parentWbs: null, name: "TOPOGRAFÍA BASE Y CIERRE DE INGENIERÍA DE PARTIDA", start: "2026-01-15", end: "2026-03-28", progress: 28, status: "IN_PROGRESS", sortOrder: 2000, weight: 1.4, summary: true },
  { wbs: "3", parentWbs: null, name: "CAMINO DE ACCESO, CAMINOS INTERIORES Y HABILITACIÓN INICIAL", start: "2026-02-05", end: "2026-04-22", progress: 22, status: "IN_PROGRESS", sortOrder: 3000, weight: 1.1, summary: true },
  { wbs: "4", parentWbs: null, name: "ARRANQUE DEL PROYECTO PRINCIPAL Y FAENA DEFINITIVA", start: "2026-03-02", end: "2026-07-15", progress: 15, status: "IN_PROGRESS", sortOrder: 4000, weight: 1.6, summary: true, isCritical: true },
  { wbs: "5", parentWbs: null, name: "ESTRUCTURA FOTOVOLTAICA", start: "2026-04-10", end: "2026-08-28", progress: 10, status: "IN_PROGRESS", sortOrder: 5000, weight: 2, summary: true, isCritical: true },
  { wbs: "6", parentWbs: null, name: "OOCC PLANTA Y OBRAS ENTERRADAS", start: "2026-05-01", end: "2026-08-05", progress: 12, status: "IN_PROGRESS", sortOrder: 6000, weight: 1.3, summary: true },
  { wbs: "7", parentWbs: null, name: "SUBESTACIÓN, INVERSORES E INTEGRACIÓN ELÉCTRICA", start: "2026-07-01", end: "2026-09-30", progress: 8, status: "IN_PROGRESS", sortOrder: 7000, weight: 1.8, summary: true, isCritical: true },
  { wbs: "8", parentWbs: null, name: "COMISIONAMIENTO Y ENTREGA", start: "2026-08-15", end: "2026-10-12", progress: 5, status: "TODO", sortOrder: 8000, weight: 1.2, summary: true },
  { wbs: "1.1", parentWbs: "1", name: "Constitución de faena y habilitación preliminar", start: "2026-01-07", end: "2026-01-24", progress: 100, status: "DONE", sortOrder: 1010 },
  { wbs: "1.2", parentWbs: "1", name: "Coordinaciones mandante, comunidades y permisos iniciales", start: "2026-01-10", end: "2026-02-05", progress: 70, status: "IN_PROGRESS", sortOrder: 1020 },
  { wbs: "1.3", parentWbs: "1", name: "Carta de proyecto, baseline PMO e ingeniería de comienzo", start: "2026-01-12", end: "2026-02-12", progress: 55, status: "IN_PROGRESS", sortOrder: 1030, isCritical: true },
  { wbs: "1.4", parentWbs: "1", name: "Cierre administrativo fase pre-arranque", start: "2026-02-08", end: "2026-02-18", progress: 20, status: "TODO", sortOrder: 1040 },
  { wbs: "2.1", parentWbs: "2", name: "Replanteo topográfico base y ejes maestros", start: "2026-01-15", end: "2026-02-20", progress: 90, status: "IN_PROGRESS", sortOrder: 2010 },
  { wbs: "2.2", parentWbs: "2", name: "Cierre ingeniería de partida civil y eléctrica", start: "2026-02-01", end: "2026-03-15", progress: 40, status: "IN_PROGRESS", sortOrder: 2020, isCritical: true },
  { wbs: "2.3", parentWbs: "2", name: "Memorias de cálculo estructura y fundaciones", start: "2026-02-10", end: "2026-03-28", progress: 25, status: "IN_PROGRESS", sortOrder: 2030 },
  { wbs: "2.4", parentWbs: "2", name: "Entrega planos IFC / as-built parcial a obra", start: "2026-03-10", end: "2026-03-28", progress: 10, status: "TODO", sortOrder: 2040 },
  { wbs: "3.1", parentWbs: "3", name: "Camino de acceso — etapa provisional y definitiva", start: "2026-02-05", end: "2026-03-25", progress: 45, status: "IN_PROGRESS", sortOrder: 3010 },
  { wbs: "3.2", parentWbs: "3", name: "Caminos interiores de faena y plataformas de giro", start: "2026-03-01", end: "2026-04-15", progress: 30, status: "IN_PROGRESS", sortOrder: 3020 },
  { wbs: "3.3", parentWbs: "3", name: "Señalética, cerco perimetral fase I y control de acceso", start: "2026-03-10", end: "2026-04-22", progress: 15, status: "TODO", sortOrder: 3030 },
  { wbs: "3.4", parentWbs: "3", name: "Bodegas, taller y oficinas preoperativas", start: "2026-03-15", end: "2026-04-18", progress: 10, status: "TODO", sortOrder: 3040 },
  { wbs: "4.1", parentWbs: "4", name: "Movimiento de tierras y plataforma principal", start: "2026-03-02", end: "2026-04-30", progress: 55, status: "IN_PROGRESS", sortOrder: 4010, isCritical: true },
  { wbs: "4.2", parentWbs: "4", name: "Excavaciones y fundaciones línea de trackers", start: "2026-04-05", end: "2026-06-20", progress: 25, status: "IN_PROGRESS", sortOrder: 4020, predWbs: "4.1" },
  { wbs: "4.3", parentWbs: "4", name: "Habilitación faena definitiva (servicios, riego de polvo)", start: "2026-05-10", end: "2026-07-15", progress: 18, status: "IN_PROGRESS", sortOrder: 4030 },
  { wbs: "4.4", parentWbs: "4", name: "Logística de materiales y laydown principal", start: "2026-04-20", end: "2026-07-01", progress: 12, status: "TODO", sortOrder: 4040 },
  { wbs: "5.1", parentWbs: "5", name: "Montaje estructuras soporte de módulos FV", start: "2026-04-10", end: "2026-07-05", progress: 20, status: "IN_PROGRESS", sortOrder: 5010, isCritical: true },
  { wbs: "5.2", parentWbs: "5", name: "Colocación de módulos fotovoltaicos", start: "2026-05-20", end: "2026-08-10", progress: 8, status: "IN_PROGRESS", sortOrder: 5020, predWbs: "5.1" },
  { wbs: "5.3", parentWbs: "5", name: "Cableado string DC y canalizaciones", start: "2026-06-15", end: "2026-08-28", progress: 5, status: "TODO", sortOrder: 5030 },
  { wbs: "5.4", parentWbs: "5", name: "Puesta a tierra y mallado — conexiones DC", start: "2026-07-01", end: "2026-08-25", progress: 5, status: "TODO", sortOrder: 5040 },
  { wbs: "5.5", parentWbs: "5", name: "Inspecciones internas estructura FV", start: "2026-08-01", end: "2026-08-28", progress: 0, status: "TODO", sortOrder: 5050 },
  { wbs: "6.1", parentWbs: "6", name: "Obras de arte menores (OA) y cruces", start: "2026-05-01", end: "2026-06-30", progress: 35, status: "IN_PROGRESS", sortOrder: 6010 },
  { wbs: "6.2", parentWbs: "6", name: "Zanjas y ductos enterrados", start: "2026-05-15", end: "2026-07-20", progress: 20, status: "IN_PROGRESS", sortOrder: 6020 },
  { wbs: "6.3", parentWbs: "6", name: "Canalizaciones mecánica de suelo y protecciones", start: "2026-06-01", end: "2026-08-05", progress: 10, status: "TODO", sortOrder: 6030 },
  { wbs: "6.4", parentWbs: "6", name: "Cimentaciones equipos de planta e inversores", start: "2026-06-20", end: "2026-08-01", progress: 5, status: "TODO", sortOrder: 6040 },
  { wbs: "7.1", parentWbs: "7", name: "Montaje inversores y transformadores de potencia", start: "2026-07-01", end: "2026-08-25", progress: 12, status: "IN_PROGRESS", sortOrder: 7010, isCritical: true },
  { wbs: "7.2", parentWbs: "7", name: "Armado subestación / celdas MT y protecciones", start: "2026-07-20", end: "2026-09-15", progress: 8, status: "IN_PROGRESS", sortOrder: 7020 },
  { wbs: "7.3", parentWbs: "7", name: "Cableado de potencia y control AC", start: "2026-08-10", end: "2026-09-25", progress: 5, status: "TODO", sortOrder: 7030 },
  { wbs: "7.4", parentWbs: "7", name: "Ensayos FAT/SAT equipos principales", start: "2026-08-25", end: "2026-09-30", progress: 3, status: "TODO", sortOrder: 7040 },
  { wbs: "7.5", parentWbs: "7", name: "Integración SCADA y telemetría", start: "2026-09-01", end: "2026-09-30", progress: 0, status: "TODO", sortOrder: 7050 },
  { wbs: "8.1", parentWbs: "8", name: "Pruebas de comisionamiento en vacío", start: "2026-08-15", end: "2026-09-10", progress: 0, status: "TODO", sortOrder: 8010 },
  { wbs: "8.2", parentWbs: "8", name: "Pruebas con generación y curvas IV", start: "2026-09-05", end: "2026-09-28", progress: 0, status: "TODO", sortOrder: 8020 },
  { wbs: "8.3", parentWbs: "8", name: "Entrega documentación as-built y manuales O&M", start: "2026-09-15", end: "2026-10-05", progress: 0, status: "TODO", sortOrder: 8030 },
  { wbs: "8.4", parentWbs: "8", name: "Capacitación a operación y mandante", start: "2026-09-20", end: "2026-10-08", progress: 0, status: "TODO", sortOrder: 8040 },
  { wbs: "8.5", parentWbs: "8", name: "Recepción provisional OOCC", start: "2026-10-01", end: "2026-10-12", progress: 0, status: "TODO", sortOrder: 8050 },
  {
    wbs: "8.9",
    parentWbs: "8",
    name: "Inicio de operaciones",
    start: "2026-09-29",
    end: "2026-09-29",
    progress: 0,
    status: "TODO",
    sortOrder: 8090,
    isMilestone: true,
    isCritical: true,
    weight: 0.05,
  },
];
