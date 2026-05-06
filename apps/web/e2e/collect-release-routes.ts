import { SUITE_NAV_REGISTRY } from "../lib/suite-nav-registry";

/** Rutas del menú suite según `suite-nav-registry.ts` (sin duplicados). */
export function collectSuiteNavHrefs(): string[] {
  const out: string[] = [];
  for (const e of SUITE_NAV_REGISTRY) {
    if (e.kind === "link") {
      out.push(e.href);
    } else if (e.kind === "ventas") {
      out.push(e.hubHref, e.panelHref);
      for (const c of e.children) out.push(c.href);
    } else if (e.kind === "logistica") {
      out.push(e.hubHref, e.defaultHref);
      for (const c of e.children) out.push(c.href);
    }
  }
  return [...new Set(out)];
}

/**
 * Rutas adicionales del sidebar (Conversaciones, Usuarios, administración técnica)
 * que no están en el registro plano del hub.
 */
export const RELEASE_EXTRA_HREFS = [
  "/conversaciones",
  "/usuarios",
  "/usuarios/panel",
  "/admin/licencia-on-premise",
];

/** Orden estable para informes y capturas. */
export function allReleaseRoutes(): string[] {
  const merged = [...collectSuiteNavHrefs(), ...RELEASE_EXTRA_HREFS];
  return [...new Set(merged)].sort((a, b) => a.localeCompare(b));
}

/** Subconjunto explícito “flujos mínimos” del checklist de release. */
export const MINIMAL_FLOW_HREFS: { key: string; href: string }[] = [
  { key: "panel_general", href: "/panel-general" },
  { key: "ventas_panel", href: "/software-de-cotizaciones/panel-de-ventas" },
  { key: "clientes", href: "/clientes" },
  { key: "cotizaciones", href: "/cotizaciones" },
  { key: "estudios_fv", href: "/estudios-fv" },
  { key: "proyectos", href: "/vista-previa-suite/proyectos" },
  { key: "logistica_inventario", href: "/vista-previa-suite/logistica/inventario" },
  { key: "control_flota", href: "/vista-previa-suite/control-de-flota" },
  { key: "riesgos", href: "/vista-previa-suite/riesgos" },
  { key: "organigrama", href: "/vista-previa-suite/organigrama" },
  { key: "conversaciones", href: "/conversaciones" },
  { key: "usuarios", href: "/usuarios" },
  { key: "admin_tecnica", href: "/admin/licencia-on-premise" },
];
