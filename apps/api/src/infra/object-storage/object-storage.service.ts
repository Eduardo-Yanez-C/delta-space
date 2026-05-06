import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs/promises";
import * as path from "path";

export type PutObjectInput = {
  /** Ruta lógica dentro del bucket o bajo uploads/, p.ej. `company/logo.png` */
  key: string;
  body: Buffer;
  contentType?: string;
};

export type PutObjectResult = {
  storageKey: string;
  publicUrl: string | null;
  driver: "local" | "supabase";
};

/**
 * Capa base para archivos (logos, adjuntos, etc.).
 * - `local` (default): escribe bajo `uploads/` en el cwd del proceso (desarrollo / on-prem).
 * - `supabase`: sube vía API REST de Storage (sin SDK extra).
 */
@Injectable()
export class ObjectStorageService {
  private readonly log = new Logger(ObjectStorageService.name);

  private driver(): "local" | "supabase" {
    const d = (process.env.STORAGE_DRIVER || "local").trim().toLowerCase();
    return d === "supabase" ? "supabase" : "local";
  }

  private localRoot(): string {
    return (process.env.LOCAL_UPLOADS_DIR || "uploads").trim() || "uploads";
  }

  private supabaseRestBase(): string {
    const u = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
    if (!u) throw new Error("SUPABASE_URL es obligatorio con STORAGE_DRIVER=supabase");
    return `${u}/storage/v1`;
  }

  /**
   * PUT object usando la API REST de Supabase Storage.
   * @see https://supabase.com/docs/reference/api/upload-an-object
   */
  private async putSupabaseRest(input: PutObjectInput): Promise<PutObjectResult> {
    const bucket = (process.env.SUPABASE_STORAGE_BUCKET || "").trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!bucket) throw new Error("SUPABASE_STORAGE_BUCKET es obligatorio con STORAGE_DRIVER=supabase");
    if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY es obligatorio con STORAGE_DRIVER=supabase");

    const safeKey = input.key.replace(/^\/+/, "").replace(/\\/g, "/");
    const encodedPath = safeKey
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");
    const url = `${this.supabaseRestBase()}/object/${encodeURIComponent(bucket)}/${encodedPath}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        "Content-Type": input.contentType || "application/octet-stream",
        "x-upsert": "true",
      },
      body: new Uint8Array(input.body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      this.log.warn(`Supabase Storage HTTP ${res.status}: ${text.slice(0, 500)}`);
      throw new Error(`Supabase Storage: HTTP ${res.status}`);
    }

    const base = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
    const publicRead = (process.env.SUPABASE_STORAGE_PUBLIC_READ || "").trim() === "1";
    const publicUrl = publicRead
      ? `${base}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`
      : null;
    return { storageKey: safeKey, publicUrl, driver: "supabase" };
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const safeKey = input.key.replace(/^\/+/, "").replace(/\\/g, "/");
    if (!safeKey) throw new Error("putObject: key vacía");

    if (this.driver() === "supabase") {
      return this.putSupabaseRest({ ...input, key: safeKey });
    }

    const root = path.resolve(process.cwd(), this.localRoot());
    const abs = path.join(root, safeKey);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, input.body);
    return { storageKey: safeKey, publicUrl: null, driver: "local" };
  }

  private supabaseObjectUrl(safeKey: string): string {
    const bucket = (process.env.SUPABASE_STORAGE_BUCKET || "").trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!bucket) throw new Error("SUPABASE_STORAGE_BUCKET es obligatorio con STORAGE_DRIVER=supabase");
    if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY es obligatorio con STORAGE_DRIVER=supabase");
    const encodedPath = safeKey
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");
    return `${this.supabaseRestBase()}/object/${encodeURIComponent(bucket)}/${encodedPath}`;
  }

  /** Lee un objeto por clave lógica (misma convención que `putObject`). */
  async getBuffer(key: string): Promise<Buffer> {
    const safeKey = key.replace(/^\/+/, "").replace(/\\/g, "/");
    if (!safeKey) throw new Error("getBuffer: key vacía");

    if (this.driver() === "supabase") {
      const url = this.supabaseObjectUrl(safeKey);
      const k = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${k}`, apikey: k },
      });
      if (res.status === 404) {
        throw new Error("NOT_FOUND");
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        this.log.warn(`Supabase Storage GET HTTP ${res.status}: ${text.slice(0, 500)}`);
        throw new Error(`Supabase Storage GET: HTTP ${res.status}`);
      }
      return Buffer.from(await res.arrayBuffer());
    }

    const root = path.resolve(process.cwd(), this.localRoot());
    const abs = path.join(root, safeKey);
    try {
      return await fs.readFile(abs);
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? (e as NodeJS.ErrnoException).code : "";
      if (code === "ENOENT") throw new Error("NOT_FOUND");
      throw e;
    }
  }

  /** Elimina un objeto por clave lógica (no lanza si local ya no existe). */
  async removeObject(key: string): Promise<void> {
    const safeKey = key.replace(/^\/+/, "").replace(/\\/g, "/");
    if (!safeKey) return;

    if (this.driver() === "supabase") {
      const url = this.supabaseObjectUrl(safeKey);
      const k = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
      const res = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${k}`, apikey: k },
      });
      if (res.status === 404 || res.status === 200 || res.status === 204) return;
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        this.log.warn(`Supabase Storage DELETE HTTP ${res.status}: ${text.slice(0, 500)}`);
        throw new Error(`Supabase Storage DELETE: HTTP ${res.status}`);
      }
      return;
    }

    const root = path.resolve(process.cwd(), this.localRoot());
    const abs = path.join(root, safeKey);
    try {
      await fs.unlink(abs);
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? (e as NodeJS.ErrnoException).code : "";
      if (code !== "ENOENT") throw e;
    }
  }

  describe(): { driver: "local" | "supabase"; bucket?: string } {
    const d = this.driver();
    if (d === "supabase") {
      return { driver: "supabase", bucket: process.env.SUPABASE_STORAGE_BUCKET?.trim() || undefined };
    }
    return { driver: "local" };
  }
}
