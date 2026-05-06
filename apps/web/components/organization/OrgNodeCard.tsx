"use client";

import type { OrgDepthTheme } from "./org-node-theme";

export function OrgNodeCard({
  id,
  name,
  role,
  category,
  depth: _depth,
  photoUrl,
  contactLine,
  active,
  selected,
  inactiveLabel,
  theme,
  bandLabel,
  secondaryLine,
  consultantBadge,
  style,
  onSelect,
  onNodePointerDown,
  onNodeEdit,
}: {
  id: string;
  name: string;
  role: string;
  category?: string | null;
  depth: number;
  photoUrl?: string | null;
  /** Pie del nodo: correo / teléfono resumido */
  contactLine?: string | null;
  active: boolean;
  selected: boolean;
  inactiveLabel: string;
  theme: OrgDepthTheme;
  /** Texto de la banda (nivel / categoría visual) */
  bandLabel: string;
  /** Línea bajo cargo (p. ej. correo o «Sin contacto») */
  secondaryLine: string;
  /** Texto corto si el nodo tiene enlace matricial / consultoría. */
  consultantBadge?: string | null;
  style: React.CSSProperties;
  onSelect: (id: string) => void;
  onNodePointerDown?: (e: React.PointerEvent<HTMLDivElement>, id: string) => void;
  /** Doble clic o Enter: abrir ficha de edición (clic simple solo selecciona). */
  onNodeEdit?: (id: string) => void;
}) {
  const photo = photoUrl?.trim();
  const initials = (name || "?").slice(0, 2).toUpperCase();

  return (
    <div
      role="group"
      tabIndex={0}
      aria-label={name}
      data-org-node="1"
      data-org-node-id={id}
      onKeyDown={(e) => {
        if (e.key === " ") {
          e.preventDefault();
          onSelect(id);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          onNodeEdit?.(id);
        }
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onNodePointerDown?.(e, id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onNodeEdit?.(id);
      }}
      className={`org-node-card absolute z-10 flex cursor-grab select-none flex-col overflow-hidden rounded-xl border text-left shadow-md outline-none ring-1 ring-black/5 transition hover:brightness-[1.02] active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-sky-500 dark:ring-white/10 ${
        selected ? "org-node-card--selected ring-2 ring-amber-500/90" : ""
      }`}
      style={{
        ...style,
        backgroundColor: theme.body,
        borderColor: selected ? "#d97706" : theme.border,
        boxShadow: selected ? "0 12px 28px rgba(15, 23, 42, 0.18)" : "0 2px 8px rgba(15, 23, 42, 0.06)",
      }}
    >
      <div
        className="flex h-8 shrink-0 items-center justify-between gap-1 px-2.5 text-[10px] font-bold uppercase tracking-[0.08em]"
        style={{ backgroundColor: theme.band, color: theme.bandText }}
      >
        <span className="truncate">{bandLabel}</span>
        {consultantBadge?.trim() ? (
          <span
            className="shrink-0 rounded border border-indigo-400/80 bg-indigo-100 px-1 py-0 text-[7px] font-bold tracking-wide text-indigo-950 dark:border-indigo-500 dark:bg-indigo-950 dark:text-indigo-100"
            title={consultantBadge}
          >
            {consultantBadge}
          </span>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 gap-3 p-2.5">
        <div
          className="relative h-[56px] w-[56px] shrink-0 overflow-hidden rounded-xl border-2 bg-cover bg-center shadow-inner"
          style={{
            borderColor: theme.photoBorder,
            backgroundColor: theme.photoBg,
            backgroundImage: photo ? `url(${photo})` : undefined,
          }}
        >
          {!photo && (
            <span className="flex h-full w-full items-center justify-center text-base font-bold tracking-tight" style={{ color: theme.muted }}>
              {initials.slice(0, 1)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold leading-tight" style={{ color: theme.name }} title={name}>
            {name}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-snug" style={{ color: theme.role }} title={role}>
            {role}
          </p>
          {category?.trim() ? (
            <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-wide text-sky-800 dark:text-sky-200" title={category.trim()}>
              {category.trim()}
            </p>
          ) : null}
          <p className="mt-1 truncate text-[10px]" style={{ color: theme.muted }} title={secondaryLine}>
            {secondaryLine}
          </p>
        </div>
      </div>
      {contactLine?.trim() ? (
        <div
          className="truncate border-t px-2.5 py-1 text-[9px] font-medium"
          style={{ borderColor: theme.border, color: theme.muted, backgroundColor: "rgba(15,23,42,0.04)" }}
          title={contactLine}
        >
          {contactLine}
        </div>
      ) : null}
      {!active && (
        <div className="border-t border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[8px] font-bold uppercase text-amber-900">{inactiveLabel}</div>
      )}
    </div>
  );
}
