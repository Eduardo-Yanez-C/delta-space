import { hierarchy, tree, type HierarchyNode, type HierarchyPointNode } from "d3-hierarchy";

export type OrgBox = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

/** Cajas: banda + foto + nombre + cargo + pie (referencia organigrama formal). */
export const ORG_NODE_W = 252;
export const ORG_NODE_H = 128;
const NODE_W = ORG_NODE_W;
const NODE_H = ORG_NODE_H;
/** Separación vertical entre filas jerárquicas (superior → subordinados). */
const V_GAP = 56;
/** Separación horizontal base entre nodos hermanos (el layout tidy la refina). */
const H_GAP = 28;
const LAYOUT_ROOT_ID = "__org_chart_layout_root__";
const CANVAS_PAD = 36;

export type OrgTreeLike = {
  id: string;
  children: OrgTreeLike[];
};

type VirtualRoot = OrgTreeLike & { id: typeof LAYOUT_ROOT_ID };

/**
 * Posiciones con algoritmo Reingold–Tilford (tidy tree, Buchheim et al., vía d3-hierarchy):
 * cada nivel en una fila horizontal (Y fija por profundidad), hermanos repartidos en X
 * sin solapes, padres centrados sobre el bloque de sus descendientes.
 */
export function layoutOrgChart<T extends OrgTreeLike>(roots: T[]): {
  boxes: Map<string, OrgBox>;
  width: number;
  height: number;
} {
  const boxes = new Map<string, OrgBox>();

  if (roots.length === 0) {
    return { boxes, width: 400, height: 240 };
  }

  const rootData: VirtualRoot = { id: LAYOUT_ROOT_ID, children: roots as OrgTreeLike[] };
  const h = hierarchy(rootData, (d: OrgTreeLike) => d.children ?? []);
  const dy = NODE_H + V_GAP;
  const dx = NODE_W + H_GAP;

  const treeLayout = tree<OrgTreeLike>()
    .nodeSize([dx, dy])
    /** Hermanos: 1×; subárboles de primos algo más separados para leer el tronco. */
    .separation((a: HierarchyPointNode<OrgTreeLike>, b: HierarchyPointNode<OrgTreeLike>) =>
      a.parent === b.parent ? 1 : 1.32,
    );

  treeLayout(h);

  let minLeft = Infinity;
  let maxRight = -Infinity;
  let maxVisualDepth = 0;

  h.each((d: HierarchyNode<OrgTreeLike>) => {
    if (d.data.id === LAYOUT_ROOT_ID) return;
    const visualDepth = d.depth - 1;
    if (visualDepth < 0) return;
    const cx = (d as HierarchyPointNode<OrgTreeLike>).x ?? 0;
    const left = cx - NODE_W / 2;
    minLeft = Math.min(minLeft, left);
    maxRight = Math.max(maxRight, left + NODE_W);
    maxVisualDepth = Math.max(maxVisualDepth, visualDepth);
  });

  const shiftX = CANVAS_PAD - minLeft;

  h.each((d: HierarchyNode<OrgTreeLike>) => {
    if (d.data.id === LAYOUT_ROOT_ID) return;
    const visualDepth = d.depth - 1;
    if (visualDepth < 0) return;
    const cx = (d as HierarchyPointNode<OrgTreeLike>).x ?? 0;
    boxes.set(d.data.id, {
      id: d.data.id,
      x: cx - NODE_W / 2 + shiftX,
      y: CANVAS_PAD + visualDepth * dy,
      w: NODE_W,
      h: NODE_H,
    });
  });

  const width = Math.max(maxRight - minLeft + CANVAS_PAD * 2, 400);
  const height = Math.max((maxVisualDepth + 1) * dy + CANVAS_PAD * 2, NODE_H + CANVAS_PAD * 2);

  return { boxes, width, height };
}

/**
 * Conector ortogonal padre → hijo (estilo organigrama formal).
 * Tramo vertical desde el borde inferior del padre, bus horizontal, bajada al hijo.
 */
export function elbowPath(px: number, pyBottom: number, cx: number, cyTop: number): string {
  const span = Math.max(0, cyTop - pyBottom);
  const midY = pyBottom + Math.min(28, Math.max(14, span * 0.42));
  if (Math.abs(px - cx) < 1) {
    return `M ${px} ${pyBottom} L ${px} ${cyTop}`;
  }
  return `M ${px} ${pyBottom} L ${px} ${midY} L ${cx} ${midY} L ${cx} ${cyTop}`;
}

/**
 * Conector horizontal tipo «consultoría»: desde el borde del cargo enlazado hacia el nodo consultor.
 * Evita solaparse con el tronco vertical jerárquico (estilo línea que sale al costado).
 */
export function advisoryElbowPath(from: OrgBox, to: OrgBox): string {
  const ay = from.y + from.h / 2;
  const by = to.y + to.h / 2;
  const fromRight = from.x + from.w;
  const fromLeft = from.x;
  const toRight = to.x + to.w;
  const toLeft = to.x;
  if (toLeft >= fromRight - 8) {
    const midX = fromRight + (toLeft - fromRight) * 0.5;
    return `M ${fromRight} ${ay} L ${midX} ${ay} L ${midX} ${by} L ${toLeft} ${by}`;
  }
  if (toRight <= fromLeft + 8) {
    const midX = toRight + (fromLeft - toRight) * 0.5;
    return `M ${fromLeft} ${ay} L ${midX} ${ay} L ${midX} ${by} L ${toRight} ${by}`;
  }
  const midY = Math.min(from.y + from.h, to.y + to.h) + 36;
  const fx = from.x + from.w / 2;
  const tx = to.x + to.w / 2;
  return `M ${fx} ${from.y + from.h} L ${fx} ${midY} L ${tx} ${midY} L ${tx} ${to.y}`;
}

/**
 * Conexión libre entre cargos: misma geometría base que consultoría, con desplazamiento
 * opcional del tramo central (persistido; arrastrable en el lienzo).
 */
export function customFreeEdgePath(from: OrgBox, to: OrgBox, ox = 0, oy = 0): string {
  const ay = from.y + from.h / 2;
  const by = to.y + to.h / 2;
  const fromRight = from.x + from.w;
  const fromLeft = from.x;
  const toRight = to.x + to.w;
  const toLeft = to.x;
  if (toLeft >= fromRight - 8) {
    const midX = fromRight + (toLeft - fromRight) * 0.5 + ox;
    return `M ${fromRight} ${ay} L ${midX} ${ay} L ${midX} ${by} L ${toLeft} ${by}`;
  }
  if (toRight <= fromLeft + 8) {
    const midX = toRight + (fromLeft - toRight) * 0.5 + ox;
    return `M ${fromLeft} ${ay} L ${midX} ${ay} L ${midX} ${by} L ${toRight} ${by}`;
  }
  const midY = Math.min(from.y + from.h, to.y + to.h) + 36 + oy;
  const fx = from.x + from.w / 2 + ox;
  const tx = to.x + to.w / 2 + ox;
  return `M ${fx} ${from.y + from.h} L ${fx} ${midY} L ${tx} ${midY} L ${tx} ${to.y}`;
}

/** Punto de agarre del codo (para arrastrar el enrutamiento). */
export function customFreeEdgeBendHandle(from: OrgBox, to: OrgBox, ox = 0, oy = 0): { x: number; y: number } {
  const ay = from.y + from.h / 2;
  const by = to.y + to.h / 2;
  const fromRight = from.x + from.w;
  const fromLeft = from.x;
  const toRight = to.x + to.w;
  const toLeft = to.x;
  if (toLeft >= fromRight - 8) {
    const midX = fromRight + (toLeft - fromRight) * 0.5 + ox;
    return { x: midX, y: (ay + by) / 2 };
  }
  if (toRight <= fromLeft + 8) {
    const midX = toRight + (fromLeft - toRight) * 0.5 + ox;
    return { x: midX, y: (ay + by) / 2 };
  }
  const midY = Math.min(from.y + from.h, to.y + to.h) + 36 + oy;
  const fx = from.x + from.w / 2 + ox;
  const tx = to.x + to.w / 2 + ox;
  return { x: (fx + tx) / 2, y: midY };
}
