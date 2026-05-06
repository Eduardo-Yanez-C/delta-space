"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../../../lib/auth-context";
import { fetchSuiteProject } from "../../../../../lib/api";
import { hasSuiteNavGrant } from "../../../../../lib/suite-nav-grants";
import { SuitePlanningWorkspace } from "../../../../../components/suite-pmo/SuitePlanningWorkspace";

export default function SuiteProyectoPlanningPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id ?? "");
  const { user, loading: authLoading } = useAuth();
  const [projectName, setProjectName] = useState<string>("");
  const [projError, setProjError] = useState<string | null>(null);

  const canSee = useMemo(
    () => hasSuiteNavGrant(user?.suiteNavGrants ?? null, user?.roles, "proyectos"),
    [user?.suiteNavGrants, user?.roles],
  );

  useEffect(() => {
    if (authLoading || !user || !canSee || !id) return;
    fetchSuiteProject(id)
      .then((p) => setProjectName(p.name))
      .catch((e) => setProjError(e instanceof Error ? e.message : "Error"));
  }, [authLoading, user, canSee, id]);

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
  }, [authLoading, user, canSee, router]);

  if (authLoading || (!user && !projError)) {
    return <p className="p-6 text-sm text-slate-600">Cargando…</p>;
  }
  if (projError) {
    return (
      <main className="p-6">
        <p className="text-sm text-red-600">{projError}</p>
        <Link
          href={`/vista-previa-suite/proyectos/${encodeURIComponent(id)}`}
          className="mt-4 inline-block text-sm text-primary-600 underline"
        >
          Volver al resumen
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-0 pb-8">
      <SuitePlanningWorkspace
        projectId={id}
        projectName={projectName || "Proyecto"}
        userId={user?.id ?? null}
        activityActorName={(user?.name ?? user?.email ?? "Tú").trim() || "Tú"}
      />
    </main>
  );
}
