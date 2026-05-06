"use client";

import { useMemo } from "react";
import type { SuiteTaskRow } from "../../lib/api";
import { orderProjectTasksForDisplay } from "./planning-task-order";

type TreeNode = { id: string; label: string; children: TreeNode[] };

function buildTree(tasks: SuiteTaskRow[]): TreeNode[] {
  const byParent = new Map<string | null, SuiteTaskRow[]>();
  for (const t of tasks) {
    const p = t.parentTaskId ?? null;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p)!.push(t);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => {
      const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (so !== 0) return so;
      return String(a.wbsCode ?? "").localeCompare(String(b.wbsCode ?? ""));
    });
  }
  function nest(pid: string | null): TreeNode[] {
    return (byParent.get(pid) ?? []).map((t) => ({
      id: t.id,
      label: t.wbsCode ? `${t.wbsCode} · ${t.name}` : t.name,
      children: nest(t.id),
    }));
  }
  return nest(null);
}

function Branch({ node, depth }: { node: TreeNode; depth: number }) {
  const isRoot = depth === 0;
  return (
    <li className="relative">
      <div
        className={`inline-flex max-w-full rounded-lg border px-3 py-2 text-sm shadow-sm ${
          isRoot
            ? "border-slate-300 bg-slate-900 font-semibold text-white dark:border-slate-600 dark:bg-slate-100 dark:text-slate-900"
            : "border-slate-200 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        }`}
      >
        <span className="line-clamp-2">{node.label}</span>
      </div>
      {node.children.length > 0 ? (
        <ul className="ml-4 mt-3 space-y-3 border-l-2 border-slate-200 pl-4 dark:border-slate-600">
          {node.children.map((c) => (
            <Branch key={c.id} node={c} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function PlanningMindMapView({ tasks, projectName }: { tasks: SuiteTaskRow[]; projectName: string }) {
  const roots = useMemo(() => buildTree(tasks), [tasks]);
  const count = useMemo(() => orderProjectTasksForDisplay(tasks).length, [tasks]);

  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50/90 to-white p-4 shadow-inner dark:border-slate-700 dark:from-slate-900/80 dark:to-slate-950">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Mapa jerárquico WBS ({count} tareas). Vista compacta del desglose del proyecto.
      </p>
      <div className="mt-4 overflow-x-auto">
        <ul className="min-w-[280px] space-y-4">
          <li>
            <div className="mb-2 inline-flex rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-100">
              {projectName}
            </div>
            <ul className="mt-2 space-y-3 border-l-2 border-indigo-200 pl-4 dark:border-indigo-900">
              {roots.map((r) => (
                <Branch key={r.id} node={r} depth={0} />
              ))}
            </ul>
          </li>
        </ul>
      </div>
    </div>
  );
}
