"use client";

/**
 * Filtros de la papelera (tarea 5.2 de `auditoria-y-soft-delete-transversal`): tipo de registro,
 * quién lo eliminó y rango de fechas. Los filtros se aplican al pulsar «Filtrar», no con cada
 * cambio, para no consultar al servidor mientras la persona todavía está eligiendo.
 *
 * El formulario guarda su borrador; quien lo monta le da una `key` nueva cuando los filtros
 * cambian desde fuera (por ejemplo al ir a una dependencia) para que se vuelva a inicializar.
 */
import { FilterX, Search } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  EMPTY_TRASH_FILTERS,
  hasActiveTrashFilters,
  TRASH_ENTITY_TYPES,
  validateDateRange,
  type DateRangeErrors,
  type Person,
  type TrashFilters,
} from "@/lib/data/trash";

export interface TrashFilterBarProps {
  /** Filtros aplicados ahora; son el punto de partida del borrador. */
  filters: TrashFilters;
  /** Personas que ya aparecieron como responsables de una eliminación. */
  people: readonly Person[];
  disabled?: boolean;
  onApply: (filters: TrashFilters) => void;
}

export function TrashFilterBar({ filters, people, disabled = false, onApply }: TrashFilterBarProps) {
  const [draft, setDraft] = useState<TrashFilters>(filters);
  const [errors, setErrors] = useState<DateRangeErrors>({});

  function change(patch: Partial<TrashFilters>) {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors({});
  }

  return (
    <Card as="section" aria-label="Filtros de la papelera">
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const found = validateDateRange(draft.from, draft.to);
          setErrors(found);
          if (found.from || found.to) return;
          onApply(draft);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Tipo de registro" value={draft.entityType} disabled={disabled} onChange={(event) => change({ entityType: event.target.value })}>
            <option value="">Todos los tipos</option>
            {TRASH_ENTITY_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </Select>
          <Select label="Eliminado por" value={draft.deletedBy} disabled={disabled} onChange={(event) => change({ deletedBy: event.target.value })}>
            <option value="">Cualquier persona</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
          <Input
            label="Eliminado desde"
            type="date"
            value={draft.from}
            error={errors.from}
            disabled={disabled}
            onChange={(event) => change({ from: event.target.value })}
          />
          <Input
            label="Eliminado hasta"
            type="date"
            value={draft.to}
            error={errors.to}
            disabled={disabled}
            onChange={(event) => change({ to: event.target.value })}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" icon={Search} disabled={disabled}>
            Filtrar
          </Button>
          {(hasActiveTrashFilters(draft) || hasActiveTrashFilters(filters)) && (
            <Button
              variant="secondary"
              icon={FilterX}
              disabled={disabled}
              onClick={() => {
                setDraft(EMPTY_TRASH_FILTERS);
                setErrors({});
                onApply(EMPTY_TRASH_FILTERS);
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
