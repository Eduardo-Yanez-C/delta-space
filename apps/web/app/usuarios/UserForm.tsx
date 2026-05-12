"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { fetchCompanies, fetchRoles, type Company, type Role, type User } from "../../lib/api";
import { SUITE_NAV_GRANT_KEYS, normalizeGrantsForSubmit } from "../../lib/suite-nav-grants";
import { SUITE_NAV_REGISTRY } from "../../lib/suite-nav-registry";

type CreatePayload = {
  email: string;
  password: string;
  name?: string;
  fullName?: string;
  roleIds: number[];
  active: boolean;
  suiteNavGrants: string[] | null;
  suiteAgentMonthlyTokenLimit: number | null;
  accessExpiresAt: string | null;
  companyId: string;
};
type UpdatePayload = {
  name?: string;
  fullName?: string;
  active: boolean;
  roleIds: number[];
  suiteNavGrants: string[] | null;
  suiteAgentMonthlyTokenLimit: number | null;
  accessExpiresAt: string | null;
  companyId: string;
};

type Props =
  | {
      mode: "create";
      onSubmit: (data: CreatePayload) => Promise<void>;
    }
  | {
      mode: "edit";
      initial: User;
      onSubmit: (data: UpdatePayload) => Promise<void>;
    };

function initialSuiteGrantsFromUser(user: User | null): string[] {
  if (user?.suiteNavGrants != null && Array.isArray(user.suiteNavGrants)) {
    return [...user.suiteNavGrants];
  }
  return [...SUITE_NAV_GRANT_KEYS];
}

function iaLimitFromUser(user: User | null): string {
  if (!user || user.suiteAgentMonthlyTokenLimit == null) return "";
  return String(user.suiteAgentMonthlyTokenLimit);
}

function parseIaTokenLimitInput(raw: string): number | null {
  const s = raw.trim();
  if (s === "") return null;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("El límite de tokens de SAM debe ser un entero ≥ 0, o vacío para sin límite.");
  }
  return n;
}

function utcEndOfCalendarDayIsoFromYmd(ymd: string): string {
  const t = ymd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    throw new Error("Use una fecha válida (AAAA-MM-DD).");
  }
  return `${t}T23:59:59.999Z`;
}

function licenseExpiresDateLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return iso;
    return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export function UserForm(props: Props) {
  const isEdit = props.mode === "edit";
  const initialUser = isEdit ? props.initial : null;
  const [roles, setRoles] = useState<Role[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [form, setForm] = useState({
    email: isEdit && initialUser ? initialUser.email : "",
    password: "",
    name: isEdit && initialUser ? initialUser.name ?? "" : "",
    fullName: isEdit && initialUser ? (initialUser.fullName ?? "") : "",
    roleIds: isEdit && initialUser
      ? (initialUser.roles?.map((r) => r.id).filter((id): id is number => typeof id === "number" && Number.isInteger(id)) ??
        [])
      : [],
    active: isEdit && initialUser ? initialUser.active : true,
    iaTokenLimit: iaLimitFromUser(initialUser),
    licenseUnlimited: !initialUser?.accessExpiresAt,
    licenseEndDate: initialUser?.accessExpiresAt ? initialUser.accessExpiresAt.slice(0, 10) : "",
    companyId: initialUser?.companyId ?? "company_default",
  });
  const [suiteGrants, setSuiteGrants] = useState<string[]>(() => initialSuiteGrantsFromUser(initialUser));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRoles()
      .then(setRoles)
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar roles"));
  }, []);

  useEffect(() => {
    fetchCompanies()
      .then(setCompanies)
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar empresas"));
  }, []);

  useEffect(() => {
    if (isEdit && initialUser) {
      setForm({
        email: initialUser.email,
        password: "",
        name: initialUser.name ?? "",
        fullName: initialUser.fullName ?? "",
        roleIds: initialUser.roles?.map((r) => r.id).filter((id): id is number => typeof id === "number" && Number.isInteger(id)) ?? [],
        active: initialUser.active,
        iaTokenLimit: iaLimitFromUser(initialUser),
        licenseUnlimited: !initialUser.accessExpiresAt,
        licenseEndDate: initialUser.accessExpiresAt ? initialUser.accessExpiresAt.slice(0, 10) : "",
        companyId: initialUser.companyId ?? "company_default",
      });
      setSuiteGrants(initialSuiteGrantsFromUser(initialUser));
    }
  }, [isEdit, initialUser]);

  const toggleRole = (roleId: number) => {
    setForm((prev) => ({
      ...prev,
      roleIds: prev.roleIds.includes(roleId)
        ? prev.roleIds.filter((id) => id !== roleId)
        : [...prev.roleIds, roleId],
    }));
  };

  const toggleGrant = (key: string) => {
    setSuiteGrants((prev) => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key);
      else s.add(key);
      return SUITE_NAV_GRANT_KEYS.filter((k) => s.has(k));
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const suiteNavGrants = normalizeGrantsForSubmit(suiteGrants);
      const suiteAgentMonthlyTokenLimit = parseIaTokenLimitInput(form.iaTokenLimit);
      let accessExpiresAt: string | null;
      if (form.licenseUnlimited) {
        accessExpiresAt = null;
      } else {
        const d = form.licenseEndDate.trim();
        if (!d) {
          throw new Error("Indique la fecha de fin de licencia o marque «Sin fecha de fin».");
        }
        accessExpiresAt = utcEndOfCalendarDayIsoFromYmd(d);
      }
      if (props.mode === "create") {
        await props.onSubmit({
          email: form.email.trim(),
          password: form.password,
          name: form.name.trim() || undefined,
          fullName: form.fullName.trim() || undefined,
          roleIds: form.roleIds,
          companyId: form.companyId,
          active: form.active,
          suiteNavGrants,
          suiteAgentMonthlyTokenLimit,
          accessExpiresAt,
        });
      } else {
        await props.onSubmit({
          name: form.name.trim() || undefined,
          fullName: form.fullName.trim() || undefined,
          active: form.active,
          roleIds: form.roleIds,
          companyId: form.companyId,
          suiteNavGrants,
          suiteAgentMonthlyTokenLimit,
          accessExpiresAt,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      {props.mode === "create" && (
        <>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email *</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="input-field"
              placeholder="usuario@ejemplo.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Contraseña *</label>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="input-field"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
        </>
      )}

      {props.mode === "edit" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-500">Email</label>
          <p className="text-slate-700">{form.email}</p>
          <p className="text-xs text-slate-500">El email no se puede modificar.</p>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Nombre</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="input-field"
          placeholder="Opcional"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Nombre completo</label>
        <input
          type="text"
          value={form.fullName}
          onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
          className="input-field"
          placeholder="Ej: Eduardo Yañez Concha"
        />
        <p className="mt-0.5 text-xs text-slate-500">Para header y documentos (se muestra como primer nombre + primer apellido).</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Empresa</label>
        <select
          value={form.companyId}
          onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))}
          className="input-field"
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.active === false ? "(inactiva)" : ""}
            </option>
          ))}
          {companies.length === 0 && (
            <option value={form.companyId}>Cargando…</option>
          )}
        </select>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Determina qué datos y archivos verá el usuario (multi-empresa).
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-200">
          Licencia de acceso
        </h3>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Tras la fecha indicada el usuario no podrá iniciar sesión ni usar la API hasta que un administrador amplíe la
          licencia. Deje «Sin fecha de fin» para acceso sin caducidad por calendario.
        </p>
        {initialUser?.accessExpiresAt && (
          <p className="mt-2 text-xs text-slate-700 dark:text-slate-300">
            Estado actual: caduca el{" "}
            <span className="font-semibold">{licenseExpiresDateLabel(initialUser.accessExpiresAt)}</span> (fin del día
            UTC indicado).
          </p>
        )}
        <div className="mt-3 flex items-center gap-2">
          <input
            type="checkbox"
            id="license-unlimited"
            checked={form.licenseUnlimited}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                licenseUnlimited: e.target.checked,
              }))
            }
            className="h-4 w-4 rounded border-slate-300 text-amber-600"
          />
          <label htmlFor="license-unlimited" className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Sin fecha de fin de licencia
          </label>
        </div>
        {!form.licenseUnlimited && (
          <div className="mt-3">
            <label
              htmlFor="license-end"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Acceso permitido hasta (inclusive)
            </label>
            <input
              id="license-end"
              type="date"
              value={form.licenseEndDate}
              onChange={(e) => setForm((f) => ({ ...f, licenseEndDate: e.target.value }))}
              className="input-field max-w-xs"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Se aplica hasta el final del día UTC de la fecha elegida.
            </p>
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Límite mensual de tokens — SAM (suite)
        </label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={form.iaTokenLimit}
          onChange={(e) => setForm((f) => ({ ...f, iaTokenLimit: e.target.value.replace(/\D/g, "") }))}
          className="input-field"
          placeholder="Vacío = sin límite (mes UTC, según OpenAI total_tokens)"
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Controla el consumo de SAM (✦) por usuario. El uso y gráficos están en{" "}
          <span className="font-medium text-slate-700 dark:text-slate-200">SAM → Uso SAM</span>.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-200">Roles</h3>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Perfil base del usuario (permisos sobre datos: cotizaciones, clientes, administración, etc.).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {roles.map((r) => (
            <label
              key={r.id}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700/80"
            >
              <input
                type="checkbox"
                checked={form.roleIds.includes(r.id)}
                onChange={() => toggleRole(r.id)}
                className="h-4 w-4 rounded border-slate-300 text-amber-600"
              />
              <span className="text-sm text-slate-700 dark:text-slate-200">{r.name}</span>
            </label>
          ))}
        </div>
        {roles.length === 0 && <p className="mt-2 text-sm text-slate-500">Cargando roles…</p>}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-200">
          Acceso al menú lateral (suite)
        </h3>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Marque las secciones visibles en la barra oscura. La lista coincide con el registro del menú en código
          (`suite-nav-registry.ts`): al incorporar nuevas vistas principales o subítems de Ventas o Logística, aparecerán aquí
          automáticamente. Si deja todas marcadas, el usuario tendrá acceso completo al menú (equivalente a no
          restricción). Solo el rol desarrollador (ADMIN_DEV) ve siempre todo el menú; el rol ADMIN respeta estas casillas.
        </p>
        <div className="mt-4 space-y-3">
          {SUITE_NAV_REGISTRY.map((entry) =>
            entry.kind === "link" ? (
              <label
                key={entry.grantKey}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
              >
                <input
                  type="checkbox"
                  checked={suiteGrants.includes(entry.grantKey)}
                  onChange={() => toggleGrant(entry.grantKey)}
                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-amber-600"
                />
                <span className="text-sm text-slate-800 dark:text-slate-100">{entry.label}</span>
              </label>
            ) : (
              <div
                key={`${entry.kind}-${entry.hubHref}`}
                className="rounded-lg border border-slate-200/90 bg-white p-3 dark:border-slate-600 dark:bg-slate-800/80"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  {entry.label}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Submódulos del menú lateral (mismo desplegable que en la barra oscura).
                </p>
                <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 dark:border-slate-700">
                  {entry.children.map((child) => (
                    <label key={child.grantKey} className="flex cursor-pointer items-center gap-2 pl-1">
                      <input
                        type="checkbox"
                        checked={suiteGrants.includes(child.grantKey)}
                        onChange={() => toggleGrant(child.grantKey)}
                        className="h-4 w-4 shrink-0 rounded border-slate-300 text-amber-600"
                      />
                      <span className="text-sm text-slate-800 dark:text-slate-100">{child.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="active"
          checked={form.active}
          onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
          className="h-4 w-4 rounded border-slate-300 text-amber-600"
        />
        <label htmlFor="active" className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Usuario activo
        </label>
      </div>

      <div className="flex gap-3">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear usuario"}
        </button>
        <Link href="/usuarios" className="btn-secondary">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
