"use client";

/**
 * Asistente de fusión de dos piezas duplicadas (change `deteccion-duplicados-y-cola-revision`, tarea
 * 4.2; design D4; spec calidad-datos, «Fusión con elección de valores y reasignación de datos
 * relacionados»). Tres pasos dentro de un diálogo:
 *
 * 1. `MergeSurvivorStep`: qué pieza se conserva. Avisa los bloqueos (regímenes de tenencia distintos,
 *    códigos I vigentes distintos) y, si solo una pieza tiene código I vigente, solo deja conservar
 *    esa (RN-002).
 * 2. `MergeFieldsStep`: el valor de cada campo en conflicto (`field_choices`); los campos vacíos de la
 *    conservada se completan con los de la absorbida.
 * 3. `MergeSummaryStep`: qué pasa a la conservada, qué se queda en la absorbida y el motivo
 *    obligatorio antes de confirmar.
 *
 * Es presentacional: recibe las dos fichas y la acción (`Promise<DialogOutcome>`) y no llama a la API.
 * Las reglas están en `lib/data/merge-plan` y la API vuelve a validarlas al fusionar. Se monta solo
 * mientras está abierto, así cada apertura empieza desde el primer paso.
 */
import { ArrowLeft, ArrowRight, GitMerge } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import type { ApiSchemas } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import {
  MERGE_ROWS,
  defaultSurvivorId,
  fieldChoicesFor,
  identifierFates,
  materialFates,
  mergeBlock,
  mergeReasonError,
  mergedPeriodError,
  rowState,
  sheetChanges,
  survivorRestriction,
  type FieldChoices,
  type MergeBlock,
  type RowPicks,
} from "@/lib/data/merge-plan";

import { useSubmit } from "./DuplicateReview";
import type { DialogOutcome } from "./PieceActionDialogs";
import { TenureBadge } from "./StatusBadges";

type PieceDetail = ApiSchemas["PieceDetail"];
type DuplicateCandidate = ApiSchemas["DuplicateCandidateOut"];

export interface MergeSubmission {
  survivingPieceId: string;
  fieldChoices: FieldChoices;
  note: string;
}

export const MERGE_STEPS = ["Pieza que se conserva", "Valores de la ficha", "Resumen y confirmación"] as const;
export type MergeStep = 1 | 2 | 3;

/** «Pieza A» o «Pieza B» según su lugar en el par. */
export type PieceTitles = Record<string, string>;

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

const RADIO_STYLES = "mt-1 h-5 w-5 shrink-0 accent-terracota focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota";

function optionClassName(checked: boolean, disabled = false): string {
  return cn(
    "flex gap-3 rounded-md border p-3 text-base text-tinta",
    checked ? "border-terracota bg-terracota-light" : "border-borde bg-white",
    disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
  );
}

// ---------------------------------------------------------------------------------------------
// Paso 1: pieza que se conserva
// ---------------------------------------------------------------------------------------------

export function MergeSurvivorStep({
  pieceA,
  pieceB,
  survivingId,
  block,
  onChange,
}: {
  pieceA: PieceDetail;
  pieceB: PieceDetail;
  survivingId: string;
  block: MergeBlock | null;
  onChange: (pieceId: string) => void;
}) {
  const name = useId();
  if (block) {
    return (
      <div className="flex flex-col gap-2">
        <p role="alert" className="rounded-md bg-carmin-bg p-3 text-base text-carmin-texto">
          <strong>No se puede fusionar este par.</strong> {block.message}
        </p>
        <p className="text-sm text-gris-texto">El par sigue en la cola: puede marcarlo como distinto o posponerlo mientras se corrige.</p>
      </div>
    );
  }
  const options: [string, PieceDetail][] = [
    ["Pieza A", pieceA],
    ["Pieza B", pieceB],
  ];
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-base font-semibold text-tinta">¿Qué pieza se conserva?</legend>
      <p className="text-sm text-gris-texto">
        La otra queda fusionada en la que elija: no se borra, se da de baja lógica y su ficha enlaza a la conservada (RN-005).
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map(([title, piece]) => {
          const restriction = survivorRestriction(piece.id, pieceA, pieceB);
          const checked = survivingId === piece.id;
          const noteId = `${name}-${piece.id}`;
          return (
            <label key={piece.id} className={optionClassName(checked, Boolean(restriction))}>
              <input
                type="radio"
                name={name}
                value={piece.id}
                checked={checked}
                disabled={Boolean(restriction)}
                aria-describedby={restriction ? noteId : undefined}
                onChange={() => onChange(piece.id)}
                className={RADIO_STYLES}
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="font-semibold">
                  {title}: {piece.denomination}
                </span>
                <span className="font-mono text-sm font-bold text-terracota">{piece.code_i ? `Código I ${piece.code_i}` : "Sin código I"}</span>
                <span className="flex flex-wrap items-center gap-2 text-sm text-gris-texto">
                  <TenureBadge regime={piece.tenure_regime} />
                  {piece.collection?.name ?? "Sin colección"}
                </span>
                <span className="text-sm text-gris-texto">
                  {plural(piece.identifiers.length, "identificador vigente", "identificadores vigentes")} ·{" "}
                  {plural(piece.media_count, "fotografía", "fotografías")}
                </span>
                {restriction && (
                  <span id={noteId} className="text-sm font-medium text-carmin-texto">
                    {restriction}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------------------------
// Paso 2: valores de la ficha
// ---------------------------------------------------------------------------------------------

export function MergeFieldsStep({
  surviving,
  absorbed,
  titles,
  picks,
  onPick,
}: {
  surviving: PieceDetail;
  absorbed: PieceDetail;
  titles: PieceTitles;
  picks: RowPicks;
  onPick: (rowKey: string, pieceId: string) => void;
}) {
  const name = useId();
  const rows = MERGE_ROWS.map((row) => ({ row, state: rowState(row, surviving, absorbed) }));
  const conflicts = rows.filter((r) => r.state === "conflict");
  const fills = rows.filter((r) => r.state === "fill");
  const masked = rows.filter((r) => r.state === "masked");
  const unchanged = rows.filter((r) => r.state === "same").length;
  const periodError = mergedPeriodError(surviving, absorbed, fieldChoicesFor(picks, surviving, absorbed));

  return (
    <div className="flex flex-col gap-4">
      {conflicts.length === 0 ? (
        <p className="text-base text-tinta">Las dos fichas no tienen valores en conflicto: no hay nada que elegir.</p>
      ) : (
        <p className="text-base text-tinta">
          Elija qué valor queda en cada campo en conflicto ({conflicts.length}). Si no cambia nada, queda el de «{surviving.denomination}», que se
          conserva.
        </p>
      )}
      {conflicts.map(({ row }) => {
        const picked = picks[row.key] ?? surviving.id;
        return (
          <fieldset key={row.key} className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-tinta">{row.label}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {[surviving, absorbed].map((piece) => (
                <label key={piece.id} className={optionClassName(picked === piece.id)}>
                  <input
                    type="radio"
                    name={`${name}-${row.key}`}
                    value={piece.id}
                    checked={picked === piece.id}
                    onChange={() => onPick(row.key, piece.id)}
                    className={RADIO_STYLES}
                  />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="break-words">{row.display(piece)}</span>
                    <span className="text-sm text-gris-texto">
                      {titles[piece.id]} · {piece.id === surviving.id ? "se conserva" : "se absorbe"}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
      {periodError && (
        <p role="alert" className="rounded-md bg-carmin-bg p-3 text-sm text-carmin-texto">
          {periodError}
        </p>
      )}
      {fills.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-tinta">Se completan con «{absorbed.denomination}» (la conservada no los tiene)</h3>
          <ul className="flex flex-col gap-1 text-sm text-tinta">
            {fills.map(({ row }) => (
              <li key={row.key}>
                {row.label}: «{row.display(absorbed)}»
              </li>
            ))}
          </ul>
        </section>
      )}
      {masked.length > 0 && (
        <p className="text-sm text-gris-texto">
          {masked.map(({ row }) => row.label).join(", ")}: restringido para su rol (RF-041). Queda el valor de la conservada o, si está vacío, el
          de la absorbida.
        </p>
      )}
      <p className="text-sm text-gris-texto">
        {plural(unchanged, "campo no cambia", "campos no cambian")} (iguales, solo en la conservada o vacíos en ambas). La ubicación actual y la
        pieza contenedora son siempre las de la conservada.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Paso 3: resumen y confirmación
// ---------------------------------------------------------------------------------------------

function SummarySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-base font-semibold text-tinta">{title}</h3>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-tinta">{children}</ul>
    </section>
  );
}

export function MergeSummaryStep({
  surviving,
  absorbed,
  choices,
  note,
  noteError,
  onNoteChange,
}: {
  surviving: PieceDetail;
  absorbed: PieceDetail;
  choices: FieldChoices;
  note: string;
  noteError: string | null;
  onNoteChange: (note: string) => void;
}) {
  const changes = sheetChanges(surviving, absorbed, choices);
  const identifiers = identifierFates(surviving, absorbed);
  const moving = identifiers.filter((i) => i.fate === "moves" || i.fate === "moves_not_current");
  const staying = identifiers.filter((i) => i.fate === "stays_inventory_code" || i.fate === "stays_locked");
  const materials = materialFates(surviving, absorbed);
  const s = `«${surviving.denomination}»`;
  const a = `«${absorbed.denomination}»`;

  return (
    <div className="flex flex-col gap-4">
      <SummarySection title={`La ficha de ${s} después de fusionar`}>
        {changes.length === 0 && <li>Sus datos no cambian.</li>}
        {changes.map((change) => (
          <li key={change.row.key}>
            <span className="font-medium">{change.row.label}</span>: «{change.before}» → «{change.after}»{" "}
            <Badge intent={change.kind === "chosen" ? "info" : "default"}>{change.kind === "chosen" ? "Elegido" : "Se completa"}</Badge>
          </li>
        ))}
      </SummarySection>

      <SummarySection title={`Pasa de ${a} a ${s}`}>
        {moving.map(({ identifier, fate }) => (
          <li key={identifier.id}>
            Identificador {identifier.identifier_type_code} {identifier.original_value}
            {fate === "moves_not_current" && " (como no vigente: repite un código de la conservada; no se borra)"}
          </li>
        ))}
        <li>Sus identificadores históricos que no son código I, como históricos.</li>
        {absorbed.media_count > 0 && (
          <li>{plural(absorbed.media_count, "fotografía", "fotografías")}. Si la conservada ya tiene portada, la mantiene y las nuevas quedan como fotos normales.</li>
        )}
        {materials.moves.length > 0 && <li>Materiales: {materials.moves.map((m) => m.label).join(", ")}.</li>}
        <li>Sus componentes, sus préstamos (salvo uno en el que ya esté la conservada) y sus sugerencias de IA.</li>
      </SummarySection>

      <SummarySection title={`Se queda en ${a}, que queda fusionada en ${s}`}>
        <li>Movimientos, datos de origen y evaluaciones de conservación: no se modifican y se consultan desde la ficha de {s}, que enlaza a {a}.</li>
        {staying.map(({ identifier, fate }) => (
          <li key={identifier.id}>
            {fate === "stays_inventory_code"
              ? `Código I ${identifier.original_value}: un código I nunca cambia de pieza (RN-002).`
              : `Identificador bloqueado ${identifier.identifier_type_code} ${identifier.original_value}.`}
          </li>
        ))}
        {materials.stays.length > 0 && <li>Materiales que la conservada ya tiene: {materials.stays.map((m) => m.label).join(", ")}.</li>}
        <li>{a} se da de baja lógica con el motivo de la fusión: no se borra y su ficha muestra la fusión, la fecha y el motivo.</li>
        <li>Los demás pares de {a} en la cola pasan a «Reemplazado».</li>
      </SummarySection>

      <Textarea
        label="Motivo de la fusión (obligatorio)"
        hint="Quedará en la auditoría con su usuario y la fecha; toda la fusión se registra como un único conjunto de cambios."
        required
        rows={3}
        value={note}
        error={noteError ?? undefined}
        onChange={(event) => onNoteChange(event.target.value)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Diálogo del asistente
// ---------------------------------------------------------------------------------------------

export interface MergeWizardProps {
  candidate: Pick<DuplicateCandidate, "piece_b_id" | "blocking_conflict">;
  pieceA: PieceDetail;
  pieceB: PieceDetail;
  onClose: () => void;
  onSubmit: (submission: MergeSubmission) => Promise<DialogOutcome>;
  /** Paso con el que se abre (pruebas). */
  initialStep?: MergeStep;
}

export function MergeWizard({ candidate, pieceA, pieceB, onClose, onSubmit, initialStep = 1 }: MergeWizardProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [step, setStep] = useState<MergeStep>(initialStep);
  const [survivingId, setSurvivingId] = useState(() => defaultSurvivorId(pieceA, pieceB));
  const [picks, setPicks] = useState<RowPicks>({});
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const submit = useSubmit();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const surviving = survivingId === pieceB.id ? pieceB : pieceA;
  const absorbed = surviving === pieceA ? pieceB : pieceA;
  const titles: PieceTitles = { [pieceA.id]: "Pieza A", [pieceB.id]: "Pieza B" };
  const block = mergeBlock(candidate, pieceA, pieceB);
  const restriction = survivorRestriction(survivingId, pieceA, pieceB);
  const choices = fieldChoicesFor(picks, surviving, absorbed);
  const periodError = mergedPeriodError(surviving, absorbed, choices);
  const canAdvance = step === 1 ? !block && !restriction : !periodError;

  function close() {
    dialogRef.current?.close();
  }

  function confirm() {
    const problem = mergeReasonError(note);
    if (problem) {
      setNoteError(problem);
      return;
    }
    if (block || restriction || periodError) return;
    void submit.run(() => onSubmit({ survivingPieceId: surviving.id, fieldChoices: choices, note: note.trim() }), onClose);
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-3xl rounded-lg border border-borde bg-white p-0 text-tinta backdrop:bg-tinta/40"
    >
      <form
        noValidate
        className="flex flex-col gap-4 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (step < 3) {
            if (canAdvance) setStep((step + 1) as MergeStep);
          } else confirm();
        }}
      >
        <div className="flex flex-col gap-2">
          <h2 id={titleId} className="text-lg font-semibold text-tinta">
            Fusionar piezas duplicadas
          </h2>
          <ol aria-label="Pasos de la fusión" className="flex flex-wrap gap-2 text-sm">
            {MERGE_STEPS.map((label, index) => (
              <li
                key={label}
                aria-current={step === index + 1 ? "step" : undefined}
                className={cn("rounded-full px-3 py-1", step === index + 1 ? "bg-terracota text-white" : "bg-crema text-gris-texto")}
              >
                {index + 1}. {label}
              </li>
            ))}
          </ol>
        </div>

        {step === 1 && <MergeSurvivorStep pieceA={pieceA} pieceB={pieceB} survivingId={survivingId} block={block} onChange={setSurvivingId} />}
        {step === 2 && (
          <MergeFieldsStep
            surviving={surviving}
            absorbed={absorbed}
            titles={titles}
            picks={picks}
            onPick={(rowKey, pieceId) => setPicks((current) => ({ ...current, [rowKey]: pieceId }))}
          />
        )}
        {step === 3 && (
          <MergeSummaryStep
            surviving={surviving}
            absorbed={absorbed}
            choices={choices}
            note={note}
            noteError={noteError}
            onNoteChange={(value) => {
              setNote(value);
              setNoteError(null);
            }}
          />
        )}

        {submit.busy && (
          <p role="status" className="text-sm font-medium text-gris-texto">
            Fusionando…
          </p>
        )}
        {submit.error && (
          <p role="alert" className="rounded-md bg-carmin-bg p-3 text-sm text-carmin-texto">
            {submit.error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" disabled={submit.busy} onClick={close}>
            {block ? "Cerrar" : "Cancelar"}
          </Button>
          {!block && step > 1 && (
            <Button variant="outline" icon={ArrowLeft} disabled={submit.busy} onClick={() => setStep((step - 1) as MergeStep)}>
              Anterior
            </Button>
          )}
          {!block && step < 3 && (
            <Button type="submit" variant="primary" icon={ArrowRight} disabled={!canAdvance}>
              Siguiente
            </Button>
          )}
          {!block && step === 3 && (
            <Button type="submit" variant="primary" icon={GitMerge} disabled={submit.busy || Boolean(periodError)}>
              Fusionar piezas
            </Button>
          )}
        </div>
      </form>
    </dialog>
  );
}
