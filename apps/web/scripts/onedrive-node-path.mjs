/**
 * Si `.next` es un junction hacia %TEMP%, Node resuelve `require()` desde allí y no encuentra
 * `node_modules` del proyecto. `NODE_PATH` fuerza la búsqueda en `apps/web` y en la raíz del monorepo.
 */
import { delimiter, join } from "node:path";

export function isOneDriveWindowsPath(absWebRoot) {
  return (
    process.platform === "win32" &&
    absWebRoot.replace(/\\/g, "/").toLowerCase().includes("onedrive")
  );
}

/** @param {string} webRoot @param {string} monoRoot */
export function nodePathEnvForTempNext(webRoot, monoRoot) {
  if (!isOneDriveWindowsPath(webRoot)) return {};
  const parts = [
    join(webRoot, "node_modules"),
    join(monoRoot, "node_modules"),
    process.env.NODE_PATH,
  ].filter(Boolean);
  return { NODE_PATH: parts.join(delimiter) };
}
