"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { updateLine, type QuoteItemLineDto } from "../../../lib/api";
import { formatMoneyDraft, parseLocaleMoneyNumber } from "../../../lib/chile-inputs";

export type MarginInlineField = "quantity" | "unitPrice" | "unitCost";

/**
 * `original`: para `unitCost` puede ser `null` (sin costo). Para `quantity` y `unitPrice` siempre número.
 */
export type MarginLineEditState = {
  lineId: string;
  field: MarginInlineField;
  draft: string;
  original: number | null;
};

type CommitResult = "closed" | "error" | "noop";

function normalizeOriginalQuantity(line: QuoteItemLineDto): number {
  const q = line.quantity;
  const n = typeof q === "number" ? q : Number(q);
  return Number.isFinite(n) ? Math.trunc(n) : 1;
}

function normalizeOriginalUnitPrice(line: QuoteItemLineDto): number {
  const p = line.unitPriceSnapshot;
  const n = typeof p === "number" ? p : Number(p);
  return Number.isFinite(n) ? n : 0;
}

function normalizeOriginalUnitCost(line: QuoteItemLineDto): number | null {
  const c = line.unitCostSnapshot;
  if (c == null) return null;
  const n = typeof c === "number" ? c : Number(c);
  return Number.isFinite(n) ? n : null;
}

function parseQuantityStrict(draft: string): { ok: true; value: number } | { ok: false; message: string } {
  const t = draft.trim();
  if (t === "") {
    return { ok: false, message: "Cantidad debe ser un entero mayor o igual a 1." };
  }
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    return { ok: false, message: "Cantidad debe ser un entero mayor o igual a 1." };
  }
  return { ok: true, value: n };
}

/** Miles con punto y/o decimal con coma (Chile) o punto. */
function parseUnitPriceStrict(draft: string): { ok: true; value: number } | { ok: false; message: string } {
  const t = draft.trim();
  if (t === "") {
    return { ok: false, message: "Precio unitario debe ser un número mayor o igual a 0." };
  }
  const n = parseLocaleMoneyNumber(t);
  if (n == null || n < 0) {
    return { ok: false, message: "Precio unitario debe ser un número mayor o igual a 0." };
  }
  return { ok: true, value: n };
}

/** Vacío → null (sin costo). Coma/punto; >= 0 */
function parseUnitCostStrict(
  draft: string,
): { ok: true; value: number | null } | { ok: false; message: string } {
  const t = draft.trim();
  if (t === "") {
    return { ok: true, value: null };
  }
  const n = parseLocaleMoneyNumber(t);
  if (n == null || n < 0) {
    return { ok: false, message: "Costo unitario debe ser un número mayor o igual a 0, o vacío para quitar." };
  }
  return { ok: true, value: n };
}

function quantityUnchanged(draft: string, original: number): boolean {
  const parsed = parseQuantityStrict(draft);
  return parsed.ok && parsed.value === original;
}

/** Comparación monetaria a 2 decimales */
function unitPriceUnchanged(draft: string, original: number): boolean {
  const parsed = parseUnitPriceStrict(draft);
  if (!parsed.ok) return false;
  return Math.round(parsed.value * 100) === Math.round(original * 100);
}

function unitCostUnchanged(draft: string, original: number | null): boolean {
  const parsed = parseUnitCostStrict(draft);
  if (!parsed.ok) return false;
  if (parsed.value === null && original === null) return true;
  if (parsed.value === null || original === null) return false;
  return Math.round(parsed.value * 100) === Math.round(original * 100);
}

function initialDraft(field: MarginInlineField, original: number | null): string {
  if (field === "quantity") {
    return String(original ?? 1);
  }
  if (field === "unitPrice") {
    return formatMoneyDraft(original ?? 0);
  }
  // unitCost
  if (original === null) return "";
  return formatMoneyDraft(original);
}

/**
 * Una sola celda editable (cantidad, precio o costo unitario) a la vez — cotización MARGIN.
 * PATCH vía updateLine; Enter guarda, Escape revierte, blur guarda si cambió.
 */
export function useMarginInlineLineEdit(options: {
  quoteId: string;
  versionId: string | null;
  enabled: boolean;
  onRefresh: () => void;
}) {
  const { quoteId, versionId, enabled, onRefresh } = options;
  const [edit, setEdit] = useState<MarginLineEditState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingLineId, setSavingLineId] = useState<string | null>(null);
  const skipBlurRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setEdit(null);
      setError(null);
    }
  }, [enabled]);

  const tryCommit = useCallback(
    async (
      lineId: string,
      field: MarginInlineField,
      draft: string,
      original: number | null,
    ): Promise<CommitResult> => {
      if (field === "quantity") {
        const o = original ?? 1;
        if (quantityUnchanged(draft, o)) {
          setEdit(null);
          setError(null);
          return "noop";
        }
        const parsed = parseQuantityStrict(draft);
        if (!parsed.ok) {
          setError(parsed.message);
          return "error";
        }
        if (!versionId) return "error";
        setError(null);
        setSavingLineId(lineId);
        try {
          await updateLine(quoteId, versionId, lineId, { quantity: parsed.value });
          onRefresh();
          setEdit(null);
          return "closed";
        } catch (e) {
          setError(e instanceof Error ? e.message : "Error al guardar la cantidad");
          return "error";
        } finally {
          setSavingLineId(null);
        }
      }

      if (field === "unitPrice") {
        const o = original ?? 0;
        if (unitPriceUnchanged(draft, o)) {
          setEdit(null);
          setError(null);
          return "noop";
        }
        const parsed = parseUnitPriceStrict(draft);
        if (!parsed.ok) {
          setError(parsed.message);
          return "error";
        }
        if (!versionId) return "error";
        setError(null);
        setSavingLineId(lineId);
        try {
          await updateLine(quoteId, versionId, lineId, { unitPriceSnapshot: parsed.value });
          onRefresh();
          setEdit(null);
          return "closed";
        } catch (e) {
          setError(e instanceof Error ? e.message : "Error al guardar el precio unitario");
          return "error";
        } finally {
          setSavingLineId(null);
        }
      }

      // unitCost
      if (unitCostUnchanged(draft, original)) {
        setEdit(null);
        setError(null);
        return "noop";
      }
      const parsed = parseUnitCostStrict(draft);
      if (!parsed.ok) {
        setError(parsed.message);
        return "error";
      }
      if (!versionId) return "error";
      setError(null);
      setSavingLineId(lineId);
      try {
        await updateLine(quoteId, versionId, lineId, { unitCostSnapshot: parsed.value });
        onRefresh();
        setEdit(null);
        return "closed";
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al guardar el costo unitario");
        return "error";
      } finally {
        setSavingLineId(null);
      }
    },
    [quoteId, versionId, onRefresh],
  );

  const cancel = useCallback(() => {
    setEdit(null);
    setError(null);
  }, []);

  const cancelWithSkipBlur = useCallback(() => {
    skipBlurRef.current = true;
    cancel();
    requestAnimationFrame(() => {
      skipBlurRef.current = false;
    });
  }, [cancel]);

  const flushPending = useCallback(async (): Promise<boolean> => {
    if (!edit) return true;
    const r = await tryCommit(edit.lineId, edit.field, edit.draft, edit.original);
    return r !== "error";
  }, [edit, tryCommit]);

  const activate = useCallback(
    async (line: QuoteItemLineDto, field: MarginInlineField) => {
      if (!enabled || !versionId) return;
      const sameCell = edit?.lineId === line.id && edit?.field === field;
      if (sameCell) return;
      if (edit && (edit.lineId !== line.id || edit.field !== field)) {
        const ok = await flushPending();
        if (!ok) return;
      }
      const original =
        field === "quantity"
          ? normalizeOriginalQuantity(line)
          : field === "unitPrice"
            ? normalizeOriginalUnitPrice(line)
            : normalizeOriginalUnitCost(line);
      setEdit({
        lineId: line.id,
        field,
        draft: initialDraft(field, original),
        original,
      });
      setError(null);
    },
    [enabled, versionId, edit, flushPending],
  );

  const setDraft = useCallback((draft: string) => {
    setEdit((prev) => (prev ? { ...prev, draft } : prev));
  }, []);

  const handleBlur = useCallback(() => {
    if (skipBlurRef.current || !edit) return;
    void tryCommit(edit.lineId, edit.field, edit.draft, edit.original);
  }, [edit, tryCommit]);

  const handleEnter = useCallback(() => {
    if (!edit) return;
    void tryCommit(edit.lineId, edit.field, edit.draft, edit.original);
  }, [edit, tryCommit]);

  const isActive = useCallback(
    (lineId: string, field: MarginInlineField) => edit?.lineId === lineId && edit?.field === field,
    [edit],
  );

  return {
    edit,
    error,
    savingLineId,
    isActive,
    activate,
    setDraft,
    handleBlur,
    handleEnter,
    cancelWithSkipBlur,
    flushPending,
  };
}
