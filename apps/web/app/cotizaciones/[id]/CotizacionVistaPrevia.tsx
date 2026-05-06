"use client";

import React from "react";
import type {
  QuoteDetail,
  QuoteVersionDetail,
  QuoteFvCalculation,
  FvStudy,
  FvStudyMonth,
  ImplantationDesign,
  CompanyProfile,
} from "../../../lib/api";
import { formatDate, formatMoney, type FvSummaryFromStudy } from "../constants";
import { EstudioFvGraficos } from "../../estudios-fv/EstudioFvGraficos";
import { EstudioFvInformeEjecutivo } from "../../estudios-fv/EstudioFvInformeEjecutivo";
import { getMountingBusinessLabel } from "../../estudios-fv/constants";
import {
  MARGIN_QUOTE_SUBTITLE,
  MARGIN_QUOTE_TAGLINE,
  marginQuoteBannerClass,
  marginQuoteSubtitleTextClass,
  marginQuoteTaglineTextClass,
} from "../../../lib/margin-quote-identity";
import { formatRutForDisplay } from "../../../lib/chile-inputs";
import {
  MARGIN_SYSTEM_TYPE_LABELS,
  splitMarginTechnicalBasics,
} from "../../../lib/margin-technical-basics";

type Props = {
  quote: QuoteDetail;
  version: QuoteVersionDetail;
  /** Si es true, se muestra una leyenda indicando que es una versión histórica. */
  isHistoricalVersion?: boolean;
  /** Origen de los datos FV en esta preview: estudio en vivo, snapshot congelado o compatibilidad. */
  fvSourceLabel?: "live" | "snapshot" | "compatibility";
  /** Si existe sourceFvStudyId se usa fvSummaryFromStudy; si no, se usa fvCalculation. Nunca se muestran ambos. */
  fvCalculation?: QuoteFvCalculation | null;
  /** Resumen FV desde estudio origen (prioritario sobre fvCalculation). */
  fvSummaryFromStudy?: FvSummaryFromStudy | null;
  /** Meses del estudio FV para gráficos; solo se usa cuando hay fvSummaryFromStudy. */
  fvStudyMonths?: FvStudyMonth[] | null;
  /** Estudio FV completo para informe ejecutivo y gráficos con tarifas. */
  fvStudy?: FvStudy | null;
  /** Diseño de implantación del estudio (para sección disposición de paneles). */
  implantationDesign?: ImplantationDesign | null;
  /** URL de la captura del layout (blob URL). */
  implantationScreenshotUrl?: string | null;
  /** Resumen de implantación desde snapshot congelado (sin captura). */
  implantationSummary?: {
    placementCount: number;
    stringsSummary: Array<{ stringId: string; count: number }>;
    angles: number[];
    panelNameSnapshot: string | null;
    tiltDegrees: number | null;
    mountingType: string | null;
  } | null;
  /** Perfil de empresa para cabecera/pie del documento (lectura vía API de cotizaciones). */
  companyProfile?: CompanyProfile | null;
  /** Object URL del logo (GET autenticado + blob). */
  companyLogoObjectUrl?: string | null;
};

function hasUsefulChartData(months: FvStudyMonth[]): boolean {
  if (!months.length) return false;
  return months.some(
    (m) =>
      m.consumptionKwh > 0 ||
      m.generationKwh > 0 ||
      (m.estimatedPayment != null && Number(m.estimatedPayment) !== 0)
  );
}

function normalizeComparableText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isRedundantAgainstMain(mainName: string, lineName: string, lineDesc?: string | null): boolean {
  const main = normalizeComparableText(mainName);
  const line = normalizeComparableText(lineName);
  const desc = normalizeComparableText(lineDesc);
  if (!main || !line) return false;
  return line === main || (!!desc && desc === main);
}

/** Usa mainItems cuando la versión tiene estructura jerárquica; si no, usa items (modo plano). */
function useHierarchicalItems(version: QuoteVersionDetail): boolean {
  return Boolean(version.mainItems != null && version.mainItems.length > 0);
}

function corporateProfileHasVisibleContent(profile: CompanyProfile, hasLogo: boolean): boolean {
  if (hasLogo) return true;
  const keys: (keyof CompanyProfile)[] = [
    "commercialName",
    "legalName",
    "taxId",
    "businessActivity",
    "address",
    "commune",
    "region",
    "country",
    "phone",
    "email",
    "website",
    "instagramUrl",
    "facebookUrl",
  ];
  return keys.some((k) => {
    const v = profile[k];
    return v != null && String(v).trim() !== "";
  });
}

function normalizeExternalHref(raw: string): string {
  const s = raw.trim();
  if (!s) return "#";
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function IconInstagramMono({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function IconFacebookMono({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function DocumentCorporateHeader({
  profile,
  logoUrl,
}: {
  profile: CompanyProfile;
  logoUrl: string | null;
}) {
  const t = (s: string | null | undefined) => (s != null && String(s).trim() ? String(s).trim() : "");
  const cn = t(profile.commercialName);
  const ln = t(profile.legalName);
  const rut = t(profile.taxId);
  const biz = t(profile.businessActivity);

  const loc = [profile.commune, profile.region, profile.country]
    .map((x) => (x != null ? String(x).trim() : ""))
    .filter(Boolean)
    .join(", ");

  const addr = t(profile.address);
  const phone = t(profile.phone);
  const email = t(profile.email);
  const web = t(profile.website);
  const instagramUrl = t(profile.instagramUrl);
  const facebookUrl = t(profile.facebookUrl);
  const hasSocialRow = Boolean(instagramUrl || facebookUrl);

  const hasIdentity = Boolean(cn || ln || rut || biz);
  const hasCompanyContact = Boolean(addr || loc || phone || email);
  const hasLeftColumn = Boolean(logoUrl || web || hasSocialRow);

  if (!hasLeftColumn && !hasIdentity && !hasCompanyContact) return null;

  return (
    <div className="mb-4 flex flex-col gap-2.5 border-b border-slate-200 pb-3 print:mb-3 print:gap-2 print:pb-2.5 print:break-inside-avoid sm:flex-row sm:items-start sm:gap-5 lg:gap-6">
      {hasLeftColumn && (
        <div className="flex w-full shrink-0 justify-center sm:justify-start sm:w-auto sm:max-w-[22rem]">
          <div className="inline-flex max-w-[22rem] flex-col items-center gap-1 self-center sm:self-start">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- object URL del logo autenticado
              <img
                src={logoUrl}
                alt=""
                className="h-36 w-auto max-w-[22rem] object-contain object-left print:h-28"
              />
            ) : null}
            {web ? (
              <p className="w-full min-w-0 max-w-[22rem] text-center break-words text-[10px] leading-snug text-slate-500 print:text-[9px]">
                {web}
              </p>
            ) : null}
            {hasSocialRow ? (
              <div className="flex w-full min-w-0 max-w-[22rem] flex-wrap items-center justify-center gap-x-3 gap-y-0.5 sm:justify-start">
                {instagramUrl ? (
                  <a
                    href={normalizeExternalHref(instagramUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1 text-[10px] font-medium text-slate-600 no-underline hover:text-slate-900 hover:underline print:text-[9px] print:text-slate-700"
                  >
                    <IconInstagramMono className="h-3.5 w-3.5 shrink-0 text-slate-500 print:text-slate-600" />
                    <span className="min-w-0 truncate">Instagram</span>
                  </a>
                ) : null}
                {facebookUrl ? (
                  <a
                    href={normalizeExternalHref(facebookUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1 text-[10px] font-medium text-slate-600 no-underline hover:text-slate-900 hover:underline print:text-[9px] print:text-slate-700"
                  >
                    <IconFacebookMono className="h-3.5 w-3.5 shrink-0 text-slate-500 print:text-slate-600" />
                    <span className="min-w-0 truncate">Facebook</span>
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-3 leading-tight sm:flex-row sm:items-start sm:gap-4 lg:gap-5">
        {hasIdentity && (
          <div className="shrink-0 space-y-0.5 sm:min-w-0 sm:flex-1 sm:max-w-[14rem] lg:max-w-[15rem]">
            {cn && (
              <p className="text-lg font-semibold tracking-tight text-slate-900 print:text-base">{cn}</p>
            )}
            {ln && <p className="text-xs text-slate-600 print:text-slate-700">{ln}</p>}
            {rut && <p className="text-xs text-slate-800 print:text-slate-900">RUT {rut}</p>}
            {biz && <p className="text-[10px] leading-tight text-slate-500">{biz}</p>}
          </div>
        )}
        {hasCompanyContact ? (
          <div className="min-w-0 flex-1 space-y-2 text-[11px] leading-tight print:space-y-1.5">
            {addr ? (
              <div className="min-w-0">
                <p className="text-[9px] font-medium uppercase tracking-wide text-slate-500">Dirección</p>
                <p className="mt-0.5 break-words text-[11px] text-slate-800">{addr}</p>
              </div>
            ) : null}
            {loc ? (
              <div className="min-w-0">
                <p className="text-[9px] font-medium uppercase tracking-wide text-slate-500">Comuna / región / país</p>
                <p className="mt-0.5 break-words text-[11px] text-slate-800">{loc}</p>
              </div>
            ) : null}
            {phone || email ? (
              <div className="min-w-0 space-y-1.5">
                {phone ? (
                  <div>
                    <p className="text-[9px] font-medium uppercase tracking-wide text-slate-500">Teléfono</p>
                    <p className="mt-0.5 break-words text-[11px] text-slate-800">{phone}</p>
                  </div>
                ) : null}
                {email ? (
                  <div>
                    <p className="text-[9px] font-medium uppercase tracking-wide text-slate-500">Correo</p>
                    <p className="mt-0.5 break-words text-[11px] text-slate-800">{email}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DocumentCompanyClosingBlock({ profile }: { profile: CompanyProfile }) {
  const t = (s: string | null | undefined) => (s != null && String(s).trim() ? String(s).trim() : "");

  const bankName = t(profile.bankName);
  const accountType = t(profile.accountType);
  const accountNumber = t(profile.accountNumber);
  const accountHolderName = t(profile.accountHolderName);
  const accountHolderTaxId = t(profile.accountHolderTaxId);
  const transferReceiptEmail = t(profile.transferReceiptEmail);

  const hasTransfer = Boolean(
    bankName ||
      accountType ||
      accountNumber ||
      accountHolderName ||
      accountHolderTaxId ||
      transferReceiptEmail
  );
  const hasPaymentTerms = !!t(profile.paymentTerms);
  const hasGeneral = !!t(profile.generalNotes);
  const hasQuoteNote = !!t(profile.quoteNote);

  if (!hasTransfer && !hasPaymentTerms && !hasGeneral && !hasQuoteNote) return null;

  return (
    <section className="mt-8 space-y-6 border-t border-slate-200 pt-6 print:mt-6 print:pt-4 print:break-inside-avoid">
      {hasTransfer && (
        <div className="min-w-0 print:break-inside-avoid">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 print:text-xs">
            Datos para transferencia
          </h2>
          <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 text-[12px] sm:grid-cols-2 sm:gap-y-1.5 lg:grid-cols-3 print:mt-2 print:grid-cols-3 print:gap-x-3 print:gap-y-1 print:text-[11px]">
            {bankName ? (
              <div className="min-w-0">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500 print:text-[9px]">
                  Banco
                </dt>
                <dd className="mt-0.5 font-medium break-words leading-snug text-slate-900">{bankName}</dd>
              </div>
            ) : null}
            {accountType ? (
              <div className="min-w-0">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500 print:text-[9px]">
                  Tipo de cuenta
                </dt>
                <dd className="mt-0.5 font-medium break-words leading-snug text-slate-900">{accountType}</dd>
              </div>
            ) : null}
            {accountNumber ? (
              <div className="min-w-0">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500 print:text-[9px]">
                  Número de cuenta
                </dt>
                <dd className="mt-0.5 font-medium break-words leading-snug text-slate-900">{accountNumber}</dd>
              </div>
            ) : null}
            {accountHolderName ? (
              <div className="min-w-0">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500 print:text-[9px]">
                  Titular
                </dt>
                <dd className="mt-0.5 font-medium break-words leading-snug text-slate-900">{accountHolderName}</dd>
              </div>
            ) : null}
            {accountHolderTaxId ? (
              <div className="min-w-0">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500 print:text-[9px]">
                  RUT titular
                </dt>
                <dd className="mt-0.5 font-medium break-words leading-snug text-slate-900">{accountHolderTaxId}</dd>
              </div>
            ) : null}
            {transferReceiptEmail ? (
              <div className="min-w-0 sm:col-span-2 lg:col-span-1 print:col-span-1">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500 print:text-[9px]">
                  Correo para comprobante
                </dt>
                <dd className="mt-0.5 break-all font-medium leading-snug text-slate-900">{transferReceiptEmail}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      )}
      {hasPaymentTerms && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Condiciones de pago (empresa)</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{t(profile.paymentTerms)}</p>
        </div>
      )}
      {hasGeneral && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Observaciones generales</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{t(profile.generalNotes)}</p>
        </div>
      )}
      {hasQuoteNote && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Nota para cotización</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{t(profile.quoteNote)}</p>
        </div>
      )}
    </section>
  );
}

export function CotizacionVistaPrevia({
  quote,
  version,
  isHistoricalVersion = false,
  fvCalculation = null,
  fvSummaryFromStudy = null,
  fvStudyMonths = null,
  fvStudy = null,
  implantationDesign = null,
  implantationScreenshotUrl = null,
  implantationSummary = null,
  fvSourceLabel,
  companyProfile = null,
  companyLogoObjectUrl = null,
}: Props) {
  const currency = quote.currency ?? "USD";
  const fvSourceMessage =
    fvSourceLabel === "snapshot"
      ? "Fuente de datos FV: snapshot congelado (versión no modificable)."
      : fvSourceLabel === "compatibility"
        ? "Fuente de datos FV: estudio en vivo (compatibilidad con versión antigua)."
        : fvSourceLabel === "live"
          ? "Fuente de datos FV: estudio en vivo."
          : null;
  const showFvFromStudy = fvSummaryFromStudy != null;
  const showFvFromCalculation = !showFvFromStudy && fvCalculation != null;
  /** Cotización hereda `technicalBasicsJson.systemType`; fallback al estudio vinculado. */
  const systemTypeForPreview =
    splitMarginTechnicalBasics(quote.technicalBasicsJson).form.systemType ||
    (fvStudy ? splitMarginTechnicalBasics({ systemType: fvStudy.systemType }).form.systemType : "");
  const showCharts =
    showFvFromStudy &&
    fvStudyMonths &&
    fvStudyMonths.length > 0 &&
    hasUsefulChartData(fvStudyMonths);
  const chartCurrency = fvSummaryFromStudy?.currency ?? currency;
  const fieldValue = (v: string | null | undefined): string => {
    if (v == null) return "—";
    const t = String(v).trim();
    return t.length > 0 ? t : "—";
  };
  const customerName = fieldValue(quote.client?.name) !== "—" ? fieldValue(quote.client?.name) : quote.clientId;
  const salespersonName = quote.salesperson
    ? fieldValue(
        quote.salesperson.fullName?.trim() ||
          quote.salesperson.name?.trim() ||
          quote.salesperson.email,
      )
    : "—";
  const isMarginQuote = quote.quoteKind === "MARGIN";

  const leadRef =
    quote.leadNumber != null && String(quote.leadNumber).trim() !== ""
      ? String(quote.leadNumber).trim()
      : null;

  const showCorporateHeader =
    companyProfile != null &&
    corporateProfileHasVisibleContent(companyProfile, Boolean(companyLogoObjectUrl));

  return (
    <article className="cotizacion-documento mx-auto max-w-4xl bg-white px-6 py-8 print:max-w-none print:px-0 print:py-3 sm:px-8 sm:py-10">
      {showCorporateHeader && companyProfile != null && (
        <DocumentCorporateHeader profile={companyProfile} logoUrl={companyLogoObjectUrl ?? null} />
      )}

      {/* Identidad MARGIN: mismo documento que STANDARD; sin datos económicos internos */}
      {isMarginQuote && (
        <div className="mb-6 border-b border-slate-200 pb-6 print:mb-4 print:pb-4 print:break-inside-avoid">
          <div
            className={`print:break-inside-avoid ${marginQuoteBannerClass} print:border print:border-violet-200 print:bg-violet-50`}
          >
            <p className={`${marginQuoteSubtitleTextClass} print:text-violet-900`}>
              {MARGIN_QUOTE_SUBTITLE}
            </p>
            <p className={`${marginQuoteTaglineTextClass} print:text-violet-800`}>
              {MARGIN_QUOTE_TAGLINE}
            </p>
          </div>
        </div>
      )}

      {/* Encabezado de cotización — título + propuesta (datos operativos solo en Ficha comercial) */}
      <section className="mt-3 border-b border-slate-200 pb-3 print:mt-2.5 print:pb-2.5 print:break-inside-avoid">
        <h1 className="text-lg font-bold tracking-tight text-slate-900 print:text-base">Cotización</h1>
        <div className="mt-1.5 border-t border-slate-100 pt-1.5 print:mt-1 print:pt-1.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-base font-semibold leading-tight text-slate-900 print:text-[15px]">{quote.title}</span>
            {leadRef && (
              <span className="text-[11px] font-medium tabular-nums text-slate-500">Ref.: {leadRef}</span>
            )}
          </div>
          {isHistoricalVersion && (
            <p className="mt-1 text-[11px] leading-tight text-amber-700">
              Versión histórica — no es la versión vigente actual.
            </p>
          )}
        </div>
      </section>

      {/* Ficha comercial — grilla densa (mín. 4 columnas en print/PDF) */}
      <section className="mt-3 border border-slate-200 px-3 py-2 print:mt-2 print:border-slate-300 print:px-2 print:py-1.5 print:break-inside-avoid sm:rounded-lg sm:px-3 sm:py-2.5">
        <h2 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 print:text-[9px]">
          Ficha comercial
        </h2>
        <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 print:mt-1.5 print:grid-cols-4 print:gap-x-3 print:gap-y-1 print:text-[10px]">
          <div className="min-w-0">
            <dt className="text-[8px] font-medium uppercase tracking-wide text-slate-500 print:text-[7px]">
              Nº cotización
            </dt>
            <dd className="mt-0.5 font-semibold leading-tight text-slate-900">{quote.commercialNumber ?? "—"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[8px] font-medium uppercase tracking-wide text-slate-500 print:text-[7px]">
              Cliente
            </dt>
            <dd className="mt-0.5 font-semibold leading-tight text-slate-900">{customerName}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[8px] font-medium uppercase tracking-wide text-slate-500 print:text-[7px]">Correo</dt>
            <dd className="mt-0.5 break-all leading-tight text-slate-900">{fieldValue(quote.client?.email)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[8px] font-medium uppercase tracking-wide text-slate-500 print:text-[7px]">
              Teléfono
            </dt>
            <dd className="mt-0.5 leading-tight text-slate-900">{fieldValue(quote.client?.phone)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[8px] font-medium uppercase tracking-wide text-slate-500 print:text-[7px]">
              Tipo de sistema
            </dt>
            <dd className="mt-0.5 leading-tight text-slate-900">
              {systemTypeForPreview ? MARGIN_SYSTEM_TYPE_LABELS[systemTypeForPreview] : "—"}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[8px] font-medium uppercase tracking-wide text-slate-500 print:text-[7px]">
              Estado comercial
            </dt>
            <dd className="mt-0.5 leading-tight text-slate-900">{fieldValue(quote.status)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[8px] font-medium uppercase tracking-wide text-slate-500 print:text-[7px]">
              Fecha emisión
            </dt>
            <dd className="mt-0.5 leading-tight text-slate-900">{formatDate(version.createdAt)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[8px] font-medium uppercase tracking-wide text-slate-500 print:text-[7px]">
              Validez
            </dt>
            <dd className="mt-0.5 leading-tight text-slate-900">{formatDate(quote.validUntil)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[8px] font-medium uppercase tracking-wide text-slate-500 print:text-[7px]">
              Vendedor
            </dt>
            <dd className="mt-0.5 leading-tight text-slate-900">{salespersonName}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[8px] font-medium uppercase tracking-wide text-slate-500 print:text-[7px]">RUT</dt>
            <dd className="mt-0.5 leading-tight text-slate-900">
              {fieldValue(formatRutForDisplay(quote.client?.taxId) || undefined)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[8px] font-medium uppercase tracking-wide text-slate-500 print:text-[7px]">Lead</dt>
            <dd className="mt-0.5 leading-tight text-slate-900">{fieldValue(quote.leadNumber)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[8px] font-medium uppercase tracking-wide text-slate-500 print:text-[7px]">
              Versión
            </dt>
            <dd className="mt-0.5 font-medium leading-tight text-slate-900">
              {version.versionNumber} · {formatDate(version.createdAt)}
            </dd>
          </div>
          <div className="min-w-0 col-span-2 sm:col-span-3 lg:col-span-4 print:col-span-4">
            <dt className="text-[8px] font-medium uppercase tracking-wide text-slate-500 print:text-[7px]">
              Dirección
            </dt>
            <dd className="mt-0.5 leading-tight text-slate-900">{fieldValue(quote.client?.address)}</dd>
          </div>
        </dl>
      </section>

      {fvSourceMessage && (
        <p className="mt-4 text-xs text-slate-600">
          {fvSourceMessage}
        </p>
      )}

      {/* Informe ejecutivo FV — tras ficha; evitar cortes internos en impresión */}
      {fvStudy && (
        <section
          id="informe-ejecutivo"
          className="print-avoid-break mt-6 border-t border-slate-200 pt-4 print:mt-4 print:pt-3"
          aria-label="Informe ejecutivo del proyecto"
        >
          <EstudioFvInformeEjecutivo
            study={fvStudy}
            inversionTotalOverride={version.total > 0 ? version.total : undefined}
          />
        </section>
      )}

      {/* Propuesta comercial: tabla a ancho completo; totales debajo (cierre económico) */}
      <section
        className={`mt-6 border-t border-slate-200 pt-4 print:mt-5 print:pt-3${fvStudy ? " print-break-before" : ""}`}
      >
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600 print:text-[10px]">
          Propuesta comercial — detalle e importes
        </h2>
        <div className="mt-3 print:mt-2 print:break-inside-avoid">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 print:text-[10px]">
            Detalle de ítems
          </h3>
          <div className="mt-2 w-full overflow-x-auto print:mt-1.5 print:overflow-visible">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="py-3 text-left font-medium text-slate-700">Descripción</th>
                <th className="w-20 py-3 text-right font-medium text-slate-700 print:w-14 print:py-2">Cant.</th>
                <th className="w-28 py-3 text-right font-medium text-slate-700 print:w-24 print:py-2">P. unit.</th>
                <th className="w-24 py-3 text-right font-medium text-slate-700 print:w-16 print:py-2">Desc.</th>
                <th className="w-28 py-3 text-right font-medium text-slate-700 print:w-24 print:py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {useHierarchicalItems(version) ? (
                // Modo jerárquico: solo principales con visibleInFinalQuote; sus líneas visibles solo si el principal es visible
                (() => {
                  const visibleMainItems = (version.mainItems ?? []).filter(
                    (m) => m.visibleInFinalQuote === true
                  );
                  if (visibleMainItems.length === 0) {
                    return (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500">
                          Sin ítems visibles en esta versión.
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <>
                      {visibleMainItems.map((mainItem) => (
                        <React.Fragment key={mainItem.id}>
                          {/* Fila del principal: siempre si el principal es visible; Cant., P. unit., Desc. vacíos o "—" */}
                          <tr
                            className="border-b border-slate-100 print:break-inside-avoid"
                          >
                            <td className="py-3 break-words print:py-2">
                              <div className="font-medium text-slate-900">{mainItem.name}</div>
                              {mainItem.description && mainItem.description.trim() !== "" && (
                                <div className="mt-0.5 text-xs text-slate-500">
                                  {mainItem.description}
                                </div>
                              )}
                            </td>
                            <td className="py-3 text-right text-slate-500 print:py-2">—</td>
                            <td className="py-3 text-right text-slate-500 print:py-2">—</td>
                            <td className="py-3 text-right text-slate-500 print:py-2">—</td>
                            <td className="py-3 text-right font-medium text-slate-900 print:py-2">
                              {formatMoney(mainItem.total, currency)}
                            </td>
                          </tr>
                          {/* Líneas visibles solo cuando el principal es visible; estilo secundario / sangría */}
                          {mainItem.lines
                            .filter((line) => line.visibleInFinalQuote === true)
                            .map((line) => {
                              const hasDiscount =
                                line.discountPercentSnapshot != null &&
                                Number(line.discountPercentSnapshot) > 0;
                              const redundantName = isRedundantAgainstMain(
                                mainItem.name,
                                line.productNameSnapshot,
                                line.productDescriptionSnapshot
                              );
                              const hasUsefulLineDescription =
                                !!line.productDescriptionSnapshot &&
                                normalizeComparableText(line.productDescriptionSnapshot) !== "" &&
                                normalizeComparableText(line.productDescriptionSnapshot) !==
                                  normalizeComparableText(mainItem.name) &&
                                normalizeComparableText(line.productDescriptionSnapshot) !==
                                  normalizeComparableText(mainItem.description);
                              return (
                                <tr
                                  key={line.id}
                                  className="border-b border-slate-50 print:break-inside-avoid"
                                >
                                  <td className="py-2 pl-6 text-slate-600 break-words print:pl-4">
                                    {!redundantName && (
                                      <div className="font-medium">{line.productNameSnapshot}</div>
                                    )}
                                    {hasUsefulLineDescription && (
                                      <div className="mt-0.5 text-xs text-slate-500">
                                        {line.productDescriptionSnapshot}
                                      </div>
                                    )}
                                    {redundantName && !hasUsefulLineDescription && (
                                      <div className="text-xs italic text-slate-500">
                                        Detalle incluido en el encabezado del grupo.
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2 text-right text-slate-600">
                                    {line.quantity}
                                  </td>
                                  <td className="py-2 text-right text-slate-600">
                                    {formatMoney(line.unitPriceSnapshot, line.currencySnapshot)}
                                  </td>
                                  <td className="py-2 text-right text-slate-500">
                                    {hasDiscount ? `${line.discountPercentSnapshot}%` : "—"}
                                  </td>
                                  <td className="py-2 text-right font-medium text-slate-700">
                                    {formatMoney(line.lineTotalSnapshot, line.currencySnapshot)}
                                  </td>
                                </tr>
                              );
                            })}
                        </React.Fragment>
                      ))}
                    </>
                  );
                })()
              ) : version.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    Sin ítems en esta versión.
                  </td>
                </tr>
              ) : (
                version.items.map((item) => {
                  const hasDiscount =
                    item.discountPercentSnapshot != null &&
                    Number(item.discountPercentSnapshot) > 0;
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-slate-100 print:break-inside-avoid"
                    >
                      <td className="py-3 break-words print:py-2">
                        <div className="font-medium text-slate-900">
                          {item.productNameSnapshot}
                        </div>
                        {item.productDescriptionSnapshot && (
                          <div className="mt-0.5 text-xs text-slate-500">
                            {item.productDescriptionSnapshot}
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-right text-slate-700 print:py-2">
                        {item.quantity}
                      </td>
                      <td className="py-3 text-right text-slate-700 print:py-2">
                        {formatMoney(item.unitPriceSnapshot, item.currencySnapshot)}
                      </td>
                      <td className="py-3 text-right text-slate-600 print:py-2">
                        {hasDiscount ? `${item.discountPercentSnapshot}%` : "—"}
                      </td>
                      <td className="py-3 text-right font-medium text-slate-900 print:py-2">
                        {formatMoney(item.lineTotalSnapshot, item.currencySnapshot)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>

          <div className="mt-4 flex w-full justify-end border-t border-slate-200 pt-3 print:mt-3 print:pt-2.5 print:break-inside-avoid">
            <div className="w-full max-w-xs space-y-1.5 text-[13px] tabular-nums print:max-w-[14rem] print:text-[11px]">
              <div className="flex justify-between gap-6">
                <span className="text-slate-600">Subtotal</span>
                <span className="text-right font-medium text-slate-900">
                  {formatMoney(version.subtotal, currency)}
                </span>
              </div>
              {version.discountsTotal > 0 && (
                <div className="flex justify-between gap-6">
                  <span className="text-slate-600">Descuento global</span>
                  <span className="text-right font-medium text-slate-900">
                    − {formatMoney(version.discountsTotal, currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-6">
                <span className="text-slate-600">IVA ({version.vatPercent}%)</span>
                <span className="text-right font-medium text-slate-900">
                  {formatMoney(version.taxesTotal, currency)}
                </span>
              </div>
              <div className="mt-2 flex justify-between gap-6 border-t-2 border-slate-300 pt-2 text-base font-semibold print:mt-1.5 print:pt-1.5 print:text-[13px]">
                <span className="text-slate-900">Total</span>
                <span className="text-right text-slate-900">
                  {formatMoney(version.total, currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Resumen fotovoltaico — solo si no hay estudio completo (el informe ya cubre el caso con fvStudy) */}
      {(showFvFromStudy || showFvFromCalculation) && !fvStudy && (
        <section className="mt-8 space-y-3 border-t border-slate-200 pt-6 print:mt-6 print:pt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Resumen fotovoltaico
          </h2>
          {fvSummaryFromStudy?.sourceTitle && (
            <p className="text-xs text-slate-500">
              Basado en Estudio FV: {fvSummaryFromStudy.sourceTitle}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-1">
            {showFvFromStudy && fvSummaryFromStudy ? (
              <>
                <div>
                  <p className="text-xs font-medium text-slate-500">Planta recomendada</p>
                  <p className="mt-0.5 font-medium text-slate-900">{fvSummaryFromStudy.plantaKwp} kWp</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Cantidad de paneles</p>
                  <p className="mt-0.5 font-medium text-slate-900">{fvSummaryFromStudy.cantidadPaneles}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Generación anual estimada</p>
                  <p className="mt-0.5 font-medium text-slate-900">
                    {fvSummaryFromStudy.generacionAnualKwh.toLocaleString("es-CL")} kWh
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Ahorro anual estimado</p>
                  <p className="mt-0.5 font-medium text-slate-900">
                    {formatMoney(fvSummaryFromStudy.ahorroAnual, fvSummaryFromStudy.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Porcentaje de ahorro</p>
                  <p className="mt-0.5 font-medium text-slate-900">{fvSummaryFromStudy.porcentajeAhorro.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Pago residual estimado</p>
                  <p className="mt-0.5 font-medium text-slate-900">
                    {formatMoney(fvSummaryFromStudy.pagoResidualAnual, fvSummaryFromStudy.currency)}
                  </p>
                </div>
              </>
            ) : fvCalculation ? (
              <>
                <div>
                  <p className="text-xs font-medium text-slate-500">Planta recomendada</p>
                  <p className="mt-0.5 font-medium text-slate-900">{fvCalculation.plantaKwp} kWp</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Cantidad de paneles</p>
                  <p className="mt-0.5 font-medium text-slate-900">{fvCalculation.cantidadPaneles}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Generación anual estimada</p>
                  <p className="mt-0.5 font-medium text-slate-900">
                    {fvCalculation.generacionAnualKwh.toLocaleString("es-CL")} kWh
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Ahorro anual estimado</p>
                  <p className="mt-0.5 font-medium text-slate-900">
                    {formatMoney(fvCalculation.ahorroAnual, fvCalculation.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Porcentaje de ahorro</p>
                  <p className="mt-0.5 font-medium text-slate-900">{fvCalculation.porcentajeAhorro.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Pago residual estimado</p>
                  <p className="mt-0.5 font-medium text-slate-900">
                    {formatMoney(fvCalculation.pagoResidual, fvCalculation.currency)}
                  </p>
                </div>
              </>
            ) : null}
          </div>
        </section>
      )}

      {/* Análisis FV: gráficos mensuales + implantación en un mismo bloque editorial */}
      {((showCharts && fvStudyMonths) || (fvStudy && (implantationDesign || implantationSummary))) && (
        <section
          className="mt-8 border-t border-slate-200 pt-6 print:mt-6 print:pt-4"
          aria-label="Análisis del estudio FV"
        >
          {showCharts && fvStudyMonths && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                Análisis mensual del estudio FV
              </h2>
              {fvSummaryFromStudy?.sourceTitle && (
                <p className="text-xs text-slate-500">
                  Basado en Estudio FV: {fvSummaryFromStudy.sourceTitle}
                </p>
              )}
              <div>
                <EstudioFvGraficos
                  months={fvStudyMonths}
                  currency={chartCurrency}
                  valorKwhConsumo={fvStudy?.valorKwhConsumo}
                  valorKwhInyeccion={fvStudy?.valorKwhInyeccion}
                />
              </div>
            </div>
          )}

          {fvStudy && (implantationDesign || implantationSummary) && (
            <div
              className={
                showCharts && fvStudyMonths
                  ? "mt-8 space-y-4 border-t border-slate-200 pt-6 print:mt-6 print:pt-4"
                  : "space-y-4"
              }
            >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Disposición de paneles e implantación
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {implantationScreenshotUrl && (
              <div className="print-avoid-break">
                <p className="mb-1 text-xs font-medium text-slate-500">Captura del layout</p>
                <img
                  src={implantationScreenshotUrl}
                  alt="Diseño de implantación"
                  className="max-h-52 w-auto rounded border border-slate-200 object-contain print:max-h-64"
                />
              </div>
            )}
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-xs font-medium text-slate-500">Cantidad de paneles</p>
                <p className="font-medium text-slate-900">
                  {implantationSummary
                    ? implantationSummary.placementCount
                    : implantationDesign?.placements?.length ?? 0}
                </p>
              </div>
              {implantationSummary ? (
                <>
                  {implantationSummary.stringsSummary.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-500">Strings</p>
                      <p className="font-medium text-slate-900">
                        {[...implantationSummary.stringsSummary]
                          .sort((a, b) => (a.stringId === "—" ? 1 : b.stringId === "—" ? -1 : a.stringId.localeCompare(b.stringId)))
                          .map(({ stringId: sid, count: n }) =>
                            sid === "—" ? `Sin asignar: ${n}` : `String ${sid}: ${n} paneles`
                          )
                          .join(" · ")}
                      </p>
                    </div>
                  )}
                  {implantationSummary.angles.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-500">Orientación / ángulo en planta</p>
                      <p className="font-medium text-slate-900">
                        {implantationSummary.angles.join("°, ")}°
                      </p>
                    </div>
                  )}
                </>
              ) : implantationDesign?.placements?.length ? (
                (() => {
                  const byString = new Map<string, number>();
                  const angles = new Set<number>();
                  for (const p of implantationDesign.placements) {
                    const sid = p.stringId?.trim() || "—";
                    byString.set(sid, (byString.get(sid) ?? 0) + 1);
                    if (p.orientationDeg != null) angles.add(Math.round(p.orientationDeg));
                  }
                  return (
                    <>
                      {byString.size > 0 && (
                        <div>
                          <p className="text-xs font-medium text-slate-500">Strings</p>
                          <p className="font-medium text-slate-900">
                            {Array.from(byString.entries())
                              .sort(([a], [b]) => (a === "—" ? 1 : b === "—" ? -1 : a.localeCompare(b)))
                              .map(([sid, n]) => (sid === "—" ? `Sin asignar: ${n}` : `String ${sid}: ${n} paneles`))
                              .join(" · ")}
                          </p>
                        </div>
                      )}
                      {angles.size > 0 && (
                        <div>
                          <p className="text-xs font-medium text-slate-500">Orientación / ángulo en planta</p>
                          <p className="font-medium text-slate-900">
                            {Array.from(angles).sort((a, b) => a - b).join("°, ")}°
                          </p>
                        </div>
                      )}
                    </>
                  );
                })()
              ) : null}
              <div>
                <p className="text-xs font-medium text-slate-500">Tipo de panel</p>
                <p className="font-medium text-slate-900">
                  {(implantationSummary?.panelNameSnapshot ?? implantationDesign?.panelNameSnapshot)?.trim() || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Inclinación</p>
                <p className="font-medium text-slate-900">
                  {(implantationSummary?.tiltDegrees ?? fvStudy.tiltDegrees) != null
                    ? `${implantationSummary?.tiltDegrees ?? fvStudy.tiltDegrees}°`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Tipo de montaje</p>
                <p className="font-medium text-slate-900">
                  {getMountingBusinessLabel((implantationSummary?.mountingType ?? fvStudy.mountingType) ?? undefined)}
                </p>
              </div>
            </div>
          </div>
            </div>
          )}
        </section>
      )}

      {/* Condiciones y notas al cliente (cotización) */}
      <section className="mt-8 space-y-4 border-t border-slate-200 pt-6 print:mt-6 print:pt-4">
        {quote.paymentTerms && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Condiciones de pago
            </p>
            <p className="mt-0.5 text-sm text-slate-700">{quote.paymentTerms}</p>
          </div>
        )}
        {quote.deliveryDays != null && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Plazo de entrega
            </p>
            <p className="mt-0.5 text-sm text-slate-700">{quote.deliveryDays} días</p>
          </div>
        )}
        {quote.clientNotes && quote.clientNotes.trim() !== "" && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Notas
            </p>
            <p className="mt-0.5 text-sm text-slate-700 whitespace-pre-wrap">
              {quote.clientNotes.trim()}
            </p>
          </div>
        )}
      </section>

      {companyProfile != null && <DocumentCompanyClosingBlock profile={companyProfile} />}

      <footer className="mt-10 border-t border-slate-100 pt-4 text-center text-xs text-slate-400 print:mt-6 print:pt-3 print:break-inside-avoid">
        {isMarginQuote && (
          <p className="mb-2 text-[11px] font-medium text-violet-800 print:text-violet-900">
            {MARGIN_QUOTE_SUBTITLE} — {MARGIN_QUOTE_TAGLINE}
          </p>
        )}
        Documento generado desde DELTA SPACE. Moneda: {currency}.
      </footer>
    </article>
  );
}
