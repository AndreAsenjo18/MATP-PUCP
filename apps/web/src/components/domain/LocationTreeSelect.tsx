"use client";

/**
 * Selector de ubicación en árbol (change `fusion-busqueda-deposito`, tarea 2.2; RF-016, RF-017):
 * sede › espacio › mueble › nivel › contenedor, con buscador. Elegir un lugar incluye todo lo que
 * contiene, como el filtro `location_id` de la API. Las ramas abiertas parten de las sedes y de la
 * ruta del lugar elegido; quien las abre o cierra decide sobre ese punto de partida.
 *
 * Con `actions` (quien administra ubicaciones, `crud-manual-completo` 3.1), el lugar elegido se puede
 * ampliar, editar o desactivar desde aquí. Sin ellas, el árbol solo sirve para filtrar.
 */
import { ChevronDown, ChevronRight, CircleOff, Pencil, Plus, X } from "lucide-react";
import { useState } from "react";

import { LEVEL_INTENT } from "@/components/domain/LocationsAdmin";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { allowedTypesSentence, locationTrail, locationTreeRows, type LocationNode } from "@/lib/data/locations";

export const LOCATION_TREE_HINT = "Al elegir un lugar se incluye todo lo que contiene.";

export const PLACE_ACTIONS_HINT = "Elija un lugar para agregar otro dentro, editarlo o desactivarlo.";

export interface LocationTreeActions {
  onAdd: (node: LocationNode) => void;
  onEdit: (node: LocationNode) => void;
  onDeactivate: (node: LocationNode) => void;
}

export interface LocationTreeSelectProps {
  nodes: readonly LocationNode[];
  value: string | null;
  onChange: (id: string | null) => void;
  label?: string;
  /** Búsqueda con la que abre el selector (pruebas y enlaces). */
  initialQuery?: string;
  /** Solo para quien administra ubicaciones. */
  actions?: LocationTreeActions;
  /** Resultado de la última acción sobre un lugar. */
  notice?: string | null;
}

export function LocationTreeSelect({ nodes, value, onChange, label = "Ubicación", initialQuery = "", actions, notice = null }: LocationTreeSelectProps) {
  const [query, setQuery] = useState(initialQuery);
  // Solo lo que la persona abrió o cerró; el resto sigue el punto de partida (sedes y ruta elegida).
  const [toggled, setToggled] = useState<ReadonlyMap<string, boolean>>(new Map());

  const trail = value ? locationTrail(nodes, value) : null;
  const chosen = trail?.at(-1) ?? null;
  const admitsPlaces = (chosen?.allowed_child_types ?? []).length > 0;
  const opened = new Set([...nodes.map((node) => node.id), ...(trail ?? []).slice(0, -1).map((node) => node.id)]);
  for (const [id, open] of toggled) {
    if (open) opened.add(id);
    else opened.delete(id);
  }
  const rows = locationTreeRows(nodes, { query, expanded: opened });
  const toggle = (id: string, open: boolean) => setToggled((previous) => new Map(previous).set(id, open));

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-tinta">{label}</legend>
      <p className="text-sm text-gris-texto">{LOCATION_TREE_HINT}</p>
      {value && (
        <p className="flex items-center justify-between gap-2 rounded-md bg-crema px-2 py-1 text-sm text-tinta">
          <span>{trail ? trail.map((node) => node.name).join(" › ") : "Lugar elegido (ya no está en el árbol)"}</span>
          <Button variant="outline" size="sm" icon={X} aria-label="Quitar la ubicación" onClick={() => onChange(null)} />
        </p>
      )}
      {actions &&
        (chosen ? (
          <div role="group" aria-label={`Acciones sobre ${chosen.name}`} className="flex flex-col gap-1">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" icon={Plus} disabled={!admitsPlaces} onClick={() => actions.onAdd(chosen)}>
                Agregar lugar aquí
              </Button>
              <Button variant="outline" size="sm" icon={Pencil} onClick={() => actions.onEdit(chosen)}>
                Editar
              </Button>
              <Button variant="outline" size="sm" icon={CircleOff} onClick={() => actions.onDeactivate(chosen)}>
                Desactivar
              </Button>
            </div>
            {!admitsPlaces && <p className="text-sm text-gris-texto">{allowedTypesSentence(chosen)}</p>}
          </div>
        ) : (
          <p className="text-sm text-gris-texto">{PLACE_ACTIONS_HINT}</p>
        ))}
      {notice && (
        <p role="status" className="rounded-md bg-verde-bg px-2 py-1 text-sm text-verde-exito">
          {notice}
        </p>
      )}
      <Input
        label="Buscar lugar"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="p. ej. Estante B"
        autoComplete="off"
      />
      {nodes.length === 0 ? (
        <p role="status" className="text-sm text-gris-texto">
          No hay ubicaciones registradas.
        </p>
      ) : rows.length === 0 ? (
        <p role="status" className="text-sm text-gris-texto">
          Ningún lugar coincide con «{query.trim()}».
        </p>
      ) : (
        <ul aria-label={`Lugares para ${label.toLowerCase()}`} className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
          {rows.map((row) => {
            const selected = row.node.id === value;
            return (
              <li key={row.node.id} className="flex items-center gap-1" style={{ paddingLeft: `${row.depth * 16}px` }}>
                {row.hasChildren ? (
                  <button
                    type="button"
                    aria-expanded={row.expanded}
                    aria-label={`${row.expanded ? "Cerrar" : "Abrir"} ${row.node.name}`}
                    className="flex size-11 shrink-0 items-center justify-center rounded text-gris-texto hover:bg-crema-light focus-visible:outline-2 focus-visible:outline-terracota lg:size-6"
                    onClick={() => toggle(row.node.id, !row.expanded)}
                  >
                    {row.expanded ? <ChevronDown aria-hidden className="size-4" /> : <ChevronRight aria-hidden className="size-4" />}
                  </button>
                ) : (
                  <span aria-hidden className="size-11 shrink-0 lg:size-6" />
                )}
                <button
                  type="button"
                  aria-pressed={selected}
                  title={row.path.join(" › ")}
                  className={cn(
                    "flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded px-1 py-0.5 text-left text-sm text-tinta hover:bg-crema-light focus-visible:outline-2 focus-visible:outline-terracota lg:min-h-0",
                    selected && "bg-crema font-medium",
                  )}
                  onClick={() => onChange(row.node.id)}
                >
                  <Badge intent={LEVEL_INTENT[row.node.level_type] ?? "default"} className="px-2 py-0 text-xs">
                    {row.node.level_type}
                  </Badge>
                  {row.node.name}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
