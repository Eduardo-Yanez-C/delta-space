"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createUserInvitation, fetchCompanies, fetchRoles, fetchUserInvitations, type Company, type Role, type UserInvitation } from "../../../lib/api";
import { useCan } from "../../../lib/useCan";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function InvitacionesAdminPage() {
  const canAccess = useCan("access", "users"); // mismo permiso que gestión de usuarios
  const [list, setList] = useState<UserInvitation[] | null>(null);
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [roleIds, setRoleIds] = useState<number[]>([]);
  const [expiresDays, setExpiresDays] = useState(7);
  const [nameHint, setNameHint] = useState("");
  const [fullNameHint, setFullNameHint] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([fetchUserInvitations(), fetchCompanies(), fetchRoles()])
      .then(([inv, comps, rs]) => {
        setList(inv);
        setCompanies(comps);
        setRoles(rs);
        if (!companyId && comps.length > 0) setCompanyId(comps[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!canAccess) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  const byStatus = useMemo(() => {
    if (!list) return [];
    return [...list].sort((a, b) => {
      const aa = a.acceptedAt ? 1 : 0;
      const bb = b.acceptedAt ? 1 : 0;
      if (aa !== bb) return aa - bb;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [list]);

  if (!canAccess) {
    return (
      <div className="card p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200" role="alert">
          No tiene permisos para administrar invitaciones.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Invitaciones</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Crea un link para que la persona configure su contraseña (sin que el admin la vea).
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={load} type="button">Recargar</button>
            <Link className="btn-secondary" href="/usuarios">Usuarios</Link>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200" role="alert">
            {error}
          </div>
        )}

        <form
          className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setCreatedLink(null);
            setError(null);
            const eNorm = email.trim().toLowerCase();
            if (!eNorm) return setError("Email es obligatorio");
            if (!companyId) return setError("Empresa es obligatoria");
            const expiresAt = new Date(Date.now() + Math.max(1, expiresDays) * 24 * 60 * 60 * 1000).toISOString();
            setCreating(true);
            try {
              const { token } = await createUserInvitation({
                email: eNorm,
                companyId,
                roleIds,
                expiresAt,
                nameHint: nameHint.trim() || null,
                fullNameHint: fullNameHint.trim() || null,
              });
              const link = `${window.location.origin}/aceptar-invitacion?token=${encodeURIComponent(token)}`;
              setCreatedLink(link);
              setEmail("");
              setNameHint("");
              setFullNameHint("");
              setRoleIds([]);
              load();
            } catch (e2) {
              setError(e2 instanceof Error ? e2.message : "Error al crear invitación");
            } finally {
              setCreating(false);
            }
          }}
        >
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Email *</label>
            <input className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@empresa.com" required />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Empresa *</label>
            <select className="input-field" value={companyId} onChange={(e) => setCompanyId(e.target.value)} required>
              {(companies ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.slug})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Expira en (días)</label>
            <input type="number" min={1} max={60} className="input-field" value={expiresDays} onChange={(e) => setExpiresDays(Number(e.target.value) || 7)} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Nombre (hint)</label>
            <input className="input-field" value={nameHint} onChange={(e) => setNameHint(e.target.value)} placeholder="(opcional)" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Nombre completo (hint)</label>
            <input className="input-field" value={fullNameHint} onChange={(e) => setFullNameHint(e.target.value)} placeholder="(opcional)" />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Roles</label>
            <div className="flex flex-wrap gap-2">
              {(roles ?? []).map((r) => {
                const checked = roleIds.includes(r.id);
                return (
                  <label key={r.id} className="inline-flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setRoleIds((prev) => {
                          if (e.target.checked) return [...prev, r.id];
                          return prev.filter((x) => x !== r.id);
                        });
                      }}
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-200">{r.name}</span>
                  </label>
                );
              })}
              {roles && roles.length === 0 ? <span className="text-xs text-slate-500">Sin roles</span> : null}
            </div>
          </div>

          <div className="md:col-span-2 flex items-center gap-3">
            <button className="btn-primary" type="submit" disabled={creating}>
              {creating ? "Creando…" : "Crear invitación"}
            </button>
          </div>

          {createdLink && (
            <div className="md:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
              <div className="font-medium">Link creado</div>
              <div className="mt-1 break-all font-mono text-xs">{createdLink}</div>
              <div className="mt-2 flex gap-2">
                <button type="button" className="btn-secondary" onClick={() => navigator.clipboard.writeText(createdLink)}>
                  Copiar
                </button>
                <a className="btn-secondary" href={createdLink} target="_blank" rel="noreferrer">
                  Abrir
                </a>
              </div>
            </div>
          )}
        </form>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading && !list ? (
          <div className="p-10 text-center text-slate-500 dark:text-slate-400">Cargando…</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Email</th>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Empresa</th>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Estado</th>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Expira</th>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Creada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {byStatus.map((i) => {
                const expired = !i.acceptedAt && new Date(i.expiresAt).getTime() <= Date.now();
                return (
                  <tr key={i.id}>
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">{i.email}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{i.company?.name ?? i.companyId}</td>
                    <td className="px-4 py-2">
                      {i.acceptedAt ? (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">Aceptada</span>
                      ) : expired ? (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">Expirada</span>
                      ) : (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700/60 dark:text-slate-200">Pendiente</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{formatDateTime(i.expiresAt)}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{formatDateTime(i.createdAt)}</td>
                  </tr>
                );
              })}
              {list && list.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    Sin invitaciones.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

