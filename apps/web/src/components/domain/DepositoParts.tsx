/**
 * Piezas de presentación de la vista de Depósito, compartidas por el modo demostración y el modo
 * conectado (change `rediseno-ux-deposito`): nombre y código destacados, destinos finales con
 * buscador y la distribución en dos columnas desde `lg` (una sola con controles táctiles en celular).
 */
import { ArrowLeft, ArrowRight, MapPin, PackageSearch } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { Card, cardClassName } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { filterDestinations, type DestinationOption } from "@/lib/data/locations";

/** Código de inventario general en una etiqueta visible; sin código, lo dice con el mismo lugar. */
export function CodeChip({ code }: { code: string | null | undefined }) {
  if (!code) {
    return <span className="whitespace-nowrap rounded-md bg-crema px-2 py-0.5 text-sm font-medium text-gris-texto">Sin código I</span>;
  }
  return <span className="whitespace-nowrap rounded-md bg-terracota-light px-2 py-0.5 font-mono text-sm font-bold text-terracota-dark">{code}</span>;
}

/** Nombre de la pieza en grande y en negrita con su código al lado. */
export function PieceTitle({ name, code, as: Heading = "p", className }: { name: string; code: string | null | undefined; as?: "h2" | "p"; className?: string }) {
  return (
    <Heading className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      <span className="font-heading text-lg font-bold leading-snug text-tinta">{name}</span>
      <CodeChip code={code} />
    </Heading>
  );
}

export interface PieceResultProps {
  name: string;
  code: string | null | undefined;
  location: string | null | undefined;
  active?: boolean;
  onSelect: () => void;
}

/** Fila de resultado: nombre y código primero, ubicación como dato secundario. */
export function PieceResult({ name, code, location, active = false, onSelect }: PieceResultProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={cardClassName({
        interactive: true,
        className: cn("flex w-full flex-col gap-1 text-left", active && "border-terracota bg-terracota-light/40"),
      })}
    >
      <PieceTitle name={name} code={code} />
      <span className="flex items-start gap-1.5 text-sm text-gris-texto">
        <MapPin size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
        {location ?? "Sin ubicación"}
      </span>
    </button>
  );
}

/** Explica que solo se listan lugares finales; las rutas completas dan el contexto. */
export const DESTINATION_HINT = "Solo lugares finales (nivel o contenedor): ahí es donde queda guardada la pieza.";

export interface DestinationPickerProps {
  options: readonly DestinationOption[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
}

/** «Mover a»: buscador y lista de lugares finales con su ruta completa. */
export function DestinationPicker({ options, value, onChange, label = "Mover a" }: DestinationPickerProps) {
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
        <option value="">Seleccione un destino…</option>
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

export interface PiecePanelProps {
  name: string;
  code: string | null | undefined;
  /** Ubicación actual ya como texto. */
  location: string;
  href: string;
  photo?: { src: string; alt: string };
  onBack: () => void;
  verify: ReactNode;
  move: ReactNode;
  feedback?: ReactNode;
}

/** Panel de la pieza elegida: cabecera con nombre y código, ubicación y las dos acciones. */
export function PiecePanel({ name, code, location, href, photo, onBack, verify, move, feedback }: PiecePanelProps) {
  return (
    <Card className="flex flex-col gap-4 lg:p-5">
      <button
        type="button"
        onClick={onBack}
        className="flex min-h-11 items-center gap-1 self-start text-base text-gris-texto underline hover:text-terracota lg:hidden"
      >
        <ArrowLeft size={18} aria-hidden="true" />
        Buscar otra pieza
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- foto sintética en data: URI
          <img src={photo.src} alt={photo.alt} className="order-2 aspect-[4/3] max-h-48 w-full rounded-md object-cover sm:order-1 sm:w-48 sm:shrink-0" />
        )}
        <div className="order-1 flex min-w-0 flex-1 flex-col gap-2 sm:order-2">
          <PieceTitle as="h2" name={name} code={code} className="[&>span:first-child]:text-xl lg:[&>span:first-child]:text-2xl" />
          <p className="flex items-start gap-2 text-base text-tinta lg:text-sm">
            <MapPin size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-terracota" />
            <span>
              Ubicación actual: <strong>{location}</strong>
            </span>
          </p>
          <Link href={href} className="inline-flex items-center gap-1 self-start text-base text-terracota underline lg:text-sm">
            Ver ficha completa
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="grid gap-4 border-t border-borde pt-4 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:gap-6">
        <section aria-label="Verificar" className="flex flex-col gap-2">
          <h3 className="text-base font-semibold text-tinta lg:text-sm">Verificar</h3>
          <p className="text-sm text-gris-texto">Confirma que la pieza sigue en su ubicación actual.</p>
          {verify}
        </section>
        <section aria-label="Mover" className="flex flex-col gap-3 border-t border-borde pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
          <h3 className="text-base font-semibold text-tinta lg:text-sm">Mover</h3>
          {move}
        </section>
      </div>
      {feedback}
    </Card>
  );
}

/** Panel vacío del escritorio, mientras no hay pieza elegida. */
export function PieceDetailPlaceholder() {
  return (
    <div className="hidden min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-borde bg-white/60 p-6 text-center lg:flex">
      <PackageSearch size={28} aria-hidden="true" className="text-gris-texto" />
      <p className="text-sm text-gris-texto">Busque una pieza a la izquierda y elíjala para verificarla o moverla.</p>
    </div>
  );
}

export interface DepositoLayoutProps {
  title: string;
  subtitle: string;
  /** Búsqueda y resultados (columna izquierda). */
  search: ReactNode;
  /** Panel de la pieza elegida, o `null` si no hay. */
  detail: ReactNode | null;
  /** Lote pendiente, debajo del panel. */
  extra?: ReactNode;
}

/**
 * Una columna en celular (con la pieza elegida se oculta la búsqueda) y dos desde `lg`: búsqueda y
 * resultados a la izquierda, panel de la pieza y lote a la derecha.
 */
export function DepositoLayout({ title, subtitle, search, detail, extra }: DepositoLayoutProps) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold text-tinta lg:text-2xl">{title}</h1>
        <p className="text-base text-gris-texto lg:text-sm">{subtitle}</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start">
        <section aria-label="Buscar pieza" className={cn("flex flex-col gap-3", detail !== null && "hidden lg:flex")}>
          {search}
        </section>
        <div className="flex min-w-0 flex-col gap-4">
          {detail ?? <PieceDetailPlaceholder />}
          {extra}
        </div>
      </div>
    </div>
  );
}
