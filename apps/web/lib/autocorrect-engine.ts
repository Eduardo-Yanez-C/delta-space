import type { KeyboardEvent } from "react";
import { getBuiltinAutocorrectMap } from "./autocorrect-builtin";
import type { SpellPrefsV1, SpellUiLanguage } from "./spell-prefs";

export type AutocorrectUndoEntry = {
  /** Inicio del texto reemplazado en el valor actual (tras la corrección). */
  replaceStart: number;
  replaceEnd: number;
  originalWord: string;
};

const WORD_CHAR = /[^\s\n\r]/;

export function getWordRangeBeforeCursor(text: string, cursor: number): { start: number; end: number; raw: string } | null {
  if (cursor <= 0) return null;
  let end = cursor;
  while (end > 0 && /\s/.test(text[end - 1]!)) {
    end--;
  }
  if (end === 0) return null;
  let start = end - 1;
  while (start >= 0 && WORD_CHAR.test(text[start]!)) {
    start--;
  }
  start++;
  const raw = text.slice(start, end);
  if (!raw.length || !WORD_CHAR.test(raw)) return null;
  return { start, end, raw };
}

/** Replica mayúsculas simples del token original sobre la corrección. */
export function applyCaseLike(original: string, correction: string): string {
  if (original.length === 0) return correction;
  if (original === original.toUpperCase()) return correction.toUpperCase();
  if (original[0] === original[0]!.toUpperCase()) {
    return correction.charAt(0).toUpperCase() + correction.slice(1);
  }
  return correction;
}

function normalizePersonalSet(prefs: SpellPrefsV1): Set<string> {
  const set = new Set<string>();
  for (const w of prefs.personalWords) {
    const k = w.trim().toLowerCase();
    if (k.length >= 1) set.add(k);
  }
  return set;
}

function mergeCustomMaps(prefs: SpellPrefsV1): Map<string, string> {
  const m = new Map<string, string>();
  for (const row of prefs.autocorrectCustomRows) {
    const from = row.from.trim().toLowerCase();
    const to = row.to.trim();
    if (from.length >= 2 && to.length >= 1) m.set(from, to);
  }
  return m;
}

export function lookupCorrection(rawWord: string, prefs: SpellPrefsV1): string | null {
  const key = rawWord.toLowerCase();
  if (key.length < 2) return null;
  const personal = normalizePersonalSet(prefs);
  if (personal.has(key)) return null;

  const custom = mergeCustomMaps(prefs);
  const customHit = custom.get(key);
  if (customHit !== undefined) return applyCaseLike(rawWord, customHit);

  const lang: SpellUiLanguage = prefs.uiLanguage;
  const builtin = getBuiltinAutocorrectMap(lang);
  const hit = builtin[key];
  if (hit !== undefined) return applyCaseLike(rawWord, hit);
  return null;
}

export type TriggerSep = { char: string; preventDefault: boolean };

/** Espacio: en algunos navegadores/WebViews `e.key` no es " " pero `e.code === "Space"`. */
export function triggerSeparator(e: KeyboardEvent<HTMLTextAreaElement>): TriggerSep | null {
  if (e.key === " " || e.code === "Space") return { char: " ", preventDefault: true };
  if (e.key === "Tab" || e.code === "Tab") return { char: "\t", preventDefault: true };
  if (e.key === "Enter" || e.code === "Enter" || e.code === "NumpadEnter") return { char: "", preventDefault: true };
  if (e.key.length === 1 && /[,.;:!?)\]}»"'…]/.test(e.key)) return { char: e.key, preventDefault: true };
  return null;
}

export type ApplyAutocorrectResult = {
  newValue: string;
  newCursor: number;
  undo: AutocorrectUndoEntry;
};

/**
 * Si la palabra antes del cursor tiene corrección, devuelve el nuevo texto insertando el separador tras la palabra corregida.
 * `cursor` = selectionStart al disparar el evento (antes de que el navegador inserte el separador).
 */
export function applyAutocorrectAtTrigger(
  value: string,
  cursor: number,
  sep: TriggerSep,
  prefs: SpellPrefsV1,
): ApplyAutocorrectResult | null {
  if (!prefs.autocorrectWhileTyping) return null;
  const range = getWordRangeBeforeCursor(value, cursor);
  if (!range) return null;
  const corrected = lookupCorrection(range.raw, prefs);
  if (!corrected) return null;

  const before = value.slice(0, range.start);
  const after = value.slice(cursor);
  const newValue = before + corrected + sep.char + after;
  const newCursor = range.start + corrected.length + sep.char.length;
  return {
    newValue,
    newCursor,
    undo: {
      replaceStart: range.start,
      replaceEnd: range.start + corrected.length,
      originalWord: range.raw,
    },
  };
}

export function undoAutocorrectEntry(value: string, entry: AutocorrectUndoEntry): { newValue: string; newCursor: number } | null {
  const { replaceStart, replaceEnd, originalWord } = entry;
  if (replaceStart < 0 || replaceEnd > value.length || replaceStart >= replaceEnd) return null;
  const current = value.slice(replaceStart, replaceEnd);
  if (!current.length || current === originalWord) return null;
  const newValue = value.slice(0, replaceStart) + originalWord + value.slice(replaceEnd);
  const newCursor = replaceStart + originalWord.length;
  return { newValue, newCursor };
}
