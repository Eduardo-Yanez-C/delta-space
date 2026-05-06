import {
  DEFAULT_ACCENT_PALETTE_ID,
  isValidAccentPaletteId,
} from "./accent-palettes";

const GUEST_KEY = "pfv_accent_palette_v1_guest";

export function accentPaletteStorageKey(userId: string | null | undefined): string {
  if (userId && String(userId).trim()) return `pfv_accent_palette_v1_u_${String(userId).trim()}`;
  return GUEST_KEY;
}

export function readStoredAccentPalette(userId: string | null | undefined): string {
  if (typeof window === "undefined") return DEFAULT_ACCENT_PALETTE_ID;
  const raw = window.localStorage.getItem(accentPaletteStorageKey(userId));
  if (isValidAccentPaletteId(raw)) return raw;
  return DEFAULT_ACCENT_PALETTE_ID;
}

export function writeStoredAccentPalette(userId: string | null | undefined, paletteId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(accentPaletteStorageKey(userId), paletteId);
}

/** Si el usuario no tenía paleta guardada, copia la que usaba como invitado (misma máquina). */
export function migrateGuestAccentPaletteIfNeeded(userId: string | null | undefined): void {
  if (typeof window === "undefined" || !userId) return;
  const uKey = accentPaletteStorageKey(userId);
  if (window.localStorage.getItem(uKey)) return;
  const guest = window.localStorage.getItem(GUEST_KEY);
  if (isValidAccentPaletteId(guest)) {
    window.localStorage.setItem(uKey, guest);
  }
}

export function applyAccentPaletteToDocument(paletteId: string): void {
  if (typeof document === "undefined") return;
  const id = isValidAccentPaletteId(paletteId) ? paletteId : DEFAULT_ACCENT_PALETTE_ID;
  document.documentElement.setAttribute("data-accent-palette", id);
}
