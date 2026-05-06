"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../../lib/auth-context";
import { fetchSuiteProjectWorkspace, type SuiteWorkspacePayload } from "../../../../lib/api";
import { hasSuiteNavGrant } from "../../../../lib/suite-nav-grants";
import { SuiteProjectWorkspaceDashboard } from "../../../../components/suite-pmo/SuiteProjectWorkspaceDashboard";
import { useSuiteAgentRuntime } from "../../../../components/suite-agent/SuiteAgentRuntimeProvider";

export default function SuiteProyectoDetallePage() {
  const { mergeRuntime } = useSuiteAgentRuntime();
  const router = useRouter();
  const params = useParams();
  const id = String(params.id ?? "");
  const { user, loading: authLoading } = useAuth();
  const [ws, setWs] = useState<SuiteWorkspacePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSee = useMemo(
    () => hasSuiteNavGrant(user?.suiteNavGrants ?? null, user?.roles, "proyectos"),
    [user?.suiteNavGrants, user?.roles],
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!canSee) {
      router.replace("/acceso-restringido");
      return;
    }
    if (!id) return;
    let cancelled = false;
    setError(null);
    fetchSuiteProjectWorkspace(id)
      .then((p) => {
        if (!cancelled) setWs(p);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, canSee, id, router]);

  useEffect(() => {
    if (!ws?.project) return;
    mergeRuntime({
      projectId: ws.project.id,
      projectName: ws.project.name,
      summary: `Resumen del proyecto ${ws.project.code}: KPIs, salud y alertas en pantalla.`,
    });
  }, [ws, mergeRuntime]);

  if (authLoading || (!user && !error)) {
    return <p className="p-6 text-sm text-slate-600">Cargando…</p>;
  }
  if (error) {
    return (
      <main className="p-6">
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/vista-previa-suite/proyectos" className="mt-4 inline-block text-sm text-primary-600 underline">
          Volver al listado
        </Link>
      </main>
    );
  }
  if (!ws) {
    return <p className="p-6 text-sm text-slate-500">Cargando panel del proyecto…</p>;
  }

  return (
    <main className="p-4 md:p-6">
      <SuiteProjectWorkspaceDashboard ws={ws} projectId={id} />
    </main>
  );
}
