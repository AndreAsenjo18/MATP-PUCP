"use client";

/**
 * Filtros de la búsqueda (change `fusion-busqueda-deposito`, tarea 2.1; RF-032, RNF-010): el buscador
 * «Código o texto» va aparte y siempre a la vista (`SearchBox`, rediseno-ux-busqueda D1; Reportes lo
 * conserva en el panel con `withQuery`); luego denominación, categoría, material y descripción, y el resto en «Más filtros», que se abre solo cuando alguno de esos filtros está activo (un enlace, una
 * sugerencia) y nunca se cierra solo.
 */
import { Eraser, SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";

import { DisclosureSummary, withActiveCount } from "@/components/domain/DisclosureSummary";
import { flattenLocationTree } from "@/components/domain/LocationsAdmin";
import { LocationTreeSelect, type LocationTreeActions } from "@/components/domain/LocationTreeSelect";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { ControlSize } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SearchPill } from "@/components/ui/SearchPill";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { fetchLocationsTree, type LocationNode } from "@/lib/data/locations";
import { fetchPieceCatalogs, type TermOption } from "@/lib/data/pieces";
import { TENURE_REGIMES, secondaryFiltersActive, secondaryFiltersCount, type SearchFilters, type TenureRegimeLabel } from "@/lib/data/search";

export interface SearchOptions {
  collections: TermOption[];
  categories: TermOption[];
  materials: TermOption[];
  conservationStates: TermOption[];
  /** Cada ubicación con su ruta completa, para el nombre del filtro activo. */
  locations: TermOption[];
  /** El árbol del filtro de ubicación (`LocationTreeSelect`, fusion-busqueda-deposito 2.2). */
  locationTree: LocationNode[];
}

export const EMPTY_OPTIONS: SearchOptions = { collections: [], categories: [], materials: [], conservationStates: [], locations: [], locationTree: [] };

/** Las listas de los filtros: los catálogos de la ficha y el árbol de ubicaciones. */
export async function loadSearchOptions(devUser?: string): Promise<SearchOptions> {
  const [catalogs, locations] = await Promise.all([fetchPieceCatalogs(), fetchLocationsTree(devUser)]);
  const tree = locations.status === "ok" ? locations.value : [];
  return {
    collections: catalogs.status === "ok" ? catalogs.catalogs.collections : [],
    categories: catalogs.status === "ok" ? catalogs.catalogs.categories : [],
    materials: catalogs.status === "ok" ? catalogs.catalogs.materials : [],
    conservationStates: catalogs.status === "ok" ? catalogs.catalogs.conservationStates : [],
    locations: flattenLocationTree(tree),
    locationTree: tree,
  };
}

function toBoolean(value: string): boolean | null {
  return value === "" ? null : value === "true";
}

function toYear(value: string): number | null {
  if (value.trim() === "") return null;
  const year = Number(value);
  return Number.isFinite(year) ? Math.trunc(year) : null;
}

function OptionSelect({
  label,
  value,
  options,
  onChange,
  size,
}: {
  label: string;
  value: string | null;
  options: TermOption[];
  onChange: (value: string | null) => void;
  size?: ControlSize;
}) {
  return (
    <Select label={label} value={value ?? ""} onChange={(event) => onChange(event.target.value || null)} controlSize={size}>
      <option value="">Todas</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

/** En tableta los filtros se abren con un botón, para dejar la pantalla a los resultados (design D4). */
export function FiltersDrawer({
  open,
  onToggle,
  activeCount,
  id = "search-filters",
  children,
}: {
  open: boolean;
  onToggle: () => void;
  activeCount: number;
  /** Lo usan también la papelera y la auditoría (change `administracion-control`). */
  id?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Button variant="secondary" size="touch" icon={SlidersHorizontal} aria-expanded={open} aria-controls={id} className="lg:hidden" onClick={onToggle}>
        {open ? "Ocultar los filtros" : "Filtros"}
        {activeCount > 0 && ` (${activeCount} activo${activeCount === 1 ? "" : "s"})`}
      </Button>
      <div id={id} className={cn(open ? "block" : "hidden", "lg:block")}>
        {children}
      </div>
    </div>
  );
}

/** Ayuda única del buscador (rediseno-ux-busqueda D2): reemplaza al subtítulo de la pantalla. */
export const SEARCH_BOX_HINT = "Cualquier código, vigente o histórico, con o sin formato. No distingue mayúsculas ni tildes.";

/**
 * Buscador «Código o texto», siempre a la vista y fuera del panel de filtros (rediseno-ux-busqueda D1).
 * Píldora con el botón «Buscar» dentro (maqueta B). La búsqueda ya se aplica mientras se escribe, así
 * que enviar el formulario no hace nada más: no recarga la página.
 */
export function SearchBox({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  return (
    <form role="search" onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-1">
      <label htmlFor="q" className="text-base font-semibold text-tinta">
        Código o texto
      </label>
      <SearchPill
        id="q"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="p. ej. I-0236, mmz 15, cerámica huánuco"
        aria-describedby="q-hint"
      />
      <p id="q-hint" className="text-base text-gris-texto">
        {SEARCH_BOX_HINT}
      </p>
    </form>
  );
}

export function SearchFiltersPanel({
  filters,
  options,
  onChange,
  onClear,
  openMore = false,
  locationActions,
  locationNotice = null,
  withQuery = true,
  layout = "columna",
}: {
  filters: SearchFilters;
  options: SearchOptions;
  onChange: (next: Partial<SearchFilters>) => void;
  onClear: () => void;
  /** Abre «Más filtros» desde el inicio: el acceso «Ver por ubicación» (design D3). */
  openMore?: boolean;
  /** Agregar, editar o desactivar lugares: solo para quien administra ubicaciones (`crud-manual-completo` 3.1). */
  locationActions?: LocationTreeActions;
  locationNotice?: string | null;
  /**
   * Incluye el buscador «Código o texto» dentro del panel (Reportes). Búsqueda lo pasa en `false`
   * porque lo muestra arriba y siempre a la vista (`SearchBox`, rediseno-ux-busqueda D1).
   */
  withQuery?: boolean;
  /**
   * `columna`: en su propia tarjeta, un filtro bajo otro (Reportes). `fila`: sin tarjeta, en una
   * cuadrícula de campos de 52 px, para ir dentro de la tarjeta de filtros de Buscar (maqueta B).
   */
  layout?: "columna" | "fila";
}) {
  const secondary = secondaryFiltersActive(filters);
  const fila = layout === "fila";
  // Los campos se alinean por abajo: si una etiqueta salta de línea, su campo no se descuadra.
  const fields = fila ? "grid grid-cols-1 items-end gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-4" : "flex flex-col gap-4";
  // En fila (Buscar), campos de 44 px para que la tarjeta ocupe poco alto y los resultados se vean antes.
  const size = "md";
  const [moreOpen, setMoreOpen] = useState(secondary || openMore);
  // Se abre al llegar un filtro secundario; ajustar el estado al renderizar evita un efecto.
  const [wasSecondary, setWasSecondary] = useState(secondary);
  if (secondary !== wasSecondary) {
    setWasSecondary(secondary);
    if (secondary) setMoreOpen(true);
  }

  const body = (
    <>
      {withQuery && (
        <Input
          id="q"
          label="Código o texto"
          value={filters.q}
          onChange={(event) => onChange({ q: event.target.value })}
          placeholder="p. ej. I-0236, mmz 15, cerámica huánuco"
          hint="Sin distinguir mayúsculas ni tildes."
          className="p-2.5"
        />
      )}
      <div className={fields}>
        <Input
          id="denomination"
          label="Denominación"
          value={filters.denomination}
          onChange={(event) => onChange({ denomination: event.target.value })}
          placeholder="p. ej. mate burilado"
          controlSize={size}
        />
        <OptionSelect label="Categoría" value={filters.categoryId} options={options.categories} onChange={(categoryId) => onChange({ categoryId })} size={size} />
        <OptionSelect label="Material" value={filters.materialId} options={options.materials} onChange={(materialId) => onChange({ materialId })} size={size} />
        <Input
          id="description"
          label="Descripción contiene"
          value={filters.description}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder="p. ej. paja toquilla"
          controlSize={size}
        />
      </div>
      <details open={moreOpen} onToggle={(event) => setMoreOpen(event.currentTarget.open)} className="group">
        <DisclosureSummary>{withActiveCount("Más filtros", secondaryFiltersCount(filters))}</DisclosureSummary>
        <div className={cn("mt-2", fields)}>
          <OptionSelect
            label="Colección (con subcolecciones)"
            value={filters.collectionId}
            options={options.collections}
            onChange={(collectionId) => onChange({ collectionId })}
            size={size}
          />
          <OptionSelect
            label="Estado de conservación"
            value={filters.conservationStateId}
            options={options.conservationStates}
            onChange={(conservationStateId) => onChange({ conservationStateId })}
            size={size}
          />
          {/* El árbol de lugares necesita el ancho entero de la fila. */}
          <div className={fila ? "sm:col-span-full" : undefined}>
            <LocationTreeSelect
              label="Ubicación"
              nodes={options.locationTree}
              value={filters.locationId}
              onChange={(locationId) => onChange({ locationId })}
              actions={locationActions}
              notice={locationNotice}
            />
          </div>
          <Select
            controlSize={size}
            label="Régimen de tenencia"
            value={filters.tenureRegime ?? ""}
            onChange={(event) => onChange({ tenureRegime: (event.target.value || null) as TenureRegimeLabel | null })}
          >
            <option value="">Todos</option>
            {TENURE_REGIMES.map((regime) => (
              <option key={regime} value={regime}>
                {regime}
              </option>
            ))}
          </Select>
          <Select
            controlSize={size}
            label="Código I"
            value={filters.hasInventoryCode === null ? "" : String(filters.hasInventoryCode)}
            onChange={(event) => onChange({ hasInventoryCode: toBoolean(event.target.value) })}
          >
            <option value="">Con o sin código I</option>
            <option value="true">Con código I</option>
            <option value="false">Sin código I</option>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input
              controlSize={size}
              label="Época desde (año)"
              type="number"
              value={filters.epochStartYear ?? ""}
              onChange={(event) => onChange({ epochStartYear: toYear(event.target.value) })}
            />
            <Input
              controlSize={size}
              label="Época hasta (año)"
              type="number"
              value={filters.epochEndYear ?? ""}
              onChange={(event) => onChange({ epochEndYear: toYear(event.target.value) })}
            />
          </div>
          <Input id="author" label="Autor" value={filters.author} onChange={(event) => onChange({ author: event.target.value })} controlSize={size} />
          <Input id="provenance" label="Procedencia" value={filters.provenance} onChange={(event) => onChange({ provenance: event.target.value })} controlSize={size} />
          <Select
            controlSize={size}
            label="Completitud de la ficha"
            value={filters.hasAlerts === null ? "" : String(filters.hasAlerts)}
            onChange={(event) => onChange({ hasAlerts: toBoolean(event.target.value) })}
          >
            <option value="">Todas las piezas</option>
            <option value="true">Solo piezas incompletas</option>
            <option value="false">Solo piezas completas</option>
          </Select>
        </div>
      </details>
      <Button variant={fila ? "neutral" : "secondary"} icon={Eraser} onClick={onClear} className={fila ? "self-start sm:self-end" : undefined}>
        Limpiar filtros
      </Button>
    </>
  );
  if (fila) return <div className="flex flex-col gap-3">{body}</div>;
  return (
    <Card as="aside" aria-label="Filtros de búsqueda" className="flex flex-col gap-4">
      {body}
    </Card>
  );
}
