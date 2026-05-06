import type { SpellUiLanguage } from "./spell-prefs";

/**
 * Sustituciones frecuentes (chat / teclado). Claves ≥2 caracteres.
 * Prioridad: reglas del usuario en preferencias, luego esta lista según idioma.
 */
const ES: Record<string, string> = {
  qe: "que",
  ke: "que",
  kie: "qué",
  xq: "porque",
  xke: "porque",
  porq: "porque",
  proque: "porque",
  poque: "porque",
  pq: "porque",
  dps: "después",
  dsp: "después",
  tb: "también",
  tmb: "también",
  tamien: "también",
  oi: "hoy",
  ahy: "ahí",
  ayi: "ahí",
  ahii: "ahí",
  ntp: "no te preocupes",
  np: "no pasa nada",
  salu2: "saludos",
  recivir: "recibir",
  resivir: "recibir",
  aunke: "aunque",
  aunq: "aunque",
  aver: "a ver",
  haver: "a ver",
  aser: "hacer",
  acer: "hacer",
  alli: "allí",
  alla: "allá",
  beses: "veces",
  vezes: "veces",
  nadaa: "nada",
  buo: "bueno",
  bn: "bien",
  grax: "gracias",
  graicas: "gracias",
};

const EN: Record<string, string> = {
  teh: "the",
  adn: "and",
  taht: "that",
  thn: "than",
  recieve: "receive",
  wierd: "weird",
  dont: "don't",
  cant: "can't",
  wont: "won't",
  im: "I'm",
  ive: "I've",
};

const PT: Record<string, string> = {
  vc: "você",
  vcs: "vocês",
  tb: "também",
  pq: "porque",
  mto: "muito",
  msm: "mesmo",
  qse: "quase",
};

export function getBuiltinAutocorrectMap(lang: SpellUiLanguage): Record<string, string> {
  switch (lang) {
    case "en":
      return EN;
    case "pt":
      return PT;
    case "auto": {
      const n = (typeof navigator !== "undefined" ? navigator.language : "es").toLowerCase();
      if (n.startsWith("pt")) return PT;
      if (n.startsWith("en")) return EN;
      return ES;
    }
    default:
      return ES;
  }
}
