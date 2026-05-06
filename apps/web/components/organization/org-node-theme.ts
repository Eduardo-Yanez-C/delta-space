/** Paleta corporativa por profundidad (banda + cuerpo + textos). */

export type OrgDepthTheme = {
  band: string;
  bandText: string;
  body: string;
  border: string;
  name: string;
  role: string;
  muted: string;
  photoBg: string;
  photoBorder: string;
};

export const ORG_DEPTH_THEMES: Record<number, OrgDepthTheme> = {
  0: {
    band: "#0c1929",
    bandText: "#f1f5f9",
    body: "#ffffff",
    border: "#1e293b",
    name: "#0f172a",
    role: "#334155",
    muted: "#64748b",
    photoBg: "#e2e8f0",
    photoBorder: "#94a3b8",
  },
  1: {
    band: "#1e3a8a",
    bandText: "#eff6ff",
    body: "#f8fafc",
    border: "#2563eb",
    name: "#0f172a",
    role: "#1e3a8a",
    muted: "#475569",
    photoBg: "#dbeafe",
    photoBorder: "#3b82f6",
  },
  2: {
    band: "#115e59",
    bandText: "#f0fdfa",
    body: "#ffffff",
    border: "#0d9488",
    name: "#042f2e",
    role: "#134e4a",
    muted: "#0f766e",
    photoBg: "#ccfbf1",
    photoBorder: "#14b8a6",
  },
  3: {
    band: "#374151",
    bandText: "#f9fafb",
    body: "#fafafa",
    border: "#6b7280",
    name: "#111827",
    role: "#374151",
    muted: "#4b5563",
    photoBg: "#f3f4f6",
    photoBorder: "#9ca3af",
  },
};

export function orgThemeForDepth(depth: number): OrgDepthTheme {
  return ORG_DEPTH_THEMES[Math.min(Math.max(0, depth), 3)] ?? ORG_DEPTH_THEMES[3];
}
