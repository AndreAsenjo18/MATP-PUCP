import { afterEach, describe, expect, it, vi } from "vitest";

import type { CompletionProposal, PieceCompletion } from "@/lib/data/ai";
import { render, visibleText } from "@/test/render";

import {
  completionDecision,
  evidenceText,
  GeminiNotFound,
  GeminiProposalCard,
  GeminiStatus,
  highlightQuotes,
  PieceTextEvidence,
  proposalKey,
  withoutAccepted,
} from "./GeminiCompletion";
import { asksGemini, IncompleteTriage } from "./IncompleteTriage";

// Spec ia-asistiva — Propuestas de IA para completar la ficha con su prueba (change
// `ia-completar-ficha`; RIA-01, RIA-03, RN-009). Datos sintéticos (RNF-014).

const DESCRIPTION = "Caja de resonancia de madera de cedro, elaborada en Ayacucho.";

function proposal(overrides: Partial<CompletionProposal>): CompletionProposal {
  return {
    field: "materials",
    piece_field: "materials",
    value: "MADERA",
    label: "Madera",
    term_id: "term-madera",
    confidence: 0.8,
    evidence: { source: "text", quote: "madera de cedro", text_field: "description" },
    ...overrides,
  };
}

const MADERA = proposal({});
const PROVENANCE = proposal({
  field: "provenance",
  piece_field: "provenance",
  value: "Ayacucho",
  label: "Ayacucho",
  term_id: null,
  evidence: { source: "text", quote: "elaborada en Ayacucho", text_field: "description" },
});
const CATEGORY = proposal({
  field: "category",
  piece_field: "category_id",
  value: "INSTRUMENTO_MUSICAL",
  label: "Instrumento musical",
  term_id: "term-instrumento",
  evidence: { source: "image", quote: null, text_field: null },
});

describe("la prueba de cada propuesta", () => {
  it("marca en el texto de la ficha las citas que existen, sin inventar ninguna", () => {
    expect(highlightQuotes(DESCRIPTION, ["madera de cedro", "no está en el texto"])).toEqual([
      { text: "Caja de resonancia de ", mark: false },
      { text: "madera de cedro", mark: true },
      { text: ", elaborada en Ayacucho.", mark: false },
    ]);
    expect(highlightQuotes(DESCRIPTION, [])).toEqual([{ text: DESCRIPTION, mark: false }]);
  });

  it("dice de dónde sale: de la descripción, de las observaciones o de la foto", () => {
    expect(evidenceText(MADERA)).toBe("De la descripción");
    expect(evidenceText(proposal({ evidence: { source: "text", quote: "x", text_field: "notes" } }))).toBe("De las observaciones");
    expect(evidenceText(CATEGORY)).toBe("De la foto principal");
  });

  it("«Lo que ya dice la ficha» resalta las citas", () => {
    const html = render(<PieceTextEvidence texts={[{ label: "Descripción", text: DESCRIPTION }]} quotes={["madera de cedro"]} />);
    expect(visibleText(html)).toContain("Lo que ya dice la ficha");
    expect(html).toMatch(/<mark[^>]*>madera de cedro<\/mark>/);
    expect(render(<PieceTextEvidence texts={[{ label: "Descripción", text: DESCRIPTION }]} quotes={[]} />)).toBe("");
  });
});

describe("tarjeta «Sugerido por Gemini»", () => {
  it("muestra el valor y la cita, con Aceptar y Descartar de 44 px", () => {
    const html = render(<GeminiProposalCard proposal={MADERA} state="pending" onAccept={() => {}} onDiscard={() => {}} onUndo={() => {}} />);
    const text = visibleText(html);
    expect(text).toContain("Sugerido por Gemini");
    expect(text).toContain("Madera");
    expect(text).toContain("De la descripción: «madera de cedro»");
    expect(text).toContain("Aceptar");
    expect(text).toContain("Descartar");
    expect(html.match(/min-h-11/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("aceptada se puede deshacer; descartada se puede volver a ver", () => {
    expect(visibleText(render(<GeminiProposalCard proposal={MADERA} state="accepted" onAccept={() => {}} onDiscard={() => {}} onUndo={() => {}} />))).toContain(
      "Aceptado de Gemini",
    );
    const discarded = visibleText(render(<GeminiProposalCard proposal={MADERA} state="discarded" onAccept={() => {}} onDiscard={() => {}} onUndo={() => {}} />));
    expect(discarded).toContain("Descartó «Madera»");
    expect(discarded).toContain("Volver a ver");
  });

  it("sin dato en la ficha lo dice con su nombre", () => {
    expect(visibleText(render(<GeminiNotFound field="epoch_original_text" />))).toBe("Gemini no encontró la época en la ficha.");
  });

  it("mientras lee lo avisa; luego lleva «Powered by Gemini»", () => {
    expect(visibleText(render(<GeminiStatus state={{ status: "loading" }} />))).toContain("Gemini está leyendo la ficha…");
    const completion = { proposals: [MADERA], not_found: [], fields: ["materials"], image_used: false, reused: false } as PieceCompletion;
    const ready = visibleText(render(<GeminiStatus state={{ status: "ready", completion }} />));
    expect(ready).toContain("Powered by Gemini");
    expect(ready).toContain("Nada se guarda hasta que lo acepte");
    expect(visibleText(render(<GeminiStatus state={{ status: "unavailable" }} />))).toContain("Complete los datos a mano");
  });
});

describe("qué se guarda al pulsar «Guardar y siguiente» (RN-009)", () => {
  const proposals = [MADERA, PROVENANCE, CATEGORY];

  it("una propuesta sin aceptar nunca se guarda, aunque se guarde la ficha", () => {
    const { decision, handled, materialIds } = completionDecision(proposals, {}, {});
    expect(decision.accepted).toEqual([]);
    expect(decision.discarded).toEqual(["materials", "provenance", "category"]);
    expect(handled.size).toBe(0);
    expect(materialIds.size).toBe(0);
  });

  it("aceptada va con la aprobación (origen IA); corregida, con el valor corregido", () => {
    const states = { [proposalKey(MADERA)]: "accepted", [proposalKey(PROVENANCE)]: "accepted", [proposalKey(CATEGORY)]: "discarded" } as const;
    const form = { materials: ["term-madera", "term-cuero"], provenance: "  Huamanga, Ayacucho ", category_id: "term-otra" };
    const { decision, handled, materialIds } = completionDecision(proposals, states, form);
    expect(decision.accepted).toEqual([
      { field: "materials", value: "MADERA" },
      { field: "provenance", value: "Huamanga, Ayacucho" },
    ]);
    expect(decision.discarded).toEqual(["category"]);
    // Lo aceptado no va en el PUT; lo que la persona eligió por su cuenta, sí.
    expect(withoutAccepted(form, handled, materialIds)).toEqual({ materials: ["term-cuero"], category_id: "term-otra" });
  });

  it("si tras aceptar elige otro término o vacía el campo, ya no es de Gemini", () => {
    const states = { [proposalKey(CATEGORY)]: "accepted", [proposalKey(PROVENANCE)]: "accepted" } as const;
    const { decision, handled } = completionDecision([CATEGORY, PROVENANCE], states, { category_id: "term-otra", provenance: "  " });
    expect(decision.accepted).toEqual([]);
    expect(decision.discarded).toEqual(["category", "provenance"]);
    expect(handled.size).toBe(0);
  });
});

describe("cuándo se le pregunta a Gemini", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("solo con permiso, con la API real y con algo que Gemini pueda probar", () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "live");
    expect(asksGemini({ missing_fields: ["materials"] }, true)).toBe(true);
    expect(asksGemini({ missing_fields: ["materials"] }, false)).toBe(false);
    // La colección y la descripción no salen de una cita de la ficha (D1).
    expect(asksGemini({ missing_fields: ["collection_id", "description"] }, true)).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "mock");
    expect(asksGemini({ missing_fields: ["materials"] }, true)).toBe(false);
  });

  it("en la demostración el panel es el de siempre, sin Gemini", () => {
    const text = visibleText(render(<IncompleteTriage canDownload canEdit canMove canUpload canUseAi />));
    expect(text).not.toContain("Gemini");
  });
});
