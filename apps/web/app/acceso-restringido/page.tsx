"use client";

import Link from "next/link";

export default function AccesoRestringidoPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="card max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <svg
            className="h-7 w-7 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-slate-900">Acceso restringido</h1>
        <p className="mt-2 text-slate-600">
          No tiene permisos para acceder a esta sección. Contacte al administrador si cree que es un error.
        </p>
        <Link href="/" className="btn-primary mt-6 inline-block">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
