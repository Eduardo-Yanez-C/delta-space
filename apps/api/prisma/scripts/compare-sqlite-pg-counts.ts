/**
 * Compara conteos por tabla entre SQLite (origen) y PostgreSQL (DATABASE_URL).
 *
 * Uso (desde apps/api):
 *   SOURCE_DATABASE_URL=file:./dev.sqlite DATABASE_URL=postgresql://... npx ts-node prisma/scripts/compare-sqlite-pg-counts.ts
 */

import Database from "better-sqlite3";
import { Pool } from "pg";
import * as path from "path";

function sqliteFilePathFromUrl(url: string): string {
  if (!url.startsWith("file:")) {
    throw new Error("SOURCE_DATABASE_URL debe ser file:./…");
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

async function pgTables(pool: Pool): Promise<string[]> {
  const r = await pool.query<{ t: string }>(
    `SELECT tablename AS t FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );
  return r.rows.map((x) => x.t);
}

async function main(): Promise<void> {
  const sourceUrl =
    process.env.SOURCE_DATABASE_URL || process.env.SQLITE_DATABASE_URL || "";
  const targetUrl = process.env.DATABASE_URL || "";
  if (!sourceUrl || !targetUrl) {
    throw new Error("Defina SOURCE_DATABASE_URL y DATABASE_URL.");
  }

  const sqlite = new Database(sqliteFilePathFromUrl(sourceUrl), {
    readonly: true,
    fileMustExist: true,
  });
  const pool = new Pool({ connectionString: targetUrl });

  try {
    const pgT = await pgTables(pool);
    const sqliteTables = sqlite
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type='table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\'
         ORDER BY name`,
      )
      .all() as { name: string }[];
    const sqliteSet = new Set(sqliteTables.map((x) => x.name));

    let mismatches = 0;
    for (const table of pgT) {
      if (table === "_prisma_migrations") continue;
      if (!sqliteSet.has(table)) {
        console.log(`[solo PG] ${table} (no existe en SQLite)`);
        continue;
      }
      const s = sqlite
        .prepare(`SELECT count(*) AS c FROM ${qi(table)}`)
        .get() as { c: number };
      const p = await pool.query<{ c: string }>(
        `SELECT count(*)::text AS c FROM ${qi(table)}`,
      );
      const pc = Number(p.rows[0]?.c ?? "0");
      const sc = Number(s.c);
      const ok = sc === pc;
      if (!ok) mismatches++;
      console.log(`${ok ? "OK " : "!! "}${table}: sqlite=${sc} pg=${pc}`);
    }

    for (const { name } of sqliteTables) {
      if (name === "_prisma_migrations") continue;
      if (!pgT.includes(name)) {
        console.log(`[solo SQLite] ${name}`);
      }
    }

    if (mismatches > 0) {
      process.exitCode = 2;
      console.error(`\nTerminado con ${mismatches} tablas con conteo distinto.`);
    }
  } finally {
    await pool.end();
    sqlite.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
