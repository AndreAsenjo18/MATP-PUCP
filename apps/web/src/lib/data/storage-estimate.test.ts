import { afterEach, describe, expect, it, vi } from "vitest";

import { getAllPieceMedia } from "@/lib/fixtures";

import { expectedCollection, fetchStorageEstimate, formatBytes, projectionOf } from "./storage-estimate";

// Modo `mock`: el valor por defecto sin NEXT_PUBLIC_API_MODE. Modo `live`: `fetch` simulado, sin red.

const BASE_URL = "http://api.test";

function useLive(handler: (request: Request) => Promise<Response>) {
  vi.stubEnv("NEXT_PUBLIC_API_MODE", "live");
  vi.stubEnv("API_INTERNAL_URL", BASE_URL);
  const fetchMock = vi.fn(handler);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("formatBytes", () => {
  it("usa unidades decimales y el formato de es-PE", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(20_480)).toBe("20.5 KB");
    expect(formatBytes(419_430_400_000)).toBe("419 GB");
  });
});

describe("fetchStorageEstimate (mock)", () => {
  it("calcula el volumen sobre las fotos sintéticas y proyecta las 25 000 esperadas", async () => {
    const media = getAllPieceMedia();

    const result = await fetchStorageEstimate();

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const originals = media.reduce((total, asset) => total + asset.size_bytes, 0);
    expect(result.estimate.by_file_type.original_bytes).toBe(originals);
    expect(expectedCollection(result.estimate).photos).toBe(25000);
    expect(projectionOf(result.estimate)).toBeNull();
  });

  it("con parámetros devuelve la proyección a medida", async () => {
    const result = await fetchStorageEstimate({ pieces: 20000, photos_per_piece: 5, mb_per_photo: 4 });

    expect(result.status === "ok" && projectionOf(result.estimate)?.projected_originals_bytes).toBe(20000 * 5 * 4 * 1024 * 1024);
  });
});

describe("fetchStorageEstimate (live)", () => {
  it("pide GET /media/storage-estimate con los parámetros escritos", async () => {
    const fetchMock = useLive(async () => json(200, { keeps_originals: false }));

    await fetchStorageEstimate({ pieces: 1000, mb_per_photo: 6 });

    const url = new URL(fetchMock.mock.calls[0]![0].url);
    expect(url.pathname).toBe("/api/v1/media/storage-estimate");
    expect(Object.fromEntries(url.searchParams)).toEqual({ pieces: "1000", mb_per_photo: "6" });
  });

  it("un error de la API se explica sin romper la tarjeta", async () => {
    useLive(async () => json(422, { code: "validation_failed", message: "Los parámetros no pueden ser negativos." }));

    expect(await fetchStorageEstimate({ pieces: 1 })).toEqual({
      status: "error",
      message: "Los parámetros no pueden ser negativos.",
    });
  });
});
