"use client";

import { useRef } from "react";
import type { PlanningColumnId } from "../../lib/suite-planning-persisted-view";

export function ResizableThSuite({
  colId,
  label,
  width,
  minW,
  maxW,
  align = "left",
  className = "",
  onWidthChange,
}: {
  colId: PlanningColumnId;
  label: React.ReactNode;
  width: number;
  minW: number;
  maxW: number;
  align?: "left" | "center" | "right";
  className?: string;
  onWidthChange: (id: PlanningColumnId, w: number) => void;
}) {
  const startRef = useRef({ x: 0, w: 0 });
  const alignCls = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";

  return (
    <th
      className={`relative select-none border-b border-slate-200 bg-slate-50 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-raised)] dark:text-[var(--suite-text-muted)] ${alignCls} ${className}`}
      style={{ width, minWidth: width, maxWidth: width }}
    >
      <span className="block truncate px-1 pr-2">{label}</span>
      <div
        role="separator"
        aria-orientation="vertical"
        className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize hover:bg-[var(--suite-accent-soft)] active:bg-[var(--suite-accent)]/30"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          startRef.current = { x: e.clientX, w: width };
          function onMove(ev: MouseEvent) {
            const dx = ev.clientX - startRef.current.x;
            const nw = Math.min(maxW, Math.max(minW, Math.round(startRef.current.w + dx)));
            onWidthChange(colId, nw);
          }
          function onUp() {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
          }
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        }}
      />
    </th>
  );
}
