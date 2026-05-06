/**
 * Preferencias de ortografía en el cliente (web + misma semántica que escritorio).
 * Persistencia en localStorage. En Electron, además spell-settings.json vía IPC.
 */

const STORAGE_KEY = "pv_quoting_spell_prefs_v1";

export type SpellUiLanguage = "es" | "en" | "pt" | "auto";

export type AutocorrectCustomRow = { from: string; to: string };

export type SpellPrefsV1 = {
  enabled: boolean;
  uiLanguage: SpellUiLanguage;
  autocorrectWhileTyping: boolean;
  autocorrectShowUndoBar: boolean;
  /** Solo aplicación de escritorio: menú contextual con sugerencias al clic derecho. */
  showDesktopRightClickSuggestions: boolean;
  personalWords: string[];
  autocorrectCustomRows: AutocorrectCustomRow[];
};

const DEFAULTS: SpellPrefsV1 = {
  enabled: true,
  uiLanguage: "es",
  autocorrectWhileTyping: true,
  autocorrectShowUndoBar: true,
  showDesktopRightClickSuggestions: true,
  personalWords: [],
  autocorrectCustomRows: [],
};

/** Merge puro (sin window): sirve para tests y para normalizar JSON guardado. */
export function mergeSpellPrefsFromPartial(o: Partial<SpellPrefsV1> | Record<string, unknown>): SpellPrefsV1 {
  const customRows: AutocorrectCustomRow[] = Array.isArray(o.autocorrectCustomRows)
    ? (o.autocorrectCustomRows as unknown[]).filter(
        (r): r is AutocorrectCustomRow =>
          r != null &&
          typeof r === "object" &&
          typeof (r as AutocorrectCustomRow).from === "string" &&
          typeof (r as AutocorrectCustomRow).to === "string",
      )
    : [...DEFAULTS.autocorrectCustomRows];

  return {
    enabled: o.enabled !== false,
    uiLanguage:
      o.uiLanguage === "en" || o.uiLanguage === "pt" || o.uiLanguage === "auto" ? o.uiLanguage : "es",
    /** Solo `false` explícito desactiva; clave ausente → activo. */
    autocorrectWhileTyping: o.autocorrectWhileTyping !== false,
    autocorrectShowUndoBar: o.autocorrectShowUndoBar !== false,
    showDesktopRightClickSuggestions: o.showDesktopRightClickSuggestions !== false,
    personalWords: Array.isArray(o.personalWords)
      ? (o.personalWords as unknown[]).filter((x): x is string => typeof x === "string")
      : [...DEFAULTS.personalWords],
    autocorrectCustomRows: [...customRows],
  };
}

let spellPrefsMigrateDone = false;

/**
 * Normaliza y reescribe `pv_quoting_spell_prefs_v1` si faltan claves o el JSON no coincide con el merge.
 * Idempotente; una vez por carga del bundle (HMR puede repetir).
 */
export function ensureSpellPrefsMigrated(): void {
  if (typeof window === "undefined") return;
  if (spellPrefsMigrateDone) return;
  spellPrefsMigrateDone = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<SpellPrefsV1>) : {};
    const merged = mergeSpellPrefsFromPartial(parsed);
    const next = JSON.stringify(merged);
    if (next !== raw) {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  } catch {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mergeSpellPrefsFromPartial({})));
    } catch {
      /* */
    }
  }
}

export function getSpellPrefs(): SpellPrefsV1 {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    ensureSpellPrefsMigrated();
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const o = JSON.parse(raw) as Partial<SpellPrefsV1>;
    return mergeSpellPrefsFromPartial(o);
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSpellPrefs(prefs: SpellPrefsV1): void {
  if (typeof window === "undefined") return;
  const normalized = mergeSpellPrefsFromPartial(prefs);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

/** Una línea por regla: `mal → bien` (también `->`, `=` o `:`). */
export function parseAutocorrectCustomTextarea(text: string): AutocorrectCustomRow[] {
  const rows: AutocorrectCustomRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^(.+?)\s*(?:→|->|=|:)\s*(.+)$/);
    if (m) rows.push({ from: m[1]!.trim(), to: m[2]!.trim() });
  }
  return rows;
}

export function formatAutocorrectCustomTextarea(rows: AutocorrectCustomRow[]): string {
  return rows.map((r) => `${r.from} → ${r.to}`).join("\n");
}

/** Idiomas para session.setSpellCheckerLanguages (Electron / Chromium). */
export function uiLanguageToElectronLanguages(ui: SpellUiLanguage): string[] {
  switch (ui) {
    case "en":
      return ["en-US", "es"];
    case "pt":
      return ["pt-BR", "es", "en-US"];
    case "auto": {
      const n = (typeof navigator !== "undefined" ? navigator.language : "es").toLowerCase();
      if (n.startsWith("pt")) return ["pt-BR", "es"];
      if (n.startsWith("en")) return ["en-US", "es"];
      return ["es", "en-US", "pt-BR"];
    }
    default:
      return ["es", "en-US", "pt-BR"];
  }
}

/** Atributo lang del documento (ayuda al subrayado nativo del navegador). */
export function documentLangFromUi(ui: SpellUiLanguage): string {
  if (ui === "auto" && typeof navigator !== "undefined") {
    const n = navigator.language || "es";
    return (n.split("-")[0] || "es").toLowerCase();
  }
  return ui;
}
