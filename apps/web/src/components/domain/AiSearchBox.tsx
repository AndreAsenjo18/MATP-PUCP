"use client";

/**
 * Búsqueda con IA de la pantalla Búsqueda (change `busqueda-barra-compacta-ia`, D3; RIA-06): una caja
 * propia en la banda terracota, separada de «Código o nombre», con la insignia «Powered by Gemini», el
 * borde con su degradado, dictado por voz y el botón «Buscar con IA».
 *
 * Interpreta solo al enviar o al terminar de dictar. Una frase describe la búsqueda completa, así que
 * los filtros reconocidos **reemplazan** a los anteriores. Si la IA no responde, la frase pasa a la caja
 * de código como texto libre y se avisa, sin tocar los demás filtros. Nada se guarda (RN-009).
 */
import { useId, useState } from "react";

import { optionNames, useVoiceDictation, type SearchOptions } from "@/components/domain/SearchFilters";
import { GeminiBadge, GeminiStar } from "@/components/ui/GeminiBadge";
import { SearchPill } from "@/components/ui/SearchPill";
import { cn } from "@/lib/cn";
import { EMPTY_FILTERS, activeChips, interpretSearch, type SearchFilters } from "@/lib/data/search";

export const AI_SEARCH_HINT = "La IA convierte su frase en los filtros de abajo; puede quitarlos cuando quiera.";

type Phase =
  | { kind: "idle" }
  | { kind: "thinking" }
  | { kind: "applied"; summary: string; count: number }
  | { kind: "nothing" }
  | { kind: "unavailable" };

function statusText(phase: Phase): string {
  switch (phase.kind) {
    case "thinking":
      return "Gemini está interpretando su búsqueda…";
    case "applied":
      return `✓ ${phase.count} filtro${phase.count === 1 ? "" : "s"} aplicado${phase.count === 1 ? "" : "s"}: ${phase.summary}`;
    case "nothing":
      return "Gemini no reconoció filtros en esa frase; se buscó como texto.";
    case "unavailable":
      return "No se pudo interpretar la frase en este momento; se buscó como texto.";
    default:
      return AI_SEARCH_HINT;
  }
}

/**
 * Lo que la interpretación hace con los filtros: con algún filtro reconocido, los reemplaza todos;
 * sin ninguno (o sin IA), solo pone la frase como texto libre. Devuelve también las etiquetas aplicadas.
 */
export function applyInterpretation(
  current: SearchFilters,
  text: string,
  interpreted: Partial<SearchFilters> | null,
  names: Record<string, string> = {},
): { filters: SearchFilters; applied: string[] } {
  if (interpreted) {
    const next: SearchFilters = { ...EMPTY_FILTERS, ...interpreted };
    const applied = activeChips(next, names)
      .filter((chip) => chip.key !== "q")
      .map((chip) => `${chip.label} ${chip.value}`);
    if (applied.length > 0) return { filters: next, applied };
  }
  return { filters: { ...current, q: text.trim() }, applied: [] };
}

export function AiSearchBox({
  options,
  devUser,
  onFilters,
  onThinkingChange,
}: {
  options: SearchOptions;
  devUser?: string;
  /** Recibe una función que calcula los filtros nuevos a partir de los actuales. */
  onFilters: (update: (current: SearchFilters) => SearchFilters) => void;
  onThinkingChange?: (thinking: boolean) => void;
}) {
  const id = useId();
  const labelId = `${id}-titulo`;
  const statusId = `${id}-estado`;
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const thinking = phase.kind === "thinking";
  const voice = useVoiceDictation((transcript) => {
    setText(transcript);
    void run(transcript);
  });

  async function run(phrase: string) {
    if (thinking || !phrase.trim()) return;
    setPhase({ kind: "thinking" });
    onThinkingChange?.(true);
    const result = await interpretSearch(phrase, options, devUser);
    onThinkingChange?.(false);
    const interpreted = result.status === "ok" ? result.value : null;
    const names = optionNames(options);
    // Lo aplicado no depende de los filtros actuales: con filtros reconocidos se reemplazan todos.
    const { applied } = applyInterpretation(EMPTY_FILTERS, phrase, interpreted, names);
    onFilters((current) => applyInterpretation(current, phrase, interpreted, names).filters);
    if (!interpreted) setPhase({ kind: "unavailable" });
    else if (applied.length === 0) setPhase({ kind: "nothing" });
    else setPhase({ kind: "applied", summary: applied.join(" · "), count: applied.length });
  }

  return (
    <form
      role="search"
      aria-labelledby={labelId}
      className="flex max-w-2xl flex-col gap-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        void run(text);
      }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label id={labelId} htmlFor={id} className="text-lg font-bold">
          Pídalo con sus palabras
        </label>
        <GeminiBadge />
      </div>
      <SearchPill
        sobre="terracota"
        ia
        pensando={thinking}
        id={id}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="p. ej. «retablos del depósito 1»"
        aria-describedby={statusId}
        readOnly={thinking}
        onVoiceClick={voice.supported ? voice.toggle : undefined}
        voiceListening={voice.listening}
        submitLabel={
          <>
            <GeminiStar size={18} />
            Buscar con IA
          </>
        }
      />
      <p id={statusId} role="status" className={cn("text-base", phase.kind !== "idle" && "font-bold")}>
        {statusText(phase)}
      </p>
    </form>
  );
}
