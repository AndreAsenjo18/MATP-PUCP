"use client";

/**
 * Carga masiva con IA (change carga-masiva-con-ia, tareas 2 y 3): dentro de cada fila de la
 * revisión, pide bajo demanda (D3) la extracción de IA del texto libre sin mapear de esa fila y,
 * si es una actualización, compara cada dato contra el valor vigente de la pieza (D4) — vigente o
 * propuesto, con un clic, y editable para cuando la IA leyó mal el texto (D1). Nada se guarda en
 * el catálogo aquí (RN-009): "Guardar" solo deja los valores elegidos en la fila; se aplican
 * recién al aprobar el lote (D6).
 */
import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  FIELD_LABELS,
  explanationOf,
  fieldValueText,
  fieldsOf,
  isDimensionField,
  setRowAiFields,
  suggestRowAiFields,
  type AiSuggestion,
  type ProposedField,
} from "@/lib/data/ai";
import type { ImportRow } from "@/lib/data/imports";

interface FieldWithCurrent extends ProposedField {
  current_value?: unknown;
}

function currentValueText(field: FieldWithCurrent): string {
  if (field.current_value === undefined || field.current_value === null) return "(sin dato)";
  return fieldValueText({ field: field.field, value: field.current_value });
}

export function ImportRowAiSuggestions({
  row,
  batchId,
  devUser,
  bulkRequestSignal,
}: {
  row: ImportRow;
  batchId: string;
  devUser?: string;
  /** Se incrementa desde "Pedir sugerencias de IA para estas filas" (LiveImportWizard): cada
   * fila visible pide la suya en paralelo, en vez de una por una. */
  bulkRequestSignal?: number;
}) {
  const savedAiFields = (row.resolution as { ai_fields?: Record<string, unknown> } | null)?.ai_fields ?? null;
  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null);
  const [fields, setFields] = useState<FieldWithCurrent[]>([]);
  const [included, setIncluded] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  async function request() {
    setLoading(true);
    setError(null);
    setSavedOk(false);
    const result = await suggestRowAiFields(batchId, row.id, devUser);
    setLoading(false);
    if (result.status !== "ok") return setError(result.message);
    setSuggestion(result.value);
    const proposed = fieldsOf(result.value.output_data) as FieldWithCurrent[];
    setFields(proposed);
    setIncluded(Object.fromEntries(proposed.map((_, i) => [i, true])));
  }

  const lastBulkSignal = useRef(bulkRequestSignal);
  useEffect(() => {
    if (bulkRequestSignal === undefined || bulkRequestSignal === lastBulkSignal.current) return;
    lastBulkSignal.current = bulkRequestSignal;
    if (suggestion || loading) return;
    // setTimeout, no para esperar, sino para que el setState de request() quede en una
    // macrotarea aparte y no dentro del cuerpo síncrono del efecto (react-hooks/set-state-in-effect).
    const id = setTimeout(() => void request(), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkRequestSignal]);

  function updateValue(index: number, value: unknown) {
    setFields((current) => current.map((item, i) => (i === index ? { ...item, value } : item)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const payload: Record<string, unknown> = {};
    fields.forEach((field, i) => {
      payload[field.field] = included[i] ? field.value : null;
    });
    const result = await setRowAiFields(batchId, row.id, payload, devUser);
    setSaving(false);
    if (result.status !== "ok") return setError(result.message);
    setSavedOk(true);
  }

  return (
    <section className="flex flex-col gap-2 rounded-md border border-terracota/30 bg-terracota-light/10 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-medium text-tinta">
          <Sparkles className="size-4 text-terracota" aria-hidden="true" />
          Sugerencias de IA
        </span>
        {savedAiFields && Object.keys(savedAiFields).length > 0 && !suggestion && (
          <span className="text-xs text-gris-texto">Ya hay valores de IA guardados en esta fila.</span>
        )}
        {!suggestion && (
          <Button type="button" variant="secondary" disabled={loading} onClick={() => void request()}>
            {loading ? "Analizando…" : "Pedir sugerencias de IA"}
          </Button>
        )}
      </div>

      {error && <p className="text-carmin-texto">{error}</p>}

      {suggestion && (
        <>
          <details className="text-xs text-gris-texto">
            <summary className="cursor-pointer">Ver el texto analizado</summary>
            <p className="mt-1 whitespace-pre-wrap rounded bg-white p-2">{String((suggestion.input_data as { text?: string }).text ?? "")}</p>
          </details>

          {fields.length === 0 ? (
            <p className="text-gris-texto">{explanationOf(suggestion.output_data) ?? "La IA no propuso datos nuevos para esta fila."}</p>
          ) : (
            <>
              <div className="hidden grid-cols-[auto_minmax(8rem,1fr)_2fr_2fr] gap-x-3 pb-1 text-xs font-medium text-gris-texto sm:grid">
                <span />
                <span>Campo</span>
                <span>Vigente en la pieza</span>
                <span>Propuesto por la IA (editable)</span>
              </div>
              <ul className="flex flex-col divide-y divide-terracota/20">
                {fields.map((field, index) => (
                  <li key={index} className="grid grid-cols-1 items-start gap-2 py-2 first:pt-0 sm:grid-cols-[auto_minmax(8rem,1fr)_2fr_2fr]">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-terracota"
                      checked={included[index] ?? true}
                      onChange={(event) => setIncluded({ ...included, [index]: event.target.checked })}
                      aria-label={`Aplicar ${FIELD_LABELS[field.field] ?? field.field}`}
                    />
                    <span className="font-medium text-tinta">{FIELD_LABELS[field.field] ?? field.field}</span>
                    <span className="break-words text-gris-texto">{currentValueText(field)}</span>
                    {isDimensionField(field) ? (
                      <span className="flex flex-wrap items-end gap-2">
                        <Input
                          label="Valor"
                          type="number"
                          value={field.value.value}
                          onChange={(event) => updateValue(index, { ...field.value, value: Number(event.target.value) })}
                          className="w-20"
                          fieldClassName="mb-0"
                        />
                        <Input
                          label="Unidad"
                          type="text"
                          value={field.value.unit}
                          onChange={(event) => updateValue(index, { ...field.value, unit: event.target.value })}
                          className="w-16"
                          fieldClassName="mb-0"
                        />
                      </span>
                    ) : (
                      <Input
                        label=""
                        type="text"
                        value={typeof field.value === "string" ? field.value : JSON.stringify(field.value)}
                        onChange={(event) => updateValue(index, event.target.value)}
                        fieldClassName="mb-0"
                      />
                    )}
                    {field.source_fragment && <span className="col-span-full text-xs text-gris-texto">Propuesto desde: «{field.source_fragment}»</span>}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2">
                <Button type="button" disabled={saving} onClick={() => void save()}>
                  {saving ? "Guardando…" : "Guardar valores de IA"}
                </Button>
                {savedOk && <span className="text-sm text-bosque-texto">Guardado. Se aplicará al aprobar el lote.</span>}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
