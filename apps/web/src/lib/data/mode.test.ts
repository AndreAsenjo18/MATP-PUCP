import { afterEach, describe, expect, it, vi } from "vitest";

import { apiBaseUrl } from "./mode";

// El entorno de pruebas es "node" (sin window): se simula el navegador definiendo
// globalThis.window para ejercitar las dos ramas de apiBaseUrl() (design D9).

const globalWithWindow = globalThis as { window?: unknown };

function setWindow(present: boolean) {
  if (present) {
    globalWithWindow.window = {};
  } else {
    delete globalWithWindow.window;
  }
}

afterEach(() => {
  setWindow(false);
  vi.unstubAllEnvs();
});

describe("apiBaseUrl", () => {
  it("usa cadena vacía en el navegador cuando NEXT_PUBLIC_API_URL está vacía o ausente", () => {
    setWindow(true);
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    expect(apiBaseUrl()).toBe("");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://otro-dominio.example.com");
    expect(apiBaseUrl()).toBe("https://otro-dominio.example.com");
  });

  it("usa API_INTERNAL_URL en el servidor (SSR o route handlers)", () => {
    setWindow(false);
    vi.stubEnv("API_INTERNAL_URL", "http://api:8000");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    expect(apiBaseUrl()).toBe("http://api:8000");
    vi.unstubAllEnvs();
    expect(apiBaseUrl()).toBe("http://localhost:8000");
  });
});
