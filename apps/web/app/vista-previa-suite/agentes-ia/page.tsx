"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useSuiteAgentRuntime } from "../../../components/suite-agent/SuiteAgentRuntimeProvider";

export default function AgentesIaHubPage() {
  const { mergeRuntime } = useSuiteAgentRuntime();

  useEffect(() => {
    mergeRuntime({
      summary:
        "Hub SAM: documentación. El chat vive en la burbuja inferior izquierda (POST /api/suite-agent/chat). En planificación, con proyecto activo y OPENAI_API_KEY en el API, SAM puede listar/crear/editar tareas según rol.",
    });
  }, [mergeRuntime]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Vista previa de suite
      </p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">SAM</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        SAM recibe <span className="font-medium text-slate-800 dark:text-slate-200">contexto automático</span>{" "}
        según la ruta (superficie), proyecto activo y resúmenes que cada pantalla envía al runtime. Puede adjuntar
        fragmentos (por ejemplo un TSV del cronograma desde planificación).
      </p>
      <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-400">
        <li>
          <strong className="font-medium text-slate-800 dark:text-slate-200">Panel de ventas</strong>: KPIs y conteos
          de listas recientes.
        </li>
        <li>
          <strong className="font-medium text-slate-800 dark:text-slate-200">Planning / Gantt</strong>: vista actual,
          número de tareas y muestra de nombres; botón <em>SAM · Gantt</em> para adjuntar el cronograma en TSV.
        </li>
        <li>
          <strong className="font-medium text-slate-800 dark:text-slate-200">Chat integrado</strong>: pestaña Chat en la
          burbuja; requiere <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">OPENAI_API_KEY</code> en{" "}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">apps/api/.env</code>. Herramientas de tareas en
          proyecto cuando hay <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">projectId</code> en
          contexto.
        </li>
      </ul>
      <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
        Use la burbuja <span className="font-medium text-violet-800 dark:text-violet-200">Asistente IA</span> abajo a la
        izquierda: pestaña Chat para conversar, pestaña Contexto para resumen y copiar JSON.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/vista-previa-suite/agentes-ia/uso"
          className="inline-flex rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-900 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-900/40"
        >
          Uso SAM y límites
        </Link>
        <Link
          href="/software-de-cotizaciones/panel-de-ventas"
          className="inline-flex rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Ir a panel de ventas
        </Link>
        <Link
          href="/vista-previa-suite/proyectos"
          className="inline-flex rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Ir a proyectos
        </Link>
      </div>
    </div>
  );
}
