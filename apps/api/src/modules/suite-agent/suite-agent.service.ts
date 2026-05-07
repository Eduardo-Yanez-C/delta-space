import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { parseScheduleDelimitedText } from "../../common/schedule-tsv-import";
import { PrismaService } from "../../infra/prisma/prisma.service";
import type { AuthUserPayload } from "../auth/auth.service";
import {
  expandRolesForGuard,
  hasGlobalAdminPrivileges,
  hasSalesLikePrivileges,
  OPERATIONAL_WRITE_ROLES,
  ROLE_INGENIERIA,
} from "../auth/role-constants";
import { ClientsService } from "../clients/clients.service";
import { ProjectsService } from "../projects/projects.service";
import type { FilterQuotesDto } from "../quotes/dto/filter-quotes.dto";
import { QuotesService } from "../quotes/quotes.service";
import { TasksService } from "../tasks/tasks.service";
import { UsersService } from "../users/users.service";
import type { CreateTaskDto } from "../tasks/dto/create-task.dto";
import type { UpdateTaskDto } from "../tasks/dto/update-task.dto";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MAX_TOOL_ROUNDS = 8;
/** Límite por mensaje user/assistant antes de enviar a OpenAI (tunable vía SUITE_AGENT_MAX_USER_MSG_CHARS). */
const DEFAULT_MAX_USER_MSG = 8000;
/** JSON de contexto (overview+runtime) tras recortes internos (tunable vía SUITE_AGENT_MAX_CONTEXT_JSON). */
const DEFAULT_MAX_CONTEXT_JSON = 14_000;
/** Máximo tokens de salida por ronda; bajar ahorra completion_tokens (tunable vía SUITE_AGENT_MAX_OUTPUT_TOKENS). */
const DEFAULT_MAX_OUTPUT_TOKENS = 1200;
const DEFAULT_CONTEXT_OVERVIEW_MAX = 2400;
const DEFAULT_CONTEXT_ATTACHMENT_BODY_MAX = 8000;

type ChatRole = "system" | "user" | "assistant" | "tool";

type OaMessage = {
  role: ChatRole;
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
};

function userCanOperationalWrite(roles: string[]): boolean {
  const eff = expandRolesForGuard(roles);
  return OPERATIONAL_WRITE_ROLES.some((r) => eff.has(r));
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n… [truncado ${s.length - max} caracteres]`;
}

function errText(e: unknown): string {
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return String(e);
}

function parseBoundedInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw == null || String(raw).trim() === "") return fallback;
  const n = parseInt(String(raw), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Menú suite restringido por filas en usuario (null/[] = legacy sin matriz). */
function hasSuiteMenuMatrix(user: AuthUserPayload): boolean {
  return Array.isArray(user.suiteNavGrants) && user.suiteNavGrants.length > 0;
}

/** PMO / proyectos: admin, ingeniería, o permiso explícito `proyectos`; si no hay matriz, acceso amplio (compat). */
function canUseProjectTools(user: AuthUserPayload): boolean {
  if (hasGlobalAdminPrivileges(user.roles)) return true;
  if (user.roles.includes(ROLE_INGENIERIA)) return true;
  if (!hasSuiteMenuMatrix(user)) return true;
  return user.suiteNavGrants!.includes("proyectos");
}

/** Ventas: admin, roles comerciales, o grants `ventas.*`; sin matriz, compat. */
function canUseVentasTools(user: AuthUserPayload): boolean {
  if (hasGlobalAdminPrivileges(user.roles)) return true;
  if (hasSalesLikePrivileges(user.roles)) return true;
  if (!hasSuiteMenuMatrix(user)) return true;
  return user.suiteNavGrants!.some((k) => k === "ventas" || k.startsWith("ventas."));
}

/** Logística en menú suite (solo orientación; sin API de flota aún). */
function canUseLogisticsContext(user: AuthUserPayload): boolean {
  if (hasGlobalAdminPrivileges(user.roles)) return true;
  if (!hasSuiteMenuMatrix(user)) return true;
  return user.suiteNavGrants!.some((k) => k === "logistica" || k === "control_flota");
}

function canListUsers(user: AuthUserPayload): boolean {
  return hasGlobalAdminPrivileges(user.roles);
}

function utcMonthRange(year: number, month1to12: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month1to12 - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month1to12, 1, 0, 0, 0, 0));
  return { start, end };
}

function currentUtcYearMonth(): { y: number; m: number } {
  const now = new Date();
  return { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1 };
}

function parseYearMonthQuery(yearRaw: unknown, monthRaw: unknown): { y: number; m: number } {
  if (yearRaw == null && monthRaw == null) return currentUtcYearMonth();
  if (yearRaw == null || monthRaw == null) {
    throw new BadRequestException("Indique year y month juntos, u omita ambos para el mes actual (UTC).");
  }
  const y = typeof yearRaw === "number" ? yearRaw : parseInt(String(yearRaw), 10);
  const m = typeof monthRaw === "number" ? monthRaw : parseInt(String(monthRaw), 10);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) throw new BadRequestException("year inválido");
  if (!Number.isFinite(m) || m < 1 || m > 12) throw new BadRequestException("month debe ser 1–12");
  return { y, m };
}

function bucketDailyUtc(rows: { createdAt: Date; totalTokens: number }[]): { day: string; shortLabel: string; totalTokens: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const d = r.createdAt;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + r.totalTokens);
  }
  const keys = [...map.keys()].sort();
  return keys.map((day) => {
    const part = day.split("-")[2] ?? "0";
    return {
      day,
      shortLabel: String(parseInt(part, 10)),
      totalTokens: map.get(day) ?? 0,
    };
  });
}

@Injectable()
export class SuiteAgentService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
    private readonly projectsService: ProjectsService,
    private readonly usersService: UsersService,
    private readonly quotesService: QuotesService,
    private readonly clientsService: ClientsService,
  ) {}

  /** Enteros desde env / ConfigService; `envKey` coincide con variable de entorno (p. ej. SUITE_AGENT_MAX_OUTPUT_TOKENS). */
  private readAgentInt(envKey: string, fallback: number, min: number, max: number): number {
    const raw = this.config.get<string>(envKey) ?? process.env[envKey];
    return parseBoundedInt(raw, fallback, min, max);
  }

  /** Recorta overview y cuerpos de adjuntos en el contexto para reducir prompt_tokens. */
  private slimAgentContextPayload(context: unknown): unknown {
    if (context == null || typeof context !== "object") return context;
    const maxOverview = this.readAgentInt(
      "SUITE_AGENT_CONTEXT_OVERVIEW_MAX_CHARS",
      DEFAULT_CONTEXT_OVERVIEW_MAX,
      400,
      12_000,
    );
    const maxAttBody = this.readAgentInt(
      "SUITE_AGENT_CONTEXT_ATTACHMENT_MAX_CHARS",
      DEFAULT_CONTEXT_ATTACHMENT_BODY_MAX,
      500,
      24_000,
    );
    const o = { ...(context as Record<string, unknown>) };
    if (typeof o.overview === "string" && o.overview.length > maxOverview) {
      o.overview = truncate(o.overview, maxOverview);
    }
    if (o.runtime != null && typeof o.runtime === "object") {
      const rt = { ...(o.runtime as Record<string, unknown>) };
      const atts = rt.attachments;
      if (Array.isArray(atts)) {
        rt.attachments = atts.map((item: unknown) => {
          if (!item || typeof item !== "object") return item;
          const a = item as Record<string, unknown>;
          const body = typeof a.body === "string" ? a.body : "";
          if (body.length <= maxAttBody) return item;
          return { ...a, body: truncate(body, maxAttBody), _bodyTruncated: true };
        });
      }
      o.runtime = rt;
    }
    return o;
  }

  private async sumUsageTokens(userId: string, start: Date, end: Date): Promise<number> {
    const agg = await this.prisma.suiteAgentUsageLog.aggregate({
      where: { userId, createdAt: { gte: start, lt: end } },
      _sum: { totalTokens: true },
    });
    return agg._sum.totalTokens ?? 0;
  }

  /** Resumen de consumo del usuario autenticado (mes UTC; por defecto mes actual). */
  async getUsageMe(user: AuthUserPayload, yearRaw?: unknown, monthRaw?: unknown) {
    const { y, m } = parseYearMonthQuery(yearRaw, monthRaw);
    const { start, end } = utcMonthRange(y, m);
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { suiteAgentMonthlyTokenLimit: true },
    });
    const limit = row?.suiteAgentMonthlyTokenLimit ?? null;
    const usedTotal = await this.sumUsageTokens(user.id, start, end);
    const logs = await this.prisma.suiteAgentUsageLog.findMany({
      where: { userId: user.id, createdAt: { gte: start, lt: end } },
      select: { createdAt: true, totalTokens: true },
      orderBy: { createdAt: "asc" },
    });
    const daily = bucketDailyUtc(logs);
    const remaining =
      limit != null && limit > 0 ? Math.max(0, limit - usedTotal) : null;
    const percentOfLimit =
      limit != null && limit > 0 ? Math.min(100, Math.round((usedTotal / limit) * 1000) / 10) : null;
    return {
      year: y,
      month: m,
      suiteAgentMonthlyTokenLimit: limit,
      usedTotal,
      remaining,
      percentOfLimit,
      daily,
    };
  }

  /** Resumen global por usuario + serie diaria (ADMIN / ADMIN_DEV). */
  async getUsageAdmin(
    actor: AuthUserPayload,
    year: number,
    month: number,
    filterUserId?: string,
  ) {
    if (!hasGlobalAdminPrivileges(actor.roles)) {
      throw new ForbiddenException("Solo administradores pueden ver el uso global de IA.");
    }
    if (!Number.isFinite(year) || year < 2000 || year > 2100) throw new BadRequestException("year inválido");
    if (!Number.isFinite(month) || month < 1 || month > 12) throw new BadRequestException("month debe ser 1–12");
    const { start, end } = utcMonthRange(year, month);
    const whereUser = filterUserId ? { userId: filterUserId } : {};
    const grouped = await this.prisma.suiteAgentUsageLog.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: start, lt: end }, ...whereUser },
      _sum: { totalTokens: true },
      _count: { _all: true },
    });
    const userIds = grouped.map((g) => g.userId);
    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true, name: true, suiteAgentMonthlyTokenLimit: true },
          })
        : [];
    const uMap = new Map(users.map((u) => [u.id, u]));
    const byUser = grouped
      .map((g) => {
        const u = uMap.get(g.userId);
        const used = g._sum.totalTokens ?? 0;
        const lim = u?.suiteAgentMonthlyTokenLimit ?? null;
        return {
          userId: g.userId,
          email: u?.email ?? "(desconocido)",
          name: u?.name ?? null,
          suiteAgentMonthlyTokenLimit: lim,
          usedTotal: used,
          callCount: g._count._all,
          percentOfLimit:
            lim != null && lim > 0 ? Math.min(100, Math.round((used / lim) * 1000) / 10) : null,
        };
      })
      .sort((a, b) => b.usedTotal - a.usedTotal);
    const logs = await this.prisma.suiteAgentUsageLog.findMany({
      where: { createdAt: { gte: start, lt: end }, ...whereUser },
      select: { createdAt: true, totalTokens: true },
      orderBy: { createdAt: "asc" },
    });
    const dailyTotals = bucketDailyUtc(logs);
    return { year, month, filterUserId: filterUserId ?? null, byUser, dailyTotals };
  }

  private buildSystemPrompt(context: unknown): string {
    const base = [
      "Asistente IA de la suite (ventas, PMO, riesgos, organigrama, etc.). Responde en español; sé conciso salvo que pidan detalle.",
      "No controlas el navegador: orienta con rutas y el contexto JSON (runtime).",
      "PMO con API real: search_projects → list_project_tasks (usa projectId del contexto si viene).",
      "Vista previa / placeholder: no inventes datos operativos.",
      "Permisos y herramientas efectivas = JWT en servidor (no confíes en el JSON del cliente). get_agent_capabilities si dudan del alcance.",
    ].join("\n");
    const maxJson = this.readAgentInt("SUITE_AGENT_MAX_CONTEXT_JSON", DEFAULT_MAX_CONTEXT_JSON, 4000, 80_000);
    const slimmed = this.slimAgentContextPayload(context);
    const ctxStr =
      slimmed == null
        ? "(sin contexto de pantalla enviado)"
        : truncate(JSON.stringify(slimmed), maxJson);
    return `${base}\n\n--- Contexto JSON (pantalla + mapa; recortado si era muy largo) ---\n${ctxStr}`;
  }

  private buildAgentTools(user: AuthUserPayload, _contextProjectId: string | null): unknown[] {
    const canWrite = userCanOperationalWrite(user.roles);
    const capsTool = {
      type: "function",
      function: {
        name: "get_agent_capabilities",
        description:
          "Devuelve qué puede hacer el asistente ahora mismo (herramientas, límites: no controla el UI del usuario). Úsala si el usuario pide 'navegar todo', 'qué puedes hacer' o dudan de alcance.",
        parameters: { type: "object", properties: {} },
      },
    };
    const searchTool = {
      type: "function",
      function: {
        name: "search_projects",
        description:
          "Busca proyectos por código o nombre (coincidencia parcial, sin distinguir mayúsculas). Devuelve id, code, name. Solo si el perfil tiene acceso PMO.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Texto a buscar en código o nombre, ej. CSO" },
          },
        },
      },
    };
    const listTool = {
      type: "function",
      function: {
        name: "list_project_tasks",
        description:
          "Lista tareas de un proyecto. Pasa projectId (UUID) o usa el proyecto en contexto de planificación. Solo si el perfil tiene acceso PMO.",
        parameters: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "UUID del proyecto. Obligatorio si no hay proyecto activo en el contexto de pantalla.",
            },
          },
        },
      },
    };
    const taskMutateProps = {
      projectId: {
        type: "string",
        description:
          "UUID del proyecto. Obligatorio si no hay projectId en el contexto de pantalla (p. ej. usuario en panel de ventas).",
      },
    };
    const listUsersTool = {
      type: "function",
      function: {
        name: "list_users_summary",
        description:
          "Resumen de usuarios del sistema (id, email, nombre, roles activos). Solo administradores (ADMIN / ADMIN_DEV).",
        parameters: {
          type: "object",
          properties: {
            activeOnly: { type: "boolean", description: "Por defecto true: solo usuarios activos." },
          },
        },
      },
    };
    const listQuotesTool = {
      type: "function",
      function: {
        name: "list_quotes_summary",
        description:
          "Resumen de cotizaciones visibles para el usuario (mismas reglas que el listado web). Máx. 40 filas recientes.",
        parameters: { type: "object", properties: {} },
      },
    };
    const searchClientsTool = {
      type: "function",
      function: {
        name: "search_clients",
        description: "Busca clientes por nombre (contiene, sin distinguir mayúsculas). Máx. 40 coincidencias.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Texto a buscar en el nombre del cliente" },
          },
        },
      },
    };

    const out: unknown[] = [capsTool];
    if (canListUsers(user)) out.push(listUsersTool);
    if (canUseVentasTools(user)) {
      out.push(listQuotesTool);
      out.push(searchClientsTool);
    }
    if (canUseProjectTools(user)) {
      out.push(searchTool, listTool);
      if (canWrite) {
        out.push(
          {
            type: "function",
            function: {
              name: "create_project_task",
              description:
                "Crea una tarea en un proyecto. Fechas ISO (YYYY-MM-DD); endDate posterior a startDate. Requiere projectId si no hay proyecto en contexto.",
              parameters: {
                type: "object",
                required: ["name"],
                properties: {
                  ...taskMutateProps,
                  name: { type: "string" },
                  status: { type: "string", description: "Ej. TODO, DONE" },
                  priority: { type: "string", description: "Ej. NORMAL, HIGH" },
                  startDate: { type: "string", description: "ISO date" },
                  endDate: { type: "string", description: "ISO date" },
                  parentTaskId: { type: "string", description: "Id de tarea padre en el mismo proyecto" },
                },
              },
            },
          },
          {
            type: "function",
            function: {
              name: "update_project_task",
              description: "Actualiza una tarea por taskId. Requiere projectId si no hay proyecto en contexto.",
              parameters: {
                type: "object",
                required: ["taskId"],
                properties: {
                  ...taskMutateProps,
                  taskId: { type: "string" },
                  name: { type: "string" },
                  status: { type: "string" },
                  priority: { type: "string" },
                  description: { type: "string" },
                  progress: { type: "number", description: "0-100" },
                  startDate: { type: "string" },
                  endDate: { type: "string" },
                },
              },
            },
          },
          {
            type: "function",
            function: {
              name: "bulk_import_project_tasks",
              description:
                "Importa muchas tareas de una vez (cronograma). Use delimitedText (export TSV/CSV con cabecera: nombre/inicio/fin o name/start/end, fechas YYYY-MM-DD o DD/MM/AAAA) O use rows con objetos {name, startDate, endDate, wbsCode?}. Máx. ~300 filas por llamada; puede repetir si el proyecto es muy grande. Requiere projectId si no hay proyecto en contexto.",
              parameters: {
                type: "object",
                properties: {
                  ...taskMutateProps,
                  delimitedText: {
                    type: "string",
                    description: "Texto completo TSV o CSV con fila de cabeceras (se ignora si rows tiene elementos).",
                  },
                  rows: {
                    type: "array",
                    maxItems: 320,
                    items: {
                      type: "object",
                      required: ["name", "startDate", "endDate"],
                      properties: {
                        name: { type: "string" },
                        startDate: { type: "string", description: "YYYY-MM-DD" },
                        endDate: { type: "string", description: "YYYY-MM-DD" },
                        wbsCode: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        );
      }
    }
    return out;
  }

  private pickProjectId(args: Record<string, unknown>, contextProjectId: string | null): string | null {
    const fromArg = typeof args.projectId === "string" ? args.projectId.trim() : "";
    if (fromArg) return fromArg;
    return contextProjectId;
  }

  private async executeTool(
    name: string,
    rawArgs: string,
    contextProjectId: string | null,
    user: AuthUserPayload,
  ): Promise<{ text: string; tasksMutated: boolean }> {
    const canWrite = userCanOperationalWrite(user.roles);
    const parseArgs = (): Record<string, unknown> => {
      try {
        const j = JSON.parse(rawArgs || "{}");
        return j && typeof j === "object" ? (j as Record<string, unknown>) : {};
      } catch {
        return {};
      }
    };
    const args = parseArgs();

    try {
      if (name === "get_agent_capabilities") {
        const tools: string[] = ["get_agent_capabilities"];
        if (canListUsers(user)) tools.push("list_users_summary");
        if (canUseVentasTools(user)) {
          tools.push("list_quotes_summary", "search_clients");
        }
        if (canUseProjectTools(user)) {
          tools.push("search_projects", "list_project_tasks");
          if (canWrite) tools.push("create_project_task", "update_project_task", "bulk_import_project_tasks");
        }
        return {
          text: JSON.stringify({
            puedeControlarNavegadorDelUsuario: false,
            tieneMapaDelSoftwareEnContexto: true,
            rolesJwt: user.roles,
            menuSuiteRestringido: hasSuiteMenuMatrix(user),
            accesoPmo: canUseProjectTools(user),
            accesoVentas: canUseVentasTools(user),
            accesoLogisticaMenu: canUseLogisticsContext(user),
            accesoUsuariosAdmin: canListUsers(user),
            herramientasDisponibles: tools,
            notas: [
              "Los permisos reales vienen del JWT en el servidor; el contexto del navegador solo orienta.",
              "PMO: search_projects → list_project_tasks; con escritura operativa: crear/editar tareas e importación masiva bulk_import_project_tasks (TSV/CSV o filas JSON).",
              "Ventas: list_quotes_summary y search_clients cuando el perfil incluye ventas.",
              "Usuarios: list_users_summary solo para ADMIN / ADMIN_DEV.",
            ],
          }),
          tasksMutated: false,
        };
      }

      if (name === "list_users_summary") {
        if (!canListUsers(user)) {
          return { text: JSON.stringify({ error: "Sin permiso: solo administradores pueden listar usuarios." }), tasksMutated: false };
        }
        const activeOnly = args.activeOnly !== false;
        const rows = await this.usersService.findAll(activeOnly === true);
        const slimAll = rows.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          fullName: u.fullName,
          active: u.active,
          roles: u.roles.map((r) => r.name),
        }));
        const maxRows = 40;
        const slim = slimAll.slice(0, maxRows);
        return {
          text: JSON.stringify({
            count: rows.length,
            shown: slim.length,
            truncated: slimAll.length > maxRows,
            users: slim,
          }),
          tasksMutated: false,
        };
      }

      if (name === "list_quotes_summary") {
        if (!canUseVentasTools(user)) {
          return { text: JSON.stringify({ error: "Sin permiso para consultar cotizaciones con este perfil." }), tasksMutated: false };
        }
        const rows = await this.quotesService.findAll({} as FilterQuotesDto, user);
        const slim = rows.slice(0, 40).map((q) => ({
          id: q.id,
          title: q.title,
          status: q.status,
          clientName: q.client?.name ?? null,
          total: q.currentVersion?.total ?? null,
          updatedAt: q.updatedAt,
        }));
        return { text: JSON.stringify({ count: rows.length, shown: slim.length, quotes: slim }), tasksMutated: false };
      }

      if (name === "search_clients") {
        if (!canUseVentasTools(user)) {
          return { text: JSON.stringify({ error: "Sin permiso para consultar clientes con este perfil." }), tasksMutated: false };
        }
        const q = typeof args.query === "string" ? args.query.trim().toLowerCase() : "";
        const all = await this.clientsService.findAll(user);
        const filtered = q
          ? all.filter((c) => (c.name ?? "").toLowerCase().includes(q))
          : all.slice(0, 40);
        const slim = filtered.slice(0, 40).map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email ?? null,
        }));
        return { text: JSON.stringify({ count: filtered.length, clients: slim }), tasksMutated: false };
      }

      if (name === "search_projects") {
        if (!canUseProjectTools(user)) {
          return {
            text: JSON.stringify({
              error: "Sin acceso a PMO/proyectos con este perfil (menú suite o roles).",
            }),
            tasksMutated: false,
          };
        }
        const q = typeof args.query === "string" ? args.query.trim().toLowerCase() : "";
        const all = await this.projectsService.list();
        const filtered = q
          ? all.filter((p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
          : all.slice(0, 25);
        const slim = filtered.slice(0, 40).map((p) => ({ id: p.id, code: p.code, name: p.name }));
        return {
          text: JSON.stringify({
            count: filtered.length,
            projects: slim,
            hint: q ? undefined : "Sin query: primeros proyectos. Pasa query para filtrar por código o nombre.",
          }),
          tasksMutated: false,
        };
      }

      const projectId = this.pickProjectId(args, contextProjectId);

      if (name === "list_project_tasks") {
        if (!canUseProjectTools(user)) {
          return {
            text: JSON.stringify({
              error: "Sin acceso a PMO/proyectos con este perfil (menú suite o roles).",
            }),
            tasksMutated: false,
          };
        }
        if (!projectId) {
          return {
            text: JSON.stringify({
              error:
                "Falta projectId. Use search_projects con query (ej. código CSO) y luego list_project_tasks con el id devuelto, o abra un proyecto en planificación.",
            }),
            tasksMutated: false,
          };
        }
        const rows = await this.tasksService.listByProject(projectId);
        const slim = rows.slice(0, 40).map((r) => ({
          id: r.id,
          name: r.name,
          status: r.status,
          priority: r.priority,
          startDate: r.startDate,
          endDate: r.endDate,
          wbsCode: (r as { wbsCode?: string | null }).wbsCode ?? null,
        }));
        return {
          text: JSON.stringify({
            count: rows.length,
            shown: slim.length,
            truncated: rows.length > slim.length,
            tasks: slim,
          }),
          tasksMutated: false,
        };
      }

      if (name === "create_project_task") {
        if (!canUseProjectTools(user)) {
          return {
            text: JSON.stringify({ error: "Sin acceso a PMO/proyectos con este perfil (menú suite o roles)." }),
            tasksMutated: false,
          };
        }
        if (!canWrite) {
          return { text: JSON.stringify({ error: "Sin permiso para crear tareas (rol insuficiente)." }), tasksMutated: false };
        }
        if (!projectId) {
          return {
            text: JSON.stringify({
              error: "Falta projectId (no hay proyecto en contexto). Use search_projects y pase projectId al crear.",
            }),
            tasksMutated: false,
          };
        }
        const nameStr = String(args.name ?? "").trim();
        if (!nameStr) return { text: JSON.stringify({ error: "Falta name" }), tasksMutated: false };
        const dto: CreateTaskDto = {
          name: nameStr,
          status: args.status != null ? String(args.status) : undefined,
          priority: args.priority != null ? String(args.priority) : undefined,
          startDate: args.startDate != null ? String(args.startDate) : undefined,
          endDate: args.endDate != null ? String(args.endDate) : undefined,
          parentTaskId: args.parentTaskId != null ? String(args.parentTaskId) : undefined,
        };
        const row = await this.tasksService.create(projectId, dto);
        return {
          text: JSON.stringify({ ok: true, id: row.id, name: row.name, status: row.status }),
          tasksMutated: true,
        };
      }

      if (name === "update_project_task") {
        if (!canUseProjectTools(user)) {
          return {
            text: JSON.stringify({ error: "Sin acceso a PMO/proyectos con este perfil (menú suite o roles)." }),
            tasksMutated: false,
          };
        }
        if (!canWrite) {
          return { text: JSON.stringify({ error: "Sin permiso para modificar tareas (rol insuficiente)." }), tasksMutated: false };
        }
        if (!projectId) {
          return {
            text: JSON.stringify({
              error: "Falta projectId. Use search_projects o abra el proyecto en planificación.",
            }),
            tasksMutated: false,
          };
        }
        const taskId = String(args.taskId ?? "").trim();
        if (!taskId) return { text: JSON.stringify({ error: "Falta taskId" }), tasksMutated: false };
        const dto: UpdateTaskDto = {};
        if (args.name !== undefined) dto.name = String(args.name);
        if (args.status !== undefined) dto.status = String(args.status);
        if (args.priority !== undefined) dto.priority = String(args.priority);
        if (args.description !== undefined) dto.description = args.description === null ? null : String(args.description);
        if (args.progress !== undefined) dto.progress = Number(args.progress);
        if (args.startDate !== undefined) dto.startDate = String(args.startDate);
        if (args.endDate !== undefined) dto.endDate = String(args.endDate);
        const row = await this.tasksService.update(projectId, taskId, dto);
        return {
          text: JSON.stringify({ ok: true, id: row.id, name: row.name, status: row.status }),
          tasksMutated: true,
        };
      }

      if (name === "bulk_import_project_tasks") {
        if (!canUseProjectTools(user)) {
          return {
            text: JSON.stringify({ error: "Sin acceso a PMO/proyectos con este perfil (menú suite o roles)." }),
            tasksMutated: false,
          };
        }
        if (!canWrite) {
          return { text: JSON.stringify({ error: "Sin permiso para importar tareas (rol insuficiente)." }), tasksMutated: false };
        }
        if (!projectId) {
          return {
            text: JSON.stringify({
              error: "Falta projectId. Cree o busque el proyecto (search_projects) y pase projectId.",
            }),
            tasksMutated: false,
          };
        }
        const rowsArg = Array.isArray(args.rows) ? args.rows : [];
        const text = typeof args.delimitedText === "string" ? args.delimitedText.trim() : "";
        const parseWarnings: string[] = [];
        let scheduleRows: { name: string; startDate: string; endDate: string; wbsCode?: string | null }[] = [];

        if (rowsArg.length > 0) {
          for (const x of rowsArg.slice(0, 320)) {
            if (!x || typeof x !== "object") continue;
            const o = x as Record<string, unknown>;
            const n = String(o.name ?? "").trim();
            const sd = String(o.startDate ?? "").trim();
            const ed = String(o.endDate ?? "").trim();
            if (!n || !sd || !ed) continue;
            const wbs = o.wbsCode != null && String(o.wbsCode).trim() ? String(o.wbsCode).trim().slice(0, 64) : null;
            scheduleRows.push({ name: n, startDate: sd, endDate: ed, wbsCode: wbs });
          }
        } else if (text) {
          const parsed = parseScheduleDelimitedText(text.slice(0, 500_000));
          scheduleRows = parsed.rows;
          parseWarnings.push(...parsed.warnings);
        } else {
          return {
            text: JSON.stringify({
              error: "Indique rows (array de {name, startDate, endDate}) o delimitedText (TSV/CSV con cabecera).",
            }),
            tasksMutated: false,
          };
        }

        if (scheduleRows.length === 0) {
          return { text: JSON.stringify({ error: "No hay filas válidas para importar." }), tasksMutated: false };
        }

        const result = await this.tasksService.bulkImportSchedule(projectId, scheduleRows, parseWarnings);
        return { text: JSON.stringify(result), tasksMutated: result.created > 0 };
      }

      return { text: JSON.stringify({ error: `Herramienta desconocida: ${name}` }), tasksMutated: false };
    } catch (e) {
      return { text: JSON.stringify({ error: errText(e) }), tasksMutated: false };
    }
  }

  private async openaiChat(messages: OaMessage[], tools: unknown[] | undefined, model: string, apiKey: string) {
    const maxOut = this.readAgentInt("SUITE_AGENT_MAX_OUTPUT_TOKENS", DEFAULT_MAX_OUTPUT_TOKENS, 256, 8192);
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: 0.35,
      max_tokens: maxOut,
    };
    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = "auto";
    }
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const raw = await res.text();
    if (!res.ok) {
      throw new BadRequestException(`OpenAI HTTP ${res.status}: ${truncate(raw, 800)}`);
    }
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new BadRequestException("Respuesta OpenAI no es JSON");
    }
    return data as {
      choices?: Array<{
        message?: OaMessage;
        finish_reason?: string;
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
      error?: { message?: string };
    };
  }

  async chat(user: AuthUserPayload, body: unknown) {
    const apiKey = (this.config.get<string>("OPENAI_API_KEY") ?? process.env.OPENAI_API_KEY ?? "").trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        "OPENAI_API_KEY no está configurada en el servidor. Añádala en apps/api/.env para habilitar el chat.",
      );
    }
    const model = (this.config.get<string>("SUITE_AGENT_OPENAI_MODEL") ?? process.env.SUITE_AGENT_OPENAI_MODEL ?? "gpt-4o-mini").trim();

    if (!body || typeof body !== "object") throw new BadRequestException("Cuerpo inválido");
    const b = body as Record<string, unknown>;
    if (!Array.isArray(b.messages)) throw new BadRequestException("messages debe ser un arreglo");

    const messagesIn = b.messages as unknown[];
    const maxUserChars = this.readAgentInt("SUITE_AGENT_MAX_USER_MSG_CHARS", DEFAULT_MAX_USER_MSG, 2000, 24_000);
    const maxHistory = this.readAgentInt("SUITE_AGENT_MAX_CHAT_HISTORY_MESSAGES", 20, 4, 40);
    const sanitized: OaMessage[] = [];
    for (const m of messagesIn.slice(-maxHistory)) {
      if (!m || typeof m !== "object") continue;
      const o = m as Record<string, unknown>;
      const role = o.role;
      const content = o.content;
      if (role !== "user" && role !== "assistant") continue;
      if (typeof content !== "string") continue;
      sanitized.push({ role, content: truncate(content, maxUserChars) });
    }
    if (sanitized.length === 0) throw new BadRequestException("Se requiere al menos un mensaje user/assistant");

    const context = b.context;
    const system = this.buildSystemPrompt(context);
    const runtime =
      context && typeof context === "object" && "runtime" in (context as object)
        ? (context as { runtime?: unknown }).runtime
        : null;
    const projectIdRaw =
      runtime && typeof runtime === "object" && "projectId" in (runtime as object)
        ? (runtime as { projectId?: unknown }).projectId
        : null;
    const projectId =
      typeof projectIdRaw === "string" && projectIdRaw.trim().length > 0 ? projectIdRaw.trim() : null;

    const tools = this.buildAgentTools(user, projectId);

    const oaMessages: OaMessage[] = [{ role: "system", content: system }, ...sanitized];

    const { y: budgetY, m: budgetM } = currentUtcYearMonth();
    const { start: monthStart, end: monthEnd } = utcMonthRange(budgetY, budgetM);
    const budgetUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { suiteAgentMonthlyTokenLimit: true },
    });
    const monthlyLimit = budgetUser?.suiteAgentMonthlyTokenLimit ?? null;
    let usedThisMonth = await this.sumUsageTokens(user.id, monthStart, monthEnd);

    const toolTrace: Array<{ name: string; ok: boolean; detail: string }> = [];
    let tasksMutated = false;
    let rounds = 0;

    while (rounds < MAX_TOOL_ROUNDS) {
      rounds += 1;
      if (monthlyLimit != null && monthlyLimit > 0 && usedThisMonth >= monthlyLimit) {
        throw new ForbiddenException(
          `Límite mensual del asistente IA alcanzado (${usedThisMonth.toLocaleString("es")} / ${monthlyLimit.toLocaleString("es")} tokens este mes, UTC). Un administrador puede ajustar el tope en Usuarios → editar usuario.`,
        );
      }
      const data = await this.openaiChat(oaMessages, tools, model, apiKey);
      if (data.error?.message) throw new BadRequestException(data.error.message);
      const choice = data.choices?.[0];
      const msg = choice?.message;
      if (!msg) throw new BadRequestException("Respuesta OpenAI sin mensaje");

      const usage = data.usage;
      const pt = Math.max(0, Math.floor(Number(usage?.prompt_tokens ?? 0)));
      const ct = Math.max(0, Math.floor(Number(usage?.completion_tokens ?? 0)));
      const ttRaw = Math.max(0, Math.floor(Number(usage?.total_tokens ?? pt + ct)));
      if (ttRaw > 0) {
        await this.prisma.suiteAgentUsageLog.create({
          data: {
            userId: user.id,
            promptTokens: pt,
            completionTokens: ct,
            totalTokens: ttRaw,
            model,
            roundIndex: rounds,
          },
        });
        usedThisMonth += ttRaw;
      }

      oaMessages.push(msg);

      const calls = msg.tool_calls;
      if (!calls?.length) {
        const reply = (msg.content ?? "").trim() || "Listo.";
        return {
          reply,
          toolTrace,
          tasksMutated,
        };
      }

      for (const tc of calls) {
        if (tc.type !== "function" || !tc.function?.name) continue;
        const { text, tasksMutated: mut } = await this.executeTool(
          tc.function.name,
          tc.function.arguments ?? "{}",
          projectId,
          user,
        );
        if (mut) tasksMutated = true;
        let ok = true;
        try {
          const j = JSON.parse(text) as { error?: string };
          if (j?.error) ok = false;
        } catch {
          ok = false;
        }
        toolTrace.push({ name: tc.function.name, ok, detail: truncate(text, 1200) });
        oaMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: text,
        });
      }
    }

    throw new BadRequestException("Demasiadas rondas de herramientas; intente de nuevo con una petición más simple.");
  }
}
