import { describe, expect, it } from "vitest";

import { ids } from "@/lib/fixtures";

import { fetchPieceDetail, fetchPieces } from "./pieces";

// Sin NEXT_PUBLIC_API_MODE en el entorno de pruebas, getApiMode() da "mock" (comportamiento por
// defecto, spec plataforma): estas pruebas cubren esa rama. La rama "live" no se puede probar
// aquí sin una API real corriendo (pendiente, ver docs/estado-arranque.md); su forma se valida
// con `tsc` contra el contrato generado (apps/web/src/lib/api/schema.d.ts).

describe("fetchPieces (modo mock)", () => {
  it("resuelve de forma asíncrona con la misma forma que la página de la API real", async () => {
    const page = await fetchPieces({ q: "mmz 15" });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(1);
    expect(page.page).toBe(1);
  });
});

describe("fetchPieceDetail (modo mock)", () => {
  it("devuelve status ok con la pieza cuando existe", async () => {
    const result = await fetchPieceDetail(ids.piece(1));
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.piece.title).toBe("Toro de Pucará");
  });

  it("devuelve status not_found para un id que no existe", async () => {
    const result = await fetchPieceDetail("no-existe");
    expect(result.status).toBe("not_found");
  });
});
