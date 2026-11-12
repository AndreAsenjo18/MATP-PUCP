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
 *
 * `crud-manual-completo` D4: en el alta, «Guardar y registrar otra» abre un formulario nuevo con los
 * datos repetibles (`lib/forms/piece-copy.ts`), avisando de dónde vienen y resaltándolos hasta que se tocan.
 */
import { ChevronRight, CopyPlus, Save } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Controller, useForm, useWatch, type Control } from "react-hook-form";

import { DestinationPicker } from "@/components/domain/DestinationPicker";
import { PieceEditConflict, computeConflictChanges, type ConflictChange } from "@/components/domain/PieceEditConflict";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { DestinationOption } from "@/lib/data/locations";
import {
  createPieceValidator,
  fetchPieceCatalogs,
  initialPieceCatalogs,
  type PieceFormCatalogs,
  type PieceIssue,
  type PieceUpdateResult,
  type TermOption,
} from "@/lib/data/pieces";
import type { PieceCopy } from "@/lib/forms/piece-copy";
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

/** «another»: la persona pidió seguir registrando; quien guarda no debe abrir la ficha. */
export type SaveIntent = "open" | "another";

export interface PieceFormProps {
  mode: "create" | "edit";
  /** Pieza en edición: se envía como `piece_id` a la validación. */
  pieceId?: string;
  initialValues: PieceFormValues;
  /** `updated_at` de la ficha abierta; se guarda con el borrador para avisar si luego cambió. */
  draftBase?: string | null;
  onSave: (values: PieceFormValues, intent: SaveIntent) => Promise<SaveOutcome>;
  /** Con él aparece «Guardar y registrar otra»; se llama con lo guardado, ya limpio el borrador. */
  onRegisterAnother?: (saved: PieceFormValues) => Promise<void> | void;
  /** Datos copiados de otra pieza que trae `initialValues`. */
  copy?: PieceCopy | null;
  /** Listas ya cargadas al comprobar esos datos; sin ellas, el formulario las pide. */
  initialCatalogs?: PieceFormCatalogs;
  /** Lugares para la ubicación inicial, en el alta; sin ellos (rol sin permiso de mover) no se ofrece. */
  destinations?: readonly DestinationOption[] | null;
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

/** Ubica los errores de validación en la tarjeta pertinente cuando está contraída. */
const EDIT_FIELD_SECTION: Partial<Record<PieceFormField, string>> = {
  denomination: "identification",
  collection_id: "identification",
  category_id: "identification",
  object_type_term_id: "identification",
  availability_term_id: "identification",
  lender_name: "identification",
  loan_agreement_ref: "identification",
  description: "description",
  author: "description",
  provenance: "provenance",
  period_text: "provenance",
  acquisition_method_term_id: "provenance",
  entry_date: "provenance",
  dimensions_text: "materials",
  material_term_ids: "materials",
  conservation_state_id: "conservation",
  notes: "notes",
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
  | "recorded_by"
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

/** Un dato copiado se resalta hasta que la persona lo toca, y lo dice en texto: el color no basta (RNF-010). */
function CopiedMark({ copied, children }: { copied: boolean; children: ReactNode }) {
  if (!copied) return <>{children}</>;
  return (
    <div data-copied="true" className="flex flex-col gap-1 border-l-4 border-terracota pl-3">
      <span className="text-sm font-medium text-gris-texto">Copiado</span>
      {children}
    </div>
  );
}

/** Tarjeta por sección. En edición los campos siguen montados al cerrar la tarjeta:
 * react-hook-form conserva así el borrador y las validaciones mientras la persona navega.
 * En el alta conserva el diseño original, con todas las secciones abiertas.
 */
function FormSection({
  title,
  children,
  editMode = false,
  expanded = true,
  onToggle,
  description,
  sectionId,
}: {
  title: string;
  children: ReactNode;
  editMode?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  description?: string;
  sectionId?: string;
}) {
  return (
    <fieldset className={editMode ? "rounded-lg border border-borde bg-white" : "flex flex-col gap-4 rounded-lg border border-borde p-4"}>
      <legend className={editMode ? "sr-only" : "px-2 text-lg font-semibold text-tinta"}>{title}</legend>
      {editMode && sectionId && (
        <button
          type="button"
          data-matp-piece-accordion="true"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={sectionId + "-fields"}
          className="flex min-h-14 w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-lg font-semibold text-tinta hover:bg-crema-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-crema" aria-hidden="true">
            <ChevronRight size={22} className={expanded ? "rotate-90 transition-transform" : "transition-transform"} />
          </span>
          <span className="flex-1">{title}</span>
          {description && <span className="sr-only">. {description}</span>}
        </button>
      )}
      <div
        id={sectionId ? sectionId + "-fields" : undefined}
        className={!editMode || expanded ? (editMode ? "flex flex-col gap-4 px-4 pb-4" : "flex flex-col gap-4") : "hidden"}
      >
        {children}
      </div>
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
  copied = false,
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
  copied?: boolean;
}) {
  const shownLabel = required ? <RequiredLabel>{label}</RequiredLabel> : label;
  return (
    <CopiedMark copied={copied}>
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
    </CopiedMark>
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
  copied = false,
}: {
  control: Control<PieceFormValues>;
  grouped: GroupedIssues;
  name: ChoiceFieldName;
  label: ReactNode;
  options: readonly TermOption[];
  emptyLabel: string;
  baseHint?: ReactNode;
  copied?: boolean;
}) {
  return (
    <CopiedMark copied={copied}>
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
    </CopiedMark>
  );
}

/** Dato que se muestra pero no se edita (derivado o fijado por el servidor), con su explicación. */
function ReadOnlyFact({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-base font-medium text-tinta">{label}</span>
      <p className="border-l-2 border-borde py-1 pl-3 text-base text-tinta">{value}</p>
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
  onRegisterAnother,
  copy = null,
  initialCatalogs,
  destinations = null,
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
  const { isDirty, isSubmitting, dirtyFields, touchedFields } = form.formState;
  const values = useWatch({ control });

  // La persona puede editar solo la tarjeta que necesita. Las demás permanecen
  // en el DOM, ocultas, para no descartar lo escrito al pasar entre secciones.
  const [expandedSections, setExpandedSections] = useState<ReadonlySet<string>>(() => new Set<string>());
  const toggleSection = (sectionId: string) => {
    setExpandedSections((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };
  const editSection = (sectionId: string, description: string) => ({
    editMode: mode === "edit",
    expanded: expandedSections.has(sectionId),
    onToggle: () => toggleSection(sectionId),
    description,
    sectionId,
  });

  const [validator] = useState(() => createPieceValidator());
  const [issues, setIssues] = useState<PieceIssue[]>([]);
  const [validationNote, setValidationNote] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  // Listas de materiales y estados de conservación (en modo mock ya vienen en el primer render).
  const [catalogs, setCatalogs] = useState<PieceFormCatalogs>(() => initialCatalogs ?? initialPieceCatalogs());
  const [catalogNote, setCatalogNote] = useState<string | null>(null);

  const [conflict, setConflict] = useState<{ message: string } | null>(null);
  const [conflictChanges, setConflictChanges] = useState<ConflictChange[] | null>(null);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictLoading, setConflictLoading] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  useEffect(() => () => validator.cancel(), [validator]);

  useEffect(() => {
    if (initialCatalogs) return;
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
  }, [initialCatalogs]);

  // Valida con el servidor cada vez que cambia algún campo (el validador agrupa y cancela).
  // Con un borrador recuperado también se valida al abrir, aunque aún no haya cambios nuevos.
  useEffect(() => {
    if (!isDirty && !draft) return;
    let active = true;
    void validator.validate(toCreateInput(getValues()), { pieceId }).then((outcome) => {
      if (!active) return;
      if (outcome.status === "ok") {
        setIssues(outcome.result.issues);
        if (mode === "edit") {
          const affected = outcome.result.issues
            .filter((issue) => issue.severity === "error")
            .map((issue) => EDIT_FIELD_SECTION[issue.field as PieceFormField])
            .filter((section): section is string => Boolean(section));
          if (affected.length > 0) {
            setExpandedSections((current) => new Set([...current, ...affected]));
          }
        }
        setValidationNote(null);
      } else if (outcome.status !== "aborted") {
        setIssues([]);
        setValidationNote(outcome.message);
      }
    });
    return () => {
      active = false;
    };
  }, [values, isDirty, draft, validator, getValues, pieceId, mode]);

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

  // Un borrador recuperado ya no son los datos copiados: su aviso explica cómo volver a ellos.
  const showCopy = copy !== null && draft === null;
  const untouched = (field: PieceFormField) => !dirtyFields[field] && !touchedFields[field];
  const isCopied = (field: PieceFormField) => showCopy && copy.fields.includes(field) && untouched(field);
  const droppedNotice = (field: PieceFormField) => (showCopy && untouched(field) ? copy.dropped[field] : undefined);

  const saveWith = (intent: SaveIntent) => handleSubmit(async (formValues) => {
    setSaveMessage(null);
    setConflict(null);
    saveDraft(storageKey, formValues, draftBase); // ADR-015 punto 5: antes del envío
    const outcome = await onSave(formValues, intent);
    if (outcome.status === "ok") {
      clearDraft(storageKey);
      if (intent === "another" && onRegisterAnother) {
        await onRegisterAnother(formValues);
        return;
      }
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
  }, () => {
    // Denominación es obligatoria: si se cerró su tarjeta, abrirla para mostrar
    // el error que react-hook-form acaba de encontrar.
    if (mode === "edit") setExpandedSections((current) => new Set([...current, "identification"]));
  });
  const submit = saveWith("open");

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
              {copy && ` Descártelo para usar los datos copiados de ${copy.source}.`}
            </p>
            <div>
              <Button variant="secondary" onClick={discardDraft}>
                Descartar borrador
              </Button>
            </div>
          </div>
        )}

        {showCopy && (
          <div role="status" className="flex flex-col gap-1 rounded-lg border border-borde bg-crema p-3 text-base text-tinta">
            <p>Datos copiados de {copy.source}. Revise que correspondan a esta pieza: los marcados como «Copiado» siguen sin tocar. No se copian códigos, fotos ni historial.</p>
            {Object.keys(copy.dropped).length > 0 && <p>Algunos datos copiados ya no están disponibles y quedaron vacíos: vea el aviso junto a cada campo.</p>}
            {copy.unchecked && <p>No se pudo comprobar que los datos copiados sigan vigentes: el sistema los revisará al guardar.</p>}
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

        {mode === "edit" ? (
          <div className="rounded-lg border border-borde bg-crema-light p-4">
            <p className="text-base font-semibold text-tinta">Cómo editar</p>
            <p className="mt-2 text-base text-gris-texto">
              Abra las secciones que necesite. Puede abrir varias a la vez; lo escrito se conserva al cerrarlas.
              Los campos marcados con * son obligatorios.
            </p>
          </div>
        ) : (
          <p className="text-base text-gris-texto">
            Los campos marcados con <span className="text-carmin-texto">*</span> son obligatorios; el resto puede completarse después.
          </p>
        )}

        <FormSection title="Identificación" {...editSection("identification", "Denominación, colección, clasificación y disponibilidad.")}>
          <TextControl
            control={control}
            grouped={grouped}
            name="denomination"
            label="Denominación"
            required
            copied={isCopied("denomination")}
          />
          {mode === "create" ? (
            <>
              <CopiedMark copied={isCopied("tenure_regime")}>
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
              </CopiedMark>
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
            baseHint={droppedNotice("collection_id") ?? catalogNote ?? undefined}
            copied={isCopied("collection_id")}
          />
          <ChoiceControl control={control} grouped={grouped} name="category_id" label="Categoría" options={catalogs.categories} emptyLabel="Sin registrar" baseHint={droppedNotice("category_id")} copied={isCopied("category_id")} />
          <ChoiceControl control={control} grouped={grouped} name="object_type_term_id" label="Tipo de bien" options={catalogs.objectTypes} emptyLabel="Sin registrar" baseHint={droppedNotice("object_type_term_id")} copied={isCopied("object_type_term_id")} />
          <ChoiceControl control={control} grouped={grouped} name="availability_term_id" label="Disponibilidad" options={catalogs.availabilities} emptyLabel="Sin registrar" />
          {showLender && <TextControl control={control} grouped={grouped} name="lender_name" label="Comodante" copied={isCopied("lender_name")} />}
          {showLoanAgreement && <TextControl control={control} grouped={grouped} name="loan_agreement_ref" label="Convenio de comodato" copied={isCopied("loan_agreement_ref")} />}
          {mode === "edit" && (
            <ReadOnlyFact
              label="Propietario legal"
              value={legalOwner ?? "PUCP"}
              hint="Lo fija el sistema según el régimen de tenencia; no se edita aquí."
            />
          )}
        </FormSection>

        <FormSection title="Descripción" {...editSection("description", "Descripción y autor de la pieza.")}>
          <TextControl control={control} grouped={grouped} name="description" label="Descripción" rows={3} copied={isCopied("description")} />
          <TextControl control={control} grouped={grouped} name="author" label="Autor" copied={isCopied("author")} />
        </FormSection>

        <FormSection title="Procedencia y época" {...editSection("provenance", "Procedencia, época, adquisición y fecha de ingreso.")}>
          <TextControl control={control} grouped={grouped} name="provenance" label="Procedencia" copied={isCopied("provenance")} />
          <TextControl control={control} grouped={grouped} name="period_text" label="Época (texto original)" copied={isCopied("period_text")} />
          <ChoiceControl
            control={control}
            grouped={grouped}
            name="acquisition_method_term_id"
            label="Forma de adquisición"
            options={catalogs.acquisitionMethods}
            emptyLabel="Sin registrar"
            baseHint={droppedNotice("acquisition_method_term_id")}
            copied={isCopied("acquisition_method_term_id")}
          />
          <TextControl
            control={control}
            grouped={grouped}
            name="entry_date"
            type="date"
            label="Fecha de ingreso"
            hint="Seleccione la fecha en el calendario. Puede dejarla vacía si no se conoce."
            copied={isCopied("entry_date")}
          />
          {mode === "create" && <TextControl control={control} grouped={grouped} name="recorded_by" label="Registrado por" copied={isCopied("recorded_by")} />}
          {mode === "create" && destinations && (
            <CopiedMark copied={isCopied("initial_location_id")}>
              <Controller
                control={control}
                name="initial_location_id"
                render={({ field }) => (
                  <div className="flex flex-col gap-1" onBlur={field.onBlur}>
                    <DestinationPicker options={destinations} value={field.value} onChange={field.onChange} label="Ubicación inicial" emptyLabel="Sin ubicación por ahora" />
                    {droppedNotice("initial_location_id") && <p className="text-sm text-gris-texto">{droppedNotice("initial_location_id")}</p>}
                  </div>
                )}
              />
            </CopiedMark>
          )}
        </FormSection>

        <FormSection title="Medidas y materiales" {...editSection("materials", "Dimensiones y materiales de la pieza.")}>
          <TextControl control={control} grouped={grouped} name="dimensions_text" label="Medidas (texto original)" copied={isCopied("dimensions_text")} />
          <Controller
            control={control}
            name="material_term_ids"
            render={({ field }) => {
              const feedback = feedbackFor(grouped, "material_term_ids", undefined, droppedNotice("material_term_ids"));
              return (
                <CopiedMark copied={isCopied("material_term_ids")}>
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
                </CopiedMark>
              );
            }}
          />
        </FormSection>

        <FormSection title="Conservación" {...editSection("conservation", "Estado de conservación consignado en la ficha.")}>
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

        <FormSection title="Observaciones" {...editSection("notes", "Notas y observaciones adicionales.")}>
          <TextControl control={control} grouped={grouped} name="notes" label="Observaciones" rows={3} copied={isCopied("notes")} />
        </FormSection>

        {mode === "edit" && (
          <aside className="rounded-lg border border-borde bg-white p-4">
            <p className="text-base font-semibold text-tinta">Otras acciones de la ficha</p>
            <p className="mt-2 text-base text-gris-texto">
              Para agregar identificadores, subir fotografías o registrar evaluaciones de conservación,
              vuelva a la ficha de la pieza. Estas acciones se guardan por separado.
            </p>
          </aside>
        )}

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

        <div className={mode === "edit"
          ? "sticky bottom-0 z-10 -mx-3 flex flex-wrap items-center gap-3 border-t border-borde bg-crema-light px-3 py-3 shadow-md"
          : "flex flex-wrap items-center gap-3 border-t border-borde pt-4"}>
          <Button type="submit" icon={Save} disabled={isSubmitting || hasBlockingIssue}>
            {mode === "create" ? "Registrar pieza" : "Guardar cambios"}
          </Button>
          {onRegisterAnother && (
            <Button variant="outline" icon={CopyPlus} disabled={isSubmitting || hasBlockingIssue} onClick={saveWith("another")}>
              Guardar y registrar otra
            </Button>
          )}
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
