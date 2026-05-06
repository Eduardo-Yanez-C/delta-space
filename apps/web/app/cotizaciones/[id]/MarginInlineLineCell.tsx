"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { MarginInlineField } from "./useMarginInlineLineEdit";

type Props = {
  lineId: string;
  field: MarginInlineField;
  active: boolean;
  /** Contenido mostrado en modo lectura (ej. cantidad o $ formateado) */
  displayContent: ReactNode;
  draft: string;
  error: string | null;
  saving: boolean;
  disabled: boolean;
  onActivate: () => void;
  onDraftChange: (value: string) => void;
  onBlur: () => void;
  onEnter: () => void;
  onEscape: () => void;
  /** Ancho del input en edición */
  inputClassName?: string;
  /** Solo en edición; opcional (ej. costo vacío) */
  placeholder?: string;
};

const FIELD_ARIA: Record<MarginInlineField, string> = {
  quantity: "Editar cantidad",
  unitPrice: "Editar precio unitario",
  unitCost: "Editar costo unitario",
};

export function MarginInlineLineCell({
  lineId,
  field,
  active,
  displayContent,
  draft,
  error,
  saving,
  disabled,
  onActivate,
  onDraftChange,
  onBlur,
  onEnter,
  onEscape,
  inputClassName = "w-16",
  placeholder,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const errId = `inline-err-${lineId}-${field}`;

  useEffect(() => {
    if (active && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current.value.length > 0) {
        inputRef.current.select();
      }
    }
  }, [active, lineId, field]);

  if (!active) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onActivate()}
          className="tabular-nums text-right text-slate-900 hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60 dark:text-slate-100"
          aria-label={FIELD_ARIA[field]}
        >
          {displayContent}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errId : undefined}
        disabled={saving}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => onDraftChange(e.target.value)}
        onBlur={() => onBlur()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onEscape();
          }
        }}
        className={`${inputClassName} rounded border bg-white py-0.5 pl-1 pr-1 text-right text-sm tabular-nums dark:bg-slate-900 ${
          error
            ? "border-red-500 ring-1 ring-red-500/30"
            : "border-amber-400/80 ring-1 ring-amber-400/20 dark:border-amber-600/60"
        } ${saving ? "opacity-60" : ""}`}
      />
      {error ? (
        <span id={errId} className="max-w-[11rem] text-right text-[10px] text-red-600 dark:text-red-400" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
