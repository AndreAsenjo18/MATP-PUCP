"use client";

/**
 * Cola de revisión de sugerencias de IA, modo `live` (change `ia-extraccion-texto-libre`, tarea
 * 3.2; RIA-01, RN-009). Todas las sugerencias pendientes del sistema (no solo las de una pieza).
 * Requiere `ai.review`. Las sugerencias llegan por `carga-masiva-con-ia` (una por fila) o por el
 * endpoint `suggest-cataloging` (sin UI propia desde el change `retirar-sugerencias-ia-ficha`).
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AiSuggestionCard } from "@/components/domain/AiSuggestionCard";
import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { Card } from "@/components/ui/Card";
import {
  approveAiSuggestion,
  listPendingAiSuggestions,
  rejectAiSuggestion,
  type AiSuggestion,
  type ProposedField,
} from "@/lib/data/ai";

export function AiSuggestionsLive({
  devUser,
  canReview,
  embedded = false,
  onQueueChanged,
}: {
  devUser?: string;
  canReview: boolean;
  /** Dentro de la bandeja «Revisar pendientes» se omite el encabezado (change `revisar-pendientes-unificado`, 1.3). */
  embedded?: boolean;
  /** Se llama tras aprobar o rechazar con éxito, para que la bandeja recalcule su contador. */
  onQueueChanged?: () => void;
}) {
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
    if (result.status === "ok") {
      await reload();
      onQueueChanged?.();
    }
    else setError(result.message);
  }

  async function handleReject(suggestion: AiSuggestion, reason: string) {
    setBusyId(suggestion.id);
    const result = await rejectAiSuggestion(suggestion.id, reason, devUser);
    setBusyId(null);
    if (result.status === "ok") {
      await reload();
      onQueueChanged?.();
    }
    else setError(result.message);
  }

  if (!canReview) {
    return <PermissionNotice>Su rol no puede revisar sugerencias de IA.</PermissionNotice>;
  }

  return (
    <div className="flex flex-col gap-5">
      {!embedded && (
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-tinta">Sugerencias de IA</h1>
          <p className="max-w-3xl text-base text-gris-texto">
            Propuestas de la IA pendientes de revisión, de cualquier pieza. Ninguna se aplica al catálogo sin que una persona la apruebe (RN-009).
          </p>
        </header>
      )}

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
