import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { allReleaseRoutes, MINIMAL_FLOW_HREFS } from "./collect-release-routes";

function slugFromHref(href: string): string {
  const s = href.replace(/^\/+|\/+$/g, "").replace(/\//g, "__");
  return s || "root";
}

function isBenignConsole(text: string): boolean {
  return (
    /ResizeObserver loop/i.test(text) ||
    /Hydration failed/i.test(text) ||
    /Download the React DevTools/i.test(text) ||
    /favicon/i.test(text)
  );
}

function looksLikePlaceholder(body: string): boolean {
  const t = body.slice(0, 80_000);
  return /próximamente|proximamente|en construcción|en desarrollo|placeholder|coming soon|under construction/i.test(
    t,
  );
}

function resolveApiOrigin(): string {
  const raw =
    process.env.E2E_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://127.0.0.1:4000/api";
  try {
    const u = new URL(raw);
    return u.origin;
  } catch {
    return "http://127.0.0.1:4000";
  }
}

test.describe("Release QA — navegación y módulos", () => {
  test("recorrido completo + informe JSON", async ({ page }, testInfo) => {
    const apiOrigin = resolveApiOrigin();
    const routes = allReleaseRoutes();

    const report: {
      generatedAt: string;
      baseURL: string;
      apiOrigin: string;
      modules: Array<{
        href: string;
        slug: string;
        httpStatus: number | null;
        notFoundHeuristic: boolean;
        placeholderHeuristic: boolean;
        consoleErrors: string[];
        failedRequests: string[];
        api5xx: { url: string; status: number }[];
      }>;
      summary: {
        okModules: number;
        brokenRoutes: string[];
        placeholderModules: string[];
        totalConsoleErrors: number;
        failedRequests: string[];
        api5xx: { url: string; status: number }[];
      };
      minimalFlows: typeof MINIMAL_FLOW_HREFS;
    } = {
      generatedAt: new Date().toISOString(),
      baseURL: testInfo.project.use.baseURL ?? "",
      apiOrigin,
      modules: [],
      summary: {
        okModules: 0,
        brokenRoutes: [],
        placeholderModules: [],
        totalConsoleErrors: 0,
        failedRequests: [],
        api5xx: [],
      },
      minimalFlows: MINIMAL_FLOW_HREFS,
    };

    const shotDir = path.join(testInfo.outputDir, "screenshots");
    mkdirSync(shotDir, { recursive: true });

    for (const href of routes) {
      const consoleErrors: string[] = [];
      const failedRequests: string[] = [];
      const api5xx: { url: string; status: number }[] = [];

      const onConsole = (msg: import("@playwright/test").ConsoleMessage) => {
        if (msg.type() !== "error") return;
        const t = msg.text();
        if (isBenignConsole(t)) return;
        consoleErrors.push(t);
      };
      const onRequestFailed = (req: import("@playwright/test").Request) => {
        const f = req.failure();
        failedRequests.push(`${req.method()} ${req.url()} — ${f?.errorText ?? "failed"}`);
      };
      const onResponse = (res: import("@playwright/test").Response) => {
        const u = res.url();
        if (!u.startsWith(apiOrigin)) return;
        const st = res.status();
        if (st >= 500) api5xx.push({ url: u, status: st });
      };

      page.on("console", onConsole);
      page.on("requestfailed", onRequestFailed);
      page.on("response", onResponse);

      let status: number | null = null;
      let notFoundHeuristic = false;
      let placeholderHeuristic = false;

      try {
        const resp = await page.goto(href, { waitUntil: "load", timeout: 90_000 });
        status = resp?.status() ?? null;
        await page.evaluate(() => new Promise<void>((r) => setTimeout(r, 400)));
        const body = await page.innerText("body").catch(() => "");
        notFoundHeuristic =
          status === 404 ||
          /404|not found|no se encontró|página no encontrada/i.test(body) ||
          (await page.getByRole("heading", { name: /404/i }).count()) > 0;
        placeholderHeuristic = looksLikePlaceholder(body);

        const slug = slugFromHref(href);
        await page.screenshot({
          path: path.join(shotDir, `${slug}.png`),
          fullPage: true,
        });

        const ok = status !== null && status < 400 && !notFoundHeuristic;
        if (ok) report.summary.okModules += 1;
        if (notFoundHeuristic || (status !== null && status >= 400)) {
          report.summary.brokenRoutes.push(href);
        }
        if (placeholderHeuristic) report.summary.placeholderModules.push(href);

        report.modules.push({
          href,
          slug,
          httpStatus: status,
          notFoundHeuristic,
          placeholderHeuristic,
          consoleErrors: [...consoleErrors],
          failedRequests: [...failedRequests],
          api5xx: [...api5xx],
        });
      } finally {
        page.off("console", onConsole);
        page.off("requestfailed", onRequestFailed);
        page.off("response", onResponse);
      }
    }

    const allConsole = report.modules.flatMap((m) => m.consoleErrors);
    report.summary.totalConsoleErrors = allConsole.length;
    report.summary.failedRequests = [...new Set(report.modules.flatMap((m) => m.failedRequests))];
    report.summary.api5xx = report.modules.flatMap((m) => m.api5xx);

    mkdirSync(testInfo.outputDir, { recursive: true });
    const reportPath = path.join(testInfo.outputDir, "release-qa-report.json");
    writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
    await testInfo.attach("release-qa-report.json", {
      path: reportPath,
      contentType: "application/json",
    });

    expect(
      report.summary.brokenRoutes,
      `Rutas rotas o HTTP error: ${report.summary.brokenRoutes.join(", ")}`,
    ).toEqual([]);

    expect(
      report.summary.api5xx,
      `Respuestas 5xx hacia API (${apiOrigin}): ${JSON.stringify(report.summary.api5xx)}`,
    ).toEqual([]);

    expect(
      allConsole,
      `Errores de consola (no filtrados): ${allConsole.slice(0, 5).join(" | ")}`,
    ).toEqual([]);
  });
});

test.describe("Release QA — flujos mínimos (smoke)", () => {
  for (const flow of MINIMAL_FLOW_HREFS) {
    test(`smoke: ${flow.key}`, async ({ page }) => {
      const resp = await page.goto(flow.href, { waitUntil: "load", timeout: 90_000 });
      const st = resp?.status() ?? 0;
      expect(st, `${flow.href} status`).toBeLessThan(400);
      await expect(page).not.toHaveURL(/\/login/);
      const body = await page.innerText("body");
      expect(body, flow.href).not.toMatch(/página no encontrada|this page could not be found/i);
    });
  }
});
