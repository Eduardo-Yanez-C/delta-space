"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fetchAssignableSalesUsers, type User } from "../../lib/api";

/** Menú anclado arriba del botón (coordenada `bottom` en px respecto al viewport). */
type DockGeom = { left: number; width: number; bottom: number; maxHeight: number };
type DockTopGeom = { left: number; width: number; top: number; maxHeight: number };

type Cu = {
  input: string;
  border: string;
  muted: string;
  label: string;
};

type MenuSection = { title: string; items: { label: string; snippet: string }[] };

const PLUS_MENU: MenuSection[] = [
  {
    title: "Sugerencias",
    items: [
      { label: "Lista de control", snippet: "\n- [ ] " },
      { label: "Lista con viñetas", snippet: "\n• " },
      { label: "Lista numerada", snippet: "\n1. " },
    ],
  },
  {
    title: "Texto",
    items: [
      { label: "Bloque de código", snippet: "\n```\n\n```\n" },
      { label: "Cita", snippet: "\n> " },
    ],
  },
  {
    title: "Insertado",
    items: [
      { label: "Mención (@)", snippet: "@" },
      { label: "Enlace", snippet: "https://" },
    ],
  },
  {
    title: "IA (demo)",
    items: [
      { label: "Escribe con IA", snippet: "\n/ia " },
      { label: "Resumen", snippet: "\n/resumen " },
    ],
  },
  {
    title: "Formato",
    items: [
      { label: "Negrita", snippet: "**" },
      { label: "Cursiva", snippet: "_" },
    ],
  },
  {
    title: "Bloques avanzados",
    items: [
      { label: "Divisor", snippet: "\n---\n" },
      { label: "Tabla (markdown)", snippet: "\n| A | B |\n|---|---|\n| | |\n" },
    ],
  },
  {
    title: "Colores del texto (demo)",
    items: [
      { label: "Destacar (amarillo)", snippet: "==texto==" },
      { label: "Alerta (rojo)", snippet: "!! " },
    ],
  },
  {
    title: "Insignias (demo)",
    items: [
      { label: "Importante", snippet: "[IMPORTANTE] " },
      { label: "Revisión", snippet: "[REVISAR] " },
    ],
  },
];

/** Menú ··· estilo ClickUp: inserta comandos /slug hasta enlazar acciones reales. */
const MORE_TASK_MENU: MenuSection[] = [
  {
    title: "Asignación y equipo",
    items: [
      { label: "Asignar a…", snippet: "\n/asignar " },
      { label: "Reasignar comentario", snippet: "\n/reasignar-comentario " },
      { label: "Seguidores", snippet: "\n/seguidores " },
      { label: "Mencionar en descripción", snippet: "\n/mencionar-descripcion " },
      { label: "Equipo de la tarea", snippet: "\n/equipo-tarea " },
    ],
  },
  {
    title: "Planificación",
    items: [
      { label: "Fecha de inicio", snippet: "\n/fecha-inicio " },
      { label: "Fecha límite", snippet: "\n/fecha-limite " },
      { label: "Duración estimada", snippet: "\n/duracion " },
      { label: "Prioridad", snippet: "\n/prioridad " },
      { label: "Estado / etapa", snippet: "\n/estado " },
      { label: "Sprint", snippet: "\n/sprint " },
      { label: "Puntos de sprint", snippet: "\n/puntos-sprint " },
      { label: "Dependencias", snippet: "\n/dependencias " },
      { label: "Bloqueada por", snippet: "\n/bloqueada-por " },
    ],
  },
  {
    title: "Organización",
    items: [
      { label: "Mover a otra lista", snippet: "\n/mover-lista " },
      { label: "Duplicar tarea", snippet: "\n/duplicar " },
      { label: "Fusionar con…", snippet: "\n/fusionar " },
      { label: "Archivar", snippet: "\n/archivar " },
      { label: "Agregar a bandeja", snippet: "\n/bandeja " },
      { label: "Etiquetas", snippet: "\n/etiquetas " },
      { label: "Carpeta / espacio", snippet: "\n/carpeta " },
    ],
  },
  {
    title: "Seguimiento",
    items: [
      { label: "Registrar tiempo", snippet: "\n/tiempo " },
      { label: "Estimación vs real", snippet: "\n/estimacion-real " },
      { label: "Recordatorio", snippet: "\n/recordatorio " },
      { label: "Convertir en plantilla", snippet: "\n/plantilla " },
    ],
  },
  {
    title: "Comunicación",
    items: [
      { label: "Correo desde tarea", snippet: "\n/correo-tarea " },
      { label: "Resumen para stakeholders", snippet: "\n/resumen-stakeholders " },
      { label: "Privado / solo admins", snippet: "\n/privado " },
    ],
  },
];

/** Scroll fino y oscuro (Firefox + WebKit); evita la barra blanca gruesa del sistema. */
const SUITE_MENU_SCROLL =
  "overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:rgba(100,100,100,0.5)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#4a4a4a] hover:[&::-webkit-scrollbar-thumb]:bg-[#5c5c5c]";

const SCHED_WD = ["lu", "ma", "mi", "ju", "vi", "sá", "do"] as const;
const SCHED_MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Valor `datetime-local` en hora local (no igual al calendario nativo de fechas de la ficha). */
export function dateToDatetimeLocalValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function timeInputValue(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function monthGridCells(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  const pad = (first.getDay() + 6) % 7;
  const dim = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < pad; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42) cells.push(null);
  return cells;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Interpretación ligera (es) para el campo tipo ClickUp; devuelve null si no reconoce. */
export function parseNaturalScheduleEs(text: string, base: Date): Date | null {
  const s = text.trim().toLowerCase();
  if (!s) return null;
  const out = new Date(base.getTime());
  const mergeTime = (h: number, m: number) => {
    const d = new Date(out);
    d.setHours(h, m, 0, 0);
    return d;
  };
  if (/\bma[ñn]ana\b/.test(s)) {
    out.setDate(out.getDate() + 1);
    const hm = s.match(/(\d{1,2})\s*:\s*(\d{2})/);
    if (hm) return mergeTime(Number(hm[1]), Number(hm[2]));
    const honly = s.match(/a\s+las\s+(\d{1,2})\b/);
    if (honly) return mergeTime(Number(honly[1]), 0);
    return mergeTime(8, 0);
  }
  if (/\bhoy\b/.test(s)) {
    const hm = s.match(/(\d{1,2})\s*:\s*(\d{2})/);
    if (hm) return mergeTime(Number(hm[1]), Number(hm[2]));
    return new Date(base.getTime());
  }
  const minM = s.match(/en\s+(\d+)\s*(?:min|minutos?)\b/);
  if (minM) {
    out.setTime(base.getTime() + Number(minM[1]) * 60000);
    return out;
  }
  const hM = s.match(/en\s+(\d+)\s*h(?:oras?)?\b/);
  if (hM) {
    out.setTime(base.getTime() + Number(hM[1]) * 3600000);
    return out;
  }
  const hmShort = s.match(/^(\d{1,2})\s*:\s*(\d{2})$/);
  if (hmShort) {
    out.setHours(Number(hmShort[1]), Number(hmShort[2]), 0, 0);
    return out;
  }
  return null;
}

function nextWeekMondayEight(from: Date): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + 7);
  const dow = d.getDay();
  const back = dow === 0 ? 6 : dow - 1;
  d.setDate(d.getDate() - back);
  d.setHours(8, 0, 0, 0);
  return d;
}

const EMOJI_GROUPS: { title: string; emojis: string[] }[] = [
  {
    title: "Reacciones",
    emojis: ["👍", "👎", "❤️", "🔥", "🎉", "✨", "👏", "🙌", "💯", "✅", "⚠️", "❓", "💬", "📎", "🔗", "👀"],
  },
  {
    title: "Caras",
    emojis: ["😀", "😃", "😄", "😁", "😅", "🤣", "😂", "🙂", "😉", "😊", "🙃", "😇", "🥲", "😌", "😍", "🤔", "😮", "😢", "😭", "😤", "🙏"],
  },
  {
    title: "Trabajo",
    emojis: ["💼", "📌", "📝", "📋", "📅", "⏰", "🔔", "💡", "🐛", "🔧", "🚀", "📦", "🏁", "🎯", "📊", "📈"],
  },
  {
    title: "Señales",
    emojis: ["✔️", "➕", "➖", "✖️", "➡️", "⭐", "🌟", "☀️", "🌙", "☕", "🍕", "🎁", "🏆", "💪", "🧠", "🔒"],
  },
];

function parseMentionAtCaret(text: string, caret: number): { start: number; query: string } | null {
  const slice = text.slice(0, caret);
  const m = slice.match(/@([^\s@\n]*)$/);
  if (!m) return null;
  const token = m[0];
  const start = caret - token.length;
  if (start > 0) {
    const prev = text[start - 1];
    if (prev !== " " && prev !== "\n" && prev !== "\t") return null;
  }
  return { start, query: m[1] ?? "" };
}

function userMentionLabel(u: User): string {
  const n = u.name?.trim() || u.fullName?.trim();
  return n || u.email;
}

function userMatchesMentionQuery(u: User, q: string): boolean {
  if (!q) return true;
  const n = (q || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const hay = (s: string | null | undefined) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .includes(n);
  return hay(u.email) || hay(u.name) || hay(u.fullName);
}

export function SuiteActivityComposer({
  cu,
  onPostComment,
  onScheduleReminder,
}: {
  cu: Cu;
  onPostComment: (text: string) => void | Promise<void>;
  onScheduleReminder: (isoLocal: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [plusOpen, setPlusOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [schedOpen, setSchedOpen] = useState(false);
  const [mode, setMode] = useState<"comment" | "nota" | "email">("comment");
  const [modeOpen, setModeOpen] = useState(false);
  const [schedInstant, setSchedInstant] = useState(() => new Date());
  const [schedViewMonth, setSchedViewMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [schedNl, setSchedNl] = useState("");
  const [caret, setCaret] = useState(0);
  const [mentionUsers, setMentionUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [mentionSuppressed, setMentionSuppressed] = useState(false);
  const [mentionActive, setMentionActive] = useState(0);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [plusDock, setPlusDock] = useState<DockGeom | null>(null);
  const [moreDock, setMoreDock] = useState<DockGeom | null>(null);
  const [emojiDock, setEmojiDock] = useState<DockGeom | null>(null);
  const [schedDock, setSchedDock] = useState<DockGeom | null>(null);
  const [modeDock, setModeDock] = useState<DockGeom | null>(null);
  const [mentionDock, setMentionDock] = useState<DockTopGeom | null>(null);
  const plusWrapRef = useRef<HTMLDivElement | null>(null);
  const plusBtnRef = useRef<HTMLButtonElement | null>(null);
  const plusMenuPortalRef = useRef<HTMLDivElement | null>(null);
  const moreWrapRef = useRef<HTMLDivElement | null>(null);
  const moreBtnRef = useRef<HTMLButtonElement | null>(null);
  const moreMenuPortalRef = useRef<HTMLDivElement | null>(null);
  const emojiWrapRef = useRef<HTMLDivElement | null>(null);
  const emojiBtnRef = useRef<HTMLButtonElement | null>(null);
  const emojiMenuPortalRef = useRef<HTMLDivElement | null>(null);
  const schedWrapRef = useRef<HTMLDivElement | null>(null);
  const schedBtnRef = useRef<HTMLButtonElement | null>(null);
  const schedMenuPortalRef = useRef<HTMLDivElement | null>(null);
  const modeBtnRef = useRef<HTMLButtonElement | null>(null);
  const modeMenuPortalRef = useRef<HTMLDivElement | null>(null);
  const mentionMenuPortalRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const caretAfterMention = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUsersLoading(true);
    fetchAssignableSalesUsers(true)
      .then((list) => {
        if (!cancelled) setMentionUsers(list);
      })
      .catch(() => {
        if (!cancelled) setMentionUsers([]);
      })
      .finally(() => {
        if (!cancelled) setUsersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    if (!schedOpen) return;
    const now = new Date();
    setSchedInstant(now);
    setSchedViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSchedNl("");
  }, [schedOpen]);

  useEffect(() => {
    if (!parseMentionAtCaret(draft, caret)) setMentionSuppressed(false);
  }, [draft, caret]);

  const mentionCtx = useMemo(() => parseMentionAtCaret(draft, caret), [draft, caret]);
  const mentionList = useMemo(() => {
    if (!mentionCtx) return [];
    const q = mentionCtx.query;
    return mentionUsers.filter((u) => userMatchesMentionQuery(u, q)).slice(0, 12);
  }, [mentionUsers, mentionCtx]);

  useEffect(() => {
    if (!mentionCtx || mentionList.length === 0) {
      setMentionActive(0);
      return;
    }
    setMentionActive((i) => Math.min(i, mentionList.length - 1));
  }, [mentionCtx?.query, mentionList.length, mentionCtx]);

  useLayoutEffect(() => {
    if (caretAfterMention.current == null || !textareaRef.current) return;
    const p = caretAfterMention.current;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(p, p);
    setCaret(p);
    caretAfterMention.current = null;
  }, [draft]);

  useLayoutEffect(() => {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const gap = 8;
    const dockAboveLeft = (ar: DOMRect, maxW: number): DockGeom => {
      const width = Math.min(maxW, vw - 16);
      const left = Math.max(8, Math.min(ar.left, vw - width - 8));
      const maxHeight = Math.max(120, Math.min(560, ar.top - gap));
      return { left, width, bottom: vh - ar.top + gap / 2, maxHeight };
    };
    const dockAboveRight = (ar: DOMRect, maxW: number): DockGeom => {
      const width = Math.min(maxW, vw - 16);
      const left = Math.max(8, Math.min(ar.right - width, vw - width - 8));
      const maxHeight = Math.max(120, Math.min(560, ar.top - gap));
      return { left, width, bottom: vh - ar.top + gap / 2, maxHeight };
    };
    const dockAboveCenter = (ar: DOMRect, maxW: number): DockGeom => {
      const width = Math.min(maxW, vw - 16);
      const cx = ar.left + ar.width / 2;
      const left = Math.max(8, Math.min(cx - width / 2, vw - width - 8));
      const maxHeight = Math.max(120, Math.min(480, ar.top - gap));
      return { left, width, bottom: vh - ar.top + gap / 2, maxHeight };
    };
    const compute = () => {
      setPlusDock(plusOpen && plusBtnRef.current ? dockAboveLeft(plusBtnRef.current.getBoundingClientRect(), 320) : null);
      setMoreDock(moreOpen && moreBtnRef.current ? dockAboveRight(moreBtnRef.current.getBoundingClientRect(), 288) : null);
      setEmojiDock(emojiOpen && emojiBtnRef.current ? dockAboveCenter(emojiBtnRef.current.getBoundingClientRect(), 280) : null);
      setSchedDock(schedOpen && schedBtnRef.current ? dockAboveRight(schedBtnRef.current.getBoundingClientRect(), 360) : null);
      setModeDock(modeOpen && modeBtnRef.current ? dockAboveLeft(modeBtnRef.current.getBoundingClientRect(), 240) : null);

      const showMentionPanel =
        !!mentionCtx &&
        !mentionSuppressed &&
        !!textareaRef.current &&
        (usersLoading ||
          mentionUsers.length === 0 ||
          mentionList.length > 0 ||
          (mentionUsers.length > 0 && mentionList.length === 0 && !usersLoading));
      if (showMentionPanel && textareaRef.current) {
        const ar = textareaRef.current.getBoundingClientRect();
        const width = Math.min(Math.max(ar.width, 220), vw - 16);
        const left = Math.max(8, Math.min(ar.left, vw - width - 8));
        const top = ar.bottom + 6;
        const maxHeight = Math.max(100, vh - top - 12);
        setMentionDock({ left, width, top, maxHeight });
      } else {
        setMentionDock(null);
      }
    };
    compute();
    const open =
      plusOpen ||
      moreOpen ||
      emojiOpen ||
      schedOpen ||
      modeOpen ||
      (!!mentionCtx &&
        !mentionSuppressed &&
        (usersLoading ||
          mentionUsers.length === 0 ||
          mentionList.length > 0 ||
          (mentionUsers.length > 0 && mentionList.length === 0 && !usersLoading)));
    if (!open) {
      return;
    }
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [
    plusOpen,
    moreOpen,
    emojiOpen,
    schedOpen,
    modeOpen,
    mentionCtx,
    mentionSuppressed,
    mentionList.length,
    usersLoading,
    mentionUsers.length,
  ]);

  useEffect(() => {
    if (!plusOpen && !moreOpen && !schedOpen && !modeOpen && !emojiOpen) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      const inPlus = plusWrapRef.current?.contains(t) || plusMenuPortalRef.current?.contains(t);
      const inMore = moreWrapRef.current?.contains(t) || moreMenuPortalRef.current?.contains(t);
      const inSched = schedWrapRef.current?.contains(t) || schedMenuPortalRef.current?.contains(t);
      const inEmoji = emojiWrapRef.current?.contains(t) || emojiMenuPortalRef.current?.contains(t);
      const inMode =
        (e.target as HTMLElement).closest("[data-suite-mode-root]") || modeMenuPortalRef.current?.contains(t);
      if (plusOpen && !inPlus) setPlusOpen(false);
      if (moreOpen && !inMore) setMoreOpen(false);
      if (schedOpen && !inSched) setSchedOpen(false);
      if (emojiOpen && !inEmoji) setEmojiOpen(false);
      if (modeOpen && !inMode) setModeOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [plusOpen, moreOpen, schedOpen, modeOpen, emojiOpen]);

  const insertSnippet = useCallback((snippet: string) => {
    setDraft((d) => (d ? `${d}${snippet}` : snippet));
  }, []);

  const applyMention = useCallback(
    (u: User) => {
      const ta = textareaRef.current;
      const end = ta?.selectionStart ?? caret;
      const ctx = parseMentionAtCaret(draft, end);
      if (!ctx) return;
      const label = userMentionLabel(u);
      const insert = `@${label} `;
      const next = draft.slice(0, ctx.start) + insert + draft.slice(end);
      caretAfterMention.current = ctx.start + insert.length;
      setDraft(next);
    },
    [draft, caret],
  );

  const onTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (mentionSuppressed || !mentionCtx || mentionList.length === 0) {
        if (e.key === "Escape" && mentionCtx && mentionList.length > 0) {
          e.preventDefault();
          setMentionSuppressed(true);
        }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionActive((i) => (i + 1) % mentionList.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionActive((i) => (i - 1 + mentionList.length) % mentionList.length);
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const u = mentionList[mentionActive];
        if (u) applyMention(u);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setMentionSuppressed(true);
      }
    },
    [mentionCtx, mentionList, mentionActive, applyMention, mentionSuppressed],
  );

  const send = useCallback(() => {
    const t = draft.trim();
    if (!t) return;
    void (async () => {
      try {
        await Promise.resolve(onPostComment(t));
        setDraft("");
      } catch {
        /* errores: quien monta el compositor (p. ej. ficha de tarea) */
      }
    })();
  }, [draft, onPostComment]);

  const applyNlSchedule = useCallback(() => {
    const parsed = parseNaturalScheduleEs(schedNl, schedInstant);
    if (parsed) {
      setSchedInstant(parsed);
      setSchedViewMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
      setSchedNl("");
    }
  }, [schedNl, schedInstant]);

  const applySchedule = useCallback(() => {
    void (async () => {
      try {
        await Promise.resolve(onScheduleReminder(dateToDatetimeLocalValue(schedInstant)));
        setSchedOpen(false);
        setSchedNl("");
      } catch {
        /* idem */
      }
    })();
  }, [schedInstant, onScheduleReminder]);

  const menuZ = 260;

  const plusMenuEl =
    plusOpen && plusDock ? (
      <div
        ref={plusMenuPortalRef}
        role="listbox"
        style={{
          position: "fixed",
          zIndex: menuZ,
          left: plusDock.left,
          width: plusDock.width,
          bottom: plusDock.bottom,
          maxHeight: plusDock.maxHeight,
        }}
        className={`rounded-xl border border-[#3d3d3d] bg-[#1a1a1a] py-2 pl-2 pr-1 shadow-2xl ${SUITE_MENU_SCROLL}`}
      >
        {PLUS_MENU.map((sec) => (
          <div key={sec.title} className="px-2 pb-2">
            <p className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${cu.muted}`}>{sec.title}</p>
            {sec.items.map((it) => (
              <button
                key={it.label}
                type="button"
                className="flex w-full rounded-lg px-2 py-2 text-left text-sm text-[#ececec] hover:bg-[#2a2a2a]"
                onClick={() => {
                  insertSnippet(it.snippet);
                  setPlusOpen(false);
                }}
              >
                {it.label}
              </button>
            ))}
          </div>
        ))}
        <p className={`border-t border-[#2a2a2a] px-3 py-2 text-[10px] ${cu.muted}`}>
          Más integraciones (YouTube, Drive…) próximamente.
        </p>
      </div>
    ) : null;

  const modeMenuEl =
    modeOpen && modeDock ? (
      <div
        ref={modeMenuPortalRef}
        style={{
          position: "fixed",
          zIndex: menuZ,
          left: modeDock.left,
          width: modeDock.width,
          bottom: modeDock.bottom,
          maxHeight: modeDock.maxHeight,
        }}
        className="min-w-[200px] overflow-hidden rounded-xl border border-[#3d3d3d] bg-[#1a1a1a] py-1 shadow-2xl"
      >
        {(
          [
            { id: "comment" as const, label: "Comentario" },
            { id: "nota" as const, label: "Nota interna" },
            { id: "email" as const, label: "Correo electrónico" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            className="flex w-full px-3 py-2 text-left text-sm text-[#ececec] hover:bg-[#2a2a2a]"
            onClick={() => {
              setMode(opt.id);
              setModeOpen(false);
            }}
          >
            {mode === opt.id ? <span className="mr-2 text-[#5b8cff]">✓</span> : <span className="mr-2 w-4" />}
            {opt.label}
          </button>
        ))}
      </div>
    ) : null;

  const emojiMenuEl =
    emojiOpen && emojiDock ? (
      <div
        ref={emojiMenuPortalRef}
        role="listbox"
        aria-label="Emojis"
        style={{
          position: "fixed",
          zIndex: menuZ,
          left: emojiDock.left,
          width: emojiDock.width,
          bottom: emojiDock.bottom,
          maxHeight: emojiDock.maxHeight,
        }}
        className={`rounded-xl border border-[#3d3d3d] bg-[#1a1a1a] py-2 pl-2 pr-1 shadow-2xl ${SUITE_MENU_SCROLL}`}
      >
        {EMOJI_GROUPS.map((g) => (
          <div key={g.title} className="mb-1">
            <p className={`px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${cu.muted}`}>{g.title}</p>
            <div className="grid grid-cols-8 gap-0.5 px-0.5">
              {g.emojis.map((em, i) => (
                <button
                  key={`${g.title}-${i}`}
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-lg leading-none text-[#ececec] hover:bg-[#2a2a2a]"
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => {
                    setDraft((d) => {
                      const add =
                        !d || d.endsWith(" ") || d.endsWith("\n") || d.endsWith("\t") ? `${em} ` : ` ${em} `;
                      return `${d}${add}`;
                    });
                    setEmojiOpen(false);
                  }}
                >
                  <span aria-hidden>{em}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    ) : null;

  const moreMenuEl =
    moreOpen && moreDock ? (
      <div
        ref={moreMenuPortalRef}
        style={{
          position: "fixed",
          zIndex: menuZ,
          left: moreDock.left,
          width: moreDock.width,
          bottom: moreDock.bottom,
          maxHeight: moreDock.maxHeight,
        }}
        className={`rounded-xl border border-[#3d3d3d] bg-[#1a1a1a] py-2 pl-2 pr-1 shadow-2xl ${SUITE_MENU_SCROLL}`}
      >
        {MORE_TASK_MENU.map((sec) => (
          <div key={sec.title} className="px-2 pb-2">
            <p className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${cu.muted}`}>{sec.title}</p>
            {sec.items.map((it) => (
              <button
                key={it.label}
                type="button"
                className="flex w-full rounded-lg px-2 py-2 text-left text-sm text-[#ececec] hover:bg-[#2a2a2a]"
                onClick={() => {
                  setMoreOpen(false);
                  insertSnippet(it.snippet);
                }}
              >
                {it.label}
              </button>
            ))}
          </div>
        ))}
        <p className={`border-t border-[#2a2a2a] px-3 py-2 text-[10px] ${cu.muted}`}>
          Estas entradas insertan comandos; enlazar a acciones del cronograma será el siguiente paso.
        </p>
      </div>
    ) : null;

  const schedVy = schedViewMonth.getFullYear();
  const schedVm = schedViewMonth.getMonth();
  const schedCells = monthGridCells(schedVy, schedVm);
  const schedNow = new Date();
  const presetT20 = new Date(Date.now() + 20 * 60000).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  const presetT2h = new Date(Date.now() + 2 * 3600000).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  const presetTom = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d.toLocaleString("es-CL", { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  })();
  const presetMon = nextWeekMondayEight(new Date()).toLocaleString("es-CL", {
    weekday: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const schedMenuEl =
    schedOpen && schedDock ? (
      <div
        ref={schedMenuPortalRef}
        style={{
          position: "fixed",
          zIndex: menuZ,
          left: schedDock.left,
          width: schedDock.width,
          bottom: schedDock.bottom,
          maxHeight: schedDock.maxHeight,
        }}
        className={`max-h-[min(520px,72vh)] min-w-[280px] overflow-y-auto rounded-xl border border-[#3d3d3d] bg-[#1a1a1a] p-3 shadow-2xl ${SUITE_MENU_SCROLL}`}
      >
        <p className={`mb-1.5 text-xs font-semibold text-[#ececec]`}>Programar recordatorio</p>
        <p className={`mb-2 text-[10px] leading-snug ${cu.muted}`}>
          Calendario compacto (distinto del selector de fechas del plan de la tarea).
        </p>
        <div className="mb-2 flex gap-1.5">
          <input
            value={schedNl}
            onChange={(e) => setSchedNl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyNlSchedule();
              }
            }}
            placeholder="Prueba «Mañana a las 14»…"
            className={`min-w-0 flex-1 rounded-lg border border-[#3d3d3d] bg-[#141414] px-2.5 py-2 text-xs text-[#ececec] placeholder:text-[#555] focus:border-[#5c5c5c] focus:outline-none`}
          />
          <button
            type="button"
            onClick={applyNlSchedule}
            className="shrink-0 rounded-lg border border-[#3d3d3d] bg-[#252525] px-2.5 py-2 text-xs text-[#ececec] hover:bg-[#333]"
          >
            Aplicar
          </button>
        </div>
        <div className="mb-2 space-y-0.5">
          <button
            type="button"
            onClick={() => setSchedInstant(new Date(Date.now() + 20 * 60000))}
            className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-xs text-[#ececec] hover:bg-[#2a2a2a]"
          >
            <span>En 20 minutos</span>
            <span className={`shrink-0 font-mono text-[10px] ${cu.muted}`}>{presetT20}</span>
          </button>
          <button
            type="button"
            onClick={() => setSchedInstant(new Date(Date.now() + 2 * 3600000))}
            className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-xs text-[#ececec] hover:bg-[#2a2a2a]"
          >
            <span>En 2 horas</span>
            <span className={`shrink-0 font-mono text-[10px] ${cu.muted}`}>{presetT2h}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() + 1);
              d.setHours(8, 0, 0, 0);
              setSchedInstant(d);
              setSchedViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
            }}
            className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-xs text-[#ececec] hover:bg-[#2a2a2a]"
          >
            <span>Mañana 8:00</span>
            <span className={`shrink-0 text-right font-mono text-[10px] ${cu.muted}`}>{presetTom}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const d = nextWeekMondayEight(new Date());
              setSchedInstant(d);
              setSchedViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
            }}
            className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-xs text-[#ececec] hover:bg-[#2a2a2a]"
          >
            <span>Próx. lunes 8:00</span>
            <span className={`shrink-0 text-right font-mono text-[10px] ${cu.muted}`}>{presetMon}</span>
          </button>
        </div>
        <div className="mb-2 rounded-lg border border-[#2f2f2f] bg-[#141414] p-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              className={`rounded px-1.5 py-0.5 text-xs ${cu.muted} hover:text-[#ececec]`}
              onClick={() => setSchedViewMonth(new Date(schedVy, schedVm - 1, 1))}
              aria-label="Mes anterior"
            >
              ‹
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium capitalize text-[#ececec]">
                {SCHED_MONTHS[schedVm]} {schedVy}
              </span>
              <button
                type="button"
                className={`rounded border border-[#444] px-2 py-0.5 text-[10px] ${cu.muted} hover:border-[#666] hover:text-[#ececec]`}
                onClick={() => {
                  const n = new Date();
                  setSchedViewMonth(new Date(n.getFullYear(), n.getMonth(), 1));
                  setSchedInstant(n);
                }}
              >
                Hoy
              </button>
            </div>
            <button
              type="button"
              className={`rounded px-1.5 py-0.5 text-xs ${cu.muted} hover:text-[#ececec]`}
              onClick={() => setSchedViewMonth(new Date(schedVy, schedVm + 1, 1))}
              aria-label="Mes siguiente"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium uppercase text-[#888]">
            {SCHED_WD.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>
          <div className="mt-0.5 grid grid-cols-7 gap-0.5">
            {schedCells.map((day, idx) => {
              if (day == null) {
                return <div key={`e-${idx}`} className="h-8" />;
              }
              const cellDate = new Date(schedVy, schedVm, day);
              const isToday = isSameLocalDay(cellDate, schedNow);
              const isSel = isSameLocalDay(cellDate, schedInstant);
              return (
                <button
                  key={`${schedVy}-${schedVm}-${day}-${idx}`}
                  type="button"
                  disabled={day == null}
                  onClick={() => {
                    const d = new Date(schedInstant);
                    d.setFullYear(schedVy, schedVm, day);
                    setSchedInstant(d);
                  }}
                  className={`flex h-8 items-center justify-center rounded-md text-xs tabular-nums ${
                    isSel
                      ? "bg-[var(--suite-accent)] font-semibold text-white"
                      : isToday
                        ? "ring-1 ring-rose-500/80 ring-offset-1 ring-offset-[#141414] hover:bg-[#2a2a2a]"
                        : "text-[#d6d6d6] hover:bg-[#2a2a2a]"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-[#2f2f2f] bg-[#141414] px-2 py-2">
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[#888]" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6l3 2" strokeLinecap="round" />
          </svg>
          <input
            type="time"
            step={60}
            value={timeInputValue(schedInstant)}
            onChange={(e) => {
              const v = e.target.value;
              const [hh, mm] = v.split(":").map((x) => Number(x));
              if (!Number.isFinite(hh) || !Number.isFinite(mm)) return;
              const d = new Date(schedInstant);
              d.setHours(hh, mm, 0, 0);
              setSchedInstant(d);
            }}
            className="min-w-0 flex-1 rounded border-0 bg-transparent text-sm text-[#ececec] focus:outline-none"
          />
        </div>
        <p className={`mb-2 rounded border border-[#2a2a2a] bg-[#161616] px-2 py-1.5 font-mono text-[10px] leading-relaxed ${cu.muted}`}>
          {schedInstant.toLocaleString("es-CL", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </p>
        <button
          type="button"
          onClick={applySchedule}
          className="w-full rounded-lg bg-[var(--suite-accent)] py-2 text-xs font-semibold text-white hover:bg-[var(--suite-accent-hover)]"
        >
          Guardar en actividad
        </button>
        <p className={`mt-2 text-[10px] leading-snug ${cu.muted}`}>
          Se registra como recordatorio en el historial de la tarea (mismo flujo que un comentario programado).
        </p>
      </div>
    ) : null;

  const mentionShowList = mentionCtx && !mentionSuppressed && mentionList.length > 0;
  const mentionShowLoading = mentionCtx && !mentionSuppressed && usersLoading;
  const mentionShowEmpty = mentionCtx && !mentionSuppressed && !usersLoading && mentionUsers.length === 0;
  const mentionShowNoMatch =
    mentionCtx && !mentionSuppressed && !usersLoading && mentionList.length === 0 && mentionUsers.length > 0;

  const mentionMenuEl =
    mentionDock && (mentionShowList || mentionShowLoading || mentionShowEmpty || mentionShowNoMatch) ? (
      <div
        ref={mentionMenuPortalRef}
        style={{
          position: "fixed",
          zIndex: menuZ,
          left: mentionDock.left,
          width: mentionDock.width,
          top: mentionDock.top,
          maxHeight: mentionDock.maxHeight,
        }}
        className={`rounded-lg border border-[#3d3d3d] bg-[#1a1a1a] py-1 shadow-2xl ${SUITE_MENU_SCROLL}`}
        role="listbox"
        aria-label="Mencionar usuario"
      >
        {mentionShowList
          ? mentionList.map((u, idx) => {
              const label = userMentionLabel(u);
              return (
                <button
                  key={u.id}
                  type="button"
                  role="option"
                  aria-selected={idx === mentionActive}
                  className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-[#2a2a2a] ${idx === mentionActive ? "bg-[#2a2a2a]" : ""}`}
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => applyMention(u)}
                >
                  <span className="font-medium text-[#ececec]">{label}</span>
                  {u.email && label !== u.email ? <span className={`text-xs ${cu.muted}`}>{u.email}</span> : null}
                </button>
              );
            })
          : null}
        {mentionShowLoading ? <p className={`px-3 py-2 text-xs ${cu.muted}`}>Cargando usuarios…</p> : null}
        {mentionShowEmpty ? <p className={`px-3 py-2 text-xs ${cu.muted}`}>No hay usuarios activos.</p> : null}
        {mentionShowNoMatch ? (
          <p className={`px-3 py-2 text-xs ${cu.muted}`}>Ningún usuario coincide con «{mentionCtx.query}»</p>
        ) : null}
      </div>
    ) : null;

  return (
    <>
    <div className={`relative rounded-xl border ${cu.border} bg-[#141414] p-2`}>
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => {
          const v = e.target.value;
          const sel = e.target.selectionStart;
          setDraft(v);
          setCaret(sel);
        }}
        onSelect={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart)}
        onKeyUp={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart)}
        onClick={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart)}
        onKeyDown={onTextareaKeyDown}
        rows={3}
        placeholder={
          mode === "nota"
            ? "Nota interna (solo equipo)…"
            : mode === "email"
              ? "Redacta un correo (demo, sin envío real)…"
              : "Comenta, presiona @ o /…"
        }
        className={`w-full resize-y border-0 bg-transparent px-2 py-1 text-sm text-[#ececec] placeholder:text-[#555] focus:outline-none focus:ring-0`}
      />
      <div className="mt-1 flex flex-wrap items-center gap-1 border-t border-[#2a2a2a] pt-2">
        <div className="relative" ref={plusWrapRef}>
          <button
            ref={plusBtnRef}
            type="button"
            onClick={() => {
              setPlusOpen((v) => !v);
              setMoreOpen(false);
              setSchedOpen(false);
              setEmojiOpen(false);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#3d3d3d] bg-[#1f1f1f] text-lg font-light text-[#ececec] hover:bg-[#2a2a2a]"
            title="Insertar bloque"
            aria-label="Más opciones de inserción"
          >
            +
          </button>
        </div>

        <div className="relative" data-suite-mode-root>
          <button
            ref={modeBtnRef}
            type="button"
            className={`flex items-center gap-1 rounded-lg border border-[#3d3d3d] bg-[#1f1f1f] px-2 py-1.5 text-xs text-[#c4c4c4] hover:bg-[#2a2a2a]`}
            onClick={() => {
              setModeOpen((v) => !v);
              setPlusOpen(false);
              setMoreOpen(false);
              setSchedOpen(false);
              setEmojiOpen(false);
            }}
            title="Tipo de publicación"
          >
            {mode === "comment" ? "Comentario" : mode === "nota" ? "Nota interna" : "Correo electrónico"}
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9b9b9b] hover:bg-[#252525] hover:text-[#ececec]"
          title="IA (demo)"
          onClick={() => insertSnippet("\n/ia ")}
        >
          <span className="text-base" aria-hidden>
            ✦
          </span>
        </button>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9b9b9b] hover:bg-[#252525] hover:text-[#ececec]"
          title="Mencionar"
          onClick={() => insertSnippet("@")}
        >
          @
        </button>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9b9b9b] hover:bg-[#252525] hover:text-[#ececec]"
          title="Adjuntar imagen"
          onClick={() => fileRef.current?.click()}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19A4 4 0 0117 4l-9.19 9.19" strokeLinecap="round" />
          </svg>
        </button>
        <div className="relative" ref={emojiWrapRef}>
          <button
            ref={emojiBtnRef}
            type="button"
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-[#9b9b9b] hover:bg-[#252525] hover:text-[#ececec] ${emojiOpen ? "bg-[#252525] text-[#ececec]" : ""}`}
            title="Emojis"
            aria-expanded={emojiOpen}
            aria-haspopup="listbox"
            aria-label="Abrir selector de emojis"
            onClick={() => {
              setEmojiOpen((v) => !v);
              setPlusOpen(false);
              setMoreOpen(false);
              setSchedOpen(false);
              setModeOpen(false);
            }}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="relative ml-auto flex items-center gap-0" ref={moreWrapRef}>
          <button
            ref={moreBtnRef}
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9b9b9b] hover:bg-[#252525] hover:text-[#ececec]"
            title="Más"
            onClick={() => {
              setMoreOpen((v) => !v);
              setPlusOpen(false);
              setSchedOpen(false);
              setEmojiOpen(false);
            }}
          >
            ···
          </button>
        </div>

        <div className="flex items-center overflow-hidden rounded-lg">
          <button
            type="button"
            onClick={send}
            className="flex h-8 items-center gap-1 bg-[var(--suite-accent)] px-3 text-sm font-medium text-white hover:bg-[var(--suite-accent-hover)]"
            title="Enviar"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="relative" ref={schedWrapRef}>
            <button
              ref={schedBtnRef}
              type="button"
              className="flex h-8 w-8 items-center justify-center border-l border-white/25 bg-[var(--suite-accent)] text-white hover:bg-[var(--suite-accent-hover)]"
              title="Programar o calendario"
              aria-label="Abrir programación"
              onClick={() => {
                setSchedOpen((v) => !v);
                setPlusOpen(false);
                setMoreOpen(false);
                setEmojiOpen(false);
              }}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          insertSnippet(`\n[imagen: ${f.name}]\n`);
        }}
      />
    </div>
    {typeof document !== "undefined"
      ? createPortal(
          <>
            {plusMenuEl}
            {modeMenuEl}
            {emojiMenuEl}
            {moreMenuEl}
            {schedMenuEl}
            {mentionMenuEl}
          </>,
          document.body,
        )
      : null}
    </>
  );
}
