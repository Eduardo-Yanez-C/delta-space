#!/usr/bin/env node
/**
 * Evidencia reproducible: directorio "Nueva conversación" por sesión (A–D).
 *
 * Requisitos: misma API para todos (líder LAN), LAN_MESH_SECRET en todos los Nest.
 *
 * Uso (PowerShell, ejemplo):
 *   $env:PV_API_BASE="http://192.168.1.10:4000/api"
 *   $env:PV_TOKEN_A="<JWT usuario A>"
 *   $env:PV_TOKEN_B="<JWT usuario B>"
 *   $env:PV_TOKEN_C="<JWT usuario C>"
 *   $env:PV_TOKEN_D="<JWT usuario D>"
 *   node scripts/collect-lan-directory-evidence.mjs
 *
 * Salida: JSON con headers + directoryEmails + meshUserPull + presencePull por equipo.
 */

const apiBase = (process.env.PV_API_BASE || "").replace(/\/$/, "");
const labels = ["A", "B", "C", "D"];
const tokens = labels.map((L) => process.env[`PV_TOKEN_${L}`]?.trim()).filter(Boolean);

if (!apiBase) {
  console.error("Falta PV_API_BASE (ej. http://192.168.1.10:4000/api)");
  process.exit(1);
}
if (tokens.length === 0) {
  console.error(
    "Defina PV_TOKEN_A, PV_TOKEN_B, PV_TOKEN_C, PV_TOKEN_D (JWT tras login en ese apiBase).",
  );
  process.exit(1);
}

async function fetchDirectory(token, label) {
  const url = `${apiBase}/conversations/directory-users`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  const headers = {
    "X-PV-Directory-Row-Count": res.headers.get("X-PV-Directory-Row-Count"),
    "X-PV-Lan-Instance-Id": res.headers.get("X-PV-Lan-Instance-Id"),
    "X-PV-Lan-Peer-Count": res.headers.get("X-PV-Lan-Peer-Count"),
    "X-PV-Mesh-Configured": res.headers.get("X-PV-Mesh-Configured"),
  };
  let diagnostics = null;
  if (res.ok) {
    const dres = await fetch(`${apiBase}/conversations/directory-diagnostics`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    diagnostics = await dres.json().catch(() => null);
  }
  const emails = Array.isArray(body.users)
    ? body.users.map((u) => (u.email || "").trim().toLowerCase()).filter(Boolean)
    : [];
  const names = Array.isArray(body.users) ? body.users.map((u) => u.name) : [];
  return {
    label,
    ok: res.ok,
    status: res.status,
    apiBase,
    headers,
    directoryRowCount: body.users?.length ?? 0,
    directoryEmails: emails,
    directoryNames: names,
    presentNames: Array.isArray(body.users)
      ? body.users.filter((u) => u.present).map((u) => u.name)
      : [],
    meshUserPull: diagnostics?.meshUserPull ?? null,
    presencePull: diagnostics?.presencePull ?? null,
    diagnosticsError: diagnostics?.message ?? null,
  };
}

const report = {
  collectedAt: new Date().toISOString(),
  apiBase,
  clients: [],
};

for (let i = 0; i < tokens.length; i++) {
  const label = labels[i] ?? `U${i + 1}`;
  report.clients.push(await fetchDirectory(tokens[i], label));
}

console.log(JSON.stringify(report, null, 2));

const instanceIds = new Set(
  report.clients.map((c) => c.headers["X-PV-Lan-Instance-Id"]).filter(Boolean),
);
const rowCounts = report.clients.map((c) => c.directoryRowCount);
const minRows = Math.min(...rowCounts);
const maxRows = Math.max(...rowCounts);
const meshOn = report.clients.every((c) => c.headers["X-PV-Mesh-Configured"] === "1");

console.error("\n--- Resumen ---");
console.error("apiBase común:", apiBase);
console.error("Instancias Lan-Instance-Id distintas:", instanceIds.size, [...instanceIds]);
console.error("Mesh configurado (header=1) en todas las respuestas:", meshOn);
console.error("directoryRowCount por cliente:", rowCounts.join(", "));
console.error(
  minRows === maxRows
    ? "OK: mismo número de filas en todos."
    : "ALERTA: distinto número de filas entre clientes (revisar mesh / misma API).",
);
