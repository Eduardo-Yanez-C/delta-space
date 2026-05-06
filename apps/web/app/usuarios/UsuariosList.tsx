"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { canManageUserRow } from "../../lib/role-utils";
import { useCan } from "../../lib/useCan";
import { fetchUsers, type User } from "../../lib/api";

export function UsuariosList() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const canCreate = useCan("create", "users");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("");

  const load = () => {
    setLoading(true);
    setError(null);
    const activeOnly = activeFilter === "true" ? true : activeFilter === "false" ? false : undefined;
    fetchUsers(activeOnly)
      .then((data) => setUsers(data))
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [activeFilter]);

  if (loading && users.length === 0) {
    return (
      <div className="card flex items-center justify-center p-12">
        <span className="text-slate-500">Cargando usuarios…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        {error}
      </div>
    );
  }

  const filtered = search.trim()
    ? users.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(search.trim().toLowerCase())) ||
          u.email.toLowerCase().includes(search.trim().toLowerCase())
      )
    : users;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field max-w-xs"
          />
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="input-field max-w-[140px]"
          >
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-600 dark:text-slate-300">
                  Nombre
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-600 dark:text-slate-300">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-600 dark:text-slate-300">
                  Roles
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-600 dark:text-slate-300">
                  Estado
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-600 dark:text-slate-300">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-300">
                    <p>No hay usuarios que coincidan.</p>
                    {canCreate && (
                      <Link href="/usuarios/nuevo" className="btn-primary mt-3 inline-block">
                        Crear usuario
                      </Link>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const canEditRow = canManageUserRow(currentUser?.roles, currentUser?.id, u);
                  return (
                  <tr
                    key={u.id}
                    role="button"
                    tabIndex={0}
                    title="Abrir panel (IA, ventas, estudios)"
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                    onClick={() => router.push(`/usuarios/${u.id}/panel`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/usuarios/${u.id}/panel`);
                      }
                    }}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {u.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{u.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles?.length
                          ? u.roles.map((r) => (
                              <span
                                key={r.id}
                                className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                              >
                                {r.name}
                              </span>
                            ))
                          : "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          u.active
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                            : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200"
                        }`}
                      >
                        {u.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td
                      className="whitespace-nowrap px-4 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      {canEditRow ? (
                        <Link
                          href={`/usuarios/${u.id}/editar`}
                          className="text-amber-600 hover:underline dark:text-amber-300"
                        >
                          Editar
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
