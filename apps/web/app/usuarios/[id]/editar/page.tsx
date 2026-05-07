"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../../lib/auth-context";
import { useCan } from "../../../../lib/useCan";
import { UserForm } from "../../UserForm";
import {
  fetchUser,
  getMe,
  updateUser,
  activateUser,
  deactivateUser,
  resetUserPassword,
  type User,
} from "../../../../lib/api";
import { actorIsAdminDev, userHasElevatedRole } from "../../../../lib/role-utils";

export default function EditarUsuarioPage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser, setUser: setAuthUser } = useAuth();
  const canDeactivateUser = useCan("deactivate", "users");
  const id = typeof params.id === "string" ? params.id : "";
  const [editedUser, setEditedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isEditingSelf = !!currentUser && currentUser.id === id;

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    fetchUser(id)
      .then(setEditedUser)
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleActivate = async () => {
    setActionError(null);
    try {
      await activateUser(id);
      setEditedUser((prev) => (prev ? { ...prev, active: true } : null));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Error al activar");
    }
  };

  const handleDeactivate = async () => {
    if (isEditingSelf) {
      const confirmed = window.confirm(
        "Está a punto de desactivar su propio usuario. Si continúa, podría perder acceso al sistema hasta que un administrador le reactive. ¿Desea continuar?"
      );
      if (!confirmed) return;
    } else {
      if (!window.confirm("¿Desactivar este usuario? No podrá iniciar sesión hasta que un administrador lo reactive.")) return;
    }
    setActionError(null);
    try {
      await deactivateUser(id);
      setEditedUser((prev) => (prev ? { ...prev, active: false } : null));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Error al desactivar");
    }
  };

  const handleResetPassword = async () => {
    setActionError(null);
    const pwd1 = window.prompt(
      "Nueva contraseña (mínimo 6 caracteres). Se guardará en el servidor y reemplazará la actual.",
    );
    if (pwd1 == null) return;
    const pwd = pwd1.trim();
    if (pwd.length < 6) {
      setActionError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    const confirmPwd = window.prompt("Confirme la nueva contraseña.");
    if (confirmPwd == null) return;
    if (confirmPwd.trim() !== pwd) {
      setActionError("Las contraseñas no coinciden.");
      return;
    }
    try {
      await resetUserPassword(id, pwd);
      window.alert("Contraseña restablecida.");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Error al restablecer contraseña");
    }
  };

  if (loading) {
    return (
      <div className="card flex items-center justify-center p-12">
        <span className="text-slate-500">Cargando usuario…</span>
      </div>
    );
  }

  if (error || !editedUser) {
    return (
      <div className="card p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200" role="alert">
          {error ?? "Usuario no encontrado"}
        </div>
        <Link href="/usuarios" className="btn-secondary mt-3 inline-block">
          Volver a usuarios
        </Link>
      </div>
    );
  }

  const targetElevated = userHasElevatedRole(editedUser.roles);
  const blockElevatedOthers =
    !!currentUser &&
    targetElevated &&
    !isEditingSelf &&
    !actorIsAdminDev(currentUser.roles);

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {actionError}
          <button type="button" onClick={() => setActionError(null)} className="ml-2 underline">
            Cerrar
          </button>
        </div>
      )}
      {isEditingSelf && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-medium">Está editando su propio usuario.</p>
          <p className="mt-1 text-sm">
            Si se desactiva a sí mismo, podría perder el acceso hasta que otro administrador le reactive.
          </p>
        </div>
      )}

      <div className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Editar usuario</h2>
          {!blockElevatedOthers && (
            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  title="Restablecer contraseña del usuario"
                >
                  Restablecer contraseña
                </button>
                {editedUser.active ? (
                  canDeactivateUser ? (
                    <button
                      type="button"
                      onClick={handleDeactivate}
                      className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-700 dark:bg-slate-900 dark:text-red-200 dark:hover:bg-red-950/30"
                    >
                      Desactivar usuario
                    </button>
                  ) : null
                ) : (
                  <button
                    type="button"
                    onClick={handleActivate}
                    className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-slate-900 dark:text-emerald-200 dark:hover:bg-emerald-950/30"
                  >
                    Activar usuario
                  </button>
                )}
              </div>
              {editedUser.active && !canDeactivateUser && (
                <span className="max-w-xs text-right text-xs text-slate-500 dark:text-slate-300">
                  Solo el administrador desarrollador puede desactivar usuarios.
                </span>
              )}
            </div>
          )}
        </div>
        {blockElevatedOthers ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <p className="font-medium text-slate-900 dark:text-slate-100">Vista de solo lectura</p>
            <p className="mt-2">
              No puede modificar usuarios con rol de administrador o administrador desarrollador. Solo un administrador
              desarrollador puede gestionar estos perfiles.
            </p>
            <Link href="/usuarios" className="btn-secondary mt-4 inline-block">
              Volver a usuarios
            </Link>
          </div>
        ) : (
          <UserForm
            mode="edit"
            initial={editedUser}
            onSubmit={async (data) => {
              const payload = {
                name: data.name ?? undefined,
                fullName:
                  data.fullName != null && String(data.fullName).trim() !== ""
                    ? String(data.fullName).trim()
                    : undefined,
                active: data.active,
                roleIds: data.roleIds,
                suiteNavGrants: data.suiteNavGrants,
                suiteAgentMonthlyTokenLimit: data.suiteAgentMonthlyTokenLimit,
                accessExpiresAt: data.accessExpiresAt,
              };
              await updateUser(id, payload);
              if (currentUser?.id === id) {
                try {
                  setAuthUser(await getMe());
                } catch {
                  /* sesión sigue válida; el listado ya guardó */
                }
              }
              router.push("/usuarios?success=updated");
            }}
          />
        )}
      </div>
    </div>
  );
}
