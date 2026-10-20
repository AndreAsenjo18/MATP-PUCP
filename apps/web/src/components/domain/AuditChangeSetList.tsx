/**
 * Historial de auditoría agrupado por conjunto de cambios (tarea 5.1 de
 * `auditoria-y-soft-delete-transversal`; requirement «Consulta agrupada y exportable de la
 * auditoría», RF-040/RF-041, RNF-010).
 *
 * Cada conjunto es una operación completa («la carga del 10/09 tocó 54 piezas»), no una fila por
 * campo: se muestra quién, cuándo, de dónde vino el cambio, su motivo, qué alcanzó y si ya fue
 * revertido. Debajo van las filas campo a campo **de esta pieza**; cuando el rol no puede ver un
 * valor sensible, la fila dice que el campo cambió, quién y cuándo, y nunca inventa el valor
 * (RF-041).
 *
 * Es presentacional: recibe los conjuntos ya cargados y avisa con `onRevert`. Los permisos los
 * decide quien lo monta (la pantalla, que sí conoce la sesión) a través de `access`.
 */
import { Clock, Lock, RotateCcw, User } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { AuditChangeSetSummary, AuditEntryView } from "@/lib/data/audit";

import { auditActionStatus } from "./status-intents";
import { StatusBadge } from "./StatusBadges";

type AuditOrigin = AuditChangeSetSummary["origin"];

// ---------------------------------------------------------------------------------------------
// Textos en español llano (funciones puras, probadas sin DOM)
// ---------------------------------------------------------------------------------------------

const ORIGIN_LABELS: Record<AuditOrigin, string> = {
  MANUAL: "edición manual",
  IMPORT: "carga masiva de Excel",
  AI: "sugerencia de inteligencia artificial",
  SYSTEM: "proceso del sistema",
};

/** De dónde vino el cambio, en palabras. */
export function originLabel(origin: AuditOrigin | string): string {
  return ORIGIN_LABELS[origin as AuditOrigin] ?? `origen ${origin}`;
}

/**
 * Singular y plural de cada tipo de registro que puede aparecer en la auditoría.
 *
 * Las claves son los **nombres de tabla** que envía la API (`audit_log.entity_type` = `__tablename__`),
 * no nombres inventados: si no coincide, la pantalla mostraría «registros de tipo media_asset».
 */
const ENTITY_LABELS: Record<string, [string, string]> = {
  piece: ["pieza", "piezas"],
  piece_identifier: ["identificador", "identificadores"],
  media_asset: ["fotografía", "fotografías"],
  piece_material: ["material de la pieza", "materiales de la pieza"],
  piece_movement: ["movimiento de ubicación", "movimientos de ubicación"],
  piece_source_record: ["dato de origen", "datos de origen"],
  collection: ["colección", "colecciones"],
  term: ["término de vocabulario", "términos de vocabulario"],
  vocabulary: ["vocabulario", "vocabularios"],
  location: ["ubicación", "ubicaciones"],
  conservation_assessment: ["evaluación de conservación", "evaluaciones de conservación"],
  import_mapping_template: ["plantilla de importación", "plantillas de importación"],
  import_batch: ["lote de importación", "lotes de importación"],
  loan: ["préstamo", "préstamos"],
  loan_item: ["pieza del préstamo", "piezas del préstamo"],
  app_user: ["usuario", "usuarios"],
};

export function entityLabel(entityType: string, count: number): string {
  const labels = ENTITY_LABELS[entityType];
  if (!labels) return count === 1 ? `registro de tipo ${entityType}` : `registros de tipo ${entityType}`;
  return count === 1 ? labels[0] : labels[1];
}

/** Une una lista con comas y «y» final: «1 pieza y 2 fotografías». */
export function joinWithAnd(parts: readonly string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;
}

/** «54 piezas · 486 campos registrados»: el alcance del conjunto, sin tecnicismos. */
export function scopeSentence(summary: AuditChangeSetSummary): string {
  const parts = Object.entries(summary.entity_counts).map(([entityType, count]) => `${count} ${entityLabel(entityType, count)}`);
  const scope = parts.length > 0 ? joinWithAnd(parts) : `${summary.entity_count} registros`;
  const fields = summary.field_count === 1 ? "1 campo registrado" : `${summary.field_count} campos registrados`;
  return `${scope} · ${fields}`;
}

/** Nombres técnicos de campo traducidos para la ficha; si no se conoce, se muestra tal cual. */
const FIELD_LABELS: Record<string, string> = {
  denomination: "denominación",
  description: "descripción",
  author: "autor",
  provenance: "procedencia",
  category: "categoría",
  category_id: "categoría",
  object_type_term_id: "tipo de objeto",
  conservation_state_id: "estado de conservación",
  conservation_status: "estado de conservación",
  location_id: "ubicación",
  inventory_code: "código I",
  code_i: "código I",
  is_current: "vigencia del identificador",
  lender_name: "comodante",
  loan_agreement_ref: "convenio de comodato",
  dimensions_text: "dimensiones",
  period: "periodo",
  notes: "notas",
  availability: "disponibilidad",
  acquisition_method: "forma de adquisición",
  entry_date: "fecha de ingreso",
  tenure_regime: "régimen de tenencia",
  collection_id: "colección",
  valuation_amount: "valorización",
  deleted_at: "eliminación lógica",
};

export function fieldLabel(field: string | null): string {
  if (!field) return "la ficha completa";
  return FIELD_LABELS[field] ?? field;
}

/** Valor de auditoría en texto legible: nunca JSON (RNF-010). */
export function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "(vacío)";
  if (typeof value === "boolean") return value ? "sí" : "no";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return "(valor compuesto: ábralo en la consulta de auditoría)";
}

export const MASKED_VALUE_NOTICE = "Su rol no puede ver los valores de este campo; sí queda registrado que cambió, quién y cuándo (RF-041).";

/** Una fila campo a campo en una sola frase. */
export function fieldChangeSentence(entry: AuditEntryView): string {
  if (entry.values_masked) return `${fieldLabel(entry.field)}: ${MASKED_VALUE_NOTICE}`;
  if (!entry.field) return `${auditActionStatus(entry.action).label} del registro completo.`;
  return `${fieldLabel(entry.field)}: ${formatAuditValue(entry.old_value)} → ${formatAuditValue(entry.new_value)}`;
}

/** Fecha y hora en formato peruano; el valor original se conserva para los `title`. */
export function formatMoment(isoDate: string): string {
  const moment = new Date(isoDate);
  return Number.isNaN(moment.getTime()) ? isoDate : moment.toLocaleString("es-PE");
}

// ---------------------------------------------------------------------------------------------
// Permiso de reversión (design D1, [SUPUESTO B7])
// ---------------------------------------------------------------------------------------------

/** Permiso necesario según el origen del conjunto; `null` = solo Administrador. */
export function revertPermissionFor(origin: AuditOrigin | string): string | null {
  if (origin === "MANUAL") return "pieces.update";
  if (origin === "IMPORT") return "imports.revert";
  return null;
}

export interface RevertAccess {
  /** Permisos del rol de la sesión (la pantalla pasa `hasPermission` de `lib/auth`). */
  hasPermission: (permissionCode: string) => boolean;
  isAdmin: boolean;
}

export type RevertAvailability =
  | { state: "available" }
  | { state: "reverted"; revertedByChangeSetId: string | null }
  | { state: "denied"; reason: string };

/**
 * Si se puede ofrecer el botón de revertir. El servidor vuelve a comprobarlo en la vista previa
 * (`required_permissions`, `requires_admin`): esto solo evita ofrecer algo que se rechazaría.
 */
export function revertAvailability(summary: AuditChangeSetSummary, access: RevertAccess): RevertAvailability {
  if (summary.reverted) return { state: "reverted", revertedByChangeSetId: summary.reverted_by_change_set_id };
  if (access.isAdmin) return { state: "available" };
  const permission = revertPermissionFor(summary.origin);
  if (!permission) {
    return {
      state: "denied",
      reason: `Solo un Administrador puede revertir los cambios que vienen de ${originLabel(summary.origin)}.`,
    };
  }
  if (access.hasPermission(permission)) return { state: "available" };
  return {
    state: "denied",
    reason: `Su rol no puede revertir los cambios que vienen de ${originLabel(summary.origin)}: falta el permiso «${permission}» (RF-039).`,
  };
}

// ---------------------------------------------------------------------------------------------
// Componentes
// ---------------------------------------------------------------------------------------------

export interface AuditChangeSetListProps {
  changeSets: readonly AuditChangeSetSummary[];
  /** Filas campo a campo de esta pieza, por conjunto de cambios. */
  entries?: Readonly<Record<string, readonly AuditEntryView[]>>;
  access: RevertAccess;
  /** Abre la vista previa de reversión; si falta, no se ofrece revertir. */
  onRevert?: (summary: AuditChangeSetSummary) => void;
  /** Conjunto cuya vista previa está abierta: su panel se monta debajo de la tarjeta. */
  openChangeSetId?: string | null;
  /** Panel de reversión del conjunto abierto (se recibe montado para no acoplar los datos aquí). */
  revertPanel?: ReactNode;
}

/** Ancla estable de cada conjunto, para enlazar desde el conjunto que lo revirtió. */
export function changeSetAnchor(changeSetId: string): string {
  return `conjunto-${changeSetId}`;
}

export function AuditChangeSetList({ changeSets, entries, access, onRevert, openChangeSetId, revertPanel }: AuditChangeSetListProps) {
  if (changeSets.length === 0) {
    return <Card className="border-dashed text-center text-base text-gris-texto">Sin registros de auditoría para esta pieza.</Card>;
  }
  const known = new Set(changeSets.map((summary) => summary.change_set_id));
  return (
    <ol aria-label="Conjuntos de cambios" className="flex flex-col gap-3">
      {changeSets.map((summary) => (
        <Card as="li" key={summary.change_set_id} id={changeSetAnchor(summary.change_set_id)} className="flex flex-col gap-2">
          <AuditChangeSetHeader summary={summary} />
          <AuditChangeSetEntries entries={entries?.[summary.change_set_id] ?? []} />
          <AuditRevertControl
            summary={summary}
            access={access}
            onRevert={onRevert}
            revertedIsListed={summary.reverted_by_change_set_id ? known.has(summary.reverted_by_change_set_id) : false}
          />
          {openChangeSetId === summary.change_set_id && revertPanel}
        </Card>
      ))}
    </ol>
  );
}

function AuditChangeSetHeader({ summary }: { summary: AuditChangeSetSummary }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {summary.actions.map((action) => (
          <StatusBadge key={action} status={auditActionStatus(action)} />
        ))}
        {summary.reverted && <Badge intent="info">Ya revertido</Badge>}
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gris-texto">
        <span className="inline-flex items-center gap-1">
          <Clock size={16} aria-hidden="true" />
          {formatMoment(summary.occurred_at)}
        </span>
        <span className="inline-flex items-center gap-1">
          <User size={16} aria-hidden="true" />
          {summary.actor_label ?? "Sistema"}
        </span>
        <span>Origen: {originLabel(summary.origin)}</span>
      </p>
      <p className="text-base text-tinta">{scopeSentence(summary)}</p>
      <p className="text-sm text-gris-texto">{summary.reason ? summary.reason : "Sin motivo registrado."}</p>
    </div>
  );
}

function AuditChangeSetEntries({ entries }: { entries: readonly AuditEntryView[] }) {
  if (entries.length === 0) return null;
  return (
    <ul aria-label="Campos de esta pieza en el conjunto" className="flex flex-col gap-1 border-t border-borde pt-2">
      {entries.map((entry) => (
        <li key={entry.id} className="text-base text-tinta">
          {entry.values_masked ? (
            <>
              <span className="inline-flex items-center gap-1 font-medium">
                <Lock size={16} aria-hidden="true" />
                {fieldLabel(entry.field)}
              </span>
              <span className="block text-sm text-ambar-texto">{MASKED_VALUE_NOTICE}</span>
            </>
          ) : (
            fieldChangeSentence(entry)
          )}
        </li>
      ))}
    </ul>
  );
}

interface AuditRevertControlProps {
  summary: AuditChangeSetSummary;
  access: RevertAccess;
  onRevert?: (summary: AuditChangeSetSummary) => void;
  revertedIsListed: boolean;
}

function AuditRevertControl({ summary, access, onRevert, revertedIsListed }: AuditRevertControlProps) {
  const availability = revertAvailability(summary, access);

  if (availability.state === "reverted") {
    const target = availability.revertedByChangeSetId;
    return (
      <p className="text-sm text-gris-texto">
        Este cambio ya fue revertido.{" "}
        {target && revertedIsListed ? (
          <a href={`#${changeSetAnchor(target)}`} className="text-terracota underline">
            Ver la reversión en este historial
          </a>
        ) : target ? (
          <>La reversión quedó registrada en el conjunto {target}, que a su vez puede revertirse.</>
        ) : (
          <>La reversión quedó registrada como un conjunto nuevo, que a su vez puede revertirse.</>
        )}
      </p>
    );
  }

  if (!onRevert) return null;

  if (availability.state === "denied") {
    return (
      <div className="flex flex-col gap-1">
        <Button variant="secondary" icon={RotateCcw} disabled className="self-start">
          Revertir este cambio
        </Button>
        <p className="text-sm text-ambar-texto">{availability.reason}</p>
      </div>
    );
  }

  return (
    <Button variant="outline" icon={RotateCcw} className="self-start" onClick={() => onRevert(summary)}>
      Revertir este cambio
    </Button>
  );
}
