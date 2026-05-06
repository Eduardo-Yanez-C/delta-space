import { getApiBase, getAuthToken } from "./api";
import { nestHttpErrorMessage } from "./nest-http-error-message";

function headers(json: boolean): HeadersInit {
  const h: Record<string, string> = {};
  if (json) h["Content-Type"] = "application/json";
  const t = getAuthToken();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

export async function orgApiGet<T>(path: string): Promise<T> {
  const base = getApiBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { cache: "no-store", headers: headers(false) });
  if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
  return parseJson<T>(res);
}

export async function orgApiSend<T>(path: string, method: string, body?: unknown): Promise<T> {
  const base = getApiBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method,
    headers: headers(body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await parseJson<{ message?: string | string[] }>(res);
    throw new Error(nestHttpErrorMessage(err, `HTTP ${res.status}`));
  }
  if (res.status === 204) return {} as T;
  return parseJson<T>(res);
}

export async function orgApiDelete(path: string): Promise<void> {
  const base = getApiBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { method: "DELETE", headers: headers(false) });
  if (!res.ok) throw new Error(`DELETE ${path}: ${res.status}`);
}
