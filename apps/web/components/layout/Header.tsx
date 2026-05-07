"use client";

import { useAuth } from "../../lib/auth-context";
import { useTheme } from "../../lib/theme-context";
import { useCan } from "../../lib/useCan";
import { UpdateAppButton } from "./UpdateAppButton";
import { ConnectivityLanControl } from "./ConnectivityLanControl";

/** Etiquetas de rol para mostrar en header (orden = prioridad si tiene varios). */
const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  VENTAS: "Vendedor",
  INGENIERIA: "Ingeniería",
  LECTURA: "Lectura",
};

/** Rol principal visible: primero que coincida en orden ADMIN, VENTAS, INGENIERIA, LECTURA; si no, el primero del array. */
function primaryRoleLabel(roles: string[]): string {
  if (!roles?.length) return "Usuario";
  for (const key of Object.keys(ROLE_LABELS)) {
    if (roles.includes(key)) return ROLE_LABELS[key];
  }
  return ROLE_LABELS[roles[0]] ?? roles[0];
}

/** Nombre corto para header: desde fullName (o name) primer nombre + primer apellido; si no hay, email. */
function displayUserName(fullName: string | null, name: string | null, email: string): string {
  const source = (fullName != null && fullName.trim() !== "" ? fullName : name) ?? "";
  if (source.trim() !== "") {
    const parts = source.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
    return parts[0] ?? source;
  }
  return email;
}

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user, logout, stopImpersonation } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const canUpdateApp = useCan("access", "users");

  return (
    <header className="no-print sticky top-0 z-30 border-b border-slate-200/80 bg-white shadow-md dark:border-neutral-800 dark:bg-[var(--app-shell-bg)]">
      {user?.impersonatedBy ? (
        <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="min-w-0">
            Está en <span className="font-semibold">impersonación</span> (actor:{" "}
            <span className="font-mono">{user.impersonatedBy.email}</span>).
          </div>
          <button
            type="button"
            onClick={() => void stopImpersonation()}
            className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/30"
          >
            Salir de impersonación
          </button>
        </div>
      ) : null}
      <div className="flex h-16 items-center justify-between px-6">
        <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-neutral-100">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-neutral-400">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
        <ConnectivityLanControl />
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100"
          aria-label={theme === "dark" ? "Usar modo claro" : "Usar modo oscuro"}
          title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
        >
          {theme === "dark" ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
        {user && (
          <>
            {canUpdateApp && <UpdateAppButton />}
            <div className="flex flex-col items-end text-right">
              <span className="text-sm font-medium text-slate-700 dark:text-neutral-200">
                {primaryRoleLabel(user.roles)}
              </span>
              <span className="text-xs text-slate-500 dark:text-neutral-500">
                {displayUserName(user.fullName ?? null, user.name ?? null, user.email)}
              </span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
            >
              Cerrar sesión
            </button>
          </>
        )}
      </div>
      </div>
    </header>
  );
}
