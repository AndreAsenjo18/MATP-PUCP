"use client";

/**
 * Formulario de alta y edición de piezas (change `ficha-pieza-crud`, tarea 4.2; ADR-015).
 *
 * `react-hook-form` administra el estado (campos controlados con `Controller`, porque los
 * componentes de `components/ui` no reenvían `ref`); Zod (en `lib/forms/piece-form.ts`) solo
 * comprueba formato (campo vacío, valor del desplegable). Las reglas de negocio las devuelve el
 * servidor por `validatePiece`, con espera de ~400 ms y cancelación de la petición anterior
 * (`createPieceValidator`). Los avisos del servidor se listan bajo el formulario; ubicarlos junto
 * a cada campo, el conflicto 409 y el borrador en `sessionStorage` son la tarea 4.3.
 */
import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { createPieceValidator, type PieceIssue } from "@/lib/data/pieces";
import { TENURE_REGIMES, pieceFormResolver, toCreateInput, type PieceFormValues } from "@/lib/forms/piece-form";

export type SaveOutcome = { status: "ok"; message: string } | { status: "error"; message: string };

export interface PieceFormProps {
  mode: "create" | "edit";
  /** Pieza en edición: se envía como `piece_id` a la validación. */
  pieceId?: string;
  initialValues: PieceFormValues;
  onSave: (values: PieceFormValues) => Promise<SaveOutcome>;
  onCancel: () => void;
}

export function PieceForm({ mode, pieceId, initialValues, onSave, onCancel }: PieceFormProps) {
  const form = useForm<PieceFormValues>({ resolver: pieceFormResolver, defaultValues: initialValues, mode: "onTouched" });
  const { control, handleSubmit, getValues } = form;
  const { isDirty, isSubmitting } = form.formState;
  const values = useWatch({ control });

  const [validator] = useState(() => createPieceValidator());
  const [issues, setIssues] = useState<PieceIssue[]>([]);
  const [validationNote, setValidationNote] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => () => validator.cancel(), [validator]);

  // Valida con el servidor cada vez que cambia algún campo (el validador agrupa y cancela).
  useEffect(() => {
    if (!isDirty) return;
    let active = true;
    void validator.validate(toCreateInput(getValues()), { pieceId }).then((outcome) => {
      if (!active) return;
      if (outcome.status === "ok") {
        setIssues(outcome.result.issues);
        setValidationNote(null);
      } else if (outcome.status !== "aborted") {
        setIssues([]);
        setValidationNote(outcome.message);
      }
    });
    return () => {
      active = false;
    };
  }, [values, isDirty, validator, getValues, pieceId]);

  const hasBlockingIssue = issues.some((issue) => issue.severity === "error");

  const submit = handleSubmit(async (formValues) => {
    setSaveMessage(null);
    const outcome = await onSave(formValues);
    setSaveMessage({ kind: outcome.status === "ok" ? "ok" : "error", text: outcome.message });
  });

  return (
    <Card as="section" aria-label={mode === "create" ? "Formulario de alta de pieza" : "Formulario de edición"}>
      <form noValidate className="flex flex-col gap-4" onSubmit={submit}>
        <Controller
          control={control}
          name="denomination"
          render={({ field, fieldState }) => (
            <Input
              id="denomination"
              label={
                <>
                  Denominación <span className="text-carmin-texto">*</span>
                </>
              }
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              className="p-2.5"
            />
          )}
        />
        {mode === "create" && (
          <>
            <Controller
              control={control}
              name="tenure_regime"
              render={({ field, fieldState }) => (
                <Select
                  id="tenure_regime"
                  label="Régimen de tenencia"
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  className="p-2.5"
                >
                  {TENURE_REGIMES.map((regime) => (
                    <option key={regime} value={regime}>
                      {regime}
                    </option>
                  ))}
                </Select>
              )}
            />
            <Controller
              control={control}
              name="code_i"
              render={({ field, fieldState }) => (
                <Input
                  id="code_i"
                  label="Código I (opcional)"
                  hint="Déjelo vacío si la pieza aún no tiene código de inventario."
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  className="p-2.5"
                />
              )}
            />
          </>
        )}
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <Textarea id="description" label="Descripción" name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} rows={3} className="p-2.5" />
          )}
        />
        <Controller
          control={control}
          name="provenance"
          render={({ field }) => (
            <Input id="provenance" label="Procedencia" name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} className="p-2.5" />
          )}
        />
        <Controller
          control={control}
          name="dimensions_text"
          render={({ field }) => (
            <Input
              id="dimensions_text"
              label="Medidas (texto original)"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              className="p-2.5"
            />
          )}
        />
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <Textarea id="notes" label="Observaciones" name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} rows={3} className="p-2.5" />
          )}
        />

        {(issues.length > 0 || validationNote) && (
          <div role="status" className="flex flex-col gap-2 rounded-lg border border-borde bg-crema p-3 text-base text-tinta">
            {validationNote && <p>{validationNote}</p>}
            {issues.length > 0 && (
              <ul className="list-disc pl-5">
                {issues.map((issue, index) => (
                  <li key={`${issue.field}-${issue.code}-${index}`}>
                    <strong>{issue.severity === "error" ? "Error" : "Aviso"}:</strong> {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-borde pt-4">
          <Button type="submit" icon={Save} disabled={isSubmitting || hasBlockingIssue}>
            {mode === "create" ? "Registrar pieza" : "Guardar cambios"}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          {saveMessage && (
            <span role="status" className={saveMessage.kind === "ok" ? "text-base font-medium text-verde-exito" : "text-base font-medium text-carmin-texto"}>
              {saveMessage.text}
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}
