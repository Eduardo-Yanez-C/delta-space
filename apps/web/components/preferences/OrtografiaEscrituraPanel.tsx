"use client";

import { useCallback, useEffect, useState } from "react";
import {
  documentLangFromUi,
  formatAutocorrectCustomTextarea,
  getSpellPrefs,
  parseAutocorrectCustomTextarea,
  saveSpellPrefs,
  uiLanguageToElectronLanguages,
  type SpellPrefsV1,
  type SpellUiLanguage,
} from "../../lib/spell-prefs";

function parsePersonalWordsTextarea(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function OrtografiaEscrituraPanel() {
  const [enabled, setEnabled] = useState(true);
  const [uiLanguage, setUiLanguage] = useState<SpellUiLanguage>("es");
  const [autocorrectWhileTyping, setAutocorrectWhileTyping] = useState(true);
  const [autocorrectShowUndoBar, setAutocorrectShowUndoBar] = useState(true);
  const [showDesktopRightClickSuggestions, setShowDesktopRightClickSuggestions] = useState(true);
  const [personalWordsText, setPersonalWordsText] = useState("");
  const [customRulesText, setCustomRulesText] = useState("");
  const [desktopNote, setDesktopNote] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isDesktop = typeof window !== "undefined" && window.__DESKTOP__?.isDesktop === true;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const local = getSpellPrefs();
    setEnabled(local.enabled);
    setUiLanguage(local.uiLanguage);
    setAutocorrectWhileTyping(local.autocorrectWhileTyping);
    setAutocorrectShowUndoBar(local.autocorrectShowUndoBar);
    setShowDesktopRightClickSuggestions(local.showDesktopRightClickSuggestions);
    setPersonalWordsText(local.personalWords.join("\n"));
    setCustomRulesText(formatAutocorrectCustomTextarea(local.autocorrectCustomRows));
    if (typeof window !== "undefined" && window.__DESKTOP__?.spellcheck?.getSettings) {
      try {
        const s = await window.__DESKTOP__.spellcheck.getSettings();
        setEnabled(s.enabled !== false);
        setShowDesktopRightClickSuggestions(s.showRightClickSuggestions !== false);
        setDesktopNote(`Idiomas del corrector en escritorio: ${s.languages.join(", ")}`);
      } catch {
        setDesktopNote(null);
      }
    } else {
      setDesktopNote(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setError(null);
    setSavedOk(null);
    const personalWords = parsePersonalWordsTextarea(personalWordsText);
    const autocorrectCustomRows = parseAutocorrectCustomTextarea(customRulesText);
    const prefs: SpellPrefsV1 = {
      enabled,
      uiLanguage,
      autocorrectWhileTyping,
      autocorrectShowUndoBar,
      showDesktopRightClickSuggestions,
      personalWords,
      autocorrectCustomRows,
    };
    saveSpellPrefs(prefs);
    document.documentElement.lang = documentLangFromUi(uiLanguage);

    if (typeof window !== "undefined" && window.__DESKTOP__?.spellcheck?.setSettings) {
      const langs = uiLanguageToElectronLanguages(uiLanguage);
      const res = await window.__DESKTOP__.spellcheck.setSettings({
        enabled,
        languages: langs,
        showRightClickSuggestions: showDesktopRightClickSuggestions,
      });
      if (!res.ok) {
        setError(res.error ?? "No se pudo guardar en el escritorio.");
        return;
      }
      setDesktopNote(`Corrector de escritorio actualizado · ${langs.join(", ")}`);
    }

    setSavedOk("Cambios guardados.");
  };

  return (
    <div className="mx-auto max-w-lg pb-16">
      <header className="mb-6">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Ortografía y escritura
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Ajuste cómo se revisa y corrige el texto al chatear y en los cuadros de mensaje. Los cambios se aplican de
          inmediato en esta sesión.
        </p>
      </header>

      {loading ? <p className="text-sm text-slate-500">Cargando…</p> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900/60">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <label className="flex cursor-pointer items-start gap-3 px-5 py-4 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-900"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                Corrección ortográfica
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-slate-500 dark:text-slate-400">
                Subraya posibles errores según el idioma elegido. En la app de escritorio usa el motor integrado; en el
                navegador, también cuenta la configuración del propio navegador.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 px-5 py-4 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-900"
              checked={autocorrectWhileTyping}
              onChange={(e) => setAutocorrectWhileTyping(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                Autocorrección al escribir
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-slate-500 dark:text-slate-400">
                Al pulsar espacio, Enter o signos de puntuación, corrige abreviaturas y errores muy frecuentes en
                conversaciones, burbuja de chat y compartir al chat.
              </span>
            </span>
          </label>

          <div className="px-5 py-4">
            <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">Idioma de escritura</label>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Orienta el corrector y las sugerencias automáticas.
            </p>
            <select
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              value={uiLanguage}
              onChange={(e) => setUiLanguage(e.target.value as SpellUiLanguage)}
            >
              <option value="es">Español</option>
              <option value="en">Inglés</option>
              <option value="pt">Portugués (Brasil)</option>
              <option value="auto">Automático (sistema o navegador)</option>
            </select>
          </div>

          {isDesktop ? (
            <label className="flex cursor-pointer items-start gap-3 px-5 py-4 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-900"
                checked={showDesktopRightClickSuggestions}
                onChange={(e) => setShowDesktopRightClickSuggestions(e.target.checked)}
              />
              <span>
                <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                  Sugerencias al clic derecho
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-slate-500 dark:text-slate-400">
                  En la aplicación de escritorio, al hacer clic derecho sobre una palabra marcada como error se muestran
                  correcciones y la opción de agregar al diccionario. Si lo desactiva, se usa el menú estándar del
                  sistema.
                </span>
              </span>
            </label>
          ) : null}

          <label className="flex cursor-pointer items-start gap-3 px-5 py-4 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-900"
              checked={autocorrectShowUndoBar}
              onChange={(e) => setAutocorrectShowUndoBar(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                Aviso para deshacer corrección
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-slate-500 dark:text-slate-400">
                Tras una autocorrección, muestra un mensaje breve con botón Deshacer. También puede usar Ctrl+Shift+Z.
              </span>
            </span>
          </label>
        </div>

        <details className="border-t border-slate-100 dark:border-slate-800">
          <summary className="cursor-pointer list-none px-5 py-3.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50/80 dark:text-slate-200 dark:hover:bg-slate-800/40 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-2">
              Personalización avanzada
              <span className="text-xs font-normal text-slate-400">opcional</span>
            </span>
          </summary>
          <div className="space-y-5 border-t border-slate-100 px-5 py-5 dark:border-slate-800">
            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-slate-200">
                Palabras personalizadas
              </label>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Una por línea. No se sustituirán al usar autocorrección (marcas, siglas, términos técnicos).
              </p>
              <textarea
                className="mt-2 min-h-[88px] w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                placeholder="Ej. MiEmpresa&#10;kWp"
                value={personalWordsText}
                onChange={(e) => setPersonalWordsText(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-slate-200">
                Reemplazos personalizados
              </label>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Una regla por línea: texto incorrecto, flecha, texto correcto. Tienen prioridad sobre las sugerencias
                automáticas.
              </p>
              <textarea
                className="mt-2 min-h-[96px] w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 font-mono text-xs leading-relaxed dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                placeholder={"pfv → PFV\nempresa → Empresa"}
                value={customRulesText}
                onChange={(e) => setCustomRulesText(e.target.value)}
                spellCheck={false}
              />
            </div>
          </div>
        </details>
      </div>

      {isDesktop && desktopNote ? (
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{desktopNote}</p>
      ) : null}

      {error ? <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {savedOk ? <p className="mt-4 text-sm text-emerald-700 dark:text-emerald-400">{savedOk}</p> : null}

      <button
        type="button"
        onClick={() => void handleSave()}
        className="btn-primary mt-8 w-full rounded-xl py-2.5 text-sm font-medium sm:w-auto sm:min-w-[200px]"
      >
        Guardar cambios
      </button>
    </div>
  );
}
