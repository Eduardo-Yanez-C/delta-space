/**
 * Copia datos desde SQLite (archivo Prisma histórico) hacia PostgreSQL vacío
 * tras `prisma migrate deploy` con el baseline Postgres.
 *
 * Requisitos:
 *   - Origen: SOURCE_DATABASE_URL=file:./dev.sqlite (o ruta absoluta file:)
 *   - Destino: DATABASE_URL=postgresql://...
 *   - El destino debe tener esquema aplicado y tablas vacías (salvo _prisma_migrations).
 *
 * Opcional: ALLOW_NONEMPTY_TARGET=1 si aceptas mezclar datos (no recomendado).
 *
 * Uso (desde apps/api):
 *   npx ts-node prisma/scripts/migrate-sqlite-to-postgres.ts
 */

import Database from "better-sqlite3";
import { Pool, type PoolClient } from "pg";
import * as path from "path";

function sqliteFilePathFromUrl(url: string): string {
  if (!url.startsWith("file:")) {
    throw new Error("SOURCE_DATABASE_URL debe ser file:./ruta o file:/absoluta");
  }
  const raw = url.slice("file:".length);
  const normalized = raw.startsWith("//") ? raw.slice(2) : raw;
  if (!normalized.startsWith("/") && !/^[A-Za-z]:/.test(normalized)) {
    return path.resolve(process.cwd(), normalized);
  }
  return path.normalize(normalized);
}

function qi(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

async function loadBooleanColumns(client: PoolClient): Promise<Set<string>> {
  const r = await client.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND udt_name = 'bool'`,
  );
  const set = new Set<string>();
  for (const row of r.rows) {
    set.add(`${row.table_name}.${row.column_name}`);
  }
  return set;
}

async function loadDateTimeColumns(client: PoolClient): Promise<Set<string>> {
  const r = await client.query<{ table_name: string; column_name: string; data_type: string }>(`
     SELECT table_name, column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND data_type IN ('timestamp without time zone', 'timestamp with time zone')
  `);
  const set = new Set<string>();
  for (const row of r.rows) {
    set.add(`${row.table_name}.${row.column_name}`);
  }
  return set;
}

function normalizeValue(
  table: string,
  col: string,
  value: unknown,
  boolCols: Set<string>,
  dateTimeCols: Set<string>,
): unknown {
  if (value === null || value === undefined) return null;
  const key = `${table}.${col}`;
  if (boolCols.has(key)) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "bigint") return value !== 0n;
    if (typeof value === "string") {
      const v = value.trim().toLowerCase();
      if (v === "1" || v === "true") return true;
      if (v === "0" || v === "false" || v === "") return false;
    }
    return Boolean(value);
  }
  if (typeof value === "bigint") return Number(value);

  // SQLite legacy: algunos DateTime se guardaron como epoch ms (número/texto).
  if (dateTimeCols.has(key)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      const ms = value > 1e12 ? value : value * 1000;
      return new Date(ms);
    }
    if (typeof value === "bigint") {
      const n = Number(value);
      const ms = n > 1e12 ? n : n * 1000;
      return new Date(ms);
    }
    if (typeof value === "string") {
      const s = value.trim();
      if (/^\d{10,}$/.test(s)) {
        const n = Number(s);
        const ms = n > 1e12 ? n : n * 1000;
        return new Date(ms);
      }
    }
  }

  if (Buffer.isBuffer(value)) return value;
  return value;
}

async function assertTargetMostlyEmpty(
  client: PoolClient,
  allowNonempty: boolean,
): Promise<void> {
  const tables = await client.query<{ relname: string }>(
    `SELECT c.relname
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
       AND c.relname NOT IN ('_prisma_migrations')
     ORDER BY c.relname`,
  );
  const counts: string[] = [];
  for (const { relname } of tables.rows) {
    const { rows } = await client.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM ${qi(relname)}`,
    );
    const c = Number(rows[0]?.c ?? "0");
    if (c > 0) counts.push(`${relname}=${c}`);
  }
  if (counts.length === 0) return;
  if (allowNonempty) {
    console.warn(
      "[migrate] Destino no vacío (ALLOW_NONEMPTY_TARGET=1). Filas existentes:\n  " +
        counts.join("\n  "),
    );
    return;
  }
  throw new Error(
    "El destino PostgreSQL no está vacío. Aplica solo sobre DB recién migrada con `migrate deploy` " +
      "o define ALLOW_NONEMPTY_TARGET=1 sabiendo el riesgo de duplicados.\n" +
      counts.join("\n"),
  );
}

async function resetSerials(client: PoolClient): Promise<void> {
  const tables = ["Role", "ProductCategory", "Brand", "ProductModel"] as const;
  for (const table of tables) {
    const regclass = `public.${qi(table)}`;
    await client.query(
      `SELECT setval(
        pg_get_serial_sequence($1, 'id'),
        COALESCE((SELECT MAX(${qi("id")}) FROM ${qi(table)}), 1),
        true
      )`,
      [regclass],
    );
  }
}

async function main(): Promise<void> {
  const sourceUrl =
    process.env.SOURCE_DATABASE_URL || process.env.SQLITE_DATABASE_URL || "";
  const targetUrl = process.env.DATABASE_URL || "";
  const allowNonempty = process.env.ALLOW_NONEMPTY_TARGET === "1";

  if (!sourceUrl) {
    throw new Error("Defina SOURCE_DATABASE_URL=file:./dev.sqlite (u SQLITE_DATABASE_URL).");
  }
  if (!targetUrl.startsWith("postgresql://") && !targetUrl.startsWith("postgres://")) {
    throw new Error("DATABASE_URL debe ser postgresql:// o postgres://");
  }

  const sqlitePath = sqliteFilePathFromUrl(sourceUrl);
  console.log(`[migrate] cwd=${process.cwd()}`);
  console.log(`[migrate] sourceUrl=${sourceUrl}`);
  console.log(`[migrate] sqlitePath=${sqlitePath}`);
  console.log(`[migrate] targetUrl=${targetUrl.replace(/:(?:[^@]+)@/, ':***@')}`);
  const sqlite = new Database(sqlitePath, { readonly: true, fileMustExist: true });

  const pool = new Pool({ connectionString: targetUrl });
  const client = await pool.connect();

  try {
    await assertTargetMostlyEmpty(client, allowNonempty);
    const boolCols = await loadBooleanColumns(client);
    const dateTimeCols = await loadDateTimeColumns(client);

    const tableRows = sqlite
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type='table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\'
           AND name != '_prisma_migrations'
         ORDER BY name`,
      )
      .all() as { name: string }[];

    await client.query("BEGIN");
    await client.query("SET session_replication_role = 'replica'");

    for (const { name: table } of tableRows) {
      const cols = sqlite.prepare(`PRAGMA table_info(${qi(table)})`).all() as {
        name: string;
      }[];
      if (cols.length === 0) {
        console.warn(`[migrate] Sin columnas para tabla ${table}, se omite.`);
        continue;
      }
      const colNames = cols.map((c) => c.name);
      const selectStmt = sqlite.prepare(
        `SELECT ${colNames.map((c) => qi(c)).join(", ")} FROM ${qi(table)}`,
      );
      const rows = selectStmt.all() as Record<string, unknown>[];
      if (rows.length === 0) {
        console.log(`[migrate] ${table}: 0 filas`);
        continue;
      }

      const quotedCols = colNames.map(qi).join(", ");
      let inserted = 0;
      for (const row of rows) {
        const values = colNames.map((col) =>
          normalizeValue(table, col, row[col], boolCols, dateTimeCols),
        );
        const ph = values.map((_, i) => `$${i + 1}`).join(", ");
        await client.query(
          `INSERT INTO ${qi(table)} (${quotedCols}) VALUES (${ph})`,
          values as unknown[],
        );
        inserted++;
      }
      console.log(`[migrate] ${table}: ${inserted} filas`);
    }

    await client.query("SET session_replication_role = 'origin'");
    await client.query("COMMIT");

    await resetSerials(client);
    console.log("[migrate] Secuencias enteras (Role, ProductCategory, Brand, ProductModel) actualizadas.");
    console.log("[migrate] Listo. Valida con compare-sqlite-pg-counts o pruebas manuales.");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
