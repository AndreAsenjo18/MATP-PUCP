import { afterEach, describe, expect, it, vi } from "vitest";

import type { AiSuggestion } from "@/lib/data/ai";
import { ids } from "@/lib/fixtures";
import { render, visibleText } from "@/test/render";

import { AiSuggestionCard, AiSuggestPanel } from "./AiSuggestPanel";
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

describe("AiSuggestPanel", () => {
  it("sin ai.request ni ai.review no muestra nada", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const html = render(<AiSuggestPanel pieceId={PIECE} canRequest={false} canReview={false} />);

    expect(html).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("con ai.request muestra el selector de campo y el botón de pedir sugerencia", () => {
    const html = render(<AiSuggestPanel pieceId={PIECE} canRequest canReview={false} />);
    const text = visibleText(html);

    expect(text).toContain("Sugerir datos desde el texto");
    expect(text).toContain("Analizar el texto de");
  });

  it("antes de tener respuesta de la cola, avisa que está cargando", () => {
    const html = render(<AiSuggestPanel pieceId={PIECE} canRequest={false} canReview />);

    expect(visibleText(html)).toContain("Cargando…");
  });
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

  it("con datos propuestos sí pide motivo para rechazar", () => {
    const withFields: AiSuggestion = {
      ...EMPTY_SUGGESTION,
      output_data: { fields: [{ field: "conservation_status", value: "BUENO", source_fragment: "bueno", confidence: 0.9 }] },
    };
    const html = render(<AiSuggestionCard suggestion={withFields} canReview busy={false} onApprove={() => {}} onReject={() => {}} />);
    const text = visibleText(html);

    expect(text).toContain("Aprobar todo");
    expect(text).toContain("Motivo del rechazo");
    expect(text).not.toContain("Descartar");
  });
});

describe("AiSuggestionsLive", () => {
  it("sin ai.review explica que la revisión se hace desde la ficha", () => {
    const html = render(<AiSuggestionsLive canReview={false} />);

    expect(visibleText(html)).toContain("Su rol no puede revisar sugerencias de IA");
  });

  it("con ai.review avisa que está cargando antes de tener respuesta", () => {
    const html = render(<AiSuggestionsLive canReview />);

    expect(visibleText(html)).toContain("Cargando…");
  });
});
