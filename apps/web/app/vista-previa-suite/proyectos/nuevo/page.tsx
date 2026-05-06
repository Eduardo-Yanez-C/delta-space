"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../lib/auth-context";
import {
  createSuiteProject,
  replaceProjectLocations,
  suiteBulkImportTasksSchedule,
  type ProjectLocation,
} from "../../../../lib/api";
import { hasSuiteNavGrant } from "../../../../lib/suite-nav-grants";
import { dispatchSuiteAgentOpenPanel } from "../../../../lib/suite-agent-chat";
import {
  parseSuiteScheduleDelimitedText,
  type SuiteScheduleImportRow,
} from "../../../../lib/suite-schedule-tsv-import";
import { useSuiteAgentRuntime } from "../../../../components/suite-agent/SuiteAgentRuntimeProvider";
import { ProjectLocationsModal } from "../../../../components/projects/ProjectLocationsModal";

const MAX_FILE_BYTES = 512 * 1024;
const PREVIEW_ROWS = 12;

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("No se pudo leer el archivo"));
    r.readAsText(file, "UTF-8");
  });
}

export default function SuiteProyectoNuevoPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mergeRuntime, addAttachment } = useSuiteAgentRuntime();
  const { user, loading: authLoading } = useAuth();
  const canWrite = useMemo(() => {
    const r = user?.roles ?? [];
    return ["ADMIN_DEV", "ADMIN", "VENDEDOR_TECNICO", "INGENIERIA", "VENTAS"].some((x) => r.includes(x));
  }, [user?.roles]);
  const canSee = useMemo(
    () => hasSuiteNavGrant(user?.suiteNavGrants ?? null, user?.roles, "proyectos"),
    [user?.suiteNavGrants, user?.roles],
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Si la importación falló tras crear el proyecto, enlace a la ficha. */
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [status, setStatus] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [progress, setProgress] = useState("");
  const [description, setDescription] = useState("");
  const [locationsModalOpen, setLocationsModalOpen] = useState(true);
  const [projectLocations, setProjectLocations] = useState<ProjectLocation[]>(() => [
    {
      kind: "SITE",
      label: "Obra principal",
      address: "",
      latitude: null,
      longitude: null,
      notes: "",
      isPrimary: true,
    },
  ]);

  const [scheduleFileName, setScheduleFileName] = useState<string | null>(null);
  const [scheduleRawText, setScheduleRawText] = useState<string | null>(null);
  const [scheduleRows, setScheduleRows] = useState<SuiteScheduleImportRow[] | null>(null);
  const [scheduleWarnings, setScheduleWarnings] = useState<string[]>([]);
  const [scheduleParseError, setScheduleParseError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [doImportSchedule, setDoImportSchedule] = useState(true);
  const [attachForAgent, setAttachForAgent] = useState(true);

  const resetSchedule = useCallback(() => {
    setScheduleFileName(null);
    setScheduleRawText(null);
    setScheduleRows(null);
    setScheduleWarnings([]);
    setScheduleParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const applyScheduleText = useCallback((text: string, fileName: string) => {
    setScheduleFileName(fileName);
    setScheduleRawText(text);
    try {
      const { rows, warnings } = parseSuiteScheduleDelimitedText(text);
      setScheduleRows(rows);
      setScheduleWarnings(warnings);
      setScheduleParseError(null);
    } catch (e) {
      setScheduleRows(null);
      setScheduleWarnings([]);
      setScheduleParseError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setScheduleParseError(`El archivo supera ${Math.round(MAX_FILE_BYTES / 1024)} KB. Exporte un extracto más pequeño.`);
      return;
    }
    const text = await readFileAsText(file);
    applyScheduleText(text, file.name);
  };

  if (authLoading) {
    return <p className="p-6 text-sm text-slate-600 dark:text-slate-400">Cargando…</p>;
  }
  if (!user) {
    router.replace("/login");
    return null;
  }
  if (!canSee) {
    router.replace("/acceso-restringido");
    return null;
  }
  if (!canWrite) {
    return (
      <main className="p-6">
        <p className="text-sm text-slate-700 dark:text-slate-200">No tiene permisos para crear proyectos.</p>
        <Link href="/vista-previa-suite/proyectos" className="mt-4 inline-block text-sm text-primary-600 underline">
          Volver
        </Link>
      </main>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setCreatedProjectId(null);
    try {
      if (!projectLocations.length || !projectLocations.some((x) => String(x.label ?? "").trim())) {
        setSaving(false);
        setError("Defina al menos una ubicación del proyecto (obra, bodega, etc.).");
        setLocationsModalOpen(true);
        return;
      }

      const primary =
        projectLocations.find((x) => x.isPrimary) ??
        projectLocations.find((x) => String(x.label ?? "").trim()) ??
        null;
      const locationFromPrimary =
        (primary?.address && String(primary.address).trim()) ||
        (primary?.label && String(primary.label).trim()) ||
        "";

      const prRaw = progress.trim();
      const created = await createSuiteProject({
        code: code.trim(),
        name: name.trim(),
        client: client.trim() || undefined,
        status: status.trim() || undefined,
        location: (locationFromPrimary || location).trim() || undefined,
        description: description.trim() || undefined,
        startDate: startDate.trim() || undefined,
        endDate: endDate.trim() || undefined,
        progress: prRaw ? Number(prRaw) : undefined,
      });

      try {
        await replaceProjectLocations(created.id, projectLocations);
      } catch (locErr) {
        setCreatedProjectId(created.id);
        setError(
          `El proyecto se creó, pero no se pudieron guardar las ubicaciones: ${locErr instanceof Error ? locErr.message : String(locErr)}.`,
        );
      }

      let importNote = "";
      let importFailed = false;
      if (doImportSchedule && scheduleRows && scheduleRows.length > 0) {
        try {
          const imported = await suiteBulkImportTasksSchedule(created.id, scheduleRows);
          importNote = `Importación: ${imported.created} tareas creadas.`;
          if (imported.warnings.length) importNote += ` (${imported.warnings.length} avisos)`;
        } catch (impErr) {
          importFailed = true;
          setCreatedProjectId(created.id);
          setError(
            `El proyecto se creó correctamente, pero la importación del cronograma falló: ${
              impErr instanceof Error ? impErr.message : String(impErr)
            }. Puede ir a la ficha e importar de nuevo desde planificación.`,
          );
        }
      }

      const parts: string[] = [`Proyecto ${created.code}: ${created.name}`];
      if (importNote) parts.push(importNote);
      mergeRuntime({
        projectId: created.id,
        projectName: created.name ?? created.code,
        summary: parts.join(" · "),
      });

      if (attachForAgent && scheduleRawText?.trim()) {
        addAttachment({
          id: `nuevo-proyecto-cronograma-${created.id}`,
          kind: "csv",
          title: scheduleFileName ? `Cronograma: ${scheduleFileName}` : "Cronograma adjunto (nuevo proyecto)",
          body: scheduleRawText.slice(0, 50_000),
        });
        dispatchSuiteAgentOpenPanel();
      }

      if (importFailed) {
        setSaving(false);
        return;
      }

      router.replace(`/vista-previa-suite/proyectos/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear");
    } finally {
      setSaving(false);
    }
  }

  const hasValidSchedule = Boolean(scheduleRows && scheduleRows.length > 0);

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-4 pb-16 md:p-6">
      <header className="space-y-2 border-b border-slate-200 pb-6 dark:border-slate-700">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Vista previa de suite</p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-3xl">Nuevo proyecto</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Defina la ficha del proyecto y, si desea, cargue un cronograma exportado (Excel → TSV/CSV). El sistema creará las tareas en
              planificación; SAM puede usar la misma tabla si la adjunta al chat y, con el{" "}
              <code className="mx-0.5 rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">projectId</code> en contexto o en
              argumentos, invocar{" "}
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">bulk_import_project_tasks</span>).
            </p>
          </div>
          <Link
            href="/vista-previa-suite/proyectos"
            className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800/80"
          >
            ← Volver al listado
          </Link>
        </div>

        <ol className="mt-4 flex flex-wrap gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
          <li className="flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-emerald-800 dark:text-emerald-200">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] text-white">1</span>
            Datos del proyecto
          </li>
          <li className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 dark:border-slate-600">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] dark:bg-slate-600 dark:text-white">
              2
            </span>
            Documento de cronograma (opcional)
          </li>
          <li className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 dark:border-slate-600">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] dark:bg-slate-600 dark:text-white">
              3
            </span>
            Crear e ir a la ficha
          </li>
        </ol>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100"
        >
          <p>{error}</p>
          {createdProjectId && (
            <Link
              href={`/vista-previa-suite/proyectos/${createdProjectId}`}
              className="mt-3 inline-flex rounded-lg bg-red-900/10 px-3 py-2 text-sm font-semibold text-red-900 underline-offset-2 hover:underline dark:bg-red-500/10 dark:text-red-100"
            >
              Ir al proyecto creado
            </Link>
          )}
        </div>
      )}

      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 md:p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ficha del proyecto</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Código *</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="input-field mt-1.5 w-full text-sm"
                placeholder="p.ej. PRJ-2026-001"
                autoComplete="off"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Nombre *</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="input-field mt-1.5 w-full text-sm"
                placeholder="Nombre comercial o interno"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Cliente</span>
              <input value={client} onChange={(e) => setClient(e.target.value)} className="input-field mt-1.5 w-full text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Estado</span>
              <input
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="input-field mt-1.5 w-full text-sm"
                placeholder="ACTIVE, PLANNING…"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Ubicación</span>
              <input value={location} onChange={(e) => setLocation(e.target.value)} className="input-field mt-1.5 w-full text-sm" />
            </label>
            <div className="sm:col-span-2">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setLocationsModalOpen(true)} className="btn-secondary">
                  Ubicaciones (mapa)
                </button>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Obra, bodegas, faena. La principal se usa como destino por defecto.
                </span>
              </div>
            </div>
            <label className="block">
              <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Inicio</span>
              <input value={startDate} onChange={(e) => setStartDate(e.target.value)} type="date" className="input-field mt-1.5 w-full text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Término</span>
              <input value={endDate} onChange={(e) => setEndDate(e.target.value)} type="date" className="input-field mt-1.5 w-full text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Avance %</span>
              <input
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
                type="number"
                step="0.1"
                min={0}
                max={100}
                className="input-field mt-1.5 w-full text-sm"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Descripción</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="input-field mt-1.5 w-full text-sm"
                placeholder="Contexto, alcance, supuestos…"
              />
            </label>
          </div>
        </section>

        <ProjectLocationsModal
          open={locationsModalOpen}
          onClose={() => setLocationsModalOpen(false)}
          value={projectLocations}
          onChange={(next) => setProjectLocations(next)}
        />

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Cronograma desde archivo</h2>
            {scheduleFileName && (
              <button
                type="button"
                onClick={resetSchedule}
                className="text-xs font-medium text-primary-600 underline hover:no-underline dark:text-primary-400"
              >
                Quitar archivo
              </button>
            )}
          </div>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Exporte desde Excel o MS Project una tabla con cabecera. Columnas reconocidas:{" "}
            <strong className="font-normal text-slate-800 dark:text-slate-200">nombre / inicio / fin</strong> (o{" "}
            <strong className="font-normal text-slate-800 dark:text-slate-200">name, start, end</strong>
            ); opcional <strong className="font-normal text-slate-800 dark:text-slate-200">wbs</strong>. Fechas:{" "}
            <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">YYYY-MM-DD</code> o{" "}
            <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">DD/MM/AAAA</code>. Delimitador: tabulador, punto y coma o
            coma.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv,.tsv,text/csv,text/plain"
            className="hidden"
            onChange={(ev) => void onPickFile(ev.target.files?.[0] ?? null)}
          />

          <div
            role="button"
            tabIndex={0}
            onKeyDown={(k) => {
              if (k.key === "Enter" || k.key === " ") fileInputRef.current?.click();
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void onPickFile(f);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors ${
              dragActive
                ? "border-primary-500 bg-primary-500/5 dark:border-primary-400 dark:bg-primary-500/10"
                : "border-slate-300 bg-slate-50/80 dark:border-slate-600 dark:bg-slate-800/40"
            }`}
          >
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Arrastre aquí un .csv / .tsv o haga clic para elegir</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Máximo {Math.round(MAX_FILE_BYTES / 1024)} KB · hasta 300 tareas por importación</p>
          </div>

          {scheduleParseError && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
              {scheduleParseError}
            </p>
          )}

          {scheduleWarnings.length > 0 && (
            <ul className="list-inside list-disc space-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
              {scheduleWarnings.slice(0, 8).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
              {scheduleWarnings.length > 8 && <li>… y {scheduleWarnings.length - 8} avisos más</li>}
            </ul>
          )}

          {hasValidSchedule && scheduleRows && (
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-600">
              <p className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Vista previa ({scheduleRows.length} tareas{scheduleFileName ? ` · ${scheduleFileName}` : ""})
              </p>
              <div className="max-h-56 overflow-auto">
                <table className="w-full min-w-[320px] text-left text-xs">
                  <thead className="sticky top-0 bg-white dark:bg-slate-900">
                    <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      <th className="px-2 py-2 font-semibold">WBS</th>
                      <th className="px-2 py-2 font-semibold">Nombre</th>
                      <th className="px-2 py-2 font-semibold">Inicio</th>
                      <th className="px-2 py-2 font-semibold">Fin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleRows.slice(0, PREVIEW_ROWS).map((r, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="px-2 py-1.5 font-mono text-slate-500 dark:text-slate-400">{r.wbsCode ?? "—"}</td>
                        <td className="px-2 py-1.5 text-slate-800 dark:text-slate-200">{r.name}</td>
                        <td className="px-2 py-1.5 font-mono text-slate-600 dark:text-slate-300">{r.startDate}</td>
                        <td className="px-2 py-1.5 font-mono text-slate-600 dark:text-slate-300">{r.endDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {scheduleRows.length > PREVIEW_ROWS && (
                <p className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  Mostrando {PREVIEW_ROWS} de {scheduleRows.length} filas
                </p>
              )}
            </div>
          )}

          <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-800/40">
            <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={doImportSchedule && hasValidSchedule}
                disabled={!hasValidSchedule}
                onChange={(e) => setDoImportSchedule(e.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="font-medium">Importar tareas al crear el proyecto</span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                  Solo si el archivo se analizó correctamente. Las tareas aparecerán en planificación / Gantt.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={attachForAgent && Boolean(scheduleRawText?.trim())}
                disabled={!scheduleRawText?.trim()}
                onChange={(e) => setAttachForAgent(e.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="font-medium">Enviar el texto del archivo a SAM</span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                  Abre el panel flotante con el cronograma como adjunto para que pueda alinear fechas, WBS o sugerir ajustes (los cambios en
                  tareas los hace el agente con permisos del servidor).
                </span>
              </span>
            </label>
          </div>
        </section>

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-2 dark:border-slate-700 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving || !code.trim() || !name.trim()}
              className="btn-primary rounded-xl px-6 py-2.5 text-sm font-semibold shadow-sm disabled:opacity-50"
            >
              {saving ? "Creando…" : hasValidSchedule && doImportSchedule ? "Crear proyecto e importar cronograma" : "Crear proyecto"}
            </button>
            <Link
              href="/vista-previa-suite/proyectos"
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
            >
              Cancelar
            </Link>
            <Link
              href="/vista-previa-suite/agentes-ia"
              className="text-sm font-medium text-primary-600 underline-offset-2 hover:underline dark:text-primary-400"
            >
              SAM
            </Link>
          </div>
        </div>
      </form>
    </main>
  );
}
