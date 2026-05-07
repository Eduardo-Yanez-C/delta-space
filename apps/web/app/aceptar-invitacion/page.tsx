"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { acceptInvitation } from "../../lib/api";

export default function AceptarInvitacionPage() {
  const sp = useSearchParams();
  const token = sp.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  return (
    <div className="mx-auto max-w-md space-y-4 py-10">
      <div className="card p-6">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Aceptar invitación</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Configure su contraseña para activar la cuenta.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200" role="alert">
            {error}
          </div>
        )}

        {done ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
            Cuenta activada. Ya puede iniciar sesión.
          </div>
        ) : (
          <form
            className="mt-5 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              const p = password.trim();
              if (!token) return setError("Falta el token en la URL.");
              if (!p) return setError("La contraseña es obligatoria.");
              if (p.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");
              setSaving(true);
              try {
                await acceptInvitation({
                  token,
                  password: p,
                  name: name.trim() || null,
                  fullName: fullName.trim() || null,
                });
                setDone(true);
              } catch (e2) {
                setError(e2 instanceof Error ? e2.message : "No se pudo aceptar la invitación");
              } finally {
                setSaving(false);
              }
            }}
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Nombre (opcional)</label>
              <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Nombre completo (opcional)</label>
              <input className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Contraseña *</label>
              <input className="input-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={saving}>
              {saving ? "Activando…" : "Activar cuenta"}
            </button>
          </form>
        )}

        <div className="mt-4 flex justify-center">
          <Link href="/login" className="text-sm font-medium text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200">
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  );
}

