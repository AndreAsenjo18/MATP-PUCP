"use client";

/**
 * Pantalla 8 — Sugerencias de la IA (RIA-01..05). La cola vive en
 * `components/domain/AiSuggestionsQueue` (change `revisar-pendientes-unificado`, tarea 1.3); esta
 * página exige la sesión y la monta igual que antes. `useSearchParams` (para `?resaltar=`) va
 * dentro de `Suspense`.
 */
import { Suspense } from "react";

import { AiSuggestionsQueue } from "@/components/domain/AiSuggestionsQueue";
import { RequireSession } from "@/components/layout/RequireSession";

export default function SugerenciasIaPage() {
  return (
    <RequireSession>
      <Suspense fallback={null}>
        <AiSuggestionsQueue />
      </Suspense>
    </RequireSession>
  );
}
