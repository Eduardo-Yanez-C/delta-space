"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../lib/auth-context";
import { ORGANIGRAMA_LABELS, formatOrgBandLevel } from "../../lib/organigrama-labels";
import { orgApiDelete, orgApiGet, orgApiSend } from "../../lib/organization-api";
import { DEFAULT_ORG_BUILTIN_LINE_STYLES, loadOrgBuiltinLineStyles, type OrgBuiltinLineStyles } from "../../lib/org-chart-line-styles";
import { OrgLinesModal, type OrgCustomEdgeDto, type OrgLinesLabels } from "./OrgChartConnectorPanel";
import { OrgChartDiagram, withOrgDepth, type OrgDiagramNode } from "./OrgChartDiagram";
import { OrgNodeDetailDrawer, type OrgDrawerNode } from "./OrgNodeDetailDrawer";
import { useSuiteAgentRuntime } from "../suite-agent/SuiteAgentRuntimeProvider";

type Node = {
  id: string;
  name: string;
  role: string;
  category?: string | null;
  parentId?: string | null;
  linkToId?: string | null;
  photoUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  order: number;
  active: boolean;
};

type OrgTreeNode = Node & { children: OrgTreeNode[] };

function descendantIds(rootId: string, all: Node[]): string[] {
  const out: string[] = [];
  function walk(id: string) {
    for (const n of all) {
      if (n.parentId === id) {
        out.push(n.id);
        walk(n.id);
      }
    }
  }
  walk(rootId);
  return out;
}

function buildTree(nodes: Node[]): OrgTreeNode[] {
  const map = new Map<string, OrgTreeNode>();
  for (const n of nodes) {
    map.set(n.id, { ...n, children: [] });
  }
  const roots: OrgTreeNode[] = [];
  for (const n of Array.from(map.values())) {
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId)!.children.push(n);
    } else {
      roots.push(n);
    }
  }
  roots.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const sortRec = (list: OrgTreeNode[]) => {
    list.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    list.forEach((c) => sortRec(c.children));
  };
  sortRec(roots);
  return roots;
}

function depthOfNodeInTree(id: string, tree: OrgTreeNode[], depth = 0): number {
  for (const n of tree) {
    if (n.id === id) return depth;
    const d = depthOfNodeInTree(id, n.children, depth + 1);
    if (d >= 0) return d;
  }
  return -1;
}

function TreeAdminList({
  nodes,
  inactiveLabel,
  consultantLinkLabel,
  depth = 0,
}: {
  nodes: OrgTreeNode[];
  inactiveLabel: string;
  consultantLinkLabel: string;
  depth?: number;
}) {
  return (
    <ul className={depth ? "ml-3 mt-2 border-l border-slate-200 pl-3 dark:border-slate-600" : "space-y-1"}>
      {nodes.map((n) => (
        <li key={n.id} className="text-sm">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-600 dark:bg-slate-900">
            <p className="font-semibold text-slate-900 dark:text-slate-100">{n.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{n.role}</p>
            {(n.email || n.phone) && (
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                {n.email}
                {n.email && n.phone ? " · " : ""}
                {n.phone}
              </p>
            )}
            {!n.active && <span className="mt-1 inline-block text-xs text-amber-700 dark:text-amber-300">{inactiveLabel}</span>}
            {n.linkToId ? (
              <p className="mt-1 text-[10px] font-semibold text-indigo-800 dark:text-indigo-200">↔ {consultantLinkLabel}</p>
            ) : null}
          </div>
          {n.children.length > 0 && (
            <TreeAdminList nodes={n.children} inactiveLabel={inactiveLabel} consultantLinkLabel={consultantLinkLabel} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

type Tab = "diagram" | "list" | "new";

function userCanEditOrganigrama(roles: string[] | undefined): boolean {
  if (!roles?.length) return false;
  return roles.includes("ADMIN_DEV") || roles.includes("ADMIN");
}

export function OrganigramaSuitePage() {
  const { mergeRuntime } = useSuiteAgentRuntime();
  const o = ORGANIGRAMA_LABELS;
  const { user } = useAuth();
  const canWrite = userCanEditOrganigrama(user?.roles);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [customEdges, setCustomEdges] = useState<OrgCustomEdgeDto[]>([]);
  const [lineStyles, setLineStyles] = useState<OrgBuiltinLineStyles>(DEFAULT_ORG_BUILTIN_LINE_STYLES);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("diagram");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [linesModalOpen, setLinesModalOpen] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const [presetParentForNew, setPresetParentForNew] = useState<string | null>(null);

  const reloadAll = useCallback(() => {
    return Promise.all([
      orgApiGet<Node[]>("/organization/nodes"),
      orgApiGet<OrgCustomEdgeDto[]>("/organization/custom-edges"),
    ]).then(([n, e]) => {
      setNodes(n);
      setCustomEdges(e);
    });
  }, []);

  useEffect(() => {
    setLineStyles(loadOrgBuiltinLineStyles());
  }, []);

  useEffect(() => {
    reloadAll().catch(() => setError("No se pudo cargar el organigrama."));
  }, [reloadAll]);

  useEffect(() => {
    const active = nodes.filter((n) => n.active).length;
    const tabLabel = tab === "diagram" ? "Diagrama" : tab === "list" ? "Lista" : "Alta";
    mergeRuntime({
      summary: [
        `Organigrama: ${nodes.length} nodos (${active} activos), ${customEdges.length} conexiones personalizadas.`,
        `Pestaña: ${tabLabel}.`,
        selectedId ? `Nodo seleccionado: ${nodes.find((n) => n.id === selectedId)?.name ?? selectedId}.` : "Sin nodo seleccionado.",
        canWrite ? "Usuario con permiso de edición." : "Solo lectura.",
      ].join("\n"),
    });
  }, [nodes, customEdges.length, tab, selectedId, canWrite, mergeRuntime]);

  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const rootsDiagram = useMemo(() => withOrgDepth(tree) as unknown as OrgDiagramNode[], [tree]);

  const selected = useMemo(() => nodes.find((n) => n.id === selectedId) ?? null, [nodes, selectedId]);
  const parentNode = useMemo(
    () => (selected?.parentId ? nodes.find((n) => n.id === selected.parentId) ?? null : null),
    [nodes, selected],
  );
  const childNodes = useMemo(
    () =>
      selected
        ? nodes.filter((n) => n.parentId === selected.id).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
        : [],
    [nodes, selected],
  );
  const parentSelectOptions = useMemo(() => {
    if (!selected) return nodes;
    const blocked = new Set([selected.id, ...descendantIds(selected.id, nodes)]);
    return nodes.filter((n) => !blocked.has(n.id));
  }, [nodes, selected]);

  const linkTargetNode = useMemo(
    () => (selected?.linkToId ? nodes.find((n) => n.id === selected.linkToId) ?? null : null),
    [nodes, selected],
  );

  const linkTargetOptions = useMemo(() => {
    if (!selected) return nodes;
    return nodes.filter((n) => n.id !== selected.id);
  }, [nodes, selected]);

  const advisoryEdges = useMemo(
    () =>
      nodes
        .filter((n) => n.linkToId)
        .map((n) => ({
          from: n.linkToId as string,
          to: n.id,
        })),
    [nodes],
  );

  const freeEdgesForDiagram = useMemo(
    () =>
      customEdges.map((e) => ({
        id: e.id,
        from: e.fromNodeId,
        to: e.toNodeId,
        color: e.color,
        strokeWidth: e.strokeWidth,
        dashPattern: e.dashPattern,
        midOffsetX: e.midOffsetX ?? 0,
        midOffsetY: e.midOffsetY ?? 0,
      })),
    [customEdges],
  );

  const addCustomEdge = useCallback(
    async (payload: { fromNodeId: string; toNodeId: string; color: string; strokeWidth: number; dashPattern: string | null }) => {
      setError(null);
      try {
        await orgApiSend("/organization/custom-edges", "POST", payload);
        await reloadAll();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    },
    [reloadAll],
  );

  const deleteCustomEdge = useCallback(
    async (id: string) => {
      setError(null);
      try {
        await orgApiDelete(`/organization/custom-edges/${id}`);
        await reloadAll();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    },
    [reloadAll],
  );

  const patchCustomEdge = useCallback(
    async (id: string, patch: { color?: string; strokeWidth?: number; dashPattern?: string | null; midOffsetX?: number; midOffsetY?: number }) => {
      setError(null);
      try {
        await orgApiSend(`/organization/custom-edges/${id}`, "PATCH", patch);
        await reloadAll();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    },
    [reloadAll],
  );

  const linesFormLabels: OrgLinesLabels = useMemo(
    () => ({
      hierarchyTitle: o.connectorHierarchyTitle!,
      advisoryTitle: o.connectorAdvisoryTitle!,
      color: o.connectorColor!,
      width: o.connectorWidth!,
      dashStyle: o.connectorDashStyle!,
      dashSolid: o.connectorDashSolid!,
      dashDashed: o.connectorDashDashed!,
      dashDotted: o.connectorDashDotted!,
      freeSection: o.connectorFreeSection!,
      from: o.connectorFrom!,
      to: o.connectorTo!,
      add: o.connectorAdd!,
      delete: o.connectorDelete!,
      emptyEdges: o.connectorEmptyEdges!,
      readOnly: o.connectorReadOnly!,
    }),
    [o],
  );

  async function saveNodeDetailPatch(payload: {
    name: string;
    role: string;
    category: string | null;
    email: string | null;
    phone: string | null;
    order: number;
    photoUrl: string | null;
    parentId: string | null;
    linkToId: string | null;
  }) {
    if (!selected) return;
    setDetailSaving(true);
    setError(null);
    try {
      await orgApiSend(`/organization/nodes/${selected.id}`, "PATCH", payload);
      await reloadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setDetailSaving(false);
    }
  }

  async function createSubordinate(name: string, role: string) {
    if (!selected) return;
    setError(null);
    try {
      const created = await orgApiSend<{ id: string }>("/organization/nodes", "POST", {
        name,
        role,
        parentId: selected.id,
        order: 0,
      });
      await reloadAll();
      if (created?.id) setSelectedId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      name: String(fd.get("name") || ""),
      role: String(fd.get("role") || ""),
      category: String(fd.get("category") || "").trim() || undefined,
      parentId: String(fd.get("parentId") || "") || undefined,
      linkToId: String(fd.get("linkToId") || "").trim() || undefined,
      email: String(fd.get("email") || "") || undefined,
      phone: String(fd.get("phone") || "") || undefined,
      order: Number(fd.get("order") || 0),
      photoUrl: String(fd.get("photoUrl") || "").trim() || undefined,
    };
    try {
      await orgApiSend("/organization/nodes", "POST", body);
      e.currentTarget.reset();
      setPresetParentForNew(null);
      await reloadAll();
      setTab("diagram");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className={`bg-[var(--pmo-bg)] w-full min-w-0 ${
        tab === "diagram" ? "flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-3" : "min-h-[calc(100vh-4rem)] p-6 lg:p-8"
      }`}
    >
      <div
        className={`mx-auto w-full min-w-0 max-w-[1600px] ${tab === "diagram" ? "flex min-h-0 flex-1 flex-col overflow-hidden" : ""}`}
      >
        <header
          className={`border-b border-[var(--pmo-border)] ${tab === "diagram" ? "mb-2 shrink-0 pb-2" : "mb-6 shrink-0 pb-4"} flex flex-wrap items-center justify-between gap-2`}
        >
          <div className="min-w-0 flex-1">
            <h1 className={`font-bold tracking-tight text-[var(--pmo-text)] ${tab === "diagram" ? "text-lg sm:text-xl" : "text-2xl"}`}>{o.pageTitle}</h1>
            {tab !== "diagram" ? (
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--pmo-text-muted)]">{o.pageSubtitle}</p>
            ) : (
              <p className="sr-only">{o.pageSubtitle}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Link
              href="/"
              className={`rounded-lg border border-[var(--pmo-border)] bg-[var(--pmo-surface)] font-medium text-[var(--pmo-text)] hover:bg-[var(--pmo-surface-2)] ${
                tab === "diagram" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"
              }`}
            >
              {o.backHome}
            </Link>
          </div>
        </header>

        {error && (
          <p className={`rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/25 dark:text-red-200 ${tab === "diagram" ? "mb-2 shrink-0" : "mb-4"}`}>
            {error}
          </p>
        )}

        <div
          className={`flex flex-wrap gap-1 rounded-xl border border-[var(--pmo-border)] bg-[var(--pmo-surface)] p-0.5 shadow-sm ${tab === "diagram" ? "mb-2 shrink-0" : "mb-4 shrink-0"}`}
        >
          {(
            [
              ["diagram", o.tabDiagram!],
              ["list", o.tabListAdmin!],
              ["new", o.tabNew!],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`rounded-lg font-semibold transition ${
                tab === "diagram" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
              } ${
                tab === k ? "bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900" : "text-[var(--pmo-text-muted)] hover:bg-[var(--pmo-surface-2)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "diagram" && (
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <section className="pmo-planning-shell flex min-h-0 flex-1 flex-col overflow-hidden p-1.5 sm:p-2">
              <details className="group mb-1.5 shrink-0 rounded-lg border border-[var(--pmo-border)] bg-[var(--pmo-surface-2)] px-2 py-1 text-[10px] text-[var(--pmo-text-muted)] open:bg-[var(--pmo-surface)]">
                <summary className="cursor-pointer list-none font-semibold text-[var(--pmo-text)] marker:hidden [&::-webkit-details-marker]:hidden">
                  <span className="text-[11px]">{o.diagramMetaToggle}</span>
                  <span className="ml-1 text-[10px] font-normal text-[var(--pmo-text-muted)]">({o.diagramMetaToggleHint})</span>
                </summary>
                <p className="mt-2 border-t border-[var(--pmo-border)] pt-2 text-[10px] leading-relaxed">{o.diagramSectionHint}</p>
                <p className="mt-1.5 text-[10px] leading-relaxed">{o.diagramPanHint}</p>
              </details>
              <div className="flex min-h-0 flex-1 flex-col">
                <OrgChartDiagram
                  roots={rootsDiagram}
                  selectedId={selectedId}
                  onSelect={(id) => {
                    setSelectedId(id);
                    setDetailDrawerOpen(false);
                  }}
                  onNodeEdit={(id) => {
                    setSelectedId(id);
                    setDetailDrawerOpen(true);
                  }}
                  emptyLabel={o.emptyTree!}
                  inactiveLabel={o.inactive!}
                  advisoryEdges={advisoryEdges}
                  consultantBadgeLabel={o.consultantBadge!}
                  builtinLineStyles={lineStyles}
                  freeEdges={freeEdgesForDiagram}
                  canEditFreeEdges={canWrite}
                  onPatchFreeEdge={canWrite ? patchCustomEdge : undefined}
                  onDeleteFreeEdge={canWrite ? deleteCustomEdge : undefined}
                  freeEdgeBarLabels={{
                    title: o.freeEdgeBarTitle!,
                    apply: o.freeEdgeApply!,
                    close: o.freeEdgeBarClose!,
                    delete: o.freeEdgeDeleteLink!,
                    dashSolid: o.connectorDashSolid!,
                    dashDashed: o.connectorDashDashed!,
                    dashDotted: o.connectorDashDotted!,
                    color: o.connectorColor!,
                    width: o.connectorWidth!,
                    dashStyle: o.connectorDashStyle!,
                    bendDragHint: o.freeEdgeBendDragHint!,
                    deleteNeedsRole: o.freeEdgeDeleteNeedsRole!,
                  }}
                  linesToolbar={{
                    label: o.toolbarLinesButton!,
                    title: o.toolbarLinesTitle!,
                    onClick: () => setLinesModalOpen(true),
                  }}
                  onCreateNode={() => {
                    setPresetParentForNew(selectedId);
                    setTab("new");
                  }}
                  onOpenList={() => setTab("list")}
                  bandLabelForDepth={(d) => formatOrgBandLevel(o.orgBandLevel!, String(d + 1))}
                  noSecondaryContact={o.noSecondaryContact!}
                  contextToolbarSlot={
                    selectedId ? (
                      <>
                        <button
                          type="button"
                          className="pmo-btn-secondary px-2 py-1 text-[10px] font-bold"
                          onClick={() => {
                            setPresetParentForNew(selectedId);
                            setTab("new");
                          }}
                        >
                          {o.toolbarSubUnderSelected}
                        </button>
                        <button
                          type="button"
                          className="pmo-btn-ghost px-2 py-1 text-[10px] font-semibold"
                          onClick={() => {
                            setSelectedId(null);
                            setDetailDrawerOpen(false);
                          }}
                        >
                          {o.toolbarDeselect}
                        </button>
                      </>
                    ) : null
                  }
                  toolbarLabels={{
                    zoomIn: o.toolbarZoomIn!,
                    zoomOut: o.toolbarZoomOut!,
                    fit: o.toolbarFit!,
                    center: o.toolbarCenter!,
                    reset: o.toolbarReset!,
                    create: o.toolbarCreate!,
                    listView: o.toolbarList!,
                    helpTitle: o.toolbarHelpTitle!,
                    helpBody: o.toolbarHelpBody!,
                  }}
                />
              </div>
            </section>
            <OrgLinesModal
              open={linesModalOpen}
              onClose={() => setLinesModalOpen(false)}
              title={o.linesModalTitle!}
              closeLabel={o.drawerClose!}
              nodes={nodes.map((n) => ({ id: n.id, name: n.name, role: n.role }))}
              freeEdges={customEdges}
              builtinStyles={lineStyles}
              onBuiltinStylesChange={setLineStyles}
              canEdit={canWrite}
              onAddEdge={addCustomEdge}
              onDeleteEdge={deleteCustomEdge}
              labels={linesFormLabels}
            />
            <OrgNodeDetailDrawer
              open={Boolean(selected && tab === "diagram" && detailDrawerOpen)}
              node={selected as OrgDrawerNode | null}
              parentNode={parentNode as OrgDrawerNode | null}
              linkTargetNode={linkTargetNode as OrgDrawerNode | null}
              childNodes={childNodes as OrgDrawerNode[]}
              parentOptions={parentSelectOptions as OrgDrawerNode[]}
              linkTargetOptions={linkTargetOptions as OrgDrawerNode[]}
              hierarchyLevel={selected ? Math.max(0, depthOfNodeInTree(selected.id, tree)) : 0}
              labels={o}
              saving={detailSaving}
              onClose={() => setDetailDrawerOpen(false)}
              onSave={saveNodeDetailPatch}
              onSelectNode={(id) => {
                setSelectedId(id);
                setDetailDrawerOpen(true);
              }}
              onCreateSubordinate={createSubordinate}
            />
          </div>
        )}

        {tab === "list" && (
          <section className="pmo-planning-shell p-5">
            <h2 className="text-sm font-semibold text-[var(--pmo-text)]">{o.listAdminTitle}</h2>
            <p className="mt-1 text-xs text-[var(--pmo-text-muted)]">{o.listAdminHint}</p>
            <div className="mt-4">
              {tree.length === 0 ? (
                <p className="text-sm text-[var(--pmo-text-muted)]">{o.emptyTree}</p>
              ) : (
                <TreeAdminList nodes={tree} inactiveLabel={o.inactive!} consultantLinkLabel={o.listHasConsultantLink!} />
              )}
            </div>
          </section>
        )}

        {tab === "new" && (
          <section className="pmo-planning-shell max-w-xl p-5">
            <h2 className="text-sm font-semibold text-[var(--pmo-text)]">{o.newNodeTitle}</h2>
            <form key={`new-${presetParentForNew ?? "root"}`} onSubmit={onCreate} className="mt-4 space-y-3">
              <input
                name="name"
                required
                placeholder={o.placeholderName}
                className="input-field w-full text-sm"
              />
              <input
                name="role"
                required
                placeholder={o.placeholderRole}
                className="input-field w-full text-sm"
              />
              <input name="category" placeholder={o.placeholderCategory} className="input-field w-full text-sm" />
              <select name="parentId" className="input-field w-full text-sm" defaultValue={presetParentForNew ?? ""}>
                <option value="">{o.parentRoot}</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {o.parentUnder}: {n.name}
                  </option>
                ))}
              </select>
              <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">{o.newFormConsultantLink}</label>
              <select name="linkToId" className="input-field w-full text-sm" defaultValue="">
                <option value="">{o.consultantLinkNone}</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} — {n.role}
                  </option>
                ))}
              </select>
              <input name="email" type="email" placeholder={o.placeholderEmail} className="input-field w-full text-sm" />
              <input name="phone" placeholder={o.placeholderPhone} className="input-field w-full text-sm" />
              <input name="photoUrl" type="url" placeholder={o.placeholderPhotoUrl} className="input-field w-full text-sm" />
              <input name="order" type="number" defaultValue={0} className="input-field w-full text-sm" />
              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-sm font-semibold disabled:opacity-50">
                {o.createNode}
              </button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
