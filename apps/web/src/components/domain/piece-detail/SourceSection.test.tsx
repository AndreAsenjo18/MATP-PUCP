import { describe, expect, it } from "vitest";

import { render, visibleText } from "@/test/render";
import type { ApiSchemas } from "@/lib/api/client";

import { SourceSection } from "./SourceSection";

const EXAMPLE: ApiSchemas["SourceRecordOut"] = {
  id: "source-1",
  import_batch_id: "batch-1",
  piece_id: "piece-1",
  recorded_at: "2026-11-01T10:00:00Z",
  source_name: "Sábana sintética",
  source_file_name: "datos_prueba.xlsx",
  source_row_number: 3,
  payload: { "Material original": "Cerámica", "Otro": "" },
};

describe("Datos de origen en la ficha (C20)", () => {
  it("muestra la fuente y deja las columnas originales plegadas", () => {
    const html = render(<SourceSection records={[EXAMPLE]} />);
    expect(visibleText(html)).toContain("Sábana sintética");
    expect(visibleText(html)).toContain("datos_prueba.xlsx");
    expect(html).toContain("<details");
    expect(visibleText(html)).toContain("Material original");
    expect(html).not.toContain("<pre");
  });

  it("muestra estado vacío sin inventar datos", () => {
    expect(visibleText(render(<SourceSection records={[]} />))).toContain("no tiene datos de origen adicionales");
  });

  it("escapa el texto que llega desde archivos de origen", () => {
    const html = render(<SourceSection records={[{ ...EXAMPLE, payload: { Texto: "<script>" } }]} />);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});
