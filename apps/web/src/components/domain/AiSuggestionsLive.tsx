"use client";

/**
 * Cola de revisión de sugerencias de IA, modo `live` (change `ia-extraccion-texto-libre`, tarea
 * 3.2; RIA-01, RN-009). Todas las sugerencias pendientes del sistema (no solo las de una pieza),
 * con el mismo aprobar/rechazar que la ficha. Requiere `ai.review`: quien solo puede pedir
 * sugerencias (`ai.request`) las revisa desde la propia ficha de la pieza.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AiSuggestionCard } from "@/components/domain/AiSuggestPanel";
import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { Card } from "@/components/ui/Card";
import {
  approveAiSuggestion,
  listPendingAiSuggestions,
  rejectAiSuggestion,
  type AiSuggestion,
  type ProposedField,
} from "@/lib/data/ai";

export function AiSuggestionsLive({ devUser, canReview }: { devUser?: string; canReview: boolean }) {
  const [suggestions, setSuggestions] = useState<AiSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const result = await listPendingAiSuggestions(devUser);
    if (result.status === "ok") {
      setSuggestions(result.value);
      setError(null);
    } else {
      setError(result.message);
    }
  }, [devUser]);

  useEffect(() => {
    let active = true;
    listPendingAiSuggestions(devUser).then((result) => {
      if (!active) return;
      if (result.status === "ok") {
        setSuggestions(result.value);
        setError(null);
      } else {
        setError(result.message);
      }
    });
    return () => {
      active = false;
    };
  }, [devUser]);

  async function handleApprove(suggestion: AiSuggestion, fields: ProposedField[], dimensionsText?: string) {
    setBusyId(suggestion.id);
    const result = await approveAiSuggestion(suggestion.id, fields, devUser, dimensionsText);
    setBusyId(null);
    if (result.status === "ok") await reload();
    else setError(result.message);
  }

  async function handleReject(suggestion: AiSuggestion, reason: string) {
    setBusyId(suggestion.id);
    const result = await rejectAiSuggestion(suggestion.id, reason, devUser);
    setBusyId(null);
    if (result.status === "ok") await reload();
    else setError(result.message);
  }

  if (!canReview) {
    return <PermissionNotice>Su rol no puede revisar sugerencias de IA. Pídalas desde la ficha de cada pieza si tiene permiso para solicitarlas.</PermissionNotice>;
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-tinta">Sugerencias de IA</h1>
        <p className="max-w-3xl text-base text-gris-texto">
          Propuestas de la IA pendientes de revisión, de cualquier pieza. Ninguna se aplica al catálogo sin que una persona la apruebe (RN-009).
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-md bg-carmin-bg px-3 py-2 text-base text-carmin-texto">
          {error}
        </p>
      )}

      {suggestions === null ? (
        <p className="text-base text-gris-texto">Cargando…</p>
      ) : suggestions.length === 0 ? (
        <Card className="border-dashed text-center text-base text-gris-texto">No hay sugerencias pendientes de revisión.</Card>
      ) : (
        <div className="flex flex-col gap-3">
          {suggestions.map((suggestion) => (
            <AiSuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              canReview={canReview}
              busy={busyId === suggestion.id}
              onApprove={(fields, dimensionsText) => handleApprove(suggestion, fields, dimensionsText)}
              onReject={(reason) => handleReject(suggestion, reason)}
              footer={
                suggestion.piece_id && (
                  <Link href={`/piezas/${suggestion.piece_id}`} className="text-sm text-terracota underline">
                    Ver la ficha de la pieza
                  </Link>
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
