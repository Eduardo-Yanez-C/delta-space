/**
 * Preferencias de corrector ortográfico (Electron).
 * Persistencia en userData/spell-settings.json
 */
const fs = require("fs");
const path = require("path");

const FILE = "spell-settings.json";

const DEFAULTS = {
  enabled: true,
  /** Códigos BCP-47 para session.setSpellCheckerLanguages */
  languages: ["es", "en-US", "pt-BR"],
  /** Menú contextual con sugerencias al clic derecho sobre error */
  showRightClickSuggestions: true,
};

function getPath(userDataDir) {
  return path.join(userDataDir, FILE);
}

function readSpellSettings(userDataDir) {
  try {
    const p = getPath(userDataDir);
    if (!fs.existsSync(p)) return { ...DEFAULTS };
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    return {
      enabled: raw.enabled !== false,
      languages: Array.isArray(raw.languages) && raw.languages.length ? raw.languages : DEFAULTS.languages,
      showRightClickSuggestions: raw.showRightClickSuggestions !== false,
    };
  } catch (_e) {
    return { ...DEFAULTS };
  }
}

function writeSpellSettings(userDataDir, data) {
  const prev = readSpellSettings(userDataDir);
  const next = {
    enabled: data.enabled !== undefined ? Boolean(data.enabled) : prev.enabled,
    languages: Array.isArray(data.languages) && data.languages.length ? data.languages : prev.languages,
    showRightClickSuggestions:
      data.showRightClickSuggestions !== undefined ? Boolean(data.showRightClickSuggestions) : prev.showRightClickSuggestions,
  };
  fs.writeFileSync(getPath(userDataDir), JSON.stringify(next, null, 2), "utf8");
  return next;
}

module.exports = { readSpellSettings, writeSpellSettings, DEFAULTS };
