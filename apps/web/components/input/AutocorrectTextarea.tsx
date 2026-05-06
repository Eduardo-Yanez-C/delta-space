"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  type FormEvent,
  type KeyboardEvent,
  type Ref,
} from "react";
import {
  applyAutocorrectAtTrigger,
  getWordRangeBeforeCursor,
  triggerSeparator,
  undoAutocorrectEntry,
  type AutocorrectUndoEntry,
  type TriggerSep,
} from "../../lib/autocorrect-engine";
import { getSpellPrefs } from "../../lib/spell-prefs";

const MAX_UNDO = 20;
const TOAST_MS = 7500;

/** Solo desarrollo (no producción). */
function acLog(...args: unknown[]) {
  if (process.env.NODE_ENV !== "development") return;
  console.debug("[AC]", ...args);
}

export type AutocorrectTextareaProps = Omit<ComponentPropsWithoutRef<"textarea">, "onChange" | "ref"> & {
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  /** Clases del contenedor (p. ej. flex-1) para encajar en filas tipo chat. */
  wrapperClassName?: string;
};

function assignRef<T>(ref: Ref<T> | undefined, node: T | null) {
  if (typeof ref === "function") ref(node);
  else if (ref != null)
    (ref as unknown as { current: T | null }).current = node;
}

export const AutocorrectTextarea = forwardRef<HTMLTextAreaElement, AutocorrectTextareaProps>(
  function AutocorrectTextarea(
    { value, onChange, onKeyDown, wrapperClassName, className, spellCheck, ...rest },
    ref,
  ) {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    const setRefs = useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node;
        assignRef(ref, node);
      },
      [ref],
    );

    const undoStackRef = useRef<AutocorrectUndoEntry[]>([]);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [undoUi, setUndoUi] = useState<{ corrected: string; original: string } | null>(null);

    const clearToast = useCallback(() => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
      setUndoUi(null);
    }, []);

    const flushChange = useCallback(
      (newValue: string, selStart: number, selEnd: number) => {
        const el = innerRef.current;
        const ev = {
          target: { value: newValue },
          currentTarget: el ?? undefined,
        } as ChangeEvent<HTMLTextAreaElement>;
        onChange(ev);
        requestAnimationFrame(() => {
          const node = innerRef.current;
          if (!node) return;
          try {
            node.setSelectionRange(selStart, selEnd);
          } catch {
            /* */
          }
        });
      },
      [onChange],
    );

    const undoLast = useCallback((): boolean => {
      const entry = undoStackRef.current.pop();
      if (!entry) return false;
      const undone = undoAutocorrectEntry(value, entry);
      if (!undone) return false;
      clearToast();
      flushChange(undone.newValue, undone.newCursor, undone.newCursor);
      acLog("undo applied; stack depth", undoStackRef.current.length);
      return true;
    }, [value, flushChange, clearToast]);

    const pushUndo = useCallback(
      (entry: AutocorrectUndoEntry, correctedWord: string) => {
        const st = undoStackRef.current;
        st.push(entry);
        if (st.length > MAX_UNDO) st.shift();
        const prefs = getSpellPrefs();
        if (!prefs.autocorrectShowUndoBar) return;
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setUndoUi({ corrected: correctedWord, original: entry.originalWord });
        toastTimerRef.current = setTimeout(() => {
          setUndoUi(null);
          toastTimerRef.current = null;
        }, TOAST_MS);
      },
      [],
    );

    useEffect(() => {
      acLog("AutocorrectTextarea mount");
    }, []);

    useEffect(() => {
      if (value === "") {
        undoStackRef.current = [];
        clearToast();
      }
    }, [value, clearToast]);

    const tryApplySeparator = useCallback(
      (sep: TriggerSep, cursor: number, prevent: () => void) => {
        const prefs = getSpellPrefs();
        if (!prefs.autocorrectWhileTyping) return false;
        const applied = applyAutocorrectAtTrigger(value, cursor, sep, prefs);
        if (!applied) return false;
        acLog("REPLACE", {
          original: applied.undo.originalWord,
          corrected: applied.newValue.slice(applied.undo.replaceStart, applied.undo.replaceEnd),
          newCursor: applied.newCursor,
        });
        prevent();
        flushChange(applied.newValue, applied.newCursor, applied.newCursor);
        const correctedWord = applied.newValue.slice(applied.undo.replaceStart, applied.undo.replaceEnd);
        pushUndo(applied.undo, correctedWord);
        acLog("undo stack depth", undoStackRef.current.length);
        return true;
      },
      [value, flushChange, pushUndo],
    );

    const handleBeforeInput = (e: FormEvent<HTMLTextAreaElement>) => {
      const native = e.nativeEvent as InputEvent;
      if (native.inputType !== "insertText" || native.isComposing) return;
      const data = native.data;
      if (data !== " " && data !== "\u00a0") return;
      const prefs = getSpellPrefs();
      if (!prefs.autocorrectWhileTyping) return;
      const el = e.currentTarget;
      const a = el.selectionStart ?? 0;
      const b = el.selectionEnd ?? 0;
      if (a !== b) return;
      const sep: TriggerSep = { char: data === "\u00a0" ? "\u00a0" : " ", preventDefault: true };
      const range = getWordRangeBeforeCursor(value, a);
      acLog("beforeinput space", { cursor: a, range });
      if (tryApplySeparator(sep, a, () => e.preventDefault())) return;
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.ctrlKey && e.shiftKey && !e.altKey && (e.key === "z" || e.key === "Z")) {
        if (undoLast()) {
          acLog("undo stack pop (Ctrl+Shift+Z)");
          e.preventDefault();
          return;
        }
      }

      const prefs = getSpellPrefs();
      const sep = prefs.autocorrectWhileTyping ? triggerSeparator(e) : null;
      if (sep) {
        acLog("keydown", {
          key: e.key,
          code: e.code,
          autocorrectWhileTyping: prefs.autocorrectWhileTyping,
          isComposing: e.nativeEvent.isComposing,
        });
      }

      if (
        sep &&
        !e.nativeEvent.isComposing &&
        !e.altKey &&
        !(e.ctrlKey && e.code !== "Space" && e.key !== " ") &&
        !(e.metaKey && e.code !== "Space" && e.key !== " ")
      ) {
        const el = e.currentTarget;
        const a = el.selectionStart ?? 0;
        const b = el.selectionEnd ?? 0;
        if (a === b) {
          const range = getWordRangeBeforeCursor(value, a);
          acLog("eval word before cursor", { cursor: a, range });
          if (tryApplySeparator(sep, a, () => e.preventDefault())) return;
          if (prefs.autocorrectWhileTyping && range) {
            acLog("no rule for word", { raw: range.raw });
          }
        } else {
          acLog("skip autocorrect (selection not collapsed)", { a, b });
        }
      } else if (sep && !prefs.autocorrectWhileTyping) {
        acLog("autocorrect disabled in prefs");
      }

      onKeyDown?.(e);
    };

    return (
      <div className={wrapperClassName ? `relative ${wrapperClassName}` : "relative"}>
        {undoUi ? (
          <div
            className="absolute bottom-full left-0 right-0 z-10 mb-1 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-950 shadow-sm dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
            role="status"
          >
            <span className="min-w-0 flex-1">
              Corregido: <span className="font-medium">{undoUi.original}</span> →{" "}
              <span className="font-medium">{undoUi.corrected}</span>
            </span>
            <button
              type="button"
              className="shrink-0 rounded bg-amber-600 px-2 py-0.5 font-medium text-white hover:bg-amber-700"
              onClick={() => {
                void undoLast();
              }}
            >
              Deshacer
            </button>
          </div>
        ) : null}
        <textarea
          ref={setRefs}
          {...rest}
          className={className}
          value={value}
          spellCheck={spellCheck}
          onBeforeInput={handleBeforeInput}
          onChange={onChange}
          onKeyDown={handleKeyDown}
        />
      </div>
    );
  },
);
