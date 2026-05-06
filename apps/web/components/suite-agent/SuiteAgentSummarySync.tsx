"use client";

import { useEffect } from "react";
import { useSuiteAgentRuntime } from "./SuiteAgentRuntimeProvider";

/** Inyecta un resumen fijo o derivado en el runtime del agente (p. ej. desde una página server). */
export function SuiteAgentSummarySync({ summary }: { summary: string }) {
  const { mergeRuntime } = useSuiteAgentRuntime();
  useEffect(() => {
    mergeRuntime({ summary });
  }, [summary, mergeRuntime]);
  return null;
}
