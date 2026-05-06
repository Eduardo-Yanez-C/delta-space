"use client";

import { usePathname } from "next/navigation";
import { ChatBubbleDock } from "../conversations/ChatBubbleDock";
import { SuiteAgentRuntimeProvider } from "../suite-agent/SuiteAgentRuntimeProvider";
import { SuiteAgentBubble } from "../suite-agent/SuiteAgentBubble";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { DataNodeBanner } from "./DataNodeBanner";
import { DesktopLicenseBanner } from "./DesktopLicenseBanner";
import { LanDataNodeEnforcer } from "./LanDataNodeEnforcer";
import { SpellLangHydration } from "../SpellLangHydration";
import { AccentThemeSync } from "./AccentThemeSync";

const titles: Record<string, { title: string; subtitle?: string }> = {
  "/": { title: "Inicio", subtitle: "Redirige al panel de ventas" },
  "/panel-general": { title: "Panel general", subtitle: "Panel global del sistema (placeholder)" },
  "/indicadores-externos": { title: "Indicadores externos", subtitle: "UF, Dólar e IPC con tendencias" },
  "/software-de-cotizaciones/panel-de-ventas": {
    title: "Panel de ventas",
    subtitle: "Dashboard comercial del módulo Ventas",
  },
  "/productos": { title: "Productos", subtitle: "Catálogo comercial y técnico" },
  "/productos/nuevo": { title: "Nuevo producto", subtitle: "Crear producto" },
  "/proveedores": { title: "Proveedores", subtitle: "Abastecimiento nacional e internacional" },
  "/proveedores/nuevo": { title: "Nuevo proveedor", subtitle: "Crear proveedor" },
  "/clientes": { title: "Clientes", subtitle: "Gestión de clientes" },
  "/clientes/nuevo": { title: "Nuevo cliente", subtitle: "Crear cliente" },
  "/usuarios": { title: "Usuarios", subtitle: "Lista, crear usuarios y acceso al panel" },
  "/usuarios/panel": { title: "Panel Usuarios", subtitle: "IA, ventas y estudios (resumen)" },
  "/usuarios/nuevo": { title: "Nuevo usuario", subtitle: "Crear usuario" },
  "/instalaciones": { title: "Instalaciones", subtitle: "Equipos activados y revocación" },
  "/datos-empresa": { title: "Datos de empresa", subtitle: "Identidad, contacto, transferencia y textos comerciales" },
  "/cotizaciones": { title: "Cotizaciones", subtitle: "Listado y gestión de cotizaciones" },
  "/cotizaciones/nueva": { title: "Nueva cotización", subtitle: "Crear cotización" },
  "/estudios-fv": { title: "Estudios FV", subtitle: "Estudios fotovoltaicos por cliente" },
  "/estudios-fv/nuevo": { title: "Nuevo estudio FV", subtitle: "Crear estudio fotovoltaico" },
  "/plantillas": { title: "Plantillas", subtitle: "Plantillas estándar para cotizaciones rápidas" },
  "/plantillas/nueva": { title: "Nueva plantilla", subtitle: "Crear plantilla por tipo de sistema" },
  "/conversaciones": { title: "Conversaciones", subtitle: "Mensajes internos entre usuarios" },
  "/preferencias": { title: "Ortografía y escritura", subtitle: "Corrección, autocorrección e idioma" },
  "/admin/preferencias": { title: "Preferencias", subtitle: "" },
  "/admin/preferencias/ortografia": { title: "Preferencias", subtitle: "Ortografía y escritura" },
  "/admin/preferencias/colores": { title: "Preferencias", subtitle: "Colores y tema visual" },
  "/acceso-restringido": { title: "Acceso restringido", subtitle: "" },
  "/login": { title: "Iniciar sesión", subtitle: "" },
  "/admin/nodos-lan": { title: "Nodos LAN", subtitle: "Cambio manual del API de datos (solo administración)" },
  "/admin/licencia-on-premise": { title: "Licencia on-premise", subtitle: "JWT de servidor" },
  "/admin/limpieza-datos": { title: "Limpieza de datos", subtitle: "Mantenimiento controlado del sistema" },
  "/admin/comercial": { title: "Panel comercial", subtitle: "Rendimiento por vendedor (administración)" },
  "/software-de-cotizaciones": {
    title: "Ventas",
    subtitle: "Módulo de la suite — accesos al producto actual",
  },
  "/vista-previa-suite/logistica/transporte": {
    title: "Logística · Transporte",
    subtitle: "Viajes, unidades y seguimiento de envíos (vista previa en construcción)",
  },
  "/vista-previa-suite/logistica/indicadores": {
    title: "Logística · Indicadores",
    subtitle: "KPIs de inventario por proyecto, valor estimado y productos fuera de catálogo activo",
  },
  "/vista-previa-suite/logistica/proveedores": {
    title: "Logística · Proveedores",
    subtitle: "Locales, internacionales y transportistas; usados en transporte, compras y catálogo",
  },
};

function getTitle(pathname: string): { title: string; subtitle?: string } {
  if (titles[pathname]) return titles[pathname];
  if (pathname.startsWith("/vista-previa-suite/")) {
    const slug = pathname.split("/").filter(Boolean)[1] ?? "";
    const bySlug: Record<string, string> = {
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
    const t = bySlug[slug];
    if (t) {
      if (slug === "organigrama") {
        return { title: t, subtitle: "Diagrama jerárquico, lista y administración de cargos" };
      }
      if (slug === "proyectos") {
        return {
          title: t,
          subtitle: "Resumen PMO, cronograma Gantt (WBS), hitos, decisiones y riesgos por proyecto",
        };
      }
      if (slug === "agentes-ia") {
        return { title: t, subtitle: "Contexto por pantalla, adjuntos y próximo motor con herramientas" };
      }
      if (slug === "logistica") {
        return {
          title: t,
          subtitle: "Inventario con destino (proyecto, ventas, cotización) y vínculo al catálogo de productos",
        };
      }
      return { title: t, subtitle: "Vista previa de suite (sin módulo real aún)" };
    }
  }
  if (pathname.match(/^\/productos\/[^/]+\/editar$/))
    return { title: "Editar producto", subtitle: "Modificar datos del producto" };
  if (pathname.match(/^\/productos\/[^/]+$/) && !pathname.endsWith("/nuevo"))
    return { title: "Detalle de producto", subtitle: "Datos, proveedores y precios" };
  if (pathname.match(/^\/proveedores\/[^/]+\/editar$/))
    return { title: "Editar proveedor", subtitle: "Modificar datos del proveedor" };
  if (pathname.match(/^\/clientes\/[^/]+\/editar$/))
    return { title: "Editar cliente", subtitle: "Modificar datos del cliente" };
  if (pathname.match(/^\/usuarios\/[^/]+\/editar$/))
    return { title: "Editar usuario", subtitle: "Modificar datos del usuario" };
  if (pathname.match(/^\/usuarios\/[^/]+\/panel$/))
    return { title: "Panel por usuario", subtitle: "Uso SAM, ventas y estudios" };
  if (pathname.match(/^\/cotizaciones\/[^/]+\/editar$/))
    return { title: "Editar cotización", subtitle: "Modificar datos generales" };
  if (pathname.match(/^\/cotizaciones\/[^/]+$/) && !pathname.endsWith("/nueva"))
    return { title: "Detalle de cotización", subtitle: "Datos y versiones" };
  if (pathname.match(/^\/cotizaciones\/[^/]+\/vista-previa$/))
    return { title: "Vista previa", subtitle: "Imprimir o exportar PDF" };
  if (pathname.match(/^\/estudios-fv\/[^/]+\/editar$/))
    return { title: "Editar estudio FV", subtitle: "Modificar estudio fotovoltaico" };
  if (pathname.match(/^\/estudios-fv\/[^/]+\/diseno-implantacion$/))
    return { title: "Diseño de implantación", subtitle: "Mapa, techo y paneles" };
  if (pathname.match(/^\/estudios-fv\/[^/]+$/) && !pathname.endsWith("/nuevo"))
    return { title: "Detalle de estudio FV", subtitle: "Resumen y resultados mensuales" };
  if (pathname.match(/^\/plantillas\/[^/]+\/editar$/))
    return { title: "Editar plantilla", subtitle: "Cabecera e ítems con subítems" };
  if (pathname.match(/^\/plantillas\/[^/]+$/))
    return { title: "Detalle de plantilla", subtitle: "Ítems y líneas base" };
  return { title: "DELTA SPACE", subtitle: "" };
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { title, subtitle } = getTitle(pathname);
  const hideChatDock =
    pathname === "/login" ||
    pathname === "/setup" ||
    pathname === "/acceso-restringido";
  const isWideContentRoute =
    /^\/cotizaciones\/[^/]+$/.test(pathname) ||
    /^\/cotizaciones\/[^/]+\/vista-previa$/.test(pathname) ||
    /^\/estudios-fv\/[^/]+$/.test(pathname) ||
    /^\/estudios-fv\/[^/]+\/diseno-implantacion$/.test(pathname);

  /** Editor de mapa: el main debe ocupar el alto bajo banner+header sin depender de un vh fijo frágil. */
  const isImplantationDesignRoute =
    /^\/estudios-fv\/[^/]+\/diseno-implantacion$/.test(pathname);

  /** Organigrama: lienzo a alto completo como en Software de Mejora. */
  const pathNorm = pathname.replace(/\/$/, "") || "/";
  const isOrgChartRoute = pathNorm === "/vista-previa-suite/organigrama";

  /** Inventario: tabla con scroll interno sin desplazar toda la ventana. */
  const isLogisticsInventoryRoute = pathNorm === "/vista-previa-suite/logistica/inventario";

  const isFullHeightMain = isImplantationDesignRoute || isOrgChartRoute || isLogisticsInventoryRoute;

  return (
    <SuiteAgentRuntimeProvider>
    <div className="min-h-screen bg-slate-50 dark:bg-[var(--app-shell-bg)]">
      <SpellLangHydration />
      <AccentThemeSync />
      <Sidebar />
      <div
        className={`bg-gradient-to-b from-[var(--app-shell-main-from)] to-[var(--app-shell-main-to)] pl-[var(--sidebar-width)] print:pl-0 print:bg-white dark:from-[var(--app-shell-main-from)] dark:to-[var(--app-shell-main-to)] ${
          isFullHeightMain ? "flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden" : "min-h-screen"
        }`}
      >
        <LanDataNodeEnforcer />
        <DesktopLicenseBanner />
        <DataNodeBanner />
        <Header title={title} subtitle={subtitle} />
        <main
          className={
            isFullHeightMain
              ? "flex min-h-0 max-w-none flex-1 flex-col overflow-hidden px-4 pt-3 pb-2 print:max-w-none print:p-0 md:px-5 md:pt-4 md:pb-3"
              : isWideContentRoute
                ? "max-w-none px-4 py-4 print:max-w-none print:p-0 md:px-5 md:py-6"
                : "mx-auto max-w-[1440px] p-6 print:max-w-none print:p-0 md:p-8"
          }
        >
          {children}
        </main>
      </div>
      {!hideChatDock && <ChatBubbleDock />}
      {!hideChatDock && <SuiteAgentBubble />}
    </div>
    </SuiteAgentRuntimeProvider>
  );
}
