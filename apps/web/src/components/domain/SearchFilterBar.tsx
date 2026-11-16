"use client";

/**
 * Barra compacta de filtros de Búsqueda y panel lateral «Más filtros» (change
 * `busqueda-barra-compacta-ia`; RF-038, RNF-010).
 *
 * - Píldoras para los filtros más usados (Categoría, Material, Colección, Ubicación y Código I). Cada
 *   una lleva encima un `<select>` nativo transparente (D1): la lista es la del sistema. Activa, la
 *   píldora muestra su valor y una ✕ para quitarlo.
 * - Los filtros de «Más filtros» que estén activos también salen como píldoras, para verlos todos.
 * - «Limpiar filtros» va junto al número de resultados (`SearchLive`), para no gastar una fila aquí.
 * - «Más filtros» abre un `<dialog>` modal a la derecha (D2), con el árbol de ubicaciones en un área con
 *   desplazamiento propio. Los filtros se aplican al instante; «Ver N piezas» solo cierra el panel.
 */
import { ChevronDown, Eraser, SlidersHorizontal, X } from "lucide-react";
import { useRef, type ReactNode } from "react";

import { LocationTreeSelect, type LocationTreeActions } from "@/components/domain/LocationTreeSelect";
import { OptionSelect, optionNames, type SearchOptions } from "@/components/domain/SearchFilters";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PILL, PILL_OFF, PILL_ON, PillRemoveButton, PillSelect } from "@/components/ui/PillSelect";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import type { TermOption } from "@/lib/data/pieces";
import { TENURE_REGIMES, activeChips, type SearchFilters, type TenureRegimeLabel } from "@/lib/data/search";

/** Filtros con píldora propia en la barra. */
export const BAR_FILTER_KEYS = ["categoryId", "materialId", "collectionId", "locationId", "hasInventoryCode"] as const;
type BarKey = (typeof BAR_FILTER_KEYS)[number];

/** Filtros del panel «Más filtros»: todos menos la caja de texto y los de la barra. */
export function panelFilterKeys(filters: SearchFilters): (keyof SearchFilters)[] {
  return (Object.keys(filters) as (keyof SearchFilters)[]).filter((key) => key !== "q" && !(BAR_FILTER_KEYS as readonly string[]).includes(key));
}

/** Píldora que abre el panel (Ubicación y los filtros activos de «Más filtros»). */
function PillButton({ text, active, onOpen, onRemove, removeLabel }: { text: string; active: boolean; onOpen: () => void; onRemove?: () => void; removeLabel?: string }) {
  return (
    <span className={cn(PILL, active ? PILL_ON : PILL_OFF)}>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex min-h-11 items-center gap-1.5 rounded-full pl-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota",
          active ? "pr-2" : "pr-3",
        )}
      >
        {text}
        {!active && <ChevronDown size={16} aria-hidden="true" className="text-gris-texto" />}
      </button>
      {active && onRemove && <PillRemoveButton label={removeLabel ?? text} onRemove={onRemove} />}
    </span>
  );
}

const terms = (list: TermOption[]) => list.map((option) => ({ value: option.id, label: option.label }));
const toYear = (value: string): number | null => (value.trim() === "" || !Number.isFinite(Number(value)) ? null : Math.trunc(Number(value)));
const toBoolean = (value: string): boolean | null => (value === "" ? null : value === "true");

function Section({ title, children, sectionRef }: { title: string; children: ReactNode; sectionRef?: React.Ref<HTMLElement> }) {
  return (
    <section ref={sectionRef} className="flex scroll-mt-4 flex-col gap-3">
      <h3 className="text-base font-extrabold tracking-wide text-gris-texto uppercase">{title}</h3>
      {children}
    </section>
  );
}

export function SearchFilterBar({
  filters,
  options,
  total,
  onChange,
  onRemove,
  onClear,
  locationActions,
  locationNotice = null,
}: {
  filters: SearchFilters;
  options: SearchOptions;
  /** Total de la búsqueda con los filtros actuales, para «Ver N piezas». */
  total: number | null;
  onChange: (next: Partial<SearchFilters>) => void;
  onRemove: (key: keyof SearchFilters) => void;
  onClear: () => void;
  locationActions?: LocationTreeActions;
  locationNotice?: string | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const locationRef = useRef<HTMLElement>(null);
  const names = optionNames(options);
  const panelKeys = panelFilterKeys(filters);
  const panelChips = activeChips(filters, names).filter((chip) => panelKeys.includes(chip.key));

  function openPanel(section?: "ubicacion") {
    dialogRef.current?.showModal();
    if (section === "ubicacion") requestAnimationFrame(() => locationRef.current?.scrollIntoView({ block: "start" }));
  }
  const closePanel = () => dialogRef.current?.close();
  const location = filters.locationId ? (names[filters.locationId] ?? "(seleccionada)") : null;
  const pill = (key: BarKey): ReactNode => {
    switch (key) {
      case "categoryId":
        return <PillSelect label="Categoría" allLabel="Todas las categorías" value={filters.categoryId} options={terms(options.categories)} onChange={(categoryId) => onChange({ categoryId })} />;
      case "materialId":
        return <PillSelect label="Material" allLabel="Todos los materiales" value={filters.materialId} options={terms(options.materials)} onChange={(materialId) => onChange({ materialId })} />;
      case "collectionId":
        return <PillSelect label="Colección" allLabel="Todas las colecciones" value={filters.collectionId} options={terms(options.collections)} onChange={(collectionId) => onChange({ collectionId })} />;
      case "locationId":
        return (
          <PillButton
            text={location ? `Ubicación: ${location.split(" › ").at(-1)}` : "Ubicación"}
            removeLabel={`Ubicación: ${location}`}
            active={Boolean(location)}
            onOpen={() => openPanel("ubicacion")}
            onRemove={() => onRemove("locationId")}
          />
        );
      case "hasInventoryCode":
        return (
          <PillSelect
            label="Código I"
            allLabel="Con o sin código I"
            value={filters.hasInventoryCode === null ? null : String(filters.hasInventoryCode)}
            options={[
              { value: "true", label: "Con código I" },
              { value: "false", label: "Sin código I" },
            ]}
            onChange={(value) => onChange({ hasInventoryCode: value === null ? null : value === "true" })}
          />
        );
    }
  };

  return (
    <>
      <ul aria-label="Filtros" className="flex flex-wrap items-center gap-2">
        {BAR_FILTER_KEYS.map((key) => (
          <li key={key} className="flex">
            {pill(key)}
          </li>
        ))}
        {panelChips.map((chip) => (
          <li key={chip.key} className="flex">
            <PillButton text={`${chip.label}: ${chip.value}`} active onOpen={() => openPanel()} onRemove={() => onRemove(chip.key)} />
          </li>
        ))}
        <li className="flex">
          <button
            type="button"
            onClick={() => openPanel()}
            aria-haspopup="dialog"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-tinta px-4 text-base font-bold text-crema hover:bg-black focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota"
          >
            <SlidersHorizontal size={18} aria-hidden="true" />
            Más filtros
            {panelChips.length > 0 && (
              <span className="rounded-full bg-crema px-2 text-base leading-6 font-extrabold text-tinta tabular-nums">
                {panelChips.length}
                <span className="sr-only"> activos</span>
              </span>
            )}
          </button>
        </li>
      </ul>

      <dialog
        ref={dialogRef}
        aria-labelledby="mas-filtros-titulo"
        onClick={(event) => {
          if (event.target === event.currentTarget) closePanel();
        }}
        className="fixed inset-y-2 right-2 left-auto m-0 h-auto max-h-none w-[calc(100vw-1rem)] max-w-none flex-col overflow-hidden rounded-panel bg-white p-0 text-tinta shadow-md backdrop:bg-tinta/30 open:flex sm:w-[30rem]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-borde px-6 py-4">
          <h2 id="mas-filtros-titulo" className="text-2xl font-extrabold">
            Más filtros
          </h2>
          <button
            type="button"
            onClick={closePanel}
            aria-label="Cerrar «Más filtros»"
            className="grid size-11 place-items-center rounded-full border border-borde hover:bg-crema-light focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
          <Section title="La pieza">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input controlSize="md" label="Denominación" placeholder="p. ej. mate burilado" value={filters.denomination} onChange={(event) => onChange({ denomination: event.target.value })} />
              <Input controlSize="md" label="Descripción contiene" placeholder="p. ej. paja toquilla" value={filters.description} onChange={(event) => onChange({ description: event.target.value })} />
              <OptionSelect
                label="Estado de conservación"
                value={filters.conservationStateId}
                options={options.conservationStates}
                onChange={(conservationStateId) => onChange({ conservationStateId })}
                size="md"
              />
              <Select controlSize="md" label="Régimen de tenencia" value={filters.tenureRegime ?? ""} onChange={(event) => onChange({ tenureRegime: (event.target.value || null) as TenureRegimeLabel | null })}>
                <option value="">Todos</option>
                {TENURE_REGIMES.map((regime) => (
                  <option key={regime} value={regime}>
                    {regime}
                  </option>
                ))}
              </Select>
            </div>
          </Section>
          <Section title="Dónde está" sectionRef={locationRef}>
            <div className="max-h-80 overflow-y-auto rounded-md border border-borde p-3">
              <LocationTreeSelect label="Ubicación" nodes={options.locationTree} value={filters.locationId} onChange={(locationId) => onChange({ locationId })} actions={locationActions} notice={locationNotice} />
            </div>
          </Section>
          <Section title="Origen, época y ficha">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input id="author" controlSize="md" label="Autor" value={filters.author} onChange={(event) => onChange({ author: event.target.value })} />
              <Input id="provenance" controlSize="md" label="Procedencia" value={filters.provenance} onChange={(event) => onChange({ provenance: event.target.value })} />
              <Input controlSize="md" label="Época desde (año)" type="number" value={filters.epochStartYear ?? ""} onChange={(event) => onChange({ epochStartYear: toYear(event.target.value) })} />
              <Input controlSize="md" label="Época hasta (año)" type="number" value={filters.epochEndYear ?? ""} onChange={(event) => onChange({ epochEndYear: toYear(event.target.value) })} />
              <Select
                controlSize="md"
                fieldClassName="sm:col-span-2"
                label="Completitud de la ficha"
                value={filters.hasAlerts === null ? "" : String(filters.hasAlerts)}
                onChange={(event) => onChange({ hasAlerts: toBoolean(event.target.value) })}
              >
                <option value="">Todas las piezas</option>
                <option value="true">Solo piezas incompletas</option>
                <option value="false">Solo piezas completas</option>
              </Select>
            </div>
          </Section>
        </div>
        <div className="flex items-center gap-3 border-t border-borde px-6 py-4">
          <Button variant="neutral" icon={Eraser} onClick={onClear}>
            Limpiar todo
          </Button>
          <Button className="ml-auto" onClick={closePanel}>
            {total === null ? "Ver piezas" : `Ver ${total} pieza${total === 1 ? "" : "s"}`}
          </Button>
        </div>
      </dialog>
    </>
  );
}
