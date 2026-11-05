"use client";

/**
 * Filtros de la consulta global de auditoría (tarea 5.2 de `auditoria-y-soft-delete-transversal`;
 * RF-040). Lo más usado va a la vista —tipo de registro, origen, acción y fechas— y lo demás
 * (quién, lote o sugerencia de origen, registro y conjunto concretos) en «Más filtros», que se abre
 * solo si alguno está aplicado. Los filtros se aplican al pulsar «Filtrar».
 *
 * Los identificadores se validan antes de enviarlos: el servidor rechazaría un UUID mal escrito.
 * El formulario guarda su borrador; quien lo monta le da una `key` nueva cuando los filtros
 * cambian desde fuera (por ejemplo al abrir la reversión de un conjunto).
 */
import { FilterX, Search } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_ORIGINS,
  EMPTY_AUDIT_FILTERS,
  hasActiveAuditFilters,
  validateAuditFilters,
  type AuditFilterErrors,
  type AuditQueryFilters,
} from "@/lib/data/audit-query";
import type { Person } from "@/lib/data/trash";

import { originLabel } from "./AuditChangeSetList";
import { auditActionStatus } from "./status-intents";

/** Primera letra en mayúscula, para usar una etiqueta de frase como opción de lista. */
export function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** Algún filtro de «Más filtros» está aplicado (la sección se abre sola). */
export function hasAdvancedAuditFilters(filters: AuditQueryFilters): boolean {
  return Boolean(filters.userId || filters.originRef.trim() || filters.entityId.trim() || filters.changeSetId.trim());
}

export interface AuditLogFilterBarProps {
  /** Filtros aplicados ahora; son el punto de partida del borrador. */
  filters: AuditQueryFilters;
  /** Personas que ya aparecieron como autoras de un cambio. */
  people: readonly Person[];
  disabled?: boolean;
  onApply: (filters: AuditQueryFilters) => void;
}

export function AuditLogFilterBar({ filters, people, disabled = false, onApply }: AuditLogFilterBarProps) {
  const [draft, setDraft] = useState<AuditQueryFilters>(filters);
  const [errors, setErrors] = useState<AuditFilterErrors>({});
  const [moreOpen, setMoreOpen] = useState(() => hasAdvancedAuditFilters(filters));

  function change(patch: Partial<AuditQueryFilters>) {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors({});
  }

  return (
    <Card as="section" aria-label="Filtros de la auditoría">
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const found = validateAuditFilters(draft);
          setErrors(found);
          if (Object.keys(found).length > 0) {
            if (found.changeSetId || found.entityId) setMoreOpen(true);
            return;
          }
          onApply(draft);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select label="Tipo de registro" value={draft.entityType} disabled={disabled} onChange={(event) => change({ entityType: event.target.value })}>
            <option value="">Todos los tipos</option>
            {AUDIT_ENTITY_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {capitalize(type.singular)}
              </option>
            ))}
          </Select>
          <Select label="Origen del cambio" value={draft.origin} disabled={disabled} onChange={(event) => change({ origin: event.target.value })}>
            <option value="">Cualquier origen</option>
            {AUDIT_ORIGINS.map((origin) => (
              <option key={origin} value={origin}>
                {capitalize(originLabel(origin))}
              </option>
            ))}
          </Select>
          <Select label="Acción" value={draft.action} disabled={disabled} onChange={(event) => change({ action: event.target.value })}>
            <option value="">Cualquier acción</option>
            {AUDIT_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {auditActionStatus(action).label}
              </option>
            ))}
          </Select>
          <Input
            label="Desde"
            type="date"
            value={draft.from}
            error={errors.from}
            disabled={disabled}
            onChange={(event) => change({ from: event.target.value })}
          />
          <Input
            label="Hasta"
            type="date"
            value={draft.to}
            error={errors.to}
            disabled={disabled}
            onChange={(event) => change({ to: event.target.value })}
          />
        </div>

        <details open={moreOpen} onToggle={(event) => setMoreOpen(event.currentTarget.open)} className="rounded-md border border-borde p-3">
          <summary className="min-h-6 cursor-pointer text-base font-medium text-tinta">Más filtros</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Select label="Persona que hizo el cambio" value={draft.userId} disabled={disabled} onChange={(event) => change({ userId: event.target.value })}>
              <option value="">Cualquier persona</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </Select>
            <Input
              label="Lote de importación o sugerencia de IA"
              hint="Identificador del lote o de la sugerencia que originó el cambio."
              value={draft.originRef}
              disabled={disabled}
              onChange={(event) => change({ originRef: event.target.value })}
            />
            <Input
              label="Registro concreto"
              hint="Identificador de la pieza, foto, colección… que cambió."
              value={draft.entityId}
              error={errors.entityId}
              disabled={disabled}
              onChange={(event) => change({ entityId: event.target.value })}
            />
            <Input
              label="Conjunto de cambios concreto"
              hint="Identificador de la operación completa."
              value={draft.changeSetId}
              error={errors.changeSetId}
              disabled={disabled}
              onChange={(event) => change({ changeSetId: event.target.value })}
            />
          </div>
        </details>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" icon={Search} disabled={disabled}>
            Filtrar
          </Button>
          {(hasActiveAuditFilters(draft) || hasActiveAuditFilters(filters)) && (
            <Button
              variant="secondary"
              icon={FilterX}
              disabled={disabled}
              onClick={() => {
                setDraft(EMPTY_AUDIT_FILTERS);
                setErrors({});
                onApply(EMPTY_AUDIT_FILTERS);
              }}
            >
              Quitar filtros
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
