"use client";

import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { OrgCanvasToolbar } from "./OrgCanvasToolbar";
import { OrgNodeCard } from "./OrgNodeCard";
import type { OrgBuiltinLineStyles } from "../../lib/org-chart-line-styles";
import { DEFAULT_ORG_BUILTIN_LINE_STYLES } from "../../lib/org-chart-line-styles";
import {
  advisoryElbowPath,
  customFreeEdgeBendHandle,
  customFreeEdgePath,
  elbowPath,
  layoutOrgChart,
  ORG_NODE_H,
  ORG_NODE_W,
  type OrgTreeLike,
} from "./org-chart-layout";
import { orgThemeForDepth } from "./org-node-theme";

export type OrgFreeEdge = {
  id: string;
  from: string;
  to: string;
  color: string;
  strokeWidth: number;
  dashPattern: string | null;
  midOffsetX: number;
  midOffsetY: number;
};

export type OrgDiagramNode = OrgTreeLike & {
  name: string;
  role: string;
  active: boolean;
  depth: number;
  category?: string | null;
  photoUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  /** Enlace matricial / consultoría (línea punteada hacia `linkToId` en API). */
  linkToId?: string | null;
};

export function withOrgDepth<T extends { children: T[] }>(nodes: T[], d = 0): (T & { depth: number })[] {
  return nodes.map((n) => ({
    ...n,
    depth: d,
    children: withOrgDepth(n.children as T[], d + 1),
  })) as (T & { depth: number })[];
}

function collectEdges(n: OrgDiagramNode, edges: { from: string; to: string }[]) {
  for (const c of n.children) {
    edges.push({ from: n.id, to: c.id });
    collectEdges(c as OrgDiagramNode, edges);
  }
}

function findNode(roots: OrgDiagramNode[], id: string): OrgDiagramNode | null {
  for (const r of roots) {
    if (r.id === id) return r;
    const f = findNode(r.children as OrgDiagramNode[], id);
    if (f) return f;
  }
  return null;
}

function collectPreorderIds(nodes: OrgDiagramNode[]): string[] {
  const out: string[] = [];
  function walk(list: OrgDiagramNode[]) {
    for (const n of list) {
      out.push(n.id);
      walk(n.children as OrgDiagramNode[]);
    }
  }
  walk(nodes);
  return out;
}

const SCALE_MIN = 0.35;
const SCALE_MAX = 1.85;

type FreeEdgeDashPreset = "solid" | "dashed" | "dotted";

export type OrgFreeEdgePatch = {
  color?: string;
  strokeWidth?: number;
  dashPattern?: string | null;
  midOffsetX?: number;
  midOffsetY?: number;
};

function freeDashPatternFromPreset(p: FreeEdgeDashPreset): string | null {
  if (p === "solid") return null;
  if (p === "dashed") return "8 6";
  return "2 5";
}

function freeDashPresetFromPattern(dash: string | null): FreeEdgeDashPreset {
  const t = (dash ?? "").trim();
  if (!t) return "solid";
  if (t.startsWith("2 ")) return "dotted";
  return "dashed";
}

export function OrgChartDiagram({
  roots,
  selectedId,
  onSelect,
  onNodeEdit,
  emptyLabel,
  inactiveLabel,
  onCreateNode,
  onOpenList,
  bandLabelForDepth,
  noSecondaryContact,
  advisoryEdges,
  consultantBadgeLabel,
  toolbarLabels,
  contextToolbarSlot,
  linesToolbar,
  builtinLineStyles = DEFAULT_ORG_BUILTIN_LINE_STYLES,
  freeEdges = [],
  canEditFreeEdges = false,
  onPatchFreeEdge,
  onDeleteFreeEdge,
  freeEdgeBarLabels,
}: {
  roots: OrgDiagramNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Doble clic en tarjeta: abrir ficha de edición. */
  onNodeEdit?: (id: string) => void;
  emptyLabel: string;
  inactiveLabel: string;
  onCreateNode: () => void;
  onOpenList: () => void;
  bandLabelForDepth: (depth: number) => string;
  noSecondaryContact: string;
  advisoryEdges: { from: string; to: string }[];
  consultantBadgeLabel: string;
  contextToolbarSlot?: ReactNode;
  linesToolbar?: { label: string; title?: string; onClick: () => void } | null;
  builtinLineStyles?: OrgBuiltinLineStyles;
  freeEdges?: OrgFreeEdge[];
  canEditFreeEdges?: boolean;
  onPatchFreeEdge?: (id: string, patch: OrgFreeEdgePatch) => Promise<void>;
  onDeleteFreeEdge?: (id: string) => Promise<void>;
  freeEdgeBarLabels?: {
    title: string;
    apply: string;
    close: string;
    delete: string;
    dashSolid: string;
    dashDashed: string;
    dashDotted: string;
    color: string;
    width: string;
    dashStyle: string;
    bendDragHint: string;
    deleteNeedsRole: string;
  };
  toolbarLabels: {
    zoomIn: string;
    zoomOut: string;
    fit: string;
    center: string;
    reset: string;
    create: string;
    listView: string;
    helpTitle: string;
    helpBody: string;
  };
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 32, y: 24 });
  /** Desplazamiento manual respecto al layout automático (persiste en la sesión). */
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, { dx: number; dy: number }>>({});
  const panRef = useRef(pan);
  const scaleRef = useRef(scale);
  const offsetsRef = useRef(nodeOffsets);
  const dragSession = useRef<{
    id: string;
    startClientX: number;
    startClientY: number;
    originDx: number;
    originDy: number;
  } | null>(null);
  const dragMoved = useRef(false);
  const [selectedFreeEdgeId, setSelectedFreeEdgeId] = useState<string | null>(null);
  const [freeEdgeDraft, setFreeEdgeDraft] = useState<{ color: string; strokeWidth: number; dash: FreeEdgeDashPreset }>({
    color: "#64748b",
    strokeWidth: 2,
    dash: "solid",
  });
  const [freeEdgeBusy, setFreeEdgeBusy] = useState(false);
  /** Vista previa local al arrastrar el codo (coords del lienzo). */
  const [bendPreview, setBendPreview] = useState<{ id: string; ox: number; oy: number } | null>(null);
  const onPatchFreeEdgeRef = useRef<((id: string, patch: OrgFreeEdgePatch) => Promise<void>) | undefined>(undefined);
  onPatchFreeEdgeRef.current = onPatchFreeEdge;

  const diagMarkersId = useId().replace(/:/g, "");
  const mk = useCallback((s: string) => `org-m-${diagMarkersId}-${s}`, [diagMarkersId]);

  const clampBend = useCallback((v: number) => Math.max(-500, Math.min(500, v)), []);

  panRef.current = pan;
  scaleRef.current = scale;
  offsetsRef.current = nodeOffsets;

  const laid = useMemo(() => layoutOrgChart(roots), [roots]);
  const { boxes, width, height } = laid;

  const orgStructureKey = useMemo(() => collectPreorderIds(roots).sort().join(","), [roots]);
  useEffect(() => {
    setNodeOffsets({});
  }, [orgStructureKey]);

  const effectiveBoxes = useMemo(() => {
    const m = new Map<string, { id: string; x: number; y: number; w: number; h: number }>();
    boxes.forEach((b, id) => {
      const o = nodeOffsets[id] ?? { dx: 0, dy: 0 };
      m.set(id, { ...b, x: b.x + o.dx, y: b.y + o.dy });
    });
    return m;
  }, [boxes, nodeOffsets]);

  const edges = useMemo(() => {
    const e: { from: string; to: string }[] = [];
    roots.forEach((r) => collectEdges(r, e));
    return e;
  }, [roots]);

  const advisoryPaths = useMemo(() => {
    return advisoryEdges
      .map((edge) => {
        const a = effectiveBoxes.get(edge.from);
        const b = effectiveBoxes.get(edge.to);
        if (!a || !b) return null;
        return { key: `${edge.from}-${edge.to}`, d: advisoryElbowPath(a, b) };
      })
      .filter(Boolean) as { key: string; d: string }[];
  }, [advisoryEdges, effectiveBoxes]);

  const freePaths = useMemo(() => {
    return freeEdges
      .map((edge) => {
        const a = effectiveBoxes.get(edge.from);
        const b = effectiveBoxes.get(edge.to);
        if (!a || !b) return null;
        const ox = bendPreview?.id === edge.id ? bendPreview.ox : (edge.midOffsetX ?? 0);
        const oy = bendPreview?.id === edge.id ? bendPreview.oy : (edge.midOffsetY ?? 0);
        return {
          key: edge.id,
          from: edge.from,
          to: edge.to,
          d: customFreeEdgePath(a, b, ox, oy),
          color: edge.color,
          strokeWidth: edge.strokeWidth,
          dashPattern: edge.dashPattern,
          midOx: ox,
          midOy: oy,
        };
      })
      .filter(Boolean) as {
      key: string;
      from: string;
      to: string;
      d: string;
      color: string;
      strokeWidth: number;
      dashPattern: string | null;
      midOx: number;
      midOy: number;
    }[];
  }, [freeEdges, effectiveBoxes, bendPreview]);

  const selectedFreeEdge = useMemo(
    () => freeEdges.find((e) => e.id === selectedFreeEdgeId) ?? null,
    [freeEdges, selectedFreeEdgeId],
  );

  useEffect(() => {
    if (!selectedFreeEdge) return;
    setFreeEdgeDraft({
      color: selectedFreeEdge.color,
      strokeWidth: selectedFreeEdge.strokeWidth,
      dash: freeDashPresetFromPattern(selectedFreeEdge.dashPattern),
    });
  }, [selectedFreeEdge]);

  const hi = builtinLineStyles.hierarchy;
  const adv = builtinLineStyles.advisory;

  const centerWithScale = useCallback(
    (s: number) => {
      const vp = viewportRef.current;
      if (!vp) return;
      const rect = vp.getBoundingClientRect();
      const pad = 28;
      const innerW = rect.width - pad * 2;
      const innerH = rect.height - pad * 2;
      setPan({
        x: pad + (innerW - width * s) / 2,
        y: pad + (innerH - height * s) / 2,
      });
    },
    [width, height],
  );

  const fitToView = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const rect = vp.getBoundingClientRect();
    const pad = 28;
    const innerW = rect.width - pad * 2;
    const innerH = rect.height - pad * 2;
    const sx = innerW / width;
    const sy = innerH / height;
    const next = Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.min(sx, sy) * 0.94));
    setScale(next);
    setPan({
      x: pad + (innerW - width * next) / 2,
      y: pad + (innerH - height * next) / 2,
    });
  }, [width, height]);

  const centerView = useCallback(() => {
    centerWithScale(scale);
  }, [centerWithScale, scale]);

  useLayoutEffect(() => {
    if (roots.length === 0) return;
    const t = window.setTimeout(() => fitToView(), 60);
    return () => window.clearTimeout(t);
  }, [roots.length, width, height, fitToView]);

  useEffect(() => {
    const onResize = () => {
      if (roots.length) fitToView();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fitToView, roots.length]);

  const startPan = useCallback((clientX: number, clientY: number) => {
    const start = { mx: clientX, my: clientY, px: panRef.current.x, py: panRef.current.y };
    function move(ev: PointerEvent) {
      setPan({
        x: start.px + (ev.clientX - start.mx),
        y: start.py + (ev.clientY - start.my),
      });
    }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }, []);

  const onCanvasPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const el = e.target as HTMLElement;
      if (el.closest("[data-org-node]")) return;
      if (el.closest("[data-org-free-edge-hit]")) return;
      if (el.closest("[data-org-bend-handle]")) return;
      e.preventDefault();
      setSelectedFreeEdgeId(null);
      startPan(e.clientX, e.clientY);
    },
    [startPan],
  );

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el || roots.length === 0) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const p = panRef.current;
      const prevS = scaleRef.current;
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= rect.height;
      const step = Math.sign(dy) * Math.min(0.22, Math.abs(dy) * 0.0018);
      const nextS = Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round((prevS - step) * 100) / 100));
      const wx = (mx - p.x) / prevS;
      const wy = (my - p.y) / prevS;
      setScale(nextS);
      setPan({ x: mx - wx * nextS, y: my - wy * nextS });
    };
    el.addEventListener("wheel", onWheelNative, { passive: false, capture: true });
    return () => el.removeEventListener("wheel", onWheelNative, true);
  }, [roots.length, width, height]);

  const onPointerMoveWhileDrag = useCallback((ev: PointerEvent) => {
    const s = dragSession.current;
    if (!s) return;
    const dx = ev.clientX - s.startClientX;
    const dy = ev.clientY - s.startClientY;
    if (Math.abs(dx) + Math.abs(dy) > 5) dragMoved.current = true;
    setNodeOffsets((prev) => ({
      ...prev,
      [s.id]: { dx: s.originDx + dx, dy: s.originDy + dy },
    }));
  }, []);

  const endDragSession = useCallback(
    (_ev: PointerEvent) => {
      window.removeEventListener("pointermove", onPointerMoveWhileDrag);
      window.removeEventListener("pointerup", endDragSession);
      window.removeEventListener("pointercancel", endDragSession);
      const s = dragSession.current;
      dragSession.current = null;
      if (s && !dragMoved.current) {
        setSelectedFreeEdgeId(null);
        onSelect(s.id);
      }
      dragMoved.current = false;
    },
    [onPointerMoveWhileDrag, onSelect],
  );

  const onNodePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, nodeId: string) => {
      if (e.button !== 0) return;
      const o = offsetsRef.current[nodeId] ?? { dx: 0, dy: 0 };
      dragSession.current = {
        id: nodeId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        originDx: o.dx,
        originDy: o.dy,
      };
      dragMoved.current = false;
      window.addEventListener("pointermove", onPointerMoveWhileDrag);
      window.addEventListener("pointerup", endDragSession);
      window.addEventListener("pointercancel", endDragSession);
    },
    [onPointerMoveWhileDrag, endDragSession],
  );

  const onBendHandlePointerDown = useCallback(
    (e: ReactPointerEvent<SVGCircleElement>, edgeId: string, ox: number, oy: number) => {
      if (e.button !== 0 || !canEditFreeEdges || !onPatchFreeEdge) return;
      e.stopPropagation();
      e.preventDefault();
      const startClientX = e.clientX;
      const startClientY = e.clientY;
      const originOx = ox;
      const originOy = oy;
      let curOx = ox;
      let curOy = oy;

      function move(ev: PointerEvent) {
        const sc = scaleRef.current;
        curOx = clampBend(originOx + (ev.clientX - startClientX) / sc);
        curOy = clampBend(originOy + (ev.clientY - startClientY) / sc);
        setBendPreview({ id: edgeId, ox: curOx, oy: curOy });
      }

      function end() {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        setBendPreview(null);
        const patch = onPatchFreeEdgeRef.current;
        const moved = Math.abs(curOx - originOx) > 0.5 || Math.abs(curOy - originOy) > 0.5;
        if (!moved || !patch) return;
        setFreeEdgeBusy(true);
        void patch(edgeId, { midOffsetX: curOx, midOffsetY: curOy }).finally(() => setFreeEdgeBusy(false));
      }

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    },
    [canEditFreeEdges, onPatchFreeEdge, clampBend],
  );

  if (roots.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--pmo-border)] bg-[var(--pmo-surface-2)] p-10 text-center text-sm text-[var(--pmo-text-muted)]">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="org-chart-root flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--pmo-border)] bg-[var(--pmo-surface)] shadow-sm">
      <OrgCanvasToolbar
        scalePercent={Math.round(scale * 100)}
        onZoomIn={() => setScale((s) => Math.min(SCALE_MAX, Math.round((s + 0.08) * 100) / 100))}
        onZoomOut={() => setScale((s) => Math.max(SCALE_MIN, Math.round((s - 0.08) * 100) / 100))}
        onFit={fitToView}
        onCenter={centerView}
        onResetZoom={() => {
          setScale(1);
          centerWithScale(1);
        }}
        onCreateNode={onCreateNode}
        onOpenList={onOpenList}
        labels={toolbarLabels}
        trailingSlot={contextToolbarSlot}
        linesToolbar={linesToolbar ?? null}
      />
      <div
        ref={viewportRef}
        className="org-canvas-viewport relative min-h-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
        onPointerDown={onCanvasPointerDown}
      >
        <div
          className="org-canvas-edges pointer-events-none absolute left-0 top-0 z-0"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: "0 0",
            width,
            height,
          }}
        >
          <svg width={width} height={height} className="absolute left-0 top-0 block text-[var(--pmo-text)]" aria-hidden>
            <defs>
              <marker
                id={mk("hier")}
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="5"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path d="M0,0 L10,5 L0,10 z" fill={hi.stroke} />
              </marker>
              <marker
                id={mk("adv")}
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="5"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path d="M0,0 L10,5 L0,10 z" fill={adv.stroke} />
              </marker>
              {freePaths.map((p) => (
                <marker
                  key={`mk-fe-${p.key}`}
                  id={mk(`fe-${p.key}`)}
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="5"
                  orient="auto"
                  markerUnits="userSpaceOnUse"
                >
                  <path d="M0,0 L10,5 L0,10 z" fill={p.color} />
                </marker>
              ))}
            </defs>
            {edges.map((edge) => {
              const a = effectiveBoxes.get(edge.from);
              const b = effectiveBoxes.get(edge.to);
              if (!a || !b) return null;
              const d = elbowPath(a.x + a.w / 2, a.y + a.h, b.x + b.w / 2, b.y);
              return (
                <path
                  key={`${edge.from}-${edge.to}`}
                  d={d}
                  fill="none"
                  stroke={hi.stroke}
                  strokeWidth={hi.strokeWidth}
                  strokeDasharray={hi.dashArray.trim() || undefined}
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  opacity={0.98}
                  markerEnd={`url(#${mk("hier")})`}
                />
              );
            })}
            {advisoryPaths.map((p) => (
              <path
                key={`adv-${p.key}`}
                d={p.d}
                fill="none"
                stroke={adv.stroke}
                strokeWidth={adv.strokeWidth}
                strokeDasharray={adv.dashArray.trim() || undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.92}
                markerEnd={`url(#${mk("adv")})`}
              />
            ))}
            {freePaths.map((p) => (
              <path
                key={`free-${p.key}`}
                d={p.d}
                fill="none"
                stroke={p.color}
                strokeWidth={p.strokeWidth}
                strokeDasharray={p.dashPattern?.trim() || undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={selectedFreeEdgeId === p.key ? 1 : 0.95}
                markerEnd={`url(#${mk(`fe-${p.key}`)})`}
              />
            ))}
          </svg>
        </div>
        <div
          className="org-canvas-nodes absolute left-0 top-0 z-10"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: "0 0",
            width,
            height,
            pointerEvents: "none",
          }}
        >
          <div className="relative" style={{ width, height, pointerEvents: "auto" }}>
            {Array.from(boxes.keys()).map((id) => {
              const b = effectiveBoxes.get(id);
              if (!b) return null;
              const node = findNode(roots, b.id);
              if (!node) return null;
              const theme = orgThemeForDepth(node.depth);
              const secondary = node.email?.trim() || node.phone?.trim() || noSecondaryContact;
              const contactFoot = [node.email, node.phone].filter(Boolean).join(" · ") || null;
              return (
                <OrgNodeCard
                  key={b.id}
                  id={b.id}
                  name={node.name}
                  role={node.role}
                  category={node.category}
                  depth={node.depth}
                  photoUrl={node.photoUrl}
                  contactLine={contactFoot}
                  active={node.active}
                  selected={selectedId === b.id}
                  inactiveLabel={inactiveLabel}
                  theme={theme}
                  bandLabel={bandLabelForDepth(node.depth)}
                  secondaryLine={secondary}
                  consultantBadge={node.linkToId ? consultantBadgeLabel : null}
                  style={{ left: b.x, top: b.y, width: ORG_NODE_W, height: ORG_NODE_H }}
                  onSelect={onSelect}
                  onNodePointerDown={onNodePointerDown}
                  onNodeEdit={onNodeEdit}
                />
              );
            })}
          </div>
        </div>
        <div
          className="org-canvas-edge-ui pointer-events-none absolute left-0 top-0 z-[32]"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: "0 0",
            width,
            height,
          }}
        >
          <svg width={width} height={height} className="absolute left-0 top-0 block" aria-hidden>
            {freePaths.map((p) => {
              const hitW = Math.max(22, p.strokeWidth * 6);
              return (
                <path
                  key={`hit-${p.key}`}
                  data-org-free-edge-hit="1"
                  d={p.d}
                  fill="none"
                  stroke="rgba(15,23,42,0.04)"
                  strokeWidth={hitW}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pointerEvents="stroke"
                  className="cursor-pointer"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelectedFreeEdgeId(p.key);
                  }}
                />
              );
            })}
            {selectedFreeEdgeId && freeEdgeBarLabels && selectedFreeEdge && canEditFreeEdges && onPatchFreeEdge
              ? (() => {
                  const p = freePaths.find((x) => x.key === selectedFreeEdgeId);
                  const bFrom = effectiveBoxes.get(selectedFreeEdge.from);
                  const bTo = effectiveBoxes.get(selectedFreeEdge.to);
                  if (!p || !bFrom || !bTo) return null;
                  const h = customFreeEdgeBendHandle(bFrom, bTo, p.midOx, p.midOy);
                  return (
                    <circle
                      key="bend"
                      data-org-bend-handle="1"
                      cx={h.x}
                      cy={h.y}
                      r={11}
                      fill="#0ea5e9"
                      stroke="#fff"
                      strokeWidth={2}
                      className="shadow-md hover:fill-sky-400"
                      style={{ cursor: "move", pointerEvents: "all" }}
                      onPointerDown={(e) => onBendHandlePointerDown(e, selectedFreeEdge.id, p.midOx, p.midOy)}
                    />
                  );
                })()
              : null}
          </svg>
        </div>
        {selectedFreeEdgeId && freeEdgeBarLabels ? (
          <div className="pointer-events-auto absolute bottom-3 left-1/2 z-[42] w-[min(96vw,22rem)] -translate-x-1/2 rounded-lg border border-[var(--pmo-border)] bg-[var(--pmo-surface)] p-2 shadow-xl">
            <p className="text-[10px] font-bold text-[var(--pmo-text)]">{freeEdgeBarLabels.title}</p>
            {canEditFreeEdges && onPatchFreeEdge ? (
              <p className="mt-1 text-[9px] leading-snug text-[var(--pmo-text-muted)]">{freeEdgeBarLabels.bendDragHint}</p>
            ) : (
              <p className="mt-1 text-[9px] leading-snug text-amber-800 dark:text-amber-200">{freeEdgeBarLabels.deleteNeedsRole}</p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px]">
              <label className="inline-flex items-center gap-1 font-semibold text-[var(--pmo-text-muted)]">
                <span>{freeEdgeBarLabels.color}</span>
                <input
                  type="color"
                  value={freeEdgeDraft.color}
                  disabled={!canEditFreeEdges || freeEdgeBusy}
                  onChange={(e) => setFreeEdgeDraft((d) => ({ ...d, color: e.target.value }))}
                  className="h-6 w-7 rounded border disabled:opacity-50"
                />
              </label>
              <label className="inline-flex items-center gap-1 font-semibold text-[var(--pmo-text-muted)]">
                <span>{freeEdgeBarLabels.width}</span>
                <input
                  type="number"
                  min={0.5}
                  max={8}
                  step={0.25}
                  value={freeEdgeDraft.strokeWidth}
                  disabled={!canEditFreeEdges || freeEdgeBusy}
                  onChange={(e) => setFreeEdgeDraft((d) => ({ ...d, strokeWidth: Number(e.target.value) || 2 }))}
                  className="w-12 rounded border border-[var(--pmo-border)] bg-[var(--pmo-surface-2)] px-1 py-0.5 disabled:opacity-50"
                />
              </label>
              <select
                value={freeEdgeDraft.dash}
                disabled={!canEditFreeEdges || freeEdgeBusy}
                onChange={(e) => setFreeEdgeDraft((d) => ({ ...d, dash: e.target.value as FreeEdgeDashPreset }))}
                className="rounded border border-[var(--pmo-border)] bg-[var(--pmo-surface-2)] px-1 py-0.5 disabled:opacity-50"
              >
                <option value="solid">{freeEdgeBarLabels.dashSolid}</option>
                <option value="dashed">{freeEdgeBarLabels.dashDashed}</option>
                <option value="dotted">{freeEdgeBarLabels.dashDotted}</option>
              </select>
              {canEditFreeEdges && onPatchFreeEdge ? (
                <button
                  type="button"
                  disabled={freeEdgeBusy}
                  className="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                  onClick={() => {
                    if (!selectedFreeEdgeId) return;
                    setFreeEdgeBusy(true);
                    void onPatchFreeEdge(selectedFreeEdgeId, {
                      color: freeEdgeDraft.color,
                      strokeWidth: freeEdgeDraft.strokeWidth,
                      dashPattern: freeDashPatternFromPreset(freeEdgeDraft.dash),
                    }).finally(() => setFreeEdgeBusy(false));
                  }}
                >
                  {freeEdgeBarLabels.apply}
                </button>
              ) : null}
              {canEditFreeEdges && onDeleteFreeEdge ? (
                <button
                  type="button"
                  disabled={freeEdgeBusy}
                  className="rounded-md border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-800 disabled:opacity-50 dark:border-red-900 dark:text-red-200"
                  onClick={() => {
                    if (!selectedFreeEdgeId) return;
                    setFreeEdgeBusy(true);
                    void onDeleteFreeEdge(selectedFreeEdgeId)
                      .then(() => setSelectedFreeEdgeId(null))
                      .finally(() => setFreeEdgeBusy(false));
                  }}
                >
                  {freeEdgeBarLabels.delete}
                </button>
              ) : null}
              <button
                type="button"
                className="ml-auto rounded border border-[var(--pmo-border)] px-2 py-0.5 text-[10px] font-semibold hover:bg-[var(--pmo-row-hover)]"
                onClick={() => setSelectedFreeEdgeId(null)}
              >
                {freeEdgeBarLabels.close}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { ORG_NODE_W, ORG_NODE_H };
