import Link from "next/link";
import { notFound } from "next/navigation";
import { SuiteModuloPlaceholderAgentSync } from "../../../components/suite-agent/SuiteModuloPlaceholderAgentSync";

const TITULOS: Record<string, string> = {
  proyectos: "Proyectos",
  logistica: "Logística",
  "control-de-flota": "Control de flota",
  "agentes-ia": "SAM",
  riesgos: "Riesgos",
  contabilidad: "Contabilidad",
  administracion: "Administración",
  rrhh: "RRHH",
  organigrama: "Organigrama",
};

type PageProps = { params: { modulo: string } };

export default function VistaPreviaSuiteModuloPage({ params }: PageProps) {
  const { modulo } = params;
  const titulo = TITULOS[modulo];
  if (!titulo) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <SuiteModuloPlaceholderAgentSync slug={modulo} titulo={titulo} />
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vista previa de suite</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{titulo}</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        Módulo reservado para la suite ampliada. Aquí irá el contenido real cuando exista el dominio; por ahora solo
        sirve para ordenar el menú principal.
      </p>
      <Link href="/" className="mt-8 inline-block text-sm font-medium text-primary-600 underline hover:no-underline">
        Volver al inicio
      </Link>
    </div>
  );
}
