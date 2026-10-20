/**
 * Aviso de conflicto de edición (change `ficha-pieza-crud`, tarea 4.3; design D2; RNF-010).
 *
 * Se muestra cuando el servidor responde 409 `edit_conflict`: otra persona guardó la pieza
 * mientras se editaba. Es presentacional: quien lo usa decide cuándo cargar la versión actual
 * (`onViewChanges`) y le pasa las diferencias ya calculadas con `computeConflictChanges`.
 */
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/Button";
import type { PieceFormCatalogs } from "@/lib/data/pieces";
import type { PieceFormValues } from "@/lib/forms/piece-form";

/** Campos que el editor modifica y que, por tanto, pueden chocar con otra edición. */
export const CONFLICT_FIELDS = [
  { field: "denomination", label: "Denominación" },
  { field: "collection_id", label: "Colección" },
  { field: "category_id", label: "Categoría" },
  { field: "object_type_term_id", label: "Tipo de bien" },
  { field: "availability_term_id", label: "Disponibilidad" },
  { field: "lender_name", label: "Comodante" },
  { field: "loan_agreement_ref", label: "Convenio de comodato" },
  { field: "description", label: "Descripción" },
  { field: "author", label: "Autor" },
  { field: "provenance", label: "Procedencia" },
  { field: "period_text", label: "Época (texto original)" },
  { field: "acquisition_method_term_id", label: "Forma de adquisición" },
  { field: "entry_date", label: "Fecha de ingreso" },
  { field: "dimensions_text", label: "Medidas (texto original)" },
  { field: "material_term_ids", label: "Materiales" },
  { field: "conservation_state_id", label: "Estado de conservación" },
  { field: "notes", label: "Observaciones" },
] as const satisfies ReadonlyArray<{ field: keyof PieceFormValues; label: string }>;

export interface ConflictChange {
  field: (typeof CONFLICT_FIELDS)[number]["field"];
  label: string;
  /** Lo que la persona escribió en el formulario. */
  mine: string;
  /** Lo que hay hoy en el servidor. */
  theirs: string;
}

/** Catálogos para mostrar etiquetas (y no ids) en los campos que se eligen de una lista. */
type ConflictCatalogs = Partial<PieceFormCatalogs>;

/** Campo de lista desplegable → catálogo del que sale su etiqueta. */
const SINGLE_CHOICE_CATALOG = {
  collection_id: "collections",
  category_id: "categories",
  object_type_term_id: "objectTypes",
  availability_term_id: "availabilities",
  acquisition_method_term_id: "acquisitionMethods",
  conservation_state_id: "conservationStates",
} as const satisfies Partial<Record<keyof PieceFormValues, keyof PieceFormCatalogs>>;

function termLabel(options: PieceFormCatalogs["materials"] | undefined, id: string): string {
  return options?.find((option) => option.id === id)?.label ?? id;
}

/** Texto de un campo para compararlo y mostrarlo; la lista de materiales se ordena (el orden no importa). */
function conflictText(field: ConflictChange["field"], values: PieceFormValues, catalogs?: ConflictCatalogs): string {
  if (field === "material_term_ids") {
    return values.material_term_ids
      .map((id) => termLabel(catalogs?.materials, id))
      .sort((a, b) => a.localeCompare(b, "es"))
      .join(", ");
  }
  if (field in SINGLE_CHOICE_CATALOG) {
    const id = values[field as keyof typeof SINGLE_CHOICE_CATALOG];
    return id === "" ? "" : termLabel(catalogs?.[SINGLE_CHOICE_CATALOG[field as keyof typeof SINGLE_CHOICE_CATALOG]], id);
  }
  return values[field as Exclude<ConflictChange["field"], "material_term_ids">];
}

function sameConflictField(field: ConflictChange["field"], a: PieceFormValues, b: PieceFormValues): boolean {
  if (field === "material_term_ids") {
    const left = [...a.material_term_ids].sort();
    const right = [...b.material_term_ids].sort();
    return left.length === right.length && left.every((id, index) => id === right[index]);
  }
  return a[field] === b[field];
}

/**
 * Campos que la otra persona cambió: los que hoy difieren de la ficha tal como se abrió (`base`).
 * Un campo que solo cambió esta persona no es un cambio del otro usuario y no se lista.
 * Con `catalogs`, los campos de lista (colección, categoría, materiales, estado…) se muestran por su etiqueta.
 */
export function computeConflictChanges(
  base: PieceFormValues,
  mine: PieceFormValues,
  theirs: PieceFormValues,
  catalogs?: ConflictCatalogs,
): ConflictChange[] {
  return CONFLICT_FIELDS.filter(({ field }) => !sameConflictField(field, theirs, base)).map(({ field, label }) => ({
    field,
    label,
    mine: conflictText(field, mine, catalogs),
    theirs: conflictText(field, theirs, catalogs),
  }));
}

function valueText(value: string): string {
  return value.trim() === "" ? "(vacío)" : value;
}

export interface PieceEditConflictProps {
  /** Mensaje del servidor (en español). */
  message: string;
  /** Diferencias ya calculadas; `null` mientras no se hayan cargado. */
  changes: ConflictChange[] | null;
  /** Si el detalle de cambios está desplegado. */
  open: boolean;
  loading?: boolean;
  loadError?: string | null;
  onViewChanges: () => void;
}

export function PieceEditConflict({ message, changes, open, loading = false, loadError = null, onViewChanges }: PieceEditConflictProps) {
  return (
    <section
      role="alert"
      aria-labelledby="edit-conflict-title"
      className="flex flex-col gap-3 rounded-lg border border-ambar-alerta bg-ambar-bg p-4 text-base text-ambar-texto"
    >
      <div className="flex items-start gap-2">
        <TriangleAlert size={20} aria-hidden="true" className="mt-0.5 shrink-0" />
        <div className="flex flex-col gap-1">
          <h2 id="edit-conflict-title" className="font-semibold">
            Otra persona modificó esta pieza
          </h2>
          <p>{message}</p>
          <p>
            Sus cambios no se perdieron: siguen en el formulario y en un borrador guardado en este navegador, que podrá recuperar al
            recargar la ficha.
          </p>
        </div>
      </div>

      <div>
        <Button variant="outline" onClick={onViewChanges} disabled={loading} aria-expanded={open}>
          Ver cambios del otro usuario
        </Button>
      </div>

      {loading && (
        <p role="status" className="font-medium">
          Cargando la versión actual…
        </p>
      )}
      {loadError && (
        <p role="status" className="font-medium text-carmin-texto">
          {loadError}
        </p>
      )}

      {open && changes && changes.length === 0 && <p>No hay diferencias en los campos que usted edita: el otro usuario cambió otros datos de la ficha.</p>}
      {open && changes && changes.length > 0 && (
        <table className="w-full border-collapse text-left text-sm text-tinta">
          <caption className="sr-only">Campos que el otro usuario modificó, comparados con su versión</caption>
          <thead>
            <tr className="border-b border-borde">
              <th scope="col" className="py-1 pr-3 font-semibold">
                Campo
              </th>
              <th scope="col" className="py-1 pr-3 font-semibold">
                Su versión
              </th>
              <th scope="col" className="py-1 font-semibold">
                Versión del otro usuario
              </th>
            </tr>
          </thead>
          <tbody>
            {changes.map((change) => (
              <tr key={change.field} className="border-b border-borde align-top">
                <th scope="row" className="py-1 pr-3 font-medium">
                  {change.label}
                </th>
                <td className="py-1 pr-3">{valueText(change.mine)}</td>
                <td className="py-1">{valueText(change.theirs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
