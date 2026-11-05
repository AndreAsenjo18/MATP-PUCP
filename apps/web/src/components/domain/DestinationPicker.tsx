/**
 * «Mover a»: buscador y lista de lugares finales con su ruta completa (change `rediseno-ux-deposito`).
 * Lo usa la barra de acciones de la búsqueda desde que la vista de depósito se fusionó con ella
 * (`fusion-busqueda-deposito`, tareas 3.2 y 4.2).
 */
import { useState } from "react";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { filterDestinations, type DestinationOption } from "@/lib/data/locations";

/** Explica que solo se listan lugares finales; las rutas completas dan el contexto. */
export const DESTINATION_HINT = "Solo lugares finales (niveles y contenedores), donde queda guardada la pieza.";

export interface DestinationPickerProps {
  options: readonly DestinationOption[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  /** La opción sin destino. */
  emptyLabel?: string;
}

/** «Mover a»: buscador y lista de lugares finales con su ruta completa. */
export function DestinationPicker({ options, value, onChange, label = "Mover a", emptyLabel = "Seleccione un destino…" }: DestinationPickerProps) {
  const [query, setQuery] = useState("");
  if (options.length === 0) {
    return (
      <p role="status" className="rounded-md bg-ambar-bg px-3 py-2 text-sm text-ambar-texto">
        No hay lugares finales disponibles. Créelos en Administración › Catálogo › Ubicaciones.
      </p>
    );
  }
  const matches = filterDestinations(options, query);
  // El destino ya elegido sigue en la lista aunque el buscador lo oculte.
  const chosen = options.find((option) => option.id === value);
  const visible = chosen && !matches.some((option) => option.id === value) ? [chosen, ...matches] : matches;
  return (
    <div className="flex flex-col gap-2">
      <Input
        label="Buscar destino"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="p. ej. Rack A"
        autoComplete="off"
        className="p-3 lg:p-2 lg:text-sm"
        hint={DESTINATION_HINT}
      />
      <Select label={label} value={value} onChange={(event) => onChange(event.target.value)} className="p-3 lg:p-2 lg:text-sm">
        <option value="">{emptyLabel}</option>
        {visible.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </Select>
      {query.trim() && matches.length === 0 && (
        <p role="status" className="text-sm text-gris-texto">
          Ningún lugar final coincide con «{query.trim()}».
        </p>
      )}
    </div>
  );
}
