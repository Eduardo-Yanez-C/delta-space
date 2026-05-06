import { getApiBase, getAuthToken } from "./api";
import { nestHttpErrorMessage } from "./nest-http-error-message";

function authHeaders(): Record<string, string> {
  const t = getAuthToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function ensurePath(path: string): string {
  if (!path.startsWith("/")) return `/${path}`;
  return path;
}

export async function apiGet<T>(path: string): Promise<T> {
  const base = getApiBase();
  const url = `${base}${ensurePath(path)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { ...authHeaders() },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(nestHttpErrorMessage(body, `HTTP ${res.status}`));
  }
  return (await res.json()) as T;
}

export async function apiSend<T = unknown>(path: string, method: "POST" | "PATCH" | "PUT", body: unknown): Promise<T> {
  const base = getApiBase();
  const url = `${base}${ensurePath(path)}`;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });
  if (!res.ok) {
    const b = await res.json().catch(() => null);
    throw new Error(nestHttpErrorMessage(b, `HTTP ${res.status}`));
  }
  const txt = await res.text();
  return (txt ? (JSON.parse(txt) as T) : (undefined as T));
}

export async function apiDelete<T = unknown>(path: string): Promise<T> {
  const base = getApiBase();
  const url = `${base}${ensurePath(path)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { ...authHeaders() },
    cache: "no-store",
  });
  if (!res.ok) {
    const b = await res.json().catch(() => null);
    throw new Error(nestHttpErrorMessage(b, `HTTP ${res.status}`));
  }
  const txt = await res.text();
  return (txt ? (JSON.parse(txt) as T) : (undefined as T));
}

export async function apiDownloadBlob(path: string, filename: string): Promise<void> {
  const base = getApiBase();
  const url = `${base}${ensurePath(path)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { ...authHeaders() },
    cache: "no-store",
  });
  if (!res.ok) {
    const b = await res.json().catch(() => null);
    throw new Error(nestHttpErrorMessage(b, `HTTP ${res.status}`));
  }
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(href);
  }
}

