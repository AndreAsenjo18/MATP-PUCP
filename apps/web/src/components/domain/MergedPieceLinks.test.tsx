import { describe, expect, it } from "vitest";

import type { ApiSchemas } from "@/lib/api/client";
import { getPieceDetail, ids } from "@/lib/fixtures";
import { render, visibleText } from "@/test/render";

import { MergeLinks, MergedFromNotice, MergedIntoNotice, mergeReasonText } from "./MergedPieceLinks";

// La fusión se retiró con la cola de duplicados (change `retirar-cola-duplicados`, D2), pero una pieza
// fusionada antes sigue diciendo en su ficha a cuál se unió. HTML estático (ADR-012); datos sintéticos.

type PieceDetail = ApiSchemas["PieceDetail"];

const toro = getPieceDetail(ids.piece(1))!;
const toroB: PieceDetail = { ...getPieceDetail(ids.piece(2))!, provenance: "Cusco (sintético)" };

describe("enlaces de fusión en la ficha (calidad-datos, «Consulta de la pieza absorbida»)", () => {
  it("la absorbida muestra que fue fusionada, la fecha, el motivo y el enlace a la conservada", () => {
    const html = render(<MergedIntoNotice mergedInto={{ piece_id: toro.id, merged_at: "2026-10-20T15:00:00Z", reason: `Fusionada en ${toro.id}: Misma pieza en libro y sábana` }} />);
    const text = visibleText(html);
    expect(text).toContain("Pieza fusionada");
    expect(text).toMatch(/fue fusionada en otra el \d{1,2}\/\d{1,2}\/2026/);
    expect(text).toContain("Motivo: Misma pieza en libro y sábana");
    expect(html).toContain(`href="/piezas/${toro.id}"`);
    expect(text).toContain("Ir a la pieza conservada");
  });

  it("la conservada lista las piezas fusionadas en ella con su enlace", () => {
    const html = render(
      <MergedFromNotice mergedFrom={[{ piece_id: toroB.id, denomination: toroB.denomination, merged_at: "2026-10-20T15:00:00Z", reason: `Fusionada en ${toro.id}: Duplicado` }]} />,
    );
    const text = visibleText(html);
    expect(text).toContain("Pieza fusionada en esta");
    expect(html).toContain(`href="/piezas/${toroB.id}"`);
    expect(text).toContain("Toro de Pucará (3 cuernos) · fusionada el");
    expect(text).toContain("Motivo: Duplicado");
  });

  it("una pieza que no participó en una fusión no muestra nada", () => {
    expect(render(<MergeLinks piece={toro} />)).toBe("");
    expect(render(<MergeLinks piece={{ merged_into: null, merged_from: [] }} />)).toBe("");
  });

  it("el motivo se muestra sin el prefijo técnico de la baja lógica", () => {
    expect(mergeReasonText(`Fusionada en ${toro.id}: Duplicado`)).toBe("Duplicado");
    expect(mergeReasonText(null)).toBeNull();
  });
});
