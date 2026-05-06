import type { MarginHierarchyMountStructureType, MarginHierarchySystemType } from "./margin-hierarchy.constants";

/** Línea base de plantilla limpia (cantidad mínima 1: el modelo exige quantity > 0). */
export type CleanTemplateLineDef = {
  sortOrder: number;
  productNameSnapshot: string;
  productDescriptionSnapshot?: string;
};

export type CleanTemplateBlockDef = {
  sortOrder: number;
  name: string;
  description?: string;
  lines: CleanTemplateLineDef[];
};

/**
 * Orden oficial de ítems principales (1–11). Reglas de inclusión en `filterBlocksForApplyClean`.
 */
const CLEAN_BLOCKS_BASE: CleanTemplateBlockDef[] = [
  {
    sortOrder: 1,
    name: "Suministro de paneles fotovoltaicos",
    lines: [{ sortOrder: 0, productNameSnapshot: "Panel solar" }],
  },
  {
    sortOrder: 2,
    name: "Suministro de inversor",
    lines: [
      {
        sortOrder: 0,
        productNameSnapshot: "Inversor para sistema FV",
        productDescriptionSnapshot: "Descripción genérica reutilizable; ajustar según potencia y configuración.",
      },
    ],
  },
  {
    sortOrder: 3,
    name: "Baterías y respaldo",
    lines: [
      { sortOrder: 0, productNameSnapshot: "Batería" },
      { sortOrder: 1, productNameSnapshot: "Módulo de batería" },
      { sortOrder: 2, productNameSnapshot: "Banco de baterías" },
      { sortOrder: 3, productNameSnapshot: "Accesorios de batería" },
      { sortOrder: 4, productNameSnapshot: "Soporte o gabinete de baterías" },
    ],
  },
  {
    sortOrder: 4,
    name: "Estructura de montaje",
    lines: [
      { sortOrder: 0, productNameSnapshot: "Rieles 2,4 mts" },
      { sortOrder: 1, productNameSnapshot: "Extensión de riel" },
      { sortOrder: 2, productNameSnapshot: "End clamp kit" },
      { sortOrder: 3, productNameSnapshot: "Mid clamp kit" },
      { sortOrder: 4, productNameSnapshot: "Perno suspensión" },
      { sortOrder: 5, productNameSnapshot: "Soporte L" },
      {
        sortOrder: 6,
        productNameSnapshot: 'Tornillo autoperforante hexagonal con golilla y goma N14 x 2 1/2"',
      },
      { sortOrder: 7, productNameSnapshot: "Tarugos M10" },
    ],
  },
  {
    sortOrder: 5,
    name: "Estructura angular",
    lines: [
      { sortOrder: 0, productNameSnapshot: "Kit marco / estructura angular" },
      { sortOrder: 1, productNameSnapshot: "Kit de instalación marco" },
      { sortOrder: 2, productNameSnapshot: "Elementos específicos de estructura angular" },
    ],
  },
  {
    sortOrder: 6,
    name: "Cableado fotovoltaico DC",
    lines: [
      { sortOrder: 0, productNameSnapshot: "Cable fotovoltaico rojo 4 mm" },
      { sortOrder: 1, productNameSnapshot: "Cable fotovoltaico negro 4 mm" },
      { sortOrder: 2, productNameSnapshot: "MC4" },
    ],
  },
  {
    sortOrder: 7,
    name: "Canalización y cableado AC",
    lines: [
      { sortOrder: 0, productNameSnapshot: "Cable THHN 10 AWG rojo" },
      { sortOrder: 1, productNameSnapshot: "Cable THHN 10 AWG blanco" },
      { sortOrder: 2, productNameSnapshot: "Cable THHN 10 AWG verde" },
      { sortOrder: 3, productNameSnapshot: "Cable THHN 10 AWG rojo/negro/azul" },
      { sortOrder: 4, productNameSnapshot: "RVK monopolar 4 mm2" },
      { sortOrder: 5, productNameSnapshot: "Cable RVK 3.4 mm2" },
      { sortOrder: 6, productNameSnapshot: "Cable RVK 5x10 mm2" },
      { sortOrder: 7, productNameSnapshot: "Tubo acero galvanizado 25 mm" },
      { sortOrder: 8, productNameSnapshot: "Tubo flexible 25 mm UV" },
      { sortOrder: 9, productNameSnapshot: "Abrazadera Caddy 25 mm" },
      { sortOrder: 10, productNameSnapshot: "Caja galvanizada 100x100x65" },
      { sortOrder: 11, productNameSnapshot: "Caja PVC 100x100x65" },
      { sortOrder: 12, productNameSnapshot: "Conector recto flexible 25 mm" },
      { sortOrder: 13, productNameSnapshot: "Bushing metálica 25 mm" },
      { sortOrder: 14, productNameSnapshot: "Copla EMT 25 mm" },
      { sortOrder: 15, productNameSnapshot: "Contratuerca 25 mm" },
      { sortOrder: 16, productNameSnapshot: "Prensa estopa PG 13,5" },
      { sortOrder: 17, productNameSnapshot: "Canaletas y accesorios" },
    ],
  },
  {
    sortOrder: 8,
    name: "Puesta a tierra",
    lines: [
      { sortOrder: 0, productNameSnapshot: "Platina dentada para tierra" },
      { sortOrder: 1, productNameSnapshot: "Conector de tierra kit" },
      { sortOrder: 2, productNameSnapshot: "Barra Copperweld 5/8 x 1 m" },
      { sortOrder: 3, productNameSnapshot: "Conector de Cu para barra toma tierra" },
      { sortOrder: 4, productNameSnapshot: "Camarilla de inspección PVC 160 mm" },
      { sortOrder: 5, productNameSnapshot: "Barra tierra" },
      { sortOrder: 6, productNameSnapshot: "Cable verde asociado" },
    ],
  },
  {
    sortOrder: 9,
    name: "Tablero y protecciones eléctricas",
    lines: [
      { sortOrder: 0, productNameSnapshot: "Tablero sobrepuesto 12 módulos" },
      { sortOrder: 1, productNameSnapshot: "Tablero trifásico" },
      { sortOrder: 2, productNameSnapshot: "Gabinete 300x400 dos puertas" },
      { sortOrder: 3, productNameSnapshot: "Automático 2P" },
      { sortOrder: 4, productNameSnapshot: "Automático 2P x 25A" },
      { sortOrder: 5, productNameSnapshot: "Automático 2P x 20A" },
      { sortOrder: 6, productNameSnapshot: "Automático 1P x 25A" },
      { sortOrder: 7, productNameSnapshot: "Automático 2P x 10A" },
      { sortOrder: 8, productNameSnapshot: "Diferencial AC" },
      { sortOrder: 9, productNameSnapshot: "Diferencial clase AC 2x25A" },
      { sortOrder: 10, productNameSnapshot: "Diferencial tipo A" },
      { sortOrder: 11, productNameSnapshot: "Barra repartidora bipolar" },
      { sortOrder: 12, productNameSnapshot: "Falso polo" },
      { sortOrder: 13, productNameSnapshot: "Switch TT" },
      { sortOrder: 14, productNameSnapshot: "Riel DIN" },
      { sortOrder: 15, productNameSnapshot: "Canaleta 40x40" },
      { sortOrder: 16, productNameSnapshot: "Hilo corrido 5/16" },
      { sortOrder: 17, productNameSnapshot: "Ferrules" },
      { sortOrder: 18, productNameSnapshot: "Terminal de ojo" },
    ],
  },
  {
    sortOrder: 10,
    name: "Consumibles y ferretería menor",
    lines: [
      { sortOrder: 0, productNameSnapshot: "Tornillo roscalata 14x2" },
      { sortOrder: 1, productNameSnapshot: "Autoperforante cabeza lenteja 8x3/4" },
      { sortOrder: 2, productNameSnapshot: "Sellante para techo" },
      { sortOrder: 3, productNameSnapshot: "Soldadura para cable en barra" },
      { sortOrder: 4, productNameSnapshot: "Amarras plásticas" },
      { sortOrder: 5, productNameSnapshot: "Spray galvanizado" },
      { sortOrder: 6, productNameSnapshot: "Cinta aislante roja" },
      { sortOrder: 7, productNameSnapshot: "Cinta aislante blanca" },
      { sortOrder: 8, productNameSnapshot: "Cinta aislante verde" },
      { sortOrder: 9, productNameSnapshot: "Cinta aislante de goma" },
      { sortOrder: 10, productNameSnapshot: "Gas butano para soplete" },
      { sortOrder: 11, productNameSnapshot: "Ferrules / terminales menores" },
      { sortOrder: 12, productNameSnapshot: "Tuercas y golillas" },
    ],
  },
  {
    sortOrder: 11,
    name: "Servicios y gestión del proyecto",
    lines: [
      { sortOrder: 0, productNameSnapshot: "Mano de obra" },
      { sortOrder: 1, productNameSnapshot: "Gastos operacionales" },
      { sortOrder: 2, productNameSnapshot: "Trámites SEC" },
    ],
  },
];

/**
 * - Bloque 3 (Baterías): solo HYBRID / OFF_GRID.
 * - Bloque 5 (Estructura angular): solo ANGULAR / MIXTA (se suma a la base).
 * - Bloque 4 (Estructura de montaje): STANDARD, ANGULAR y MIXTA (siempre).
 */
export function filterBlocksForApplyClean(
  systemType: MarginHierarchySystemType,
  mountStructureType: MarginHierarchyMountStructureType,
): CleanTemplateBlockDef[] {
  return CLEAN_BLOCKS_BASE.filter((block) => {
    if (block.sortOrder === 3) {
      return systemType === "HYBRID" || systemType === "OFF_GRID";
    }
    if (block.sortOrder === 5) {
      return mountStructureType === "ANGULAR" || mountStructureType === "MIXTA";
    }
    return true;
  });
}
