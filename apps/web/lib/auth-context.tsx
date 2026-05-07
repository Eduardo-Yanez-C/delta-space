"use client";

/**
 * Contexto de autenticación.
 * Persistencia del token en localStorage es una decisión temporal para MVP;
 * en producción se valorará cookie httpOnly u otro mecanismo más seguro.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, impersonateUser, login as apiLogin, setAuthToken, type AuthUser } from "./api";
import { registerDesktopChatNotify } from "./desktop-chat-notify";
import { conversationsRealtime } from "./conversations-realtime";

const STORAGE_KEY = "pv_quoting_token";
const IMPERSONATION_ADMIN_TOKEN_KEY = "pv_quoting_impersonation_admin_token";
const SESSION_CHECK_TIMEOUT_MS = 10000;

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  impersonate: (userId: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const setUser = useCallback((u: AuthUser | null) => {
    setUserState(u);
  }, []);

  const logout = useCallback(() => {
    conversationsRealtime.disconnect();
    setAuthToken(null);
    setTokenState(null);
    setUserState(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(IMPERSONATION_ADMIN_TOKEN_KEY);
    }
    router.push("/login");
  }, [router]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiLogin(email, password);
      setAuthToken(res.accessToken);
      setTokenState(res.accessToken);
      setUserState(res.user);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, res.accessToken);
        window.localStorage.removeItem(IMPERSONATION_ADMIN_TOKEN_KEY);
      }
      router.push("/");
    },
    [router],
  );

  const impersonate = useCallback(
    async (userId: string) => {
      if (typeof window === "undefined") return;
      const currentToken = token ?? window.localStorage.getItem(STORAGE_KEY);
      if (currentToken) {
        window.localStorage.setItem(IMPERSONATION_ADMIN_TOKEN_KEY, currentToken);
      }
      const res = await impersonateUser(userId);
      setAuthToken(res.accessToken);
      setTokenState(res.accessToken);
      setUserState(res.user);
      window.localStorage.setItem(STORAGE_KEY, res.accessToken);
      router.push("/");
    },
    [router, token],
  );

  const stopImpersonation = useCallback(async () => {
    if (typeof window === "undefined") return;
    const adminToken = window.localStorage.getItem(IMPERSONATION_ADMIN_TOKEN_KEY);
    if (!adminToken) return;
    window.localStorage.removeItem(IMPERSONATION_ADMIN_TOKEN_KEY);
    setAuthToken(adminToken);
    setTokenState(adminToken);
    window.localStorage.setItem(STORAGE_KEY, adminToken);
    try {
      const u = await getMe();
      setUserState(u);
    } catch {
      // si falló, forzar logout limpio
      conversationsRealtime.disconnect();
      setAuthToken(null);
      setTokenState(null);
      setUserState(null);
      window.localStorage.removeItem(STORAGE_KEY);
      router.push("/login");
      return;
    }
    router.push("/");
  }, [router]);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (!stored) {
      setLoading(false);
      return;
    }
    setAuthToken(stored);
    setTokenState(stored);
    setLoading(true);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Session check timeout")), SESSION_CHECK_TIMEOUT_MS);
    });
    Promise.race([getMe(), timeoutPromise])
      .then((u) => {
        setUserState(u);
      })
      .catch(() => {
        setAuthToken(null);
        setTokenState(null);
        setUserState(null);
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  /** Socket de conversaciones: siempre Nest local (`getLocalConversationsApiBase`), no el nodo de datos remoto. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!token || !user) {
      conversationsRealtime.disconnect();
      return;
    }
    conversationsRealtime.connect();
    const id = window.setInterval(() => {
      conversationsRealtime.connect();
    }, 3000);
    return () => {
      window.clearInterval(id);
    };
  }, [user?.id, token]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onApiBaseChanged = () => {
      if (token && user) {
        conversationsRealtime.connect();
      }
    };
    window.addEventListener("pvquoting:api-base-changed", onApiBaseChanged);
    return () => window.removeEventListener("pvquoting:api-base-changed", onApiBaseChanged);
  }, [token, user?.id]);

  /** Sonido + flash barra de tareas (solo app desktop) ante mensajes de otros usuarios. */
  useEffect(() => {
    if (typeof window === "undefined" || !token || !user?.id) return;
    return registerDesktopChatNotify(user.id);
  }, [token, user?.id]);

  const value: AuthContextValue = {
    user,
    token,
    loading,
    login,
    logout,
    impersonate,
    stopImpersonation,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return ctx;
}
