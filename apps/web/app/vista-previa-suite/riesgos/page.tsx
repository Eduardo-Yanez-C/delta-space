import Link from "next/link";
import { SuiteAgentSummarySync } from "../../../components/suite-agent/SuiteAgentSummarySync";
import { RISK_CATEGORY_ENTRIES, type RiskCategorySlug } from "../../../lib/risk-categories";

function hubCardCopy(slug: RiskCategorySlug): { title: string; desc: string } {
  switch (slug) {
    case "operacional":
      return { title: "Operacional", desc: "Riesgos operacionales (incluye capas MRB/HSEC)." };
    case "estrategico":
      return { title: "Estratégico", desc: "Riesgos que afectan objetivos y decisiones estratégicas." };
    case "financiero":
      return { title: "Financiero", desc: "Riesgos de costos, flujo, tipos de cambio y contingencias." };
    case "cumplimiento-legal":
      return { title: "Cumplimiento / Legal", desc: "Riesgos normativos, regulatorios y contractuales." };
    case "reputacional":
      return { title: "Reputacional", desc: "Riesgos de marca, percepción pública y confianza." };
    default:
      return { title: slug, desc: "" };
  }
}

const RIESGOS_HUB_AGENT_SUMMARY = [
  "Módulo Riesgos — hub de categorías (vista previa suite).",
  "Categorías: operacional, estratégico, financiero, cumplimiento/legal, reputacional.",
  "Enlaces: resumen ejecutivo (KPIs/gráficos) y vistas por categoría con matriz MRB por proyecto.",
].join("\n");

export default function RiesgosSuiteHubPage() {
  return (
    <main className="space-y-8 p-6 md:p-8">
      <SuiteAgentSummarySync summary={RIESGOS_HUB_AGENT_SUMMARY} />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vista previa de suite</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Riesgos</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Centro de riesgos con matriz MRB, resumen ejecutivo y vistas por categoría.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Link
          href="/vista-previa-suite/riesgos/ejecutivo"
          className="group flex flex-col rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm transition hover:border-indigo-400 hover:shadow-md"
        >
          <span className="text-xs font-bold uppercase tracking-wide text-indigo-700">Ejecutivo</span>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">Resumen ejecutivo</h2>
          <p className="mt-2 flex-1 text-sm text-slate-600">
            KPIs y gráficos por proyecto y por categoría.
          </p>
          <span className="mt-4 text-sm font-semibold text-indigo-700 group-hover:underline">Abrir →</span>
        </Link>

        {RISK_CATEGORY_ENTRIES.map((e) => {
          const { title, desc } = hubCardCopy(e.slug);
          return (
            <Link
              key={e.slug}
              href={`/vista-previa-suite/riesgos/${e.slug}`}
              className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
            >
              <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
              <p className="mt-2 flex-1 text-sm text-slate-600">{desc}</p>
              <span className="mt-4 text-sm font-semibold text-slate-700 group-hover:underline">Abrir matriz →</span>
            </Link>
          );
        })}
      </section>

      <p className="text-xs text-slate-500">
        Nota: este módulo se alimenta del API local (Nest) de Cotizaciones. Si está vacío, crea un proyecto y luego crea riesgos.
      </p>
    </main>
  );
}

