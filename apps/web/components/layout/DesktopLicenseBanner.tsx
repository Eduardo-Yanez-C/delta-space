"use client";

import { useEffect, useState } from "react";

type UiStatus = {
  embedded: boolean;
  level?: string;
  headline?: string;
  detail?: string;
  daysRemaining?: number | null;
  validUntil?: string | null;
  warnShort?: boolean;
  licenseId?: string | null;
  installationId?: string;
};

function getLicenseUiStatusFn(): (() => Promise<UiStatus>) | undefined {
  if (typeof window === "undefined") return undefined;
  const d = (window as unknown as { __DESKTOP__?: { license?: { getUiStatus?: () => Promise<UiStatus> } } }).__DESKTOP__;
  return d?.license?.getUiStatus;
}

/**
 * Barra de estado de licencia (solo app desktop empaquetada).
 * Texto y días desde el proceso principal (firma validUntil); aviso si quedan ≤3 días.
 */
export function DesktopLicenseBanner() {
  const [status, setStatus] = useState<UiStatus | null>(null);

  useEffect(() => {
    const getUi = getLicenseUiStatusFn();
    if (!getUi) return;

    let cancelled = false;
    const tick = () => {
      getUi().then((s) => {
        if (!cancelled) setStatus(s);
      });
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (!status?.embedded || status.level !== "active" || !status.headline) {
    return null;
  }

  const warn = Boolean(status.warnShort);
  return (
    <div
      className={`no-print shrink-0 ${
        warn
          ? "border-b border-amber-400/80 bg-amber-50 px-6 py-2 text-sm text-amber-950 dark:border-amber-600/60 dark:bg-amber-950/40 dark:text-amber-100"
          : "border-b border-emerald-200/80 bg-emerald-50 px-6 py-2 text-sm text-emerald-950 dark:border-emerald-800/60 dark:bg-emerald-950/35 dark:text-emerald-100"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">{status.headline}</span>
        {warn && (
          <span className="rounded bg-amber-200/90 px-2 py-0.5 text-xs font-semibold text-amber-950 dark:bg-amber-800/80 dark:text-amber-50">
            Quedan 3 días o menos — renueve pronto
          </span>
        )}
        {status.detail ? <span className="text-xs opacity-90">{status.detail}</span> : null}
      </div>
    </div>
  );
}
