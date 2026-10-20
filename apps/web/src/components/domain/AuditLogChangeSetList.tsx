"use client";

/**
 * Resultado de la consulta global de auditoría, agrupado por conjunto de cambios (tarea 5.2 de
 * `auditoria-y-soft-delete-transversal`; requirement «Consulta agrupada y exportable de la
 * auditoría», RF-040, RF-041, RNF-010).
 *
 * Cada tarjeta es una operación completa (una edición, una carga de Excel, una reversión): quién,
 * cuándo, de dónde vino, su motivo, qué alcanzó («54 piezas · 486 campos registrados») y si ya fue
 * revertido. «Ver los campos cambiados» abre su detalle campo a campo debajo de la tarjeta. Cuando
 * el rol no puede ver un valor sensible, la fila dice que el campo cambió, quién y cuándo, y nunca
 * inventa el valor (RF-041).
 *
 * Es presentacional y reutiliza los textos de `AuditChangeSetList` (origen, campos, valores,
 * enmascarado): una sola forma de decir cada cosa en la ficha y en Administración. Revertir un
 * conjunto se hace desde la pestaña de auditoría de la ficha, que sí conoce sus piezas.
 */
import { ChevronDown, ChevronUp, Clock, History, Lock, User } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { auditEntityLabel } from "@/lib/data/audit-query";
import type { AuditChangeSetSummary, AuditEntryView } from "@/lib/data/audit";

import { fieldChangeSentence, fieldLabel, formatMoment, joinWithAnd, MASKED_VALUE_NOTICE, originLabel } from "./AuditChangeSetList";
import { auditActionStatus } from "./status-intents";
import { StatusBadge } from "./StatusBadges";

export const AUDIT_EMPTY_MESSAGE = "Todavía no hay registros de auditoría.";
export const AUDIT_NO_MATCH_MESSAGE = "Ningún conjunto de cambios coincide con estos filtros.";
export const NO_REASON_RECORDED = "Sin motivo registrado.";

/** «54 piezas · 486 campos registrados»: el alcance del conjunto, con los nombres de la API. */
export function auditScopeSentence(summary: Pick<AuditChangeSetSummary, "entity_counts" | "entity_count" | "field_count">): string {
  const parts = Object.entries(summary.entity_counts).map(([entityType, count]) => `${count} ${auditEntityLabel(entityType, count)}`);
  const scope = parts.length > 0 ? joinWithAnd(parts) : summary.entity_count === 1 ? "1 registro" : `${summary.entity_count} registros`;
  const fields = summary.field_count === 1 ? "1 campo registrado" : `${summary.field_count} campos registrados`;
  return `${scope} · ${fields}`;
}

/** Los primeros caracteres de un identificador, para reconocerlo sin leer 36 símbolos. */
export function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

/** Qué hacer cuando no hay conjuntos: distingue «nada registrado» de «nada con estos filtros». */
export function emptyMessage(hasFilters: boolean): string {
  return hasFilters ? AUDIT_NO_MATCH_MESSAGE : AUDIT_EMPTY_MESSAGE;
}

export interface AuditLogChangeSetListProps {
  changeSets: readonly AuditChangeSetSummary[];
  hasFilters?: boolean;
  /** Conjunto cuyo detalle está abierto. */
  openChangeSetId?: string | null;
  /** Detalle del conjunto abierto (se recibe montado para no acoplar los datos aquí). */
  detail?: ReactNode;
  onToggleDetail: (summary: AuditChangeSetSummary) => void;
  /** Pasa a ver otro conjunto (la reversión de este) filtrando por su identificador. */
  onOpenChangeSet?: (changeSetId: string) => void;
}

export function AuditLogChangeSetList({ changeSets, hasFilters = false, openChangeSetId, detail, onToggleDetail, onOpenChangeSet }: AuditLogChangeSetListProps) {
  if (changeSets.length === 0) {
    return <Card className="border-dashed text-center text-base text-gris-texto">{emptyMessage(hasFilters)}</Card>;
  }
  return (
    <ol aria-label="Conjuntos de cambios" className="flex flex-col gap-3">
      {changeSets.map((summary) => {
        const open = openChangeSetId === summary.change_set_id;
        return (
          <Card as="li" key={summary.change_set_id} className="flex flex-col gap-2">
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
            <p className="text-base text-tinta">{auditScopeSentence(summary)}</p>
            <p className="text-sm text-gris-texto">{summary.reason?.trim() ? summary.reason : NO_REASON_RECORDED}</p>
            {summary.origin_ref && <p className="text-sm text-gris-texto">Lote o sugerencia de origen: {summary.origin_ref}</p>}
            {summary.reverted && (
              <p className="text-sm text-gris-texto">
                Este cambio ya fue revertido.{" "}
                {summary.reverted_by_change_set_id && onOpenChangeSet && (
                  <button
                    type="button"
                    className="min-h-6 text-terracota underline focus-visible:outline-2 focus-visible:outline-terracota"
                    onClick={() => onOpenChangeSet(summary.reverted_by_change_set_id as string)}
                  >
                    Ver la reversión
                  </button>
                )}
              </p>
            )}
            <Button
              variant="outline"
              icon={open ? ChevronUp : ChevronDown}
              className="self-start"
              aria-expanded={open}
              onClick={() => onToggleDetail(summary)}
            >
              {open ? "Ocultar los campos cambiados" : "Ver los campos cambiados"}
            </Button>
            {open && detail}
          </Card>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------------------------
// Detalle campo a campo de un conjunto
// ---------------------------------------------------------------------------------------------

export const DETAIL_EMPTY_MESSAGE = "Este conjunto no tiene campos registrados que mostrar con los permisos de su rol.";

export interface AuditLogEntryListProps {
  entries: readonly AuditEntryView[];
  /** Filas que tiene el conjunto en el servidor; mayor que `entries.length` si faltan por cargar. */
  total: number;
  loading?: boolean;
  error?: string | null;
  /** Carga las filas que faltan; si falta, no se ofrece. */
  onLoadMore?: () => void;
}

export function AuditLogEntryList({ entries, total, loading = false, error, onLoadMore }: AuditLogEntryListProps) {
  return (
    <div className="flex flex-col gap-2 border-t border-borde pt-2">
      {loading && entries.length === 0 && (
        <p role="status" className="text-base text-gris-texto">
          Cargando los campos…
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-carmin-bg p-3 text-sm text-carmin-texto">
          {error}
        </p>
      )}
      {!loading && !error && entries.length === 0 && <p className="text-base text-gris-texto">{DETAIL_EMPTY_MESSAGE}</p>}
      {entries.length > 0 && (
        <ul aria-label="Campos cambiados en el conjunto" className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-col text-base text-tinta">
              <span className="text-sm text-gris-texto">
                {auditEntityLabel(entry.entity_type)} <span className="font-mono">{shortId(entry.entity_id)}</span> · {formatMoment(entry.occurred_at)}
              </span>
              {entry.values_masked ? (
                <>
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Lock size={16} aria-hidden="true" />
                    {fieldLabel(entry.field)}
                  </span>
                  <span className="text-sm text-ambar-texto">{MASKED_VALUE_NOTICE}</span>
                </>
              ) : (
                <span>{fieldChangeSentence(entry)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {entries.length > 0 && total > entries.length && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-gris-texto">
            Se muestran {entries.length} de {total} campos.
          </p>
          {onLoadMore && (
            <Button variant="secondary" icon={History} disabled={loading} onClick={onLoadMore}>
              Mostrar más campos
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
