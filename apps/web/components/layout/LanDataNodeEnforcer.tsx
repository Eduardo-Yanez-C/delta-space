"use client";

import { useEffect } from "react";
import { useAuth } from "../../lib/auth-context";
import { useCan } from "../../lib/useCan";
import { clearAutoResolvedBase, clearLanPeerRouting, getLanRouting } from "../../lib/lan-routing";

/**
 * Usuarios sin permiso de gestión de nodos no deben quedar con API remota en localStorage (restos de versiones anteriores).
 */
export function LanDataNodeEnforcer() {
  const { user, loading, logout } = useAuth();
  const canManageLanNodes = useCan("manage", "lanNodes");

  useEffect(() => {
    if (typeof window === "undefined" || loading || !user) return;
    if (canManageLanNodes) return;
    const lan = getLanRouting();
    if (lan.mode !== "lan_peer") return;
    clearLanPeerRouting();
    clearAutoResolvedBase();
    logout();
  }, [loading, user, canManageLanNodes, logout]);

  return null;
}
