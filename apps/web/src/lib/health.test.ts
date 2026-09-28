import { describe, expect, it } from "vitest";

import { summarizeHealth } from "./health";

describe("summarizeHealth", () => {
  it("reports an operational API with its version", () => {
    const result = summarizeHealth("api", 200, {
      status: "ok",
      version: "0.1.0",
      checks: { database: { status: "ok" } },
    });
    expect(result.state).toBe("ok");
    expect(result.detail).toBe("Operativo · versión 0.1.0");
  });

  it("shows the mock provider of the AI service", () => {
    const result = summarizeHealth("ai", 200, { status: "ok", provider: "mock" });
    expect(result.detail).toContain("proveedor mock");
  });

  it("lists failing dependencies when degraded", () => {
    const result = summarizeHealth("api", 503, {
      status: "degraded",
      checks: { database: { status: "error" }, storage: { status: "ok" } },
    });
    expect(result.state).toBe("degraded");
    expect(result.detail).toBe("Con problemas en: database.");
  });

  it("marks the service unreachable on network failure", () => {
    const result = summarizeHealth("ai", null, null);
    expect(result.state).toBe("unreachable");
    expect(result.label).toBe("Servicio de IA asistiva");
  });
});
