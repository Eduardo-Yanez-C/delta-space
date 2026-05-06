"use client";

import { useEffect } from "react";
import { useAuth } from "../../lib/auth-context";
import {
  applyAccentPaletteToDocument,
  migrateGuestAccentPaletteIfNeeded,
  readStoredAccentPalette,
} from "../../lib/accent-theme";

/**
 * Aplica la paleta de acento guardada para el usuario actual (o invitado antes de login).
 */
export function AccentThemeSync() {
  const { user } = useAuth();

  useEffect(() => {
    migrateGuestAccentPaletteIfNeeded(user?.id ?? null);
    const id = readStoredAccentPalette(user?.id ?? null);
    applyAccentPaletteToDocument(id);
  }, [user?.id]);

  return null;
}
