"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchConversationsList, fetchPublicBrandingHasLogo, fetchPublicBrandingLogoBlob, getAuthToken } from "../../lib/api";
import { COMPANY_BRANDING_CHANGED_EVENT } from "../../lib/company-branding-events";
import { conversationsRealtime } from "../../lib/conversations-realtime";
import { useAuth } from "../../lib/auth-context";
import { useCan } from "../../lib/useCan";
import {
  defaultLogisticaHref,
  defaultVentasPanelHref,
  hasLogisticaNavSection,
  hasSuiteNavGrant,
  hasVentasNavSection,
  suiteNavItemHrefToGrantKey,
  ventasChildHrefToGrantKey,
} from "../../lib/suite-nav-grants";
import { SUITE_NAV_REGISTRY, requireLogisticaRegistryGroup, requireVentasRegistryGroup } from "../../lib/suite-nav-registry";

const CONV_UNREAD_POLL_MS = 25_000;

const conversacionesNavItem = {
  href: "/conversaciones",
  label: "Conversaciones",
  icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
};

const usuariosNavItem = { href: "/usuarios", label: "Usuarios", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" };
const USUARIOS_PANEL_HREF = "/usuarios/panel";
const USUARIOS_LIST_HREF = "/usuarios";
const instalacionesNavItem = { href: "/instalaciones", label: "Instalaciones", icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" };
const licenciaOnPremiseNavItem = {
  href: "/admin/licencia-on-premise",
  label: "Licencia on-premise",
  icon: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z",
};
const nodosLanNavItem = {
  href: "/admin/nodos-lan",
  label: "Nodos LAN",
  icon: "M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0",
};
const limpiezaDatosNavItem = {
  href: "/admin/limpieza-datos",
  label: "Limpieza de datos",
  icon: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
};
const panelComercialNavItem = {
  href: "/admin/comercial",
  label: "Panel comercial",
  icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
};
const empresasNavItem = {
  href: "/empresas",
  label: "Empresas",
  icon: "M3 21h18M5 21V7a2 2 0 012-2h3m4 0h3a2 2 0 012 2v14M9 21V9m6 12V9",
};
const datosEmpresaNavItem = {
  href: "/datos-empresa",
  label: "Datos de empresa",
  icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
};
const auditoriaNavItem = {
  href: "/admin/auditoria",
  label: "Auditoría",
  icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
};
const invitacionesNavItem = {
  href: "/admin/invitaciones",
  label: "Invitaciones",
  icon: "M21 8a2 2 0 01-2 2H5a2 2 0 01-2-2m18 0V6a2 2 0 00-2-2H5a2 2 0 00-2 2v2m18 0l-9 6-9-6",
};
const usoEmpresasNavItem = {
  href: "/admin/empresas/uso",
  label: "Uso por empresa",
  icon: "M11 3a1 1 0 012 0v18a1 1 0 01-2 0V3zM5 9a1 1 0 012 0v12a1 1 0 01-2 0V9zm12 4a1 1 0 012 0v8a1 1 0 01-2 0v-8z",
};
const preferenciasOrtografiaNavItem = {
  href: "/admin/preferencias/ortografia",
  label: "Ortografía y escritura",
  icon: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
};
const preferenciasColoresNavItem = {
  href: "/admin/preferencias/colores",
  label: "Colores",
  icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01",
};

type NavItem = {
  href: string;
  label: string;
  icon: string;
  /** Badge de conversaciones sin leer (solo vista previa menú suite). */
  badgeConversations?: boolean;
  /** Activo si coincide alguna ruta del módulo Ventas (software de cotizaciones). */
  activeMatch?: (pathname: string) => boolean;
};

function navItemIsActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}

function suiteSoftwareCotizacionesActive(pathname: string) {
  if (pathname.startsWith("/software-de-cotizaciones")) return true;
  return (
    pathname.startsWith("/cotizaciones") ||
    pathname.startsWith("/clientes") ||
    pathname.startsWith("/estudios-fv") ||
    pathname.startsWith("/plantillas") ||
    pathname.startsWith("/productos") ||
    pathname.startsWith("/proveedores")
  );
}

function suiteLogisticaActive(pathname: string) {
  return (
    pathname.startsWith("/vista-previa-suite/logistica") ||
    pathname.startsWith("/vista-previa-suite/control-de-flota")
  );
}

function suiteUsuariosSectionActive(pathname: string) {
  return pathname.startsWith("/usuarios");
}

function usuariosPanelRouteActive(pathname: string) {
  return pathname === USUARIOS_PANEL_HREF || /^\/usuarios\/[^/]+\/panel$/.test(pathname);
}

function usuariosListRouteActive(pathname: string) {
  if (usuariosPanelRouteActive(pathname)) return false;
  return pathname === USUARIOS_LIST_HREF || pathname.startsWith(`${USUARIOS_LIST_HREF}/`);
}

function anyAdminItemActive(pathname: string, items: NavItem[]) {
  return items.some((item) => navItemIsActive(pathname, item.href));
}

const PREFERENCIAS_PATH_PREFIX = "/admin/preferencias";

/** Ícono tipo sliders / ajustes (alineado con el resto del menú). */
const preferenciasSectionIconPath =
  "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4";

function isPreferenciasSectionActive(pathname: string) {
  return pathname === PREFERENCIAS_PATH_PREFIX || pathname.startsWith(`${PREFERENCIAS_PATH_PREFIX}/`);
}

const ventasNavGroup = requireVentasRegistryGroup();
const VENTAS_HUB_HREF = ventasNavGroup.hubHref;
const VENTAS_PANEL_DEFAULT_HREF = ventasNavGroup.panelHref;

const logisticaNavGroup = requireLogisticaRegistryGroup();
const LOGISTICA_HUB_HREF = logisticaNavGroup.hubHref;
/** Primera vista del grupo (enlace duplicado arriba del submenú); no debe repetirse en la lista del desplegable. */
const logisticaPrimaryChild =
  logisticaNavGroup.children.find((c) => c.href === logisticaNavGroup.defaultHref) ?? logisticaNavGroup.children[0];
const LOGISTICA_VISTA_HREF = logisticaPrimaryChild?.href ?? logisticaNavGroup.defaultHref;

const conversacionesSidebarItem: NavItem = {
  ...conversacionesNavItem,
  badgeConversations: true,
};

/** Parte principal del menú suite (orden y datos desde `suite-nav-registry.ts`). */
const SUITE_NAV_MAIN: NavItem[] = SUITE_NAV_REGISTRY.map((e) => {
  if (e.kind === "link") return { href: e.href, label: e.label, icon: e.icon };
  if (e.kind === "ventas") {
    return {
      href: e.hubHref,
      label: e.label,
      icon: e.icon,
      activeMatch: suiteSoftwareCotizacionesActive,
    };
  }
  return {
    href: e.hubHref,
    label: e.label,
    icon: e.icon,
    activeMatch: suiteLogisticaActive,
  };
});

export function Sidebar() {
  const pathname = usePathname();
  const [headerLogoSrc, setHeaderLogoSrc] = useState<string | null>(null);
  const [conversationsUnreadTotal, setConversationsUnreadTotal] = useState(0);
  const headerLogoUrlRef = useRef<string | null>(null);

  const refreshConversationsUnread = useCallback(async () => {
    if (!getAuthToken()) {
      setConversationsUnreadTotal(0);
      return;
    }
    try {
      const r = await fetchConversationsList();
      const sum = r.conversations.reduce((acc, c) => acc + c.unreadCount, 0);
      setConversationsUnreadTotal(sum);
    } catch {
      /* silencioso: sidebar no debe bloquear por API de chat */
    }
  }, []);

  useEffect(() => {
    void refreshConversationsUnread();
    const id = window.setInterval(() => void refreshConversationsUnread(), CONV_UNREAD_POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshConversationsUnread();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refreshConversationsUnread]);

  useEffect(() => {
    if (!getAuthToken()) return;
    conversationsRealtime.connect();
    const off = conversationsRealtime.onMessageNew(() => {
      void refreshConversationsUnread();
    });
    return off;
  }, [refreshConversationsUnread]);

  useEffect(() => {
    let cancelled = false;

    const loadHeaderLogo = () => {
      void (async () => {
        if (headerLogoUrlRef.current) {
          URL.revokeObjectURL(headerLogoUrlRef.current);
          headerLogoUrlRef.current = null;
        }
        setHeaderLogoSrc(null);
        try {
          const has = await fetchPublicBrandingHasLogo();
          if (cancelled || !has) return;
          const blob = await fetchPublicBrandingLogoBlob();
          if (cancelled || !blob) return;
          const u = URL.createObjectURL(blob);
          if (cancelled) {
            URL.revokeObjectURL(u);
            return;
          }
          headerLogoUrlRef.current = u;
          setHeaderLogoSrc(u);
        } catch {
          if (!cancelled) setHeaderLogoSrc(null);
        }
      })();
    };

    loadHeaderLogo();

    const onBranding = () => loadHeaderLogo();
    window.addEventListener(COMPANY_BRANDING_CHANGED_EVENT, onBranding);
    return () => {
      cancelled = true;
      window.removeEventListener(COMPANY_BRANDING_CHANGED_EVENT, onBranding);
      if (headerLogoUrlRef.current) {
        URL.revokeObjectURL(headerLogoUrlRef.current);
        headerLogoUrlRef.current = null;
      }
    };
  }, []);

  const canAccessUsers = useCan("access", "users");
  const canAccessInstallations = useCan("access", "installations");
  const canAccessOnPremiseLicense = useCan("access", "onPremiseLicense");
  const canManageLanNodes = useCan("manage", "lanNodes");
  const canAccessCompanyProfile = useCan("access", "companyProfile");
  const canAccessDataCleanup = useCan("access", "dataCleanup");
  const canAccessCommercialPerformance = useCan("access", "commercialPerformance");
  const canAccessCompanies = useCan("access", "companies");
  const canAccessAuditLog = useCan("access", "auditLog");
  const canAccessUserInvites = useCan("access", "users");
  const canAccessCompaniesUsage = useCan("access", "companiesUsage");
  const canReadQuotes = useCan("read", "quote");
  const canReadFvStudy = useCan("read", "fvStudy");
  const { user: authUser } = useAuth();
  const navGrants = authUser?.suiteNavGrants;
  const navRoles = authUser?.roles;

  const ventasChildNav: NavItem[] = useMemo(() => {
    const roleFiltered = ventasNavGroup.children.filter((c) => {
      if (c.href === "/estudios-fv") return canReadFvStudy;
      if (c.href === "/cotizaciones" || c.href === "/plantillas") return canReadQuotes;
      return true;
    });
    const withoutPanel = roleFiltered.filter((c) => c.grantKey !== "ventas.panel");
    return withoutPanel
      .filter((child) => {
        const gk = ventasChildHrefToGrantKey(child.href);
        if (gk && !hasSuiteNavGrant(navGrants, navRoles, gk)) return false;
        return true;
      })
      .map((c) => ({ href: c.href, label: c.label, icon: c.icon }));
  }, [canReadQuotes, canReadFvStudy, navGrants, navRoles]);

  const logisticaChildNav: NavItem[] = useMemo(() => {
    const primaryHref = logisticaNavGroup.defaultHref;
    const rest = logisticaNavGroup.children.filter((c) => c.href !== primaryHref);
    return rest
      .filter((child) => {
        const gk = ventasChildHrefToGrantKey(child.href);
        if (gk && !hasSuiteNavGrant(navGrants, navRoles, gk)) return false;
        return true;
      })
      .map((c) => ({ href: c.href, label: c.label, icon: c.icon }));
  }, [navGrants, navRoles]);

  const preferenciasChildNav: NavItem[] = useMemo(
    () => [preferenciasOrtografiaNavItem, preferenciasColoresNavItem],
    [],
  );

  const adminItems: NavItem[] = useMemo(() => {
    const out: NavItem[] = [];
    if (canAccessCommercialPerformance) out.push(panelComercialNavItem);
    if (canAccessCompanies) out.push(empresasNavItem);
    if (canAccessAuditLog) out.push(auditoriaNavItem);
    if (canAccessUserInvites) out.push(invitacionesNavItem);
    if (canAccessCompaniesUsage) out.push(usoEmpresasNavItem);
    if (canAccessInstallations) out.push(instalacionesNavItem);
    if (canManageLanNodes) out.push(nodosLanNavItem);
    if (canAccessOnPremiseLicense) out.push(licenciaOnPremiseNavItem);
    if (canAccessCompanyProfile) out.push(datosEmpresaNavItem);
    if (canAccessDataCleanup) out.push(limpiezaDatosNavItem);
    return out;
  }, [
    canAccessInstallations,
    canManageLanNodes,
    canAccessOnPremiseLicense,
    canAccessCompanyProfile,
    canAccessDataCleanup,
    canAccessCommercialPerformance,
    canAccessCompanies,
    canAccessAuditLog,
    canAccessUserInvites,
    canAccessCompaniesUsage,
  ]);

  const [adminOpen, setAdminOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [ventasOpen, setVentasOpen] = useState(false);
  const [logisticaOpen, setLogisticaOpen] = useState(false);
  const [usuariosOpen, setUsuariosOpen] = useState(false);
  const adminPathPrevRef = useRef<string | null>(null);
  const prefsPathPrevRef = useRef<string | null>(null);
  const ventasPathPrevRef = useRef<string | null>(null);
  const logisticaPathPrevRef = useRef<string | null>(null);
  const usuariosPathPrevRef = useRef<string | null>(null);

  const adminHasContent = preferenciasChildNav.length > 0 || adminItems.length > 0;

  useEffect(() => {
    if (!adminHasContent) {
      setAdminOpen(false);
      setPrefsOpen(false);
      adminPathPrevRef.current = pathname;
      prefsPathPrevRef.current = pathname;
      return;
    }
    const prev = adminPathPrevRef.current;
    adminPathPrevRef.current = pathname;

    const nowAdmin =
      anyAdminItemActive(pathname, adminItems) || isPreferenciasSectionActive(pathname);
    if (prev === null) {
      if (nowAdmin) setAdminOpen(true);
    } else {
      const wasAdmin =
        anyAdminItemActive(prev, adminItems) || isPreferenciasSectionActive(prev);
      if (nowAdmin) setAdminOpen(true);
      else if (wasAdmin && !nowAdmin) setAdminOpen(false);
    }
  }, [pathname, adminItems, adminHasContent]);

  useEffect(() => {
    const prev = prefsPathPrevRef.current;
    prefsPathPrevRef.current = pathname;
    const nowPrefs = isPreferenciasSectionActive(pathname);
    if (prev === null) {
      if (nowPrefs) setPrefsOpen(true);
      return;
    }
    const wasPrefs = isPreferenciasSectionActive(prev);
    if (nowPrefs) setPrefsOpen(true);
    else if (wasPrefs && !nowPrefs) setPrefsOpen(false);
  }, [pathname]);

  useEffect(() => {
    const prev = ventasPathPrevRef.current;
    ventasPathPrevRef.current = pathname;
    const now = suiteSoftwareCotizacionesActive(pathname);
    if (prev === null) {
      if (now) setVentasOpen(true);
    } else {
      const was = suiteSoftwareCotizacionesActive(prev);
      if (now) setVentasOpen(true);
      else if (was && !now) setVentasOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    const prev = logisticaPathPrevRef.current;
    logisticaPathPrevRef.current = pathname;
    const now = suiteLogisticaActive(pathname);
    if (prev === null) {
      if (now) setLogisticaOpen(true);
    } else {
      const was = suiteLogisticaActive(prev);
      if (now) setLogisticaOpen(true);
      else if (was && !now) setLogisticaOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    const prev = usuariosPathPrevRef.current;
    usuariosPathPrevRef.current = pathname;
    const now = suiteUsuariosSectionActive(pathname);
    if (prev === null) {
      if (now) setUsuariosOpen(true);
    } else {
      const was = suiteUsuariosSectionActive(prev);
      if (now) setUsuariosOpen(true);
      else if (was && !now) setUsuariosOpen(false);
    }
  }, [pathname]);

  const adminSectionActive =
    adminHasContent &&
    (anyAdminItemActive(pathname, adminItems) || isPreferenciasSectionActive(pathname));

  const preferenciasSectionActive = isPreferenciasSectionActive(pathname);

  const ventasSectionActive = suiteSoftwareCotizacionesActive(pathname);

  const logisticaSectionActive = suiteLogisticaActive(pathname);

  const renderItemLink = (item: NavItem, nested?: boolean) => {
    const isActive = item.activeMatch ? item.activeMatch(pathname) : navItemIsActive(pathname, item.href);
    const showConvBadge = Boolean(item.badgeConversations) && conversationsUnreadTotal > 0;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] font-medium transition-all duration-200 ${
          nested ? "pl-2" : ""
        } ${
          isActive
            ? "border-l-2 border-primary-500 bg-slate-800 text-white dark:bg-slate-700/80"
            : "text-slate-400 hover:bg-slate-800/90 hover:text-white dark:text-slate-500 dark:hover:bg-slate-700/60"
        }`}
      >
        <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
        </svg>
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {showConvBadge ? (
          <span
            className="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-primary-500 px-1 text-[10px] font-bold text-white tabular-nums ring-2 ring-[#0a0e17]"
            title={`${conversationsUnreadTotal} sin leer`}
            aria-label={`Mensajes sin leer en conversaciones: ${conversationsUnreadTotal}`}
          >
            {conversationsUnreadTotal > 99 ? "99+" : conversationsUnreadTotal}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <aside
      className="no-print fixed left-0 top-0 z-40 flex h-dvh max-h-dvh w-[var(--sidebar-width)] flex-col border-r border-slate-800/80 bg-[var(--app-shell-sidebar-bg)] text-white shadow-xl dark:border-neutral-800"
      aria-label="Navegación principal"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-800/80 px-3 dark:border-neutral-800">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-900/45 shadow-md shadow-black/30 dark:border-white/10 dark:bg-slate-950/50 dark:shadow-black/40">
            {headerLogoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- object URL del logo (misma fuente que documento)
              <img
                src={headerLogoSrc}
                alt=""
                className="h-full w-full max-h-full max-w-full rounded-lg object-contain p-0.5"
              />
            ) : (
              <svg className="h-6 w-6 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            )}
          </div>
          <span className="text-xs font-semibold leading-tight tracking-tight text-slate-100">DELTA SPACE</span>
        </div>
        <nav className="sidebar-scroll-discrete flex min-h-0 flex-1 flex-col overflow-hidden overscroll-y-contain p-2.5">
          <div className="sidebar-scroll-discrete min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden">
            {SUITE_NAV_MAIN.flatMap((item) => {
              if (item.href === VENTAS_HUB_HREF) {
                if (!hasVentasNavSection(navGrants, navRoles)) return [];
                const ventasMainHref = defaultVentasPanelHref(navGrants, navRoles);
                const showPanelSubLink = hasSuiteNavGrant(navGrants, navRoles, "ventas.panel");
                const showVentasDropdown = showPanelSubLink || ventasChildNav.length > 0;
                return [
                  <div key="ventas-suite" className="space-y-1">
                  <div
                    className={`flex w-full items-stretch overflow-hidden rounded-lg transition-all duration-200 ${
                      ventasSectionActive && !ventasOpen
                        ? "border-l-2 border-primary-500/70 bg-slate-800/90 text-white"
                        : ventasSectionActive && ventasOpen
                          ? "border-l-2 border-primary-500 bg-slate-800 text-white dark:bg-slate-700/80"
                          : "text-slate-400 hover:bg-slate-800/90 hover:text-white dark:text-slate-500 dark:hover:bg-slate-700/60"
                    }`}
                  >
                    <Link
                      href={ventasMainHref}
                      className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2.5 text-left text-[13px] font-medium text-inherit hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                    >
                      <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d={ventasNavGroup.icon}
                        />
                      </svg>
                      <span className="min-w-0 flex-1 truncate">{ventasNavGroup.label}</span>
                    </Link>
                    {showVentasDropdown ? (
                      <button
                        type="button"
                        onClick={() => setVentasOpen((o) => !o)}
                        aria-expanded={ventasOpen}
                        aria-label={ventasOpen ? "Ocultar submenú de Ventas" : "Mostrar submenú de Ventas"}
                        className="flex shrink-0 items-center justify-center border-l border-white/10 px-2 py-2.5 text-inherit transition hover:bg-slate-700/40 dark:border-white/5"
                      >
                        <svg
                          className={`h-4 w-4 shrink-0 opacity-70 transition-transform ${ventasOpen ? "-rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                  {ventasOpen && showVentasDropdown ? (
                    <div className="ml-2 space-y-1 border-l border-slate-700/70 pl-2 dark:border-slate-600/60">
                      {showPanelSubLink ? (
                        <Link
                          href={VENTAS_PANEL_DEFAULT_HREF}
                          className={`flex w-full items-center gap-2.5 rounded-lg py-2.5 pl-2 pr-2.5 text-[13px] font-medium transition-all duration-200 ${
                            navItemIsActive(pathname, VENTAS_PANEL_DEFAULT_HREF)
                              ? "border-l-2 border-primary-500 bg-slate-800 text-white dark:bg-slate-700/80"
                              : "text-slate-400 hover:bg-slate-800/90 hover:text-white dark:text-slate-500 dark:hover:bg-slate-700/60"
                          }`}
                        >
                          <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                            />
                          </svg>
                          <span className="min-w-0 flex-1 truncate">Panel de ventas</span>
                        </Link>
                      ) : null}
                      {ventasChildNav.map((child) => renderItemLink(child, true))}
                    </div>
                  ) : null}
                </div>,
                ];
              }
              if (item.href === LOGISTICA_HUB_HREF) {
                if (!hasLogisticaNavSection(navGrants, navRoles)) return [];
                const logisticaMainHref = defaultLogisticaHref(navGrants, navRoles);
                const showVistaSubLink = hasSuiteNavGrant(navGrants, navRoles, "logistica");
                const showLogisticaDropdown = showVistaSubLink || logisticaChildNav.length > 0;
                return [
                  <div key="logistica-suite" className="space-y-1">
                    <div
                      className={`flex w-full items-stretch overflow-hidden rounded-lg transition-all duration-200 ${
                        logisticaSectionActive && !logisticaOpen
                          ? "border-l-2 border-primary-500/70 bg-slate-800/90 text-white"
                          : logisticaSectionActive && logisticaOpen
                            ? "border-l-2 border-primary-500 bg-slate-800 text-white dark:bg-slate-700/80"
                            : "text-slate-400 hover:bg-slate-800/90 hover:text-white dark:text-slate-500 dark:hover:bg-slate-700/60"
                      }`}
                    >
                      <Link
                        href={logisticaMainHref}
                        className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2.5 text-left text-[13px] font-medium text-inherit hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                      >
                        <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d={logisticaNavGroup.icon}
                          />
                        </svg>
                        <span className="min-w-0 flex-1 truncate">{logisticaNavGroup.label}</span>
                      </Link>
                      {showLogisticaDropdown ? (
                        <button
                          type="button"
                          onClick={() => setLogisticaOpen((o) => !o)}
                          aria-expanded={logisticaOpen}
                          aria-label={logisticaOpen ? "Ocultar submenú de Logística" : "Mostrar submenú de Logística"}
                          className="flex shrink-0 items-center justify-center border-l border-white/10 px-2 py-2.5 text-inherit transition hover:bg-slate-700/40 dark:border-white/5"
                        >
                          <svg
                            className={`h-4 w-4 shrink-0 opacity-70 transition-transform ${logisticaOpen ? "-rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-hidden
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      ) : null}
                    </div>
                    {logisticaOpen && showLogisticaDropdown ? (
                      <div className="ml-2 space-y-1 border-l border-slate-700/70 pl-2 dark:border-slate-600/60">
                        {showVistaSubLink ? (
                          <Link
                            href={LOGISTICA_VISTA_HREF}
                            className={`flex w-full items-center gap-2.5 rounded-lg py-2.5 pl-2 pr-2.5 text-[13px] font-medium transition-all duration-200 ${
                              navItemIsActive(pathname, LOGISTICA_VISTA_HREF)
                                ? "border-l-2 border-primary-500 bg-slate-800 text-white dark:bg-slate-700/80"
                                : "text-slate-400 hover:bg-slate-800/90 hover:text-white dark:text-slate-500 dark:hover:bg-slate-700/60"
                            }`}
                          >
                            <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d={logisticaPrimaryChild?.icon ?? logisticaNavGroup.icon}
                              />
                            </svg>
                            <span className="min-w-0 flex-1 truncate">{logisticaPrimaryChild?.label ?? "Inventario"}</span>
                          </Link>
                        ) : null}
                        {logisticaChildNav.map((child) => renderItemLink(child, true))}
                      </div>
                    ) : null}
                  </div>,
                ];
              }
              const grantKey = suiteNavItemHrefToGrantKey(item.href);
              if (grantKey && !hasSuiteNavGrant(navGrants, navRoles, grantKey)) return [];
              return [renderItemLink(item)];
            })}
          </div>
          <div className="mt-2 shrink-0 space-y-1 border-t border-slate-700/70 pt-2 dark:border-slate-600/60">
            {renderItemLink(conversacionesSidebarItem)}
            {canAccessUsers ? (
              <div key="usuarios-suite" className="space-y-1">
                <div
                  className={`flex w-full items-stretch overflow-hidden rounded-lg transition-all duration-200 ${
                    suiteUsuariosSectionActive(pathname) && !usuariosOpen
                      ? "border-l-2 border-primary-500/70 bg-slate-800/90 text-white"
                      : suiteUsuariosSectionActive(pathname) && usuariosOpen
                        ? "border-l-2 border-primary-500 bg-slate-800 text-white dark:bg-slate-700/80"
                        : "text-slate-400 hover:bg-slate-800/90 hover:text-white dark:text-slate-500 dark:hover:bg-slate-700/60"
                  }`}
                >
                  <Link
                    href={USUARIOS_PANEL_HREF}
                    className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2.5 text-left text-[13px] font-medium text-inherit hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                  >
                    <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={usuariosNavItem.icon} />
                    </svg>
                    <span className="min-w-0 flex-1 truncate">{usuariosNavItem.label}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setUsuariosOpen((o) => !o)}
                    aria-expanded={usuariosOpen}
                    aria-label={usuariosOpen ? "Ocultar submenú de Usuarios" : "Mostrar submenú de Usuarios"}
                    className="flex shrink-0 items-center justify-center border-l border-white/10 px-2 py-2.5 text-inherit transition hover:bg-slate-700/40 dark:border-white/5"
                  >
                    <svg
                      className={`h-4 w-4 shrink-0 opacity-70 transition-transform ${usuariosOpen ? "-rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                {usuariosOpen ? (
                  <div className="ml-2 space-y-1 border-l border-slate-700/70 pl-2 dark:border-slate-600/60">
                    <Link
                      href={USUARIOS_PANEL_HREF}
                      className={`flex w-full items-center gap-2.5 rounded-lg py-2.5 pl-2 pr-2.5 text-[13px] font-medium transition-all duration-200 ${
                        usuariosPanelRouteActive(pathname)
                          ? "border-l-2 border-primary-500 bg-slate-800 text-white dark:bg-slate-700/80"
                          : "text-slate-400 hover:bg-slate-800/90 hover:text-white dark:text-slate-500 dark:hover:bg-slate-700/60"
                      }`}
                    >
                      <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                      </svg>
                      <span className="min-w-0 flex-1 truncate">Panel y dashboards</span>
                    </Link>
                    <Link
                      href={USUARIOS_LIST_HREF}
                      className={`flex w-full items-center gap-2.5 rounded-lg py-2.5 pl-2 pr-2.5 text-[13px] font-medium transition-all duration-200 ${
                        usuariosListRouteActive(pathname)
                          ? "border-l-2 border-primary-500 bg-slate-800 text-white dark:bg-slate-700/80"
                          : "text-slate-400 hover:bg-slate-800/90 hover:text-white dark:text-slate-500 dark:hover:bg-slate-700/60"
                      }`}
                    >
                      <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={usuariosNavItem.icon} />
                      </svg>
                      <span className="min-w-0 flex-1 truncate">Lista y crear usuarios</span>
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : null}
            {adminHasContent ? (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setAdminOpen((o) => !o)}
                  aria-expanded={adminOpen}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-[13px] font-medium transition-all duration-200 ${
                    adminSectionActive && !adminOpen
                      ? "border-l-2 border-primary-500/70 bg-slate-800/90 text-white"
                      : adminSectionActive && adminOpen
                        ? "border-l-2 border-primary-500 bg-slate-800 text-white dark:bg-slate-700/80"
                        : "text-slate-400 hover:bg-slate-800/90 hover:text-white dark:text-slate-500 dark:hover:bg-slate-700/60"
                  }`}
                >
                  <svg
                    className="h-[18px] w-[18px] shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span className="min-w-0 flex-1 truncate leading-snug">Administración del sistema</span>
                  <svg
                    className={`h-4 w-4 shrink-0 opacity-70 transition-transform ${adminOpen ? "-rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {adminOpen ? (
                  <div className="ml-2 space-y-1 border-l border-slate-700/70 pl-2 dark:border-slate-600/60">
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => setPrefsOpen((o) => !o)}
                        aria-expanded={prefsOpen}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 pl-2 text-left text-[13px] font-medium transition-all duration-200 ${
                          preferenciasSectionActive && !prefsOpen
                            ? "border-l-2 border-primary-500/70 bg-slate-800/90 text-white"
                            : preferenciasSectionActive && prefsOpen
                              ? "border-l-2 border-primary-500 bg-slate-800 text-white dark:bg-slate-700/80"
                              : "text-slate-400 hover:bg-slate-800/90 hover:text-white dark:text-slate-500 dark:hover:bg-slate-700/60"
                        }`}
                      >
                        <svg
                          className="h-[18px] w-[18px] shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d={preferenciasSectionIconPath}
                          />
                        </svg>
                        <span className="min-w-0 flex-1 truncate">Preferencias</span>
                        <svg
                          className={`h-4 w-4 shrink-0 opacity-70 transition-transform ${prefsOpen ? "-rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {prefsOpen ? (
                        <div className="ml-1 space-y-0.5 border-l border-slate-600/50 py-0.5 pl-2">
                          {preferenciasChildNav.map((item) => renderItemLink(item, true))}
                        </div>
                      ) : null}
                    </div>
                    {adminItems.map((item) => renderItemLink(item, true))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </nav>
        <div className="shrink-0 border-t border-slate-800/80 px-3 py-2.5 dark:border-slate-700/80">
          <p className="text-xs font-medium tracking-tight text-slate-400 dark:text-slate-400">DELTA SPACE</p>
        </div>
      </div>
    </aside>
  );
}
