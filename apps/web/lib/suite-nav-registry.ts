/**
 * Registro único del menú suite (barra lateral oscura): ítems principales + grupos con submenú (Ventas, Logística…).
 *
 * Al añadir una vista nueva, agregue aquí una entrada; el formulario de usuarios y los permisos
 * del menú se actualizan automáticamente (junto con suite-nav-grants derivado de este archivo).
 */

export const ICON_COTIZACIONES_DOC =
  "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z";

export type SuiteNavTopLinkDef = {
  kind: "link";
  grantKey: string;
  href: string;
  label: string;
  icon: string;
};

export type SuiteNavVentasChildDef = {
  grantKey: string;
  href: string;
  label: string;
  icon: string;
};

export type SuiteNavVentasGroupDef = {
  kind: "ventas";
  /** Ruta del hub (identidad del ítem en el menú; puede redirigir). */
  hubHref: string;
  label: string;
  icon: string;
  panelHref: string;
  children: SuiteNavVentasChildDef[];
};

export type SuiteNavLogisticaGroupDef = {
  kind: "logistica";
  hubHref: string;
  label: string;
  icon: string;
  /** Destino por defecto del clic principal (primera vista del grupo). */
  defaultHref: string;
  children: SuiteNavVentasChildDef[];
};

export type SuiteNavRegistryEntry = SuiteNavTopLinkDef | SuiteNavVentasGroupDef | SuiteNavLogisticaGroupDef;

/** Orden del menú lateral suite (bloque principal). */
export const SUITE_NAV_REGISTRY: SuiteNavRegistryEntry[] = [
  {
    kind: "link",
    grantKey: "panel_general",
    href: "/panel-general",
    label: "Panel general",
    icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9",
  },
  {
    kind: "link",
    grantKey: "indicadores_externos",
    href: "/indicadores-externos",
    label: "Indicadores externos",
    icon: "M3 3v18h18M7 14l3-3 3 2 4-5",
  },
  {
    kind: "link",
    grantKey: "proyectos",
    href: "/vista-previa-suite/proyectos",
    label: "Proyectos",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  },
  {
    kind: "logistica",
    hubHref: "/vista-previa-suite/logistica",
    label: "Logística",
    icon: "M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10h16V8a1 1 0 00-1-1h-4",
    defaultHref: "/vista-previa-suite/logistica/inventario",
    children: [
      {
        grantKey: "logistica",
        href: "/vista-previa-suite/logistica/inventario",
        label: "Inventario",
        icon: "M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10h16V8a1 1 0 00-1-1h-4",
      },
      {
        grantKey: "logistica",
        href: "/vista-previa-suite/logistica/proveedores",
        label: "Proveedores",
        icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm12 0a4 4 0 10-8 0 4 4 0 008zm-4-4h.01",
      },
      {
        grantKey: "logistica",
        href: "/vista-previa-suite/logistica/indicadores",
        label: "Indicadores",
        icon: "M3 3v18h18M7 14l3-3 3 2 4-5",
      },
      {
        grantKey: "logistica",
        href: "/vista-previa-suite/logistica/transporte",
        label: "Transporte",
        icon: "M4 10h2v9H4v-9zm4 0h10v9H8v-9zm12 1h2l2 3v5h-4v-8zm-8 11a2 2 0 104 0 2 2 0 00-4 0zm-8 0a2 2 0 104 0 2 2 0 00-4 0",
      },
      {
        grantKey: "logistica",
        href: "/vista-previa-suite/logistica/transporte-comercial",
        label: "Transporte comercial",
        icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      },
      {
        grantKey: "logistica",
        href: "/vista-previa-suite/logistica/transporte-contratos",
        label: "Contratos transporte",
        icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
      },
      {
        grantKey: "logistica",
        href: "/vista-previa-suite/logistica/transporte-variables",
        label: "Variables transporte",
        icon: "M7 12l3-3 3 3m4-2a9 9 0 11-18 0 9 9 0 0118 0z",
      },
      {
        grantKey: "logistica",
        href: "/vista-previa-suite/logistica/transporte-viajes-comercial",
        label: "Viajes comerciales",
        icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
      },
      {
        grantKey: "logistica",
        href: "/vista-previa-suite/logistica/operacion-internacional",
        label: "Operación internacional",
        icon: "M3 7h18M3 12h18M3 17h12M8 21l4-4 4 4",
      },
      {
        grantKey: "control_flota",
        href: "/vista-previa-suite/control-de-flota",
        label: "Control de flota",
        icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
      },
    ],
  },
  {
    kind: "ventas",
    hubHref: "/software-de-cotizaciones",
    label: "Ventas",
    icon: ICON_COTIZACIONES_DOC,
    panelHref: "/software-de-cotizaciones/panel-de-ventas",
    children: [
      {
        grantKey: "ventas.panel",
        href: "/software-de-cotizaciones/panel-de-ventas",
        label: "Panel de ventas",
        icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
      },
      {
        grantKey: "ventas.clientes",
        href: "/clientes",
        label: "Clientes",
        icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 11a3 3 0 11-6 0 3 3 0 016 0z",
      },
      {
        grantKey: "ventas.estudios_fv",
        href: "/estudios-fv",
        label: "Estudios FV",
        icon: "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z",
      },
      {
        grantKey: "ventas.cotizaciones",
        href: "/cotizaciones",
        label: "Cotizaciones",
        icon: ICON_COTIZACIONES_DOC,
      },
      {
        grantKey: "ventas.plantillas",
        href: "/plantillas",
        label: "Plantillas",
        icon: ICON_COTIZACIONES_DOC,
      },
      {
        grantKey: "ventas.productos",
        href: "/productos",
        label: "Productos",
        icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
      },
      {
        grantKey: "ventas.proveedores",
        href: "/proveedores",
        label: "Proveedores",
        icon: "M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10h16V8a1 1 0 00-1-1h-4",
      },
    ],
  },
  {
    kind: "link",
    grantKey: "agentes_ia",
    href: "/vista-previa-suite/agentes-ia",
    label: "SAM",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
  },
  {
    kind: "link",
    grantKey: "riesgos",
    href: "/vista-previa-suite/riesgos",
    label: "Riesgos",
    icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  },
  {
    kind: "link",
    grantKey: "contabilidad",
    href: "/vista-previa-suite/contabilidad",
    label: "Contabilidad",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    kind: "link",
    grantKey: "administracion",
    href: "/vista-previa-suite/administracion",
    label: "Administración",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  },
  {
    kind: "link",
    grantKey: "rrhh",
    href: "/vista-previa-suite/rrhh",
    label: "RRHH",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  },
  {
    kind: "link",
    grantKey: "organigrama",
    href: "/vista-previa-suite/organigrama",
    label: "Organigrama",
    icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
  },
];

export function getVentasRegistryEntry(): SuiteNavVentasGroupDef | undefined {
  const v = SUITE_NAV_REGISTRY.find((e): e is SuiteNavVentasGroupDef => e.kind === "ventas");
  return v;
}

/** Grupo Ventas del menú; falla en arranque si falta la entrada (error de configuración). */
export function requireVentasRegistryGroup(): SuiteNavVentasGroupDef {
  const v = getVentasRegistryEntry();
  if (!v) {
    throw new Error('suite-nav-registry: debe existir exactamente una entrada kind: "ventas"');
  }
  return v;
}

export function getLogisticaRegistryEntry(): SuiteNavLogisticaGroupDef | undefined {
  const v = SUITE_NAV_REGISTRY.find((e): e is SuiteNavLogisticaGroupDef => e.kind === "logistica");
  return v;
}

export function requireLogisticaRegistryGroup(): SuiteNavLogisticaGroupDef {
  const v = getLogisticaRegistryEntry();
  if (!v) {
    throw new Error('suite-nav-registry: debe existir exactamente una entrada kind: "logistica"');
  }
  return v;
}

/** Todas las claves de permiso (planas) según el registro actual. */
export function getAllSuiteNavGrantKeys(): string[] {
  const keys: string[] = [];
  for (const e of SUITE_NAV_REGISTRY) {
    if (e.kind === "link") {
      keys.push(e.grantKey);
    } else if (e.kind === "ventas" || e.kind === "logistica") {
      for (const c of e.children) {
        keys.push(c.grantKey);
      }
    }
  }
  return keys;
}

/** Etiquetas para formulario de usuario y mensajes (clave → texto). */
export function getSuiteGrantLabels(): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const e of SUITE_NAV_REGISTRY) {
    if (e.kind === "link") {
      labels[e.grantKey] = e.label;
    } else if (e.kind === "ventas" || e.kind === "logistica") {
      for (const c of e.children) {
        labels[c.grantKey] = c.label;
      }
    }
  }
  return labels;
}

export function buildSuiteNavHrefToGrantKeyMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const e of SUITE_NAV_REGISTRY) {
    if (e.kind === "link") {
      map[e.href] = e.grantKey;
    } else if (e.kind === "ventas" || e.kind === "logistica") {
      for (const c of e.children) {
        map[c.href] = c.grantKey;
      }
    }
  }
  return map;
}
