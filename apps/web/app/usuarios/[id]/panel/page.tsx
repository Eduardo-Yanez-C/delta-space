"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "../../../../lib/auth-context";
import {
  fetchCommercialPerformance,
  fetchSuiteAgentUsageAdmin,
  fetchSuiteAgentUsageMe,
  fetchUser,
  type CommercialPerformanceData,
  type SuiteAgentUsageAdminResponse,
  type SuiteAgentUsageMeResponse,
  type User,
} from "../../../../lib/api";
import { canManageUserRow } from "../../../../lib/role-utils";
import { useCan } from "../../../../lib/useCan";

function defaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function utcYearMonth(): { y: number; m: number } {
  const d = new Date();
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
}

function formatTokens(n: number): string {
  return n.toLocaleString("es");
}

export default function UsuarioPanelPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { user: currentUser } = useAuth();
  const canUsersAdmin = useCan("access", "users");
  const canCommercial = useCan("access", "commercialPerformance");

  const [target, setTarget] = useState<User | null>(null);
  const [iaAdmin, setIaAdmin] = useState<SuiteAgentUsageAdminResponse | null>(null);
  const [iaMe, setIaMe] = useState<SuiteAgentUsageMeResponse | null>(null);
  const [commercial, setCommercial] = useState<CommercialPerformanceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isIaAdmin = useMemo(
    () => !!currentUser?.roles?.some((r) => r === "ADMIN" || r === "ADMIN_DEV"),
    [currentUser?.roles],
  );

  const canView = useMemo(() => {
    if (!id || !currentUser) return false;
    if (canUsersAdmin) return true;
    if (currentUser.id === id) return true;
    if (!target) return false;
    return canManageUserRow(currentUser.roles, currentUser.id, { id, roles: target.roles });
  }, [id, currentUser, canUsersAdmin, target]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const { y, m } = utcYearMonth();
    const range = defaultDateRange();
    try {
      const u = await fetchUser(id);
      setTarget(u);
      const promises: Promise<unknown>[] = [];
      if (canUsersAdmin && isIaAdmin) {
        promises.push(
          fetchSuiteAgentUsageAdmin({ year: y, month: m, userId: id })
            .then(setIaAdmin)
            .catch(() => setIaAdmin(null)),
        );
      } else {
        setIaAdmin(null);
      }
      if (currentUser?.id === id) {
        promises.push(
          fetchSuiteAgentUsageMe({ year: y, month: m })
            .then(setIaMe)
            .catch(() => setIaMe(null)),
        );
      } else {
        setIaMe(null);
      }
      if (canCommercial && canUsersAdmin) {
        promises.push(
          fetchCommercialPerformance({ from: range.from, to: range.to, userIds: [id] })
            .then(setCommercial)
            .catch(() => setCommercial(null)),
        );
      } else {
        setCommercial(null);
      }
      await Promise.all(promises);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
      setTarget(null);
    } finally {
      setLoading(false);
    }
  }, [id, canUsersAdmin, canCommercial, isIaAdmin, currentUser?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!id) {
    return <div className="card p-6 text-slate-600">Identificador inválido.</div>;
  }

  if (error && !target) {
    return (
      <div className="card p-6">
        <p className="text-red-700 dark:text-red-300">{error}</p>
        <Link href="/usuarios" className="btn-secondary mt-4 inline-block">
          Volver
        </Link>
      </div>
    );
  }

  if (!loading && !canView) {
    return (
      <div className="card p-8 text-center">
        <p className="text-slate-700 dark:text-slate-200">No puede ver el panel de este usuario.</p>
        <Link href="/usuarios" className="btn-secondary mt-4 inline-block">
          Volver a la lista
        </Link>
      </div>
    );
  }

  const seller = commercial?.sellers?.[0];
  const iaDaily = iaAdmin?.dailyTotals ?? iaMe?.daily ?? [];
  const iaLimit = target?.suiteAgentMonthlyTokenLimit ?? null;
  const iaUsed = (() => {
    const row = iaAdmin?.byUser?.find((r) => r.userId === id);
    if (row != null) return row.usedTotal;
    if (iaMe != null) return iaMe.usedTotal;
    if (iaDaily.length > 0) return iaDaily.reduce((s, d) => s + d.totalTokens, 0);
    return null;
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-6 dark:border-slate-700 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Panel por usuario</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {target?.name || target?.email || "Usuario"}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{target?.email}</p>
          {target?.roles?.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {target.roles.map((r) => (
                <span
                  key={r.id}
                  className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                >
                  {r.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/usuarios/panel" className="btn-secondary text-sm">
            Panel global
          </Link>
          <Link href="/usuarios" className="btn-secondary text-sm">
            Lista
          </Link>
          {canManageUserRow(currentUser?.roles, currentUser?.id, { id, roles: target?.roles }) ? (
            <Link href={`/usuarios/${id}/editar`} className="btn-primary text-sm">
              Editar y límite IA
            </Link>
          ) : null}
        </div>
      </div>

      {loading ? <div className="card p-8 text-center text-slate-500">Cargando…</div> : null}

      {!loading && target ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase text-slate-500 dark:text-slate-400">Uso IA (suite)</h2>
            <p className="mt-1 text-xs text-slate-500">Mes UTC actual</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600 dark:text-slate-400">Tokens usados</dt>
                <dd className="font-semibold tabular-nums">{iaUsed != null ? formatTokens(iaUsed) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600 dark:text-slate-400">Límite mensual</dt>
                <dd className="font-medium">
                  {iaLimit != null && iaLimit > 0 ? formatTokens(iaLimit) : "Sin límite"}
                </dd>
              </div>
            </dl>
            {iaDaily.length > 0 ? (
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={iaDaily} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                    <XAxis dataKey="shortLabel" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={44} />
                    <Tooltip formatter={(value) => formatTokens(Number(value))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="totalTokens" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Sin actividad de IA este mes.</p>
            )}
          </section>

          <section className="card p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase text-slate-500 dark:text-slate-400">Ventas y estudios FV</h2>
            <p className="mt-1 text-xs text-slate-500">Periodo: mes en curso (admin comercial)</p>
            {seller ? (
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/80">
                  <dt className="text-xs text-slate-500">Cotizaciones</dt>
                  <dd className="text-xl font-semibold tabular-nums">{seller.quotesCreated}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/80">
                  <dt className="text-xs text-slate-500">Estudios FV</dt>
                  <dd className="text-xl font-semibold tabular-nums">{seller.fvStudiesCreated}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/80">
                  <dt className="text-xs text-slate-500">Convertidos</dt>
                  <dd className="text-xl font-semibold text-emerald-700 dark:text-emerald-300">{seller.fvStudiesConverted}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/80">
                  <dt className="text-xs text-slate-500">Monto cotizado</dt>
                  <dd className="text-xl font-semibold tabular-nums">{Math.round(seller.totalQuotedAmount).toLocaleString("es")}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                {canCommercial && canUsersAdmin
                  ? "Sin datos de rendimiento comercial en este periodo, o el usuario no tiene actividad atribuida."
                  : "Los KPIs comerciales por persona están disponibles para administradores."}
              </p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
