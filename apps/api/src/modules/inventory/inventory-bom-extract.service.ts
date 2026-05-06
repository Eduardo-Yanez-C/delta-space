import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import * as XLSX from "xlsx";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { INVENTORY_TRACEABILITY } from "./inventory-traceability.constants";
import type { ImportSupplierBomConfirmedDto, SupplierBomLineInDto } from "./dto/supplier-bom-line-in.dto";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DOCUMENT_MAX_BYTES = 12 * 1024 * 1024;
/** Texto total máximo a procesar (varios fragmentos en serie). */
const TEXT_SOFT_CAP = 120_000;
const CHUNK_CHAR_TARGET = 4200;
const CHUNK_OVERLAP = 900;
const MAX_LINES_RETURNED = 400;
const DEFAULT_MAX_OUTPUT_TOKENS = 16_384;
const MIN_OUTPUT_TOKENS = 4096;
const MAX_OUTPUT_TOKENS_CAP = 32_768;

export type SupplierBomDraftLineDto = {
  bomLineNo: number | null;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  supplierName: string;
  supplierQuoteRef: string | null;
  materialGrade: string | null;
  specText: string | null;
  componentLabel: string | null;
  spareQty: number | null;
  /** Columna tipo QTY 1*72 (cantidad por kit). */
  qtyPerKit: number | null;
  /** Columna "Unit" del PDF (p. ej. 60 plantas/kits), no es la cantidad de stock. */
  unitKit: number | null;
  unitWeightKg: number | null;
  totalWeightKg: number | null;
};

export type ExtractSupplierBomDraftResult = {
  lines: SupplierBomDraftLineDto[];
  warnings: string[];
  textCharsTotal: number;
  textCharsUsed: number;
  model: string;
  chunksProcessed: number;
};

export type RefineSupplierBomDraftAiResult = {
  lines: SupplierBomDraftLineDto[];
  warnings: string[];
  model: string;
};

function parseBoundedInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw == null || String(raw).trim() === "") return fallback;
  const n = parseInt(String(raw), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function stripJsonFence(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("```")) {
    return t
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
  }
  return t;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

/** Parte el texto en fragmentos solapados para no cortar filas al límite y forzar más cobertura al modelo. */
function chunkPdfText(text: string): string[] {
  const t = text.length > TEXT_SOFT_CAP ? text.slice(0, TEXT_SOFT_CAP) : text;
  if (t.length <= CHUNK_CHAR_TARGET) return [t];
  const out: string[] = [];
  for (let start = 0; start < t.length; start += CHUNK_CHAR_TARGET - CHUNK_OVERLAP) {
    out.push(t.slice(start, Math.min(start + CHUNK_CHAR_TARGET, t.length)));
    if (start + CHUNK_CHAR_TARGET >= t.length) break;
  }
  return out;
}

function lineRichnessScore(o: Record<string, unknown>): number {
  let s = 0;
  if (str(o.name, 500)) s += 2;
  if (str(o.componentLabel, 500)) s += 2;
  if (str(o.specText, 2000)) s += 3;
  if (str(o.materialGrade, 200)) s += 1;
  if (num(o.totalWeightKg) != null) s += 2;
  if (num(o.quantity) != null) s += 2;
  return s;
}

@Injectable()
export class InventoryBomExtractService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private coerceSupplierBomDraftLine(
    o: Record<string, unknown>,
    fallbacks: { supplierName: string; supplierQuoteRef: string | null },
  ): SupplierBomDraftLineDto | null {
    const qty = num(o.quantity);
    const name = str(o.name, 500);
    if (qty == null || qty <= 0 || !name) return null;
    const unit = str(o.unit, 64) ?? "unidad";
    return {
      bomLineNo: num(o.bomLineNo) != null ? Math.trunc(num(o.bomLineNo)!) : null,
      name,
      description: str(o.description, 4000),
      quantity: qty,
      unit,
      supplierName: str(o.supplierName, 200) ?? fallbacks.supplierName,
      supplierQuoteRef: str(o.supplierQuoteRef, 120) ?? fallbacks.supplierQuoteRef,
      materialGrade: str(o.materialGrade, 200),
      specText: str(o.specText, 2000),
      componentLabel: str(o.componentLabel, 500),
      spareQty: num(o.spareQty),
      qtyPerKit: num(o.qtyPerKit),
      unitKit: num(o.unitKit),
      unitWeightKg: num(o.unitWeightKg),
      totalWeightKg: num(o.totalWeightKg),
    };
  }

  private readMaxOutputTokens(): number {
    const raw = this.config.get<string>("INVENTORY_BOM_MAX_OUTPUT_TOKENS") ?? process.env.INVENTORY_BOM_MAX_OUTPUT_TOKENS;
    return parseBoundedInt(raw, DEFAULT_MAX_OUTPUT_TOKENS, MIN_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS_CAP);
  }

  private buildSystemPrompt(chunkIndex: number, chunkTotal: number): string {
    return `Eres un extractor de datos para inventario de plantas solares. Recibes un FRAGMENTO (${chunkIndex + 1}/${chunkTotal}) del TEXTO extraído de un documento (PDF, Excel, Word, etc.; cotización BOM de tracker/estructura, p. ej. Mibet).

OBLIGATORIO:
- Extrae TODAS las filas de tabla BOM visibles en ESTE fragmento (lista "BOM Components List" o columnas No., Item, Material, Spec., Total Qty, etc.).
- Una entrada en "lines" por cada fila numerada; respeta bomLineNo = número de la primera columna (No.).
- **quantity** = valor numérico de la columna **"Total Qty"** (total de piezas del proyecto). 
  **NUNCA** uses como "quantity" el número fijo de la columna **"Unit"** (suele ser 60 = número de plantas/kits). Ese valor va en **unitKit**.
- **qtyPerKit** = columna tipo **"QTY 1*72"** o primera columna de cantidad por kit (si existe).
- **unitKit** = columna **"Unit"** del PDF cuando es el multiplicador de kits (p. ej. 60), no Total Qty.
- **spareQty** = "Spare Part". **unitWeightKg** / **totalWeightKg** = pesos de la tabla si existen.
- **componentLabel** = texto de la columna **Item** (inglés, ej. "U-Shaped Rail"). **name** = el mismo Item o una versión corta única POR FILA (no repitas el mismo nombre genérico para todas).
- **materialGrade** = columna Material. **specText** = Spec. (mm) o dimensiones.

Devuelve SOLO JSON con forma:
{
  "supplierName": string o null (solo si aparece en este fragmento),
  "supplierQuoteRef": string o null,
  "lines": [
    {
      "bomLineNo": number | null,
      "name": string,
      "description": string | null,
      "quantity": number,
      "unit": string,
      "materialGrade": string | null,
      "specText": string | null,
      "componentLabel": string | null,
      "qtyPerKit": number | null,
      "unitKit": number | null,
      "spareQty": number | null,
      "unitWeightKg": number | null,
      "totalWeightKg": number | null
    }
  ]
}
Máximo ${MAX_LINES_RETURNED} líneas por respuesta. No omitas filas que estén en este fragmento.`;
  }

  private buildRefineSystemPrompt(): string {
    return `Eres un editor de borradores JSON de líneas BOM (lista de materiales de proveedor) para inventario solar.
El usuario envía "currentLines" (filas ya extraídas) e "instruction" en español o inglés.

Devuelve SOLO JSON: { "lines": [ ... ] } con el mismo esquema por fila:
bomLineNo, name, description, quantity, unit, supplierName, supplierQuoteRef, materialGrade, specText, componentLabel, spareQty, qtyPerKit, unitKit, unitWeightKg, totalWeightKg.

Reglas:
- Mantén el mismo número de filas y el mismo orden que "currentLines", salvo que la instrucción pida explícitamente eliminar filas concretas.
- Si la instrucción solo pide rellenar o corregir columnas (ej. qtyPerKit vacío), conserva el resto de campos; puedes calcular qtyPerKit a partir de quantity y unitKit si la matemática es coherente (ej. quantity / unitKit cuando ambos existen y unitKit > 0).
- quantity = Total Qty; unitKit = multiplicador de kits (p. ej. 60); qtyPerKit = cantidad por kit si aplica.
- No inventes nombres de ítem; no contradigas pesos obvios (unitWeightKg * quantity ≈ totalWeightKg salvo redondeo).`;
  }

  private async openAiBomChunk(args: {
    chunkText: string;
    chunkIndex: number;
    chunkTotal: number;
    originalName: string;
    model: string;
    apiKey: string;
    extraInstructions?: string | null;
  }): Promise<{
    lines: Record<string, unknown>[];
    supplierName: string | null;
    supplierQuoteRef: string | null;
    finishReason: string | null;
  }> {
    const maxOut = this.readMaxOutputTokens();
    const system = this.buildSystemPrompt(args.chunkIndex, args.chunkTotal);
    let userMsg = `Archivo: ${args.originalName.slice(0, 200)}\nFragmento ${args.chunkIndex + 1}/${args.chunkTotal}.\n\n--- TEXTO ---\n\n${args.chunkText}`;
    const extra = args.extraInstructions?.trim();
    if (extra) {
      userMsg += `\n\n--- Instrucciones adicionales del usuario (prioritarias si no contradicen cifras explícitas en la tabla) ---\n${extra.slice(0, 3000)}`;
    }

    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: args.model,
        temperature: 0.15,
        max_tokens: maxOut,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
      }),
    });
    const raw = await res.text();
    if (!res.ok) {
      throw new BadRequestException(`OpenAI HTTP ${res.status}: ${raw.slice(0, 600)}`);
    }
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new BadRequestException("Respuesta OpenAI inválida (no JSON)");
    }
    const choice = (data as { choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }> })?.choices?.[0];
    const finishReason = choice?.finish_reason ?? null;
    const content = choice?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new BadRequestException("OpenAI no devolvió contenido");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFence(content));
    } catch {
      throw new BadRequestException("La IA no devolvió JSON parseable en un fragmento");
    }
    const root = parsed as Record<string, unknown>;
    const arr = root.lines;
    const lines = Array.isArray(arr) ? (arr as Record<string, unknown>[]) : [];
    return {
      lines,
      supplierName: str(root.supplierName, 200),
      supplierQuoteRef: str(root.supplierQuoteRef, 120),
      finishReason,
    };
  }

  private async readDocumentPlainText(buffer: Buffer, originalName: string): Promise<{ text: string; sourceLabel: string }> {
    const lower = (originalName || "").toLowerCase();
    if (lower.endsWith(".pdf")) {
      try {
        const parsed = await pdfParse(buffer);
        const text = typeof parsed.text === "string" ? parsed.text : "";
        return { text, sourceLabel: "PDF" };
      } catch {
        throw new BadRequestException(
          "No se pudo leer el PDF (¿protegido o escaneado como imagen?). Pruebe a exportar texto desde el lector o use Word/Excel si el proveedor lo entrega.",
        );
      }
    }
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      try {
        const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
        const parts: string[] = [];
        for (const name of wb.SheetNames.slice(0, 8)) {
          const sh = wb.Sheets[name];
          if (!sh) continue;
          const csv = XLSX.utils.sheet_to_csv(sh, { FS: "\t", RS: "\n" });
          if (csv.trim()) parts.push(`[Hoja: ${name}]\n${csv}`);
        }
        return { text: parts.join("\n\n"), sourceLabel: "Excel" };
      } catch {
        throw new BadRequestException("No se pudo leer el libro de Excel.");
      }
    }
    if (lower.endsWith(".docx")) {
      try {
        const r = await mammoth.extractRawText({ buffer });
        return { text: (r.value || "").trim(), sourceLabel: "Word" };
      } catch {
        throw new BadRequestException("No se pudo leer el documento Word (.docx).");
      }
    }
    if (lower.endsWith(".csv") || lower.endsWith(".txt") || lower.endsWith(".tsv")) {
      const text = buffer.toString("utf8");
      return { text, sourceLabel: "Texto" };
    }
    throw new BadRequestException("Formato no admitido para este endpoint.");
  }

  /** PDF, Word (.docx), Excel (.xls/.xlsx) o texto plano / CSV. */
  async extractDraftFromDocument(
    buffer: Buffer,
    originalName: string,
    extraInstructions?: string | null,
  ): Promise<ExtractSupplierBomDraftResult> {
    if (!buffer?.length) throw new BadRequestException("Archivo vacío");
    if (buffer.length > DOCUMENT_MAX_BYTES) {
      throw new BadRequestException(`Archivo demasiado grande (máx. ${Math.floor(DOCUMENT_MAX_BYTES / 1024 / 1024)} MB).`);
    }

    const { text: fullText, sourceLabel } = await this.readDocumentPlainText(buffer, originalName);
    const textCharsTotal = fullText.length;
    if (textCharsTotal < 40) {
      throw new BadRequestException(
        sourceLabel === "PDF"
          ? "El PDF no devolvió texto útil (puede ser solo imágenes). Se requiere texto seleccionable u otro archivo."
          : "El documento no contiene texto suficiente para interpretar una tabla (¿archivo vacío o solo imágenes?).",
      );
    }

    const apiKey = (this.config.get<string>("OPENAI_API_KEY") ?? process.env.OPENAI_API_KEY ?? "").trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        "OPENAI_API_KEY no está configurada. Añádala en apps/api/.env para extraer BOM con IA.",
      );
    }
    const model = (
      this.config.get<string>("INVENTORY_BOM_OPENAI_MODEL") ??
      process.env.INVENTORY_BOM_OPENAI_MODEL ??
      this.config.get<string>("SUITE_AGENT_OPENAI_MODEL") ??
      process.env.SUITE_AGENT_OPENAI_MODEL ??
      "gpt-4o-mini"
    ).trim();

    const chunks = chunkPdfText(fullText);
    const warnings: string[] = [];
    warnings.push(`Origen del texto: ${sourceLabel} (${originalName || "archivo"}).`);
    if (fullText.length > TEXT_SOFT_CAP) {
      warnings.push(`Texto truncado internamente a ${TEXT_SOFT_CAP} caracteres (documento muy largo).`);
    }
    if (chunks.length > 1) {
      warnings.push(
        `Se procesan ${chunks.length} fragmentos en serie (solapados) para recuperar todas las filas de la tabla.`,
      );
    }

    const mergedByNo = new Map<number, Record<string, unknown>>();
    const unnumbered: Record<string, unknown>[] = [];
    let topSupplier: string | null = null;
    let topRef: string | null = null;

    for (let i = 0; i < chunks.length; i++) {
      const { lines, supplierName, supplierQuoteRef, finishReason } = await this.openAiBomChunk({
        chunkText: chunks[i]!,
        chunkIndex: i,
        chunkTotal: chunks.length,
        originalName,
        model,
        apiKey,
        extraInstructions,
      });
      if (finishReason === "length") {
        warnings.push(
          `Fragmento ${i + 1}/${chunks.length}: la respuesta del modelo llegó al límite de tokens (max_tokens). Puede faltar parte del listado; suba INVENTORY_BOM_MAX_OUTPUT_TOKENS en .env (máx. ${MAX_OUTPUT_TOKENS_CAP}).`,
        );
      }
      if (supplierName && !topSupplier) topSupplier = supplierName;
      if (supplierQuoteRef && !topRef) topRef = supplierQuoteRef;

      for (const o of lines) {
        const bn = num(o.bomLineNo);
        if (bn != null && Number.isFinite(bn)) {
          const k = Math.trunc(bn);
          const prev = mergedByNo.get(k);
          if (!prev || lineRichnessScore(o) > lineRichnessScore(prev)) mergedByNo.set(k, o);
        } else {
          unnumbered.push(o);
        }
      }
    }

    const sortedKeys = [...mergedByNo.keys()].sort((a, b) => a - b);
    const mergedList: Record<string, unknown>[] = sortedKeys.map((k) => mergedByNo.get(k)!);
    mergedList.push(...unnumbered);

    const topSupplierFinal = topSupplier ?? "Proveedor";
    const topRefFinal = topRef;

    const lines: SupplierBomDraftLineDto[] = [];
    for (const item of mergedList.slice(0, MAX_LINES_RETURNED)) {
      if (!item || typeof item !== "object") continue;
      const row = this.coerceSupplierBomDraftLine(item as Record<string, unknown>, {
        supplierName: topSupplierFinal,
        supplierQuoteRef: topRefFinal,
      });
      if (row) lines.push(row);
    }

    if (lines.length === 0) {
      warnings.push("No se obtuvo ninguna línea válida (cantidad y nombre). Pruebe con mejor calidad de PDF o edite manualmente.");
    } else if (lines.length < 15 && textCharsTotal > 4000 && /BOM|Components\s*List/i.test(fullText)) {
      warnings.push(
        `Solo ${lines.length} líneas recuperadas pero el texto tiene ${textCharsTotal} caracteres y parece incluir BOM. Si faltan filas: compruebe texto seleccionable (no solo imagen en PDF) o use Excel/Word exportado por el proveedor.`,
      );
    }

    const textCharsUsed = chunks.reduce((s, c) => s + c.length, 0);

    return {
      lines,
      warnings,
      textCharsTotal,
      textCharsUsed,
      model,
      chunksProcessed: chunks.length,
    };
  }

  private buildLinksJson(args: {
    line: SupplierBomLineInDto;
    supplierName: string;
    supplierQuoteRef: string | null | undefined;
    sourceFileName: string | null | undefined;
    importRunId: string;
  }): string {
    const { line, supplierName, supplierQuoteRef, sourceFileName, importRunId } = args;
    const obj: Record<string, unknown> = {
      traceability: INVENTORY_TRACEABILITY.SUPPLIER_BOM_LINE,
      supplierName,
      supplierQuoteRef: supplierQuoteRef?.trim() || null,
      bomLineNo: line.bomLineNo ?? null,
      materialGrade: line.materialGrade ?? null,
      specText: line.specText ?? null,
      componentLabel: line.componentLabel ?? null,
      spareQty: line.spareQty ?? null,
      qtyPerKit: line.qtyPerKit ?? null,
      unitKit: line.unitKit ?? null,
      unitWeightKg: line.unitWeightKg ?? null,
      totalWeightKg: line.totalWeightKg ?? null,
      sourceImportedAt: new Date().toISOString(),
      importRunId,
    };
    if (sourceFileName?.trim()) obj.sourceFileName = sourceFileName.trim().slice(0, 500);
    return JSON.stringify(obj);
  }

  private descriptionForRow(line: SupplierBomLineInDto, supplierName: string, ref: string | null): string | null {
    const parts = [
      line.description?.trim() || null,
      line.materialGrade ? `Material: ${line.materialGrade}` : null,
      line.specText ? `Especificación: ${line.specText}` : null,
      line.componentLabel ? `Componente: ${line.componentLabel}` : null,
      line.qtyPerKit != null ? `QTY kit: ${line.qtyPerKit}` : null,
      line.unitKit != null ? `Unit (kits): ${line.unitKit}` : null,
      `Proveedor: ${supplierName}`,
      ref ? `Cotización: ${ref}` : null,
    ].filter(Boolean);
    const s = parts.join("\n").slice(0, 4000);
    return s || null;
  }

  /** Aplica instrucciones del usuario al borrador ya extraído (sin re-leer el archivo). */
  async refineDraftWithAi(linesIn: Record<string, unknown>[], instruction: string): Promise<RefineSupplierBomDraftAiResult> {
    const ins = instruction.trim();
    if (!linesIn.length) throw new BadRequestException("Sin líneas para refinar");
    if (ins.length < 4) throw new BadRequestException("Instrucción demasiado corta");

    const apiKey = (this.config.get<string>("OPENAI_API_KEY") ?? process.env.OPENAI_API_KEY ?? "").trim();
    if (!apiKey) {
      throw new ServiceUnavailableException("OPENAI_API_KEY no está configurada.");
    }
    const model = (
      this.config.get<string>("INVENTORY_BOM_OPENAI_MODEL") ??
      process.env.INVENTORY_BOM_OPENAI_MODEL ??
      this.config.get<string>("SUITE_AGENT_OPENAI_MODEL") ??
      process.env.SUITE_AGENT_OPENAI_MODEL ??
      "gpt-4o-mini"
    ).trim();

    const f0 = linesIn[0] as Record<string, unknown>;
    const fallbacks = {
      supplierName: str(f0.supplierName, 200) ?? "Proveedor",
      supplierQuoteRef: str(f0.supplierQuoteRef, 120) ?? null,
    };

    const payload = JSON.stringify({ currentLines: linesIn, instruction: ins });
    if (payload.length > 120_000) {
      throw new BadRequestException("Demasiado contenido para refinar en una sola petición (reduzca filas o acorte la instrucción).");
    }

    const maxOut = this.readMaxOutputTokens();
    const system = this.buildRefineSystemPrompt();
    const userMsg = `Aplica la instrucción al borrador siguiente.\n\n${payload}`;

    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: maxOut,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
      }),
    });
    const raw = await res.text();
    if (!res.ok) {
      throw new BadRequestException(`OpenAI HTTP ${res.status}: ${raw.slice(0, 600)}`);
    }
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new BadRequestException("Respuesta OpenAI inválida (no JSON)");
    }
    const choice = (data as { choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }> })?.choices?.[0];
    const content = choice?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new BadRequestException("OpenAI no devolvió contenido");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFence(content));
    } catch {
      throw new BadRequestException("La IA no devolvió JSON parseable");
    }
    const root = parsed as Record<string, unknown>;
    const arr = root.lines;
    const aiLines = Array.isArray(arr) ? (arr as Record<string, unknown>[]) : [];
    const warnings: string[] = [];
    if (aiLines.length !== linesIn.length) {
      warnings.push(
        `La IA devolvió ${aiLines.length} filas frente a ${linesIn.length} en la vista previa; se rellenan huecos con la fila original si hace falta.`,
      );
    }

    const out: SupplierBomDraftLineDto[] = [];
    for (let i = 0; i < linesIn.length; i++) {
      const src = linesIn[i] as Record<string, unknown>;
      const ai = aiLines[i];
      const fromAi = ai && typeof ai === "object" ? this.coerceSupplierBomDraftLine(ai as Record<string, unknown>, fallbacks) : null;
      if (fromAi) {
        out.push(fromAi);
        continue;
      }
      const fromSrc = this.coerceSupplierBomDraftLine(src, fallbacks);
      if (fromSrc) out.push(fromSrc);
    }

    if (out.length === 0) {
      throw new BadRequestException("No quedó ninguna línea válida tras refinar; revise la instrucción.");
    }

    return { lines: out, warnings, model };
  }

  async importConfirmed(dto: ImportSupplierBomConfirmedDto): Promise<{ created: number; skipped: number; importRunId: string }> {
    const pid = dto.projectId.trim();
    const n = await this.prisma.project.count({ where: { id: pid } });
    if (!n) throw new BadRequestException("Proyecto no encontrado");

    const supplierName = dto.supplierName.trim();
    const supplierQuoteRef = dto.supplierQuoteRef?.trim() || null;
    const sourceFileName = dto.sourceFileName?.trim() || null;
    const importRunId = `bom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

    let existingKeys = new Set<string>();
    if (dto.skipDuplicates) {
      const existing = await this.prisma.inventoryItem.findMany({
        where: {
          projectId: pid,
          destinationKind: "PROJECT",
          linksJson: { contains: INVENTORY_TRACEABILITY.SUPPLIER_BOM_LINE },
        },
        select: { linksJson: true },
      });
      for (const e of existing) {
        try {
          const o = e.linksJson ? (JSON.parse(e.linksJson) as Record<string, unknown>) : {};
          const refK = typeof o.supplierQuoteRef === "string" ? o.supplierQuoteRef : "";
          const bn = typeof o.bomLineNo === "number" ? String(o.bomLineNo) : "";
          existingKeys.add(`${refK}::${bn}`);
        } catch {
          /* ignore */
        }
      }
    }

    let created = 0;
    let skipped = 0;
    const dataRows: Prisma.InventoryItemCreateManyInput[] = [];

    for (const line of dto.lines) {
      const key = `${supplierQuoteRef ?? ""}::${line.bomLineNo ?? ""}`;
      if (dto.skipDuplicates && line.bomLineNo != null && existingKeys.has(key)) {
        skipped += 1;
        continue;
      }
      const linksJson = this.buildLinksJson({
        line,
        supplierName,
        supplierQuoteRef,
        sourceFileName,
        importRunId,
      });
      const desc = this.descriptionForRow(line, supplierName, supplierQuoteRef);
      const sku =
        line.bomLineNo != null
          ? `BOM-${(supplierQuoteRef || "REF").replace(/[^\w.-]+/g, "_").slice(0, 40)}-${line.bomLineNo}`.slice(0, 120)
          : null;

      dataRows.push({
        sku,
        name: line.name.trim().slice(0, 500),
        description: desc,
        quantity: line.quantity,
        unit: (line.unit?.trim() || "unidad").slice(0, 64),
        storageLocation: null,
        destinationKind: "PROJECT",
        destinationNote: `BOM proveedor (IA) · ${supplierName}${supplierQuoteRef ? ` · ${supplierQuoteRef}` : ""}`.slice(0, 2000),
        projectId: pid,
        quoteId: null,
        productId: null,
        linksJson,
      });
      if (dto.skipDuplicates && line.bomLineNo != null) existingKeys.add(key);
    }

    const CHUNK = 80;
    for (let i = 0; i < dataRows.length; i += CHUNK) {
      const chunk = dataRows.slice(i, i + CHUNK);
      if (chunk.length === 0) continue;
      await this.prisma.inventoryItem.createMany({ data: chunk });
      created += chunk.length;
    }

    return { created, skipped, importRunId };
  }
}
