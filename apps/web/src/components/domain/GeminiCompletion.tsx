"use client";

/**
 * Propuestas de Gemini dentro del panel «Completar ficha» (change `ia-completar-ficha`; RIA-01,
 * RIA-03, RN-009, RN-010):
 *
 * - Cada propuesta es una tarjeta en su campo, «Sugerido por Gemini», con su prueba: la cita de la
 *   ficha (resaltada en «Lo que ya dice la ficha») o «De la foto». Se acepta o se descarta; aceptar
 *   llena el campo y cambiar el valor después es corregirlo.
 * - Nada se guarda hasta «Guardar y siguiente», y solo lo aceptado (D3): `completionDecision` separa
 *   lo que va con la aprobación de la sugerencia (auditado como propuesto por la IA) de lo que la
 *   persona escribió por su cuenta (el `PUT` de siempre).
 */
import { Check, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { GeminiBadge, GeminiStar } from "@/components/ui/GeminiBadge";
import type { CompletionDecision, CompletionProposal, PieceCompletion } from "@/lib/data/ai";

export type ProposalState = "pending" | "accepted" | "discarded";
/** Los valores del panel (campos de la ficha), como los guarda `IncompleteTriage`. */
export type CompletionForm = { materials?: string[] } & { [field: string]: unknown };

/** «Gemini no encontró … en la ficha», con el artículo de cada campo. */
export const NOT_FOUND_LABELS: Record<string, string> = {
  category_id: "la categoría",
  materials: "los materiales",
  provenance: "la procedencia",
  epoch_original_text: "la época",
  dimensions_text: "las medidas",
  conservation_state_id: "el estado de conservación",
};

const TEXT_FIELD_LABELS: Record<string, string> = {
  description: "la descripción",
  notes: "las observaciones",
  denomination: "la denominación",
};

export function proposalKey(proposal: Pick<CompletionProposal, "field" | "value">): string {
  return `${proposal.field}:${proposal.value}`;
}

/** De dónde sale la propuesta, en llano. */
export function evidenceText(proposal: Pick<CompletionProposal, "evidence">): string {
  const { evidence } = proposal;
  if (evidence.source === "image") return "De la foto principal";
  return `De ${TEXT_FIELD_LABELS[evidence.text_field ?? "description"] ?? "la ficha"}`;
}

/** El texto partido en tramos, con las citas marcadas (la primera aparición de cada una). */
export function highlightQuotes(text: string, quotes: string[]): { text: string; mark: boolean }[] {
  const spans: [number, number][] = [];
  for (const quote of quotes) {
    if (!quote) continue;
    const start = text.indexOf(quote);
    if (start >= 0) spans.push([start, start + quote.length]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const parts: { text: string; mark: boolean }[] = [];
  let cursor = 0;
  for (const [start, end] of spans) {
    if (end <= cursor) continue;
    const from = Math.max(start, cursor);
    if (from > cursor) parts.push({ text: text.slice(cursor, from), mark: false });
    parts.push({ text: text.slice(from, end), mark: true });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), mark: false });
  return parts;
}

/**
 * Lo que va a la aprobación de la sugerencia al guardar (D3) y lo que no:
 * - aceptada y sin cambios, o con el texto corregido → aceptada (con el valor que quedó);
 * - aceptada pero luego se eligió otro término de la lista, o se vació → descartada (lo que quede
 *   en el campo es de la persona y va con el `PUT`);
 * - descartada o sin decidir → descartada: nunca se guarda una propuesta que no se aceptó.
 *
 * `handled` son los campos de la ficha que se guardan por la aprobación y `materialIds` los
 * materiales aceptados; ninguno de los dos va en el `PUT`.
 */
export function completionDecision(
  proposals: CompletionProposal[],
  states: Record<string, ProposalState>,
  form: CompletionForm,
): { decision: CompletionDecision; handled: Set<string>; materialIds: Set<string> } {
  const accepted: CompletionDecision["accepted"] = [];
  const discarded: CompletionDecision["discarded"] = [];
  const handled = new Set<string>();
  const materialIds = new Set<string>();
  for (const proposal of proposals) {
    if ((states[proposalKey(proposal)] ?? "pending") !== "accepted") {
      discarded.push(proposal.field);
      continue;
    }
    if (proposal.field === "materials") {
      if (proposal.term_id && (form.materials ?? []).includes(proposal.term_id)) {
        accepted.push({ field: proposal.field, value: proposal.value });
        materialIds.add(proposal.term_id);
      } else discarded.push(proposal.field);
      continue;
    }
    if (proposal.term_id) {
      if (form[proposal.piece_field] === proposal.term_id) {
        accepted.push({ field: proposal.field, value: proposal.value });
        handled.add(proposal.piece_field);
      } else discarded.push(proposal.field);
      continue;
    }
    const raw = form[proposal.piece_field];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value) {
      accepted.push({ field: proposal.field, value });
      handled.add(proposal.piece_field);
    } else discarded.push(proposal.field);
  }
  return { decision: { accepted, discarded: [...new Set(discarded)] }, handled, materialIds };
}

/** El formulario sin lo que se guarda por la aprobación de la sugerencia. */
export function withoutAccepted<F extends CompletionForm>(form: F, handled: Set<string>, materialIds: Set<string>): F {
  const rest: F = { ...form };
  for (const field of handled) delete rest[field];
  if (rest.materials) rest.materials = rest.materials.filter((id) => !materialIds.has(id));
  return rest;
}

/** Arriba del panel: Gemini leyendo, lo que propuso, o que no respondió. */
export function GeminiStatus({ state }: { state: { status: "loading" } | { status: "ready"; completion: PieceCompletion } | { status: "unavailable" } }) {
  if (state.status === "loading") {
    return (
      <p role="status" className="flex items-center gap-2 text-base font-semibold text-gris-texto">
        <GeminiStar size={20} className="motion-safe:animate-pulse" />
        Gemini está leyendo la ficha…
      </p>
    );
  }
  if (state.status === "unavailable") {
    return <p className="text-base text-gris-texto">Gemini no respondió. Complete los datos a mano.</p>;
  }
  const count = (state.completion.proposals ?? []).length;
  return (
    <div role="status" className="flex flex-col items-start gap-2">
      <GeminiBadge />
      <p className="text-base text-gris-texto">
        {count === 0
          ? "Gemini no encontró en la ficha los datos que faltan."
          : `Gemini propone ${count === 1 ? "1 dato" : `${count} datos`} leyendo solo esta ficha${state.completion.image_used ? " y su foto" : ""}. Nada se guarda hasta que lo acepte y pulse «Guardar y siguiente».`}
      </p>
    </div>
  );
}

/** «Lo que ya dice la ficha», con las citas de las propuestas resaltadas. */
export function PieceTextEvidence({ texts, quotes }: { texts: { label: string; text: string | null | undefined }[]; quotes: string[] }) {
  const shown = texts.filter((item): item is { label: string; text: string } => Boolean(item.text?.trim()));
  if (shown.length === 0 || quotes.length === 0) return null;
  return (
    <section aria-labelledby="lo-que-dice" className="flex flex-col gap-2 rounded-md border border-borde bg-crema-light p-3">
      <h3 id="lo-que-dice" className="text-base font-extrabold text-tinta">
        Lo que ya dice la ficha
      </h3>
      {shown.map((item) => (
        <div key={item.label} className="text-base text-tinta">
          <p className="font-semibold text-gris-texto">{item.label}</p>
          <p className="break-words whitespace-pre-line">
            {highlightQuotes(item.text, quotes).map((part, index) =>
              part.mark ? (
                <mark key={index} className="rounded-sm bg-ambar-bg px-0.5 font-semibold text-tinta">
                  {part.text}
                </mark>
              ) : (
                <span key={index}>{part.text}</span>
              ),
            )}
          </p>
        </div>
      ))}
    </section>
  );
}

/** Una propuesta en su campo: valor, prueba y Aceptar / Descartar (o Deshacer). */
export function GeminiProposalCard({
  proposal,
  state,
  onAccept,
  onDiscard,
  onUndo,
}: {
  proposal: CompletionProposal;
  state: ProposalState;
  onAccept: () => void;
  onDiscard: () => void;
  onUndo: () => void;
}) {
  if (state === "discarded") {
    return (
      <p className="flex flex-wrap items-center gap-x-2 text-base text-gris-texto">
        <span>
          Descartó «{proposal.label}», sugerido por Gemini.
        </span>
        <button type="button" onClick={onUndo} className="inline-flex min-h-11 items-center gap-1 font-semibold text-terracota underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota">
          <RotateCcw size={16} aria-hidden="true" />
          Volver a ver
        </button>
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-md border border-borde border-l-4 border-l-gemini-violeta bg-white p-3">
      <p className="flex items-center gap-1.5 text-base font-semibold text-gris-texto">
        <GeminiStar size={16} />
        {state === "accepted" ? "Aceptado de Gemini" : "Sugerido por Gemini"}
      </p>
      <p className="text-lg font-bold break-words text-tinta">{proposal.label}</p>
      <p className="text-base text-gris-texto">
        {evidenceText(proposal)}
        {proposal.evidence.source === "text" && proposal.evidence.quote && <>: «{proposal.evidence.quote}»</>}
      </p>
      <div className="flex flex-wrap gap-2">
        {state === "pending" ? (
          <>
            <Button size="sm" variant="secondary" icon={Check} onClick={onAccept}>
              Aceptar
            </Button>
            <Button size="sm" variant="neutral" icon={X} onClick={onDiscard}>
              Descartar
            </Button>
          </>
        ) : (
          <Button size="sm" variant="neutral" icon={RotateCcw} onClick={onUndo}>
            Deshacer
          </Button>
        )}
      </div>
    </div>
  );
}

/** Debajo de un campo que Gemini no encontró. */
export function GeminiNotFound({ field }: { field: string }) {
  return <p className="text-base text-gris-texto">Gemini no encontró {NOT_FOUND_LABELS[field] ?? "este dato"} en la ficha.</p>;
}
