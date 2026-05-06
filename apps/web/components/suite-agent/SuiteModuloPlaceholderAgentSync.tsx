"use client";

import { useEffect } from "react";
import { useSuiteAgentRuntime } from "./SuiteAgentRuntimeProvider";

/** Sincroniza resumen del agente en páginas placeholder de la suite (menú sin dominio aún). */
export function SuiteModuloPlaceholderAgentSync({ titulo, slug }: { titulo: string; slug: string }) {
  const { mergeRuntime } = useSuiteAgentRuntime();
  useEffect(() => {
    mergeRuntime({
      summary: [
        `Módulo «${titulo}» (ruta: /vista-previa-suite/${slug}).`,
        "Vista previa: sin pantallas de negocio completas aún; SAM no debe inventar transacciones ni datos de este módulo.",
        "Puede orientar sobre el propósito del módulo según el mapa del software y sugerir usar módulos ya operativos (ventas, PMO, organigrama) cuando aplique.",
      ].join("\n"),
    });
  }, [titulo, slug, mergeRuntime]);
  return null;
}
