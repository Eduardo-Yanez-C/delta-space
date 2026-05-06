"use client";

import { useEffect } from "react";
import { documentLangFromUi, getSpellPrefs } from "../lib/spell-prefs";

/** Aplica `lang` en <html> según preferencias guardadas (navegador / hidratación). */
export function SpellLangHydration() {
  useEffect(() => {
    const p = getSpellPrefs();
    document.documentElement.lang = documentLangFromUi(p.uiLanguage);
  }, []);
  return null;
}
