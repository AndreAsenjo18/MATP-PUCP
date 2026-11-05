"use client";

/**
 * Sugerencias de IA en la ficha, modo `live` (change `ia-extraccion-texto-libre`, tarea 3.1;
 * RIA-01, RN-009). Pide una sugerencia sobre el texto de la pieza y, para quien tiene
 * `ai.review`, deja aprobar (con o sin editar los valores propuestos, p. ej. una medida) o
 * rechazar (con motivo) las pendientes de esta pieza — nunca escribe el catálogo por sí solo,
 * eso lo hace la API tras la aprobación. Al aprobar una medida, quien revisa puede además optar
 * por actualizar el texto libre de "Medidas" (`dimensions_text`) con su propia redacción —
 * decisión del equipo, 2026-11-04; la IA nunca lo toca por sí sola.
 */
import { Check, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { ConfirmButton } from "@/components/domain/ConfirmButton";
import { suggestionStatus } from "@/components/domain/status-intents";
import { StatusBadge } from "@/components/domain/StatusBadges";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  AI_SOURCE_FIELDS,
  FIELD_LABELS,
  approveAiSuggestion,
  dimensionsTextFrom,
  explanationOf,
  fieldValueText,
  fieldsOf,
  isDimensionField,
  listPendingAiSuggestions,
  rejectAiSuggestion,
  suggestCataloging,
  type AiSuggestion,
  type ProposedField,
} from "@/lib/data/ai";

export function AiSuggestPanel({
  pieceId,
  devUser,
  canRequest,
  canReview,
  onChanged,
}: {
  pieceId: string;
  devUser?: string;
  canRequest: boolean;
  canReview: boolean;
  /** Tras aprobar: la pieza cambió de verdad (medidas, conservación, observaciones) — quien la
   * muestra debe releerla, no solo esta lista de sugerencias. */
  onChanged?: () => void;
}) {
  const [sourceField, setSourceField] = useState(AI_SOURCE_FIELDS[0].value);
  const [requesting, setRequesting] = useState(false);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AiSuggestion[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const result = await listPendingAiSuggestions(devUser, pieceId);
    if (result.status === "ok") {
      setSuggestions(result.value);
      setListError(null);
    } else {
      setListError(result.message);
    }
  }, [devUser, pieceId]);

  useEffect(() => {
    let active = true;
    listPendingAiSuggestions(devUser, pieceId).then((result) => {
      if (!active) return;
      if (result.status === "ok") {
        setSuggestions(result.value);
        setListError(null);
      } else {
        setListError(result.message);
      }
    });
    return () => {
      active = false;
    };
  }, [devUser, pieceId]);

  async function handleSuggest() {
    setRequesting(true);
    setRequestMessage(null);
    const result = await suggestCataloging(pieceId, sourceField, devUser);
    setRequesting(false);
    if (result.status === "ok") {
      const fields = fieldsOf(result.value.output_data);
      setRequestMessage(fields.length === 0 ? explanationOf(result.value.output_data) : null);
      await reload();
    } else {
      setRequestMessage(result.message);
    }
  }

  async function handleApprove(suggestion: AiSuggestion, fields: ProposedField[], dimensionsText?: string) {
    setBusyId(suggestion.id);
    const result = await approveAiSuggestion(suggestion.id, fields, devUser, dimensionsText);
    setBusyId(null);
    if (result.status === "ok") {
      await reload();
      onChanged?.();
    } else {
      setListError(result.message);
    }
  }

  async function handleReject(suggestion: AiSuggestion, reason: string) {
    setBusyId(suggestion.id);
    const result = await rejectAiSuggestion(suggestion.id, reason, devUser);
    setBusyId(null);
    if (result.status === "ok") await reload();
    else setListError(result.message);
  }

  if (!canRequest && !canReview) return null;

  return (
    <Card as="section" aria-label="Sugerencias de IA" className="flex flex-col gap-4">
      <h3 className="text-base font-semibold text-tinta">Sugerencias de IA (RIA-01)</h3>

      {canRequest && (
        <div className="flex flex-wrap items-end gap-3">
          <Select label="Analizar el texto de" value={sourceField} onChange={(event) => setSourceField(event.target.value)} fieldClassName="min-w-0">
            {AI_SOURCE_FIELDS.map((field) => (
              <option key={field.value} value={field.value}>
                {field.label}
              </option>
            ))}
          </Select>
          <Button icon={Sparkles} onClick={handleSuggest} disabled={requesting}>
            {requesting ? "Analizando…" : "Sugerir datos desde el texto"}
          </Button>
        </div>
      )}
      {requestMessage && (
        <p role="status" className="text-sm text-gris-texto">
          {requestMessage}
        </p>
      )}

      {listError && (
        <p role="alert" className="text-sm text-carmin-texto">
          {listError}
        </p>
      )}

      {suggestions === null ? (
        <p className="text-sm text-gris-texto">Cargando…</p>
      ) : suggestions.length === 0 ? (
        <p className="text-sm text-gris-texto">Sin sugerencias pendientes para esta pieza.</p>
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
            />
          ))}
        </div>
      )}
    </Card>
  );
}

/**
 * Una sugerencia pendiente: lo que propuso la IA (con el fragmento de texto de origen) y, para
 * quien revisa, aprobar todo o rechazar con motivo. La usan la ficha (`AiSuggestPanel`) y la cola
 * de revisión (`AiSuggestionsLive`).
 */
export function AiSuggestionCard({
  suggestion,
  canReview,
  busy,
  onApprove,
  onReject,
  footer,
}: {
  suggestion: AiSuggestion;
  canReview: boolean;
  busy: boolean;
  onApprove: (fields: ProposedField[], dimensionsText?: string) => void;
  onReject: (reason: string) => void;
  /** Enlace a la pieza, cuando la tarjeta no está ya dentro de su ficha. */
  footer?: ReactNode;
}) {
  const original = fieldsOf(suggestion.output_data);
  // Copia editable: la persona revisora puede corregir un valor (p. ej. una medida) antes de
  // aprobar — lo que se aplica es esto, no lo que propuso la IA (design: "con edición").
  const [fields, setFields] = useState<ProposedField[]>(original);
  const hasDimensions = fields.some(isDimensionField);
  const [syncDimensionsText, setSyncDimensionsText] = useState(false);
  const [dimensionsText, setDimensionsText] = useState(() => dimensionsTextFrom(original));

  function updateDimension(index: number, patch: Partial<{ value: number; unit: string }>) {
    setFields((current) =>
      current.map((item, i) => (i === index && isDimensionField(item) ? { ...item, value: { ...item.value, ...patch } } : item)),
    );
  }

  function toggleSyncDimensionsText(checked: boolean) {
    setSyncDimensionsText(checked);
    if (checked) setDimensionsText(dimensionsTextFrom(fields));
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-terracota/30 bg-terracota-light/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-gris-texto">Proveedor: {suggestion.provider}</span>
        <StatusBadge status={suggestionStatus(suggestion.status)} />
      </div>
      {footer}
      {fields.length === 0 ? (
        <p className="text-sm text-gris-texto">{explanationOf(suggestion.output_data) ?? "La IA no propuso datos en esta solicitud."}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {fields.map((field, index) =>
            isDimensionField(field) ? (
              <li key={index} className="flex flex-wrap items-end gap-2 text-sm text-tinta">
                <span className="font-medium">{FIELD_LABELS.dimensions}: {field.value.dimension}</span>
                <Input
                  label="Valor"
                  type="number"
                  value={field.value.value}
                  disabled={!canReview}
                  onChange={(event) => updateDimension(index, { value: Number(event.target.value) })}
                  className="w-24"
                  fieldClassName="mb-0"
                />
                <Input
                  label="Unidad"
                  type="text"
                  value={field.value.unit}
                  disabled={!canReview}
                  onChange={(event) => updateDimension(index, { unit: event.target.value })}
                  className="w-20"
                  fieldClassName="mb-0"
                />
                {field.source_fragment && <span className="text-gris-texto">— propuesto desde «{field.source_fragment}»</span>}
              </li>
            ) : (
              <li key={index} className="text-sm text-tinta">
                <span className="font-medium">{FIELD_LABELS[field.field] ?? field.field}:</span> {fieldValueText(field)}
                {field.source_fragment && <span className="text-gris-texto"> — «{field.source_fragment}»</span>}
              </li>
            ),
          )}
        </ul>
      )}
      {canReview && hasDimensions && (
        <div className="flex flex-col gap-2 rounded-md border border-borde bg-white p-2">
          <label className="flex items-center gap-2 text-sm text-tinta">
            <input
              type="checkbox"
              checked={syncDimensionsText}
              onChange={(event) => toggleSyncDimensionsText(event.target.checked)}
            />
            Actualizar también el campo &quot;Medidas&quot; de la ficha con este texto
          </label>
          {syncDimensionsText && (
            <Input
              label="Medidas (texto)"
              value={dimensionsText}
              onChange={(event) => setDimensionsText(event.target.value)}
              hint="Editable: por ejemplo «35cmx20cm» en vez del formato propuesto."
              fieldClassName="mb-0"
            />
          )}
        </div>
      )}
      {canReview && (
        <div className="flex flex-wrap gap-2">
          {fields.length > 0 ? (
            <>
              <Button
                variant="primary"
                icon={Check}
                disabled={busy}
                onClick={() => onApprove(fields, syncDimensionsText ? dimensionsText : undefined)}
              >
                Aprobar
              </Button>
              <ConfirmButton
                label="Rechazar"
                variant="danger"
                icon={X}
                confirmTitle="Rechazar la sugerencia"
                confirmDescription="La sugerencia queda rechazada; el catálogo no cambia."
                requireReason
                reasonLabel="Motivo del rechazo"
                disabled={busy}
                onConfirm={onReject}
              />
            </>
          ) : (
            // Sin datos propuestos no hay nada que justificar: se descarta sin pedir motivo (RN-009
            // exige un motivo registrado, no que la persona lo escriba cuando no hay sobre qué opinar).
            <Button
              variant="danger"
              icon={X}
              disabled={busy}
              onClick={() => onReject("Sin datos propuestos por la IA.")}
            >
              Descartar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
