import { afterEach, describe, expect, it, vi } from "vitest";

import { PIECES } from "@/lib/fixtures";

import {
  downloadIncompleteReport,
  fetchDashboardHistory,
  fetchDashboardKpis,
  fetchIncompleteReport,
  fetchPieceAlerts,
  recentDateRange,
} from "./quality";

const BASE_URL = "http://api.test";
const DEV_USER = "admin@matp.local";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function useLive(handler: (request: Request) => Promise<Response>) {
  vi.stubEnv("NEXT_PUBLIC_API_MODE", "live");
  vi.stubEnv("API_INTERNAL_URL", BASE_URL);
  const fetchMock = vi.fn(handler);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("modo mock", () => {
  it("fetchPieceAlerts devuelve las alertas del fixture de la pieza", async () => {
    const result = await fetchPieceAlerts(PIECES[0].id);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.alerts.length).toBeGreaterThan(0);
      expect(result.alerts.some((a) => a.type === "MISSING_PHOTO")).toBe(true);
    }
  });

  it("fetchPieceAlerts responde vacío para una pieza inexistente", async () => {
    const result = await fetchPieceAlerts("no-existe");
    expect(result).toEqual({ status: "ok", alerts: [] });
  });

  it("fetchDashboardKpis trae una entrada por cada una de las 6 alertas", async () => {
    const result = await fetchDashboardKpis(false);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.kpis.alerts).toHaveLength(6);
      expect(result.kpis.total_pieces).toBe(PIECES.length);
    }
  });

  it("fetchIncompleteReport filtra por alerta y pagina", async () => {
    const all = await fetchIncompleteReport({ pageSize: 100 });
    const photoOnly = await fetchIncompleteReport({ alert: ["MISSING_PHOTO"], pageSize: 100 });
    expect(all.status).toBe("ok");
    expect(photoOnly.status).toBe("ok");
    if (all.status === "ok" && photoOnly.status === "ok") {
      expect(photoOnly.page.total).toBeLessThanOrEqual(all.page.total);
      expect(photoOnly.page.items.every((p) => p.alerts.includes("MISSING_PHOTO"))).toBe(true);
    }
  });

  it("fetchDashboardHistory arma una serie con un punto por día y alerta", async () => {
    const { from, to } = recentDateRange(new Date("2026-10-10T00:00:00Z"), 3);
    const result = await fetchDashboardHistory(from, to);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      const days = new Set(result.points.map((p) => p.taken_on));
      expect(days.size).toBe(3);
      expect(result.points.length).toBe(days.size * 6);
    }
  });

  it("downloadIncompleteReport no está disponible sin backend", async () => {
    const result = await downloadIncompleteReport({}, "csv");
    expect(result.status).toBe("unavailable");
  });
});

describe("recentDateRange", () => {
  it("incluye hoy y retrocede n-1 días", () => {
    expect(recentDateRange(new Date("2026-10-10T12:00:00Z"), 7)).toEqual({ from: "2026-10-04", to: "2026-10-10" });
  });
});

describe("modo live", () => {
  it("fetchPieceAlerts pide GET /pieces/{id}/alerts con la identidad de la sesión", async () => {
    const fetchMock = useLive(async (request) => {
      expect(request.url).toBe(`${BASE_URL}/api/v1/pieces/p1/alerts`);
      expect(request.headers.get("X-MATP-User")).toBe(DEV_USER);
      return json(200, [{ type: "MISSING_PHOTO", message: "Sin fotos.", suggested_action: "Subir foto", fields: ["media"], applies: true }]);
    });
    const result = await fetchPieceAlerts("p1", DEV_USER);
    expect(result).toEqual({
      status: "ok",
      alerts: [{ type: "MISSING_PHOTO", message: "Sin fotos.", suggested_action: "Subir foto", fields: ["media"], applies: true }],
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("fetchDashboardKpis pide by_collection como parámetro de consulta", async () => {
    const fetchMock = useLive(async (request) => {
      const url = new URL(request.url);
      expect(url.pathname).toBe("/api/v1/reports/dashboard-stats");
      expect(url.searchParams.get("by_collection")).toBe("true");
      return json(200, { total_pieces: 0, alerts: [], by_collection: [], computed_at: "2026-10-01T00:00:00Z" });
    });
    const result = await fetchDashboardKpis(true, DEV_USER);
    expect(result.status).toBe("ok");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("fetchIncompleteReport responde unavailable cuando la API falla", async () => {
    useLive(async () => json(401, { code: "not_found", message: "Falta identificarse." }));
    const result = await fetchIncompleteReport({}, DEV_USER);
    expect(result.status).toBe("unavailable");
  });

  it("downloadIncompleteReport pide format=xlsx y entrega un blob", async () => {
    const fetchMock = useLive(async (request) => {
      const url = new URL(request.url);
      expect(url.searchParams.get("format")).toBe("xlsx");
      return new Response(new Blob(["contenido"]), {
        status: 200,
        headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      });
    });
    const result = await downloadIncompleteReport({}, "xlsx", DEV_USER);
    expect(result.status).toBe("ok");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
