"use client";

import Link from "next/link";

type Props = {
  message: string;
  dismissHref?: string;
  onDismiss?: () => void;
};

export function SuccessBanner({ message, dismissHref, onDismiss }: Props) {
  return (
    <div
      className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800"
      role="status"
      aria-live="polite"
    >
      <span>{message}</span>
      {dismissHref ? (
        <Link href={dismissHref} className="ml-2 font-medium underline hover:no-underline">
          Cerrar
        </Link>
      ) : onDismiss ? (
        <button type="button" onClick={onDismiss} className="ml-2 font-medium underline">
          Cerrar
        </button>
      ) : null}
    </div>
  );
}
