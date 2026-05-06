"use client";

type Variant = "default" | "success" | "warning" | "neutral" | "originNacional" | "originInternacional";

const variants: Record<Variant, string> = {
  default: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100",
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  neutral: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  originNacional: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  originInternacional: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export function CommercialStatusBadge({ status }: { status: string }) {
  const v: Variant =
    status === "ACTIVO" ? "success" : status === "DESCONTINUADO" ? "neutral" : "warning";
  const label = status === "ACTIVO" ? "Activo" : status === "DESCONTINUADO" ? "Descontinuado" : "En revisión";
  return <Badge variant={v}>{label}</Badge>;
}

export function SupplyOriginBadge({ origin }: { origin: string }) {
  const v: Variant = origin === "NACIONAL" ? "originNacional" : "originInternacional";
  const label = origin === "NACIONAL" ? "Nacional" : "Internacional";
  return <Badge variant={v}>{label}</Badge>;
}

export function ActorTypeBadge({ actorType }: { actorType: string }) {
  const labels: Record<string, string> = {
    FABRICANTE: "Fabricante",
    DISTRIBUIDOR: "Distribuidor",
    REPRESENTANTE: "Representante",
    IMPORTADOR: "Importador",
    INTEGRADOR: "Integrador",
  };
  return <Badge variant="default">{labels[actorType] ?? actorType}</Badge>;
}
