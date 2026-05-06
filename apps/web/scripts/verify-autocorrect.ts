/**
 * Verificación automática del motor de autocorrección (sin navegador).
 * Ejecutar: npm run verify:autocorrect --workspace=web
 */
import { applyAutocorrectAtTrigger, undoAutocorrectEntry } from "../lib/autocorrect-engine";
import { mergeSpellPrefsFromPartial, type SpellPrefsV1 } from "../lib/spell-prefs";

const sep = { char: " ", preventDefault: true as const };

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error("[verify:autocorrect] FAIL:", msg);
    process.exit(1);
  }
}

const oldShape = mergeSpellPrefsFromPartial({ enabled: true, uiLanguage: "es" });
assert(oldShape.autocorrectWhileTyping === true, "prefs antiguas sin clave → autocorrect activo");

const explicitOff = mergeSpellPrefsFromPartial({ autocorrectWhileTyping: false });
assert(explicitOff.autocorrectWhileTyping === false, "false explícito desactiva");

const base: SpellPrefsV1 = {
  ...oldShape,
  uiLanguage: "es",
  showDesktopRightClickSuggestions: true,
  personalWords: [],
  autocorrectCustomRows: [],
};

const r1 = applyAutocorrectAtTrigger("qe", 2, sep, base);
assert(r1 !== null && r1.newValue === "que ", `qe+espacio → "que " (obtenido: ${r1?.newValue})`);

const undone = undoAutocorrectEntry(r1!.newValue, r1!.undo);
assert(undone !== null && undone.newValue === "qe ", `deshacer → "qe " (obtenido: ${undone?.newValue})`);

const withBlock: SpellPrefsV1 = { ...base, personalWords: ["qe"] };
const r2 = applyAutocorrectAtTrigger("qe", 2, sep, withBlock);
assert(r2 === null, "palabra en lista personal no debe corregirse");

const r3 = applyAutocorrectAtTrigger("hola qe", 7, sep, base);
assert(r3 !== null && r3.newValue === "hola que ", `palabra interna: ${r3?.newValue}`);

console.log("[verify:autocorrect] OK");
