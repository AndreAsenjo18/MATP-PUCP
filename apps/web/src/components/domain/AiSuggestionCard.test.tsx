import { afterEach, describe, expect, it, vi } from "vitest";

import type { AiSuggestion } from "@/lib/data/ai";
import { ids } from "@/lib/fixtures";
import { render, visibleText } from "@/test/render";

import { AiSuggestionCard } from "./AiSuggestionCard";
import { AiSuggestionsLive } from "./AiSuggestionsLive";

const PIECE = ids.piece(1);

const EMPTY_SUGGESTION: AiSuggestion = {
  id: ids.aiSuggestion(1),
  function_code: "RIA_01",
  piece_id: PIECE,
  import_batch_id: null,
  provider: "llm",
  model: "gemini-flash-lite-latest",
  status: "PENDING",
  input_data: { texto_origen: "Sin datos reconocibles." },
  output_data: { fields: [] },
  approved_data: null,
  rejection_reason: null,
  requested_by_id: ids.user(3),
  reviewed_by_id: null,
  reviewed_at: null,
  created_at: "2026-11-04T09:00:00Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AiSuggestionCard sin datos propuestos", () => {
  it("deja descartarla sin pedir motivo, y no ofrece aprobar", () => {
    const html = render(
      <AiSuggestionCard suggestion={EMPTY_SUGGESTION} canReview busy={false} onApprove={() => {}} onReject={() => {}} />,
    );
    const text = visibleText(html);

    expect(text).toContain("Descartar");
    expect(text).not.toContain("Aprobar todo");
    expect(text).not.toContain("Motivo del rechazo");
  });

  it("muestra el motivo calculado por el backend, no un texto genérico fijo", () => {
    const noChange: AiSuggestion = {
      ...EMPTY_SUGGESTION,
      output_data: { fields: [], message: "No se notó ningún cambio con respecto a la versión actual de la pieza." },
    };
    const html = render(<AiSuggestionCard suggestion={noChange} canReview busy={false} onApprove={() => {}} onReject={() => {}} />);

    expect(visibleText(html)).toContain("No se notó ningún cambio con respecto a la versión actual de la pieza.");
  });

  it("con datos propuestos sí pide motivo para rechazar", () => {
    const withFields: AiSuggestion = {
      ...EMPTY_SUGGESTION,
      output_data: { fields: [{ field: "conservation_status", value: "BUENO", source_fragment: "bueno", confidence: 0.9 }] },
    };
    const html = render(<AiSuggestionCard suggestion={withFields} canReview busy={false} onApprove={() => {}} onReject={() => {}} />);
    const text = visibleText(html);

    expect(text).toContain("Aprobar");
    expect(text).toContain("Motivo del rechazo");
    expect(text).not.toContain("Descartar");
  });
});

describe("AiSuggestionCard con medidas propuestas", () => {
  const WITH_DIMENSIONS: AiSuggestion = {
    ...EMPTY_SUGGESTION,
    output_data: {
      fields: [
        { field: "dimensions", value: { dimension: "alto", value: 35, unit: "cm" }, source_fragment: "Alto 35 cm", confidence: 0.9 },
        { field: "dimensions", value: { dimension: "ancho", value: 20, unit: "cm" }, source_fragment: "ancho 20 cm", confidence: 0.9 },
      ],
    },
  };

  it("deja editar el valor y la unidad de cada medida, con el valor propuesto precargado", () => {
    const html = render(<AiSuggestionCard suggestion={WITH_DIMENSIONS} canReview busy={false} onApprove={() => {}} onReject={() => {}} />);

    expect(html).toContain('value="35"');
    expect(html).toContain('value="20"');
    expect(visibleText(html)).toContain("Valor");
    expect(visibleText(html)).toContain("Unidad");
  });

  it('ofrece actualizar "Medidas", pero el texto solo aparece si se marca la casilla', () => {
    const html = render(<AiSuggestionCard suggestion={WITH_DIMENSIONS} canReview busy={false} onApprove={() => {}} onReject={() => {}} />);
    const text = visibleText(html);

    expect(text).toContain("Actualizar también el campo");
    expect(text).not.toContain("Medidas (texto)");
    expect(html).not.toContain("alto 35 cm x ancho 20 cm");
  });

  it("sin medidas propuestas no ofrece actualizar el campo Medidas", () => {
    const withoutDimensions: AiSuggestion = {
      ...EMPTY_SUGGESTION,
      output_data: { fields: [{ field: "conservation_status", value: "BUENO", source_fragment: "bueno", confidence: 0.9 }] },
    };
    const html = render(<AiSuggestionCard suggestion={withoutDimensions} canReview busy={false} onApprove={() => {}} onReject={() => {}} />);

    expect(visibleText(html)).not.toContain("Medidas");
  });
});

describe("AiSuggestionsLive", () => {
  it("sin ai.review avisa que no puede revisar sugerencias", () => {
    const html = render(<AiSuggestionsLive canReview={false} />);

    expect(visibleText(html)).toContain("Su rol no puede revisar sugerencias de IA");
  });

  it("con ai.review avisa que está cargando antes de tener respuesta", () => {
    const html = render(<AiSuggestionsLive canReview />);

    expect(visibleText(html)).toContain("Cargando…");
  });
});
