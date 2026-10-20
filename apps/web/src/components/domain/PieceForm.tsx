"use client";

/**
 * Formulario de alta y edición de piezas (change `ficha-pieza-crud`, tareas 4.2 y 4.3; ADR-015).
 *
 * `react-hook-form` administra el estado (campos controlados con `Controller`, porque los
 * componentes de `components/ui` no reenvían `ref`); Zod (en `lib/forms/piece-form.ts`) solo
 * comprueba formato (campo vacío, valor del desplegable). Las reglas de negocio las devuelve el
 * servidor por `validatePiece`, con espera de ~400 ms y cancelación de la petición anterior
 * (`createPieceValidator`).
 *
 * 4.3: los errores (bloquean guardar) y avisos (no bloquean) del servidor se muestran junto al
 * campo que nombran (`lib/forms/piece-issues.ts`); un 409 de edición muestra
 * `PieceEditConflict` con la opción «Ver cambios del otro usuario»; y el borrador se conserva en
 * `sessionStorage` (`lib/forms/piece-draft.ts`).
 */
import { Save } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { PieceEditConflict, computeConflictChanges, type ConflictChange } from "@/components/domain/PieceEditConflict";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { createPieceValidator, type PieceIssue, type PieceUpdateResult } from "@/lib/data/pieces";
import { TENURE_REGIMES, pieceFormResolver, toCreateInput, type PieceFormValues } from "@/lib/forms/piece-form";
import {
  DRAFT_SAVE_DELAY_MS,
  clearDraft,
  draftKey,
  loadDraft,
  sameFormValues,
  saveDraft,
  type PieceDraft,
} from "@/lib/forms/piece-draft";
import { ALL_FORM_FIELDS, fieldMessages, groupIssuesByField, type GroupedIssues, type PieceFormField } from "@/lib/forms/piece-issues";

export type SaveOutcome =
  | { status: "ok"; message: string }
  | { status: "error"; message: string }
  /** El servidor rechazó la edición porque otra persona guardó antes (409 `edit_conflict`). */
  | { status: "conflict"; message: string };

/**
 * Traduce el resultado de `updatePiece` al `SaveOutcome` del formulario. Es una función pura (se
 * prueba sin DOM, ADR-012): el 409 `edit_conflict` pasa a `conflict` y no se confunde con el resto
 * de fallos (`rejected`, `unavailable`), que siguen siendo `error`.
 */
export function outcomeFromUpdate(result: PieceUpdateResult, okMessage: string): SaveOutcome {
  if (result.status === "ok") return { status: "ok", message: okMessage };
  if (result.status === "conflict") return { status: "conflict", message: result.message };
  return { status: "error", message: result.message };
}

export interface PieceFormProps {
  mode: "create" | "edit";
  /** Pieza en edición: se envía como `piece_id` a la validación. */
  pieceId?: string;
  initialValues: PieceFormValues;
  /** `updated_at` de la ficha abierta; se guarda con el borrador para avisar si luego cambió. */
  draftBase?: string | null;
  onSave: (values: PieceFormValues) => Promise<SaveOutcome>;
  /** Valores actuales de la ficha en el servidor, para «Ver cambios del otro usuario». */
  loadCurrentValues?: () => Promise<PieceFormValues | null>;
  onCancel: () => void;
}

/** Campos que cada modo muestra; una incidencia sobre otro campo va al resumen general. */
const VISIBLE_FIELDS: Record<"create" | "edit", readonly PieceFormField[]> = {
  create: ALL_FORM_FIELDS,
  edit: ["denomination", "description", "provenance", "dimensions_text", "notes"],
};

/** Error y ayuda de un campo: el error local (Zod) manda sobre el del servidor; los avisos van como ayuda. */
function feedbackFor(grouped: GroupedIssues, field: PieceFormField, localError?: string, baseHint?: ReactNode): { error?: string; hint?: ReactNode } {
  const { errors, warnings } = fieldMessages(grouped, field);
  return {
    error: localError ?? (errors.length > 0 ? errors.join(" ") : undefined),
    hint: warnings.length > 0 ? `Aviso: ${warnings.join(" ")}` : baseHint,
  };
}

export function PieceForm({ mode, pieceId, initialValues, draftBase = null, onSave, loadCurrentValues, onCancel }: PieceFormProps) {
  const storageKey = draftKey(mode === "create" ? { kind: "new" } : { kind: "edit", pieceId: pieceId ?? "" });

  // Un borrador igual a los valores de partida no aporta nada: se ignora.
  const [draft, setDraft] = useState<PieceDraft | null>(() => {
    const stored = loadDraft(storageKey);
    return stored && !sameFormValues(stored.values, initialValues) ? stored : null;
  });

  const form = useForm<PieceFormValues>({ resolver: pieceFormResolver, defaultValues: draft?.values ?? initialValues, mode: "onTouched" });
  const { control, handleSubmit, getValues, reset } = form;
  const { isDirty, isSubmitting } = form.formState;
  const values = useWatch({ control });

  const [validator] = useState(() => createPieceValidator());
  const [issues, setIssues] = useState<PieceIssue[]>([]);
  const [validationNote, setValidationNote] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const [conflict, setConflict] = useState<{ message: string } | null>(null);
  const [conflictChanges, setConflictChanges] = useState<ConflictChange[] | null>(null);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictLoading, setConflictLoading] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  useEffect(() => () => validator.cancel(), [validator]);

  // Valida con el servidor cada vez que cambia algún campo (el validador agrupa y cancela).
  // Con un borrador recuperado también se valida al abrir, aunque aún no haya cambios nuevos.
  useEffect(() => {
    if (!isDirty && !draft) return;
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
  }, [values, isDirty, draft, validator, getValues, pieceId]);

  // Borrador: se guarda mientras se escribe (con espera) y, además, justo antes de enviar.
  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => {
      saveDraft(storageKey, getValues(), draftBase);
    }, DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [values, isDirty, storageKey, getValues, draftBase]);

  const grouped = groupIssuesByField(issues, VISIBLE_FIELDS[mode]);
  const hasBlockingIssue = issues.some((issue) => issue.severity === "error");
  const draftIsStale = draft !== null && mode === "edit" && draft.base !== draftBase;

  const submit = handleSubmit(async (formValues) => {
    setSaveMessage(null);
    setConflict(null);
    saveDraft(storageKey, formValues, draftBase); // ADR-015 punto 5: antes del envío
    const outcome = await onSave(formValues);
    if (outcome.status === "ok") {
      clearDraft(storageKey);
      setDraft(null);
      reset(formValues);
      setSaveMessage({ kind: "ok", text: outcome.message });
    } else if (outcome.status === "conflict") {
      // El borrador se conserva: la persona puede recargar la ficha y recuperarlo.
      setConflict({ message: outcome.message });
      setConflictChanges(null);
      setConflictOpen(false);
      setConflictError(null);
    } else {
      setSaveMessage({ kind: "error", text: outcome.message });
    }
  });

  async function handleViewChanges() {
    if (conflictOpen) {
      setConflictOpen(false);
      return;
    }
    if (conflictChanges) {
      setConflictOpen(true);
      return;
    }
    if (!loadCurrentValues) {
      setConflictError("No se pueden consultar los cambios desde aquí. Recargue la ficha para ver la versión actual.");
      return;
    }
    setConflictLoading(true);
    setConflictError(null);
    let theirs: PieceFormValues | null = null;
    try {
      theirs = await loadCurrentValues();
    } catch {
      theirs = null;
    }
    setConflictLoading(false);
    if (!theirs) {
      setConflictError("No se pudo cargar la versión actual de la pieza. Recargue la página e intente de nuevo.");
      return;
    }
    // La base es la ficha tal como se abrió (`initialValues`), no el borrador recuperado.
    setConflictChanges(computeConflictChanges(initialValues, getValues(), theirs));
    setConflictOpen(true);
  }

  function discardDraft() {
    clearDraft(storageKey);
    setDraft(null);
    reset(initialValues);
    setIssues([]);
    setValidationNote(null);
  }

  return (
    <Card as="section" aria-label={mode === "create" ? "Formulario de alta de pieza" : "Formulario de edición"}>
      <form noValidate className="flex flex-col gap-4" onSubmit={submit}>
        {draft && (
          <div role="status" className="flex flex-col gap-2 rounded-lg border border-borde bg-crema p-3 text-base text-tinta">
            <p>
              Se recuperó un borrador sin guardar ({new Date(draft.savedAt).toLocaleString("es-PE")}).
              {draftIsStale && " La ficha cambió después de escribirlo: revise los datos antes de guardar."}
            </p>
            <div>
              <Button variant="secondary" onClick={discardDraft}>
                Descartar borrador
              </Button>
            </div>
          </div>
        )}

        {conflict && (
          <PieceEditConflict
            message={conflict.message}
            changes={conflictChanges}
            open={conflictOpen}
            loading={conflictLoading}
            loadError={conflictError}
            onViewChanges={handleViewChanges}
          />
        )}

        <Controller
          control={control}
          name="denomination"
          render={({ field, fieldState }) => {
            const feedback = feedbackFor(grouped, "denomination", fieldState.error?.message);
            return (
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
                error={feedback.error}
                hint={feedback.hint}
                className="p-2.5"
              />
            );
          }}
        />
        {mode === "create" && (
          <>
            <Controller
              control={control}
              name="tenure_regime"
              render={({ field, fieldState }) => {
                const feedback = feedbackFor(grouped, "tenure_regime", fieldState.error?.message);
                return (
                  <Select
                    id="tenure_regime"
                    label="Régimen de tenencia"
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={feedback.error}
                    hint={feedback.hint}
                    className="p-2.5"
                  >
                    {TENURE_REGIMES.map((regime) => (
                      <option key={regime} value={regime}>
                        {regime}
                      </option>
                    ))}
                  </Select>
                );
              }}
            />
            <Controller
              control={control}
              name="code_i"
              render={({ field, fieldState }) => {
                const feedback = feedbackFor(grouped, "code_i", fieldState.error?.message, "Déjelo vacío si la pieza aún no tiene código de inventario.");
                return (
                  <Input
                    id="code_i"
                    label="Código I (opcional)"
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={feedback.error}
                    hint={feedback.hint}
                    className="p-2.5"
                  />
                );
              }}
            />
          </>
        )}
        <Controller
          control={control}
          name="description"
          render={({ field, fieldState }) => {
            const feedback = feedbackFor(grouped, "description", fieldState.error?.message);
            return (
              <Textarea
                id="description"
                label="Descripción"
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={feedback.error}
                hint={feedback.hint}
                rows={3}
                className="p-2.5"
              />
            );
          }}
        />
        <Controller
          control={control}
          name="provenance"
          render={({ field, fieldState }) => {
            const feedback = feedbackFor(grouped, "provenance", fieldState.error?.message);
            return (
              <Input
                id="provenance"
                label="Procedencia"
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={feedback.error}
                hint={feedback.hint}
                className="p-2.5"
              />
            );
          }}
        />
        <Controller
          control={control}
          name="dimensions_text"
          render={({ field, fieldState }) => {
            const feedback = feedbackFor(grouped, "dimensions_text", fieldState.error?.message);
            return (
              <Input
                id="dimensions_text"
                label="Medidas (texto original)"
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={feedback.error}
                hint={feedback.hint}
                className="p-2.5"
              />
            );
          }}
        />
        <Controller
          control={control}
          name="notes"
          render={({ field, fieldState }) => {
            const feedback = feedbackFor(grouped, "notes", fieldState.error?.message);
            return (
              <Textarea
                id="notes"
                label="Observaciones"
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={feedback.error}
                hint={feedback.hint}
                rows={3}
                className="p-2.5"
              />
            );
          }}
        />

        {(grouped.general.length > 0 || validationNote) && (
          <div role="status" className="flex flex-col gap-2 rounded-lg border border-borde bg-crema p-3 text-base text-tinta">
            {validationNote && <p>{validationNote}</p>}
            {grouped.general.length > 0 && (
              <ul className="list-disc pl-5">
                {grouped.general.map((issue, index) => (
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
