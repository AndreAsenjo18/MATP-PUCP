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
 * Design D8: el formulario va por secciones con etiquetas visibles — Identificación, Descripción,
 * Procedencia y época, Medidas y materiales, Conservación y Observaciones. Los campos son los de
 * `PieceCreate`/`PieceUpdate` que la persona escribe y que la ficha muestra (ver la cobertura en
 * `lib/forms/piece-form.ts`); lo derivado o de solo lectura (propietario legal, régimen al editar) se
 * muestra sin controles, y lo de otros changes (fotos, ubicación, auditoría, alertas, duplicados)
 * no se edita aquí.
 *
 * 4.3: los errores (bloquean guardar) y avisos (no bloquean) del servidor se muestran junto al
 * campo que nombran (`lib/forms/piece-issues.ts`); un 409 de edición muestra
 * `PieceEditConflict` con la opción «Ver cambios del otro usuario»; y el borrador se conserva en
 * `sessionStorage` (`lib/forms/piece-draft.ts`).
 */
import { Save } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Controller, useForm, useWatch, type Control } from "react-hook-form";

import { PieceEditConflict, computeConflictChanges, type ConflictChange } from "@/components/domain/PieceEditConflict";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import {
  createPieceValidator,
  fetchPieceCatalogs,
  initialPieceCatalogs,
  type PieceFormCatalogs,
  type PieceIssue,
  type PieceUpdateResult,
  type TermOption,
} from "@/lib/data/pieces";
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
  /** Propietario legal de la ficha (solo lectura: el contrato de escritura no lo incluye, RN-006). Solo en edición. */
  legalOwner?: string | null;
  /** `PieceDetail.masked_fields`: datos restringidos para el rol, que no se muestran ni se editan. */
  maskedFields?: readonly string[];
  onCancel: () => void;
}

/** Campos que cada modo muestra; una incidencia sobre otro campo va al resumen general. */
const VISIBLE_FIELDS: Record<"create" | "edit", readonly PieceFormField[]> = {
  create: ALL_FORM_FIELDS,
  edit: [
    "denomination",
    "collection_id",
    "category_id",
    "object_type_term_id",
    "availability_term_id",
    "lender_name",
    "loan_agreement_ref",
    "description",
    "author",
    "provenance",
    "period_text",
    "acquisition_method_term_id",
    "entry_date",
    "dimensions_text",
    "material_term_ids",
    "conservation_state_id",
    "notes",
  ],
};

/** Campos de texto del formulario (los que se pintan con `Input` o `Textarea`). */
type TextFieldName =
  | "denomination"
  | "code_i"
  | "lender_name"
  | "loan_agreement_ref"
  | "description"
  | "author"
  | "provenance"
  | "period_text"
  | "entry_date"
  | "dimensions_text"
  | "notes";

/** Campos que se eligen de una lista de catálogo (un solo valor); sus opciones salen de `PieceFormCatalogs`. */
type ChoiceFieldName = "collection_id" | "category_id" | "object_type_term_id" | "availability_term_id" | "acquisition_method_term_id";

/** Error y ayuda de un campo: el error local (Zod) manda sobre el del servidor; los avisos van como ayuda. */
function feedbackFor(grouped: GroupedIssues, field: PieceFormField, localError?: string, baseHint?: ReactNode): { error?: string; hint?: ReactNode } {
  const { errors, warnings } = fieldMessages(grouped, field);
  return {
    error: localError ?? (errors.length > 0 ? errors.join(" ") : undefined),
    hint: warnings.length > 0 ? `Aviso: ${warnings.join(" ")}` : baseHint,
  };
}

/** Una sección del editor (design D8): título visible y sus campos. */
function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border border-borde p-4">
      <legend className="px-2 text-lg font-semibold text-tinta">{title}</legend>
      {children}
    </fieldset>
  );
}

/** Campo de texto de una línea o de varias (`rows`), con el error local y los mensajes del servidor. */
/** Asterisco de campo obligatorio; la leyenda del formulario lo explica en texto (RNF-010). */
function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-carmin-texto">
      *
    </span>
  );
}

function RequiredLabel({ children }: { children: ReactNode }) {
  return (
    <>
      {children} <RequiredMark />
    </>
  );
}

function TextControl({
  control,
  grouped,
  name,
  label,
  rows,
  hint,
  type,
  required,
}: {
  control: Control<PieceFormValues>;
  grouped: GroupedIssues;
  name: TextFieldName;
  label: ReactNode;
  rows?: number;
  hint?: ReactNode;
  /** Tipo de `<input>` (p. ej. `date` para la fecha de ingreso); se ignora si hay `rows`. */
  type?: string;
  /** Campo que el servidor exige para guardar: lleva asterisco y `aria-required`. */
  required?: boolean;
}) {
  const shownLabel = required ? <RequiredLabel>{label}</RequiredLabel> : label;
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const feedback = feedbackFor(grouped, name, fieldState.error?.message, hint);
        if (rows !== undefined) {
          return (
            <Textarea
              id={name}
              label={shownLabel}
              aria-required={required || undefined}
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={feedback.error}
              hint={feedback.hint}
              rows={rows}
              className="p-2.5"
            />
          );
        }
        return (
          <Input
            id={name}
            label={shownLabel}
            aria-required={required || undefined}
            name={field.name}
            type={type}
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
  );
}

/**
 * Lista desplegable de un campo de catálogo (colección, categoría, tipo de bien, disponibilidad,
 * forma de adquisición). Si el valor actual de la ficha no está en la lista (catálogo aún sin
 * cargar o término dado de baja) se conserva como opción, para no mostrar «Sin registrar» ni perderlo.
 */
function ChoiceControl({
  control,
  grouped,
  name,
  label,
  options,
  emptyLabel,
  baseHint,
}: {
  control: Control<PieceFormValues>;
  grouped: GroupedIssues;
  name: ChoiceFieldName;
  label: ReactNode;
  options: readonly TermOption[];
  emptyLabel: string;
  baseHint?: ReactNode;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const feedback = feedbackFor(grouped, name, fieldState.error?.message, baseHint);
        const known = field.value === "" || options.some((option) => option.id === field.value);
        return (
          <Select
            id={name}
            label={label}
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={feedback.error}
            hint={feedback.hint}
            className="p-2.5"
          >
            <option value="">{emptyLabel}</option>
            {!known && <option value={field.value}>Valor actual de la ficha</option>}
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        );
      }}
    />
  );
}

/** Dato que se muestra pero no se edita (derivado o fijado por el servidor), con su explicación. */
function ReadOnlyFact({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-base font-medium text-tinta">{label}</span>
      <p className="rounded-lg border border-borde bg-crema p-2.5 text-base text-tinta">{value}</p>
      {hint && <p className="text-sm text-gris-texto">{hint}</p>}
    </div>
  );
}

export function PieceForm({
  mode,
  pieceId,
  initialValues,
  draftBase = null,
  onSave,
  loadCurrentValues,
  legalOwner = null,
  maskedFields = [],
  onCancel,
}: PieceFormProps) {
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

  // Listas de materiales y estados de conservación (en modo mock ya vienen en el primer render).
  const [catalogs, setCatalogs] = useState<PieceFormCatalogs>(() => initialPieceCatalogs());
  const [catalogNote, setCatalogNote] = useState<string | null>(null);

  const [conflict, setConflict] = useState<{ message: string } | null>(null);
  const [conflictChanges, setConflictChanges] = useState<ConflictChange[] | null>(null);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictLoading, setConflictLoading] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  useEffect(() => () => validator.cancel(), [validator]);

  useEffect(() => {
    let active = true;
    void fetchPieceCatalogs().then((result) => {
      if (!active) return;
      if (result.status === "ok") {
        setCatalogs(result.catalogs);
        setCatalogNote(null);
      } else {
        setCatalogNote(result.message);
      }
    });
    return () => {
      active = false;
    };
  }, []);

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

  // Comodante y convenio solo existen con régimen Comodato, y no se muestran si el rol no puede verlos (RF-041).
  const regime = values.tenure_regime ?? initialValues.tenure_regime;
  const showLender = regime === "Comodato" && !maskedFields.includes("lender_name");
  const showLoanAgreement = regime === "Comodato" && !maskedFields.includes("loan_agreement_ref");

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
    setConflictChanges(computeConflictChanges(initialValues, getValues(), theirs, catalogs));
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

        <p className="text-sm text-gris-texto">
          Los campos marcados con <span className="text-carmin-texto">*</span> son obligatorios; el resto puede completarse después.
        </p>

        <FormSection title="Identificación">
          <TextControl
            control={control}
            grouped={grouped}
            name="denomination"
            label="Denominación"
            required
          />
          {mode === "create" ? (
            <>
              <Controller
                control={control}
                name="tenure_regime"
                render={({ field, fieldState }) => {
                  const feedback = feedbackFor(grouped, "tenure_regime", fieldState.error?.message);
                  return (
                    <Select
                      id="tenure_regime"
                      label={<RequiredLabel>Régimen de tenencia</RequiredLabel>}
                      aria-required
                      name={field.name}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      error={feedback.error}
                      hint={feedback.hint}
                      className="p-2.5"
                    >
                      {TENURE_REGIMES.map((tenure) => (
                        <option key={tenure} value={tenure}>
                          {tenure}
                        </option>
                      ))}
                    </Select>
                  );
                }}
              />
              <TextControl
                control={control}
                grouped={grouped}
                name="code_i"
                label="Código I (opcional)"
                hint="Déjelo vacío si la pieza aún no tiene código de inventario."
              />
            </>
          ) : (
            <ReadOnlyFact label="Régimen de tenencia" value={regime} hint="No se modifica desde este formulario." />
          )}
          <ChoiceControl
            control={control}
            grouped={grouped}
            name="collection_id"
            label="Colección"
            options={catalogs.collections}
            emptyLabel="Sin colección (pieza suelta)"
            baseHint={catalogNote ?? undefined}
          />
          <ChoiceControl control={control} grouped={grouped} name="category_id" label="Categoría" options={catalogs.categories} emptyLabel="Sin registrar" />
          <ChoiceControl control={control} grouped={grouped} name="object_type_term_id" label="Tipo de bien" options={catalogs.objectTypes} emptyLabel="Sin registrar" />
          <ChoiceControl control={control} grouped={grouped} name="availability_term_id" label="Disponibilidad" options={catalogs.availabilities} emptyLabel="Sin registrar" />
          {showLender && <TextControl control={control} grouped={grouped} name="lender_name" label="Comodante" />}
          {showLoanAgreement && <TextControl control={control} grouped={grouped} name="loan_agreement_ref" label="Convenio de comodato" />}
          {mode === "edit" && (
            <ReadOnlyFact
              label="Propietario legal"
              value={legalOwner ?? "PUCP"}
              hint="Lo fija el sistema según el régimen de tenencia; no se edita aquí."
            />
          )}
        </FormSection>

        <FormSection title="Descripción">
          <TextControl control={control} grouped={grouped} name="description" label="Descripción" rows={3} />
          <TextControl control={control} grouped={grouped} name="author" label="Autor" />
        </FormSection>

        <FormSection title="Procedencia y época">
          <TextControl control={control} grouped={grouped} name="provenance" label="Procedencia" />
          <TextControl control={control} grouped={grouped} name="period_text" label="Época (texto original)" />
          <ChoiceControl
            control={control}
            grouped={grouped}
            name="acquisition_method_term_id"
            label="Forma de adquisición"
            options={catalogs.acquisitionMethods}
            emptyLabel="Sin registrar"
          />
          <TextControl
            control={control}
            grouped={grouped}
            name="entry_date"
            type="date"
            label="Fecha de ingreso"
            hint="Formato año-mes-día. Déjela vacía si no se conoce."
          />
        </FormSection>

        <FormSection title="Medidas y materiales">
          <TextControl control={control} grouped={grouped} name="dimensions_text" label="Medidas (texto original)" />
          <Controller
            control={control}
            name="material_term_ids"
            render={({ field }) => {
              const feedback = feedbackFor(grouped, "material_term_ids");
              return (
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-base font-medium text-tinta">Materiales</legend>
                  {catalogs.materials.length === 0 ? (
                    <p className="text-sm text-gris-texto">{catalogNote ?? "No hay materiales en la lista."}</p>
                  ) : (
                    <div className="grid gap-x-6 sm:grid-cols-2">
                      {catalogs.materials.map((option) => {
                        const checked = field.value.includes(option.id);
                        return (
                          <label key={option.id} className="flex min-h-11 items-center gap-2 text-base text-tinta">
                            <input
                              type="checkbox"
                              className="h-5 w-5 accent-terracota"
                              name={field.name}
                              value={option.id}
                              checked={checked}
                              onChange={() => field.onChange(checked ? field.value.filter((id) => id !== option.id) : [...field.value, option.id])}
                              onBlur={field.onBlur}
                            />
                            {option.label}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {feedback.error && (
                    <p role="alert" className="text-sm font-medium text-carmin-texto">
                      {feedback.error}
                    </p>
                  )}
                  {feedback.hint && <p className="text-sm text-gris-texto">{feedback.hint}</p>}
                </fieldset>
              );
            }}
          />
        </FormSection>

        <FormSection title="Conservación">
          <Controller
            control={control}
            name="conservation_state_id"
            render={({ field, fieldState }) => {
              const feedback = feedbackFor(grouped, "conservation_state_id", fieldState.error?.message);
              return (
                <Select
                  id="conservation_state_id"
                  label="Estado de conservación"
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={feedback.error}
                  hint={feedback.hint}
                  className="p-2.5"
                >
                  <option value="">Sin registrar</option>
                  {catalogs.conservationStates.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              );
            }}
          />
        </FormSection>

        <FormSection title="Observaciones">
          <TextControl control={control} grouped={grouped} name="notes" label="Observaciones" rows={3} />
        </FormSection>

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
