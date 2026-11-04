"use client";

/**
 * Pantalla 3 — Búsqueda: barra única que acepta cualquier código (vigente o histórico,
 * normalizado o tal como está escrito) o denominación (RF-031), filtros combinados en AND
 * (RF-032) y exportación de resultados a Excel (RF-036). En modo `live`, `SearchLive` usa `GET /search`
 * con el filtro único, las exportaciones reales y «Mis exportaciones» (change
 * `busqueda-avanzada-y-exportacion`, tareas 4.1 y 4.2).
 */
import { Eraser, FileSpreadsheet, Plus, SearchX } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { PieceCard, pieceCardProps } from "@/components/domain/PieceCard";
import { SearchBox } from "@/components/domain/SearchFilters";
import { SearchLive } from "@/components/domain/SearchLive";
import { RequireSession } from "@/components/layout/RequireSession";
import { Button, buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { useSession } from "@/lib/auth/session";
import { getApiMode } from "@/lib/data/mode";
import { filtersFromSearchParams } from "@/lib/data/search";
import { alertsForPiece, COLLECTIONS, getPieceDetail, listPieces, termsByVocabulary } from "@/lib/fixtures";
import Link from "next/link";

function BusquedaContent() {
  const { hasPermission } = useSession();
  // Viene de un enlace del tablero (p. ej. "Sin código I"): valor inicial del filtro, no
  // reactivo a cambios posteriores de la URL (el usuario puede destildarlo).
  const searchParams = useSearchParams();
  const [q, setQ] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [materialCode, setMaterialCode] = useState("");
  const [conservationStatusCode, setConservationStatusCode] = useState("");
  const [tenureRegime, setTenureRegime] = useState("");
  const [incompleteOnly, setIncompleteOnly] = useState(() => searchParams.get("incompleteOnly") === "1");
  const [exported, setExported] = useState(false);

  const result = useMemo(
    () =>
      listPieces({
        q,
        collectionId: collectionId || undefined,
        categoryCode: categoryCode || undefined,
        materialCode: materialCode || undefined,
        conservationStatusCode: conservationStatusCode || undefined,
        tenureRegime: tenureRegime || undefined,
        incompleteOnly,
        pageSize: 50,
      }),
    [q, collectionId, categoryCode, materialCode, conservationStatusCode, tenureRegime, incompleteOnly],
  );

  const categories = termsByVocabulary("CATEGORY");
  const materials = termsByVocabulary("MATERIAL");
  const conservationStatuses = termsByVocabulary("CONSERVATION_STATUS");

  const clearFilters = () => {
    setQ("");
    setCollectionId("");
    setCategoryCode("");
    setMaterialCode("");
    setConservationStatusCode("");
    setTenureRegime("");
    setIncompleteOnly(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-tinta">Búsqueda</h1>
        <SearchBox value={q} onChange={setQ} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card as="aside" aria-label="Filtros de búsqueda" className="flex flex-col gap-4">
          <FilterSelect label="Colección" value={collectionId} onChange={setCollectionId} options={COLLECTIONS.map((c) => ({ value: c.id, label: c.name }))} />
          <FilterSelect label="Categoría" value={categoryCode} onChange={setCategoryCode} options={categories.map((c) => ({ value: c.code, label: c.label }))} />
          <FilterSelect label="Material" value={materialCode} onChange={setMaterialCode} options={materials.map((c) => ({ value: c.code, label: c.label }))} />
          <FilterSelect label="Estado de conservación" value={conservationStatusCode} onChange={setConservationStatusCode} options={conservationStatuses.map((c) => ({ value: c.code, label: c.label }))} />
          <FilterSelect
            label="Régimen de tenencia"
            value={tenureRegime}
            onChange={setTenureRegime}
            options={[
              { value: "Propiedad", label: "Propia" },
              { value: "Comodato", label: "Comodato" },
              { value: "Préstamo Temporal", label: "Préstamo temporal" },
            ]}
          />

          <label className="flex min-h-11 items-center gap-2 text-sm text-tinta">
            <input type="checkbox" checked={incompleteOnly} onChange={(event) => setIncompleteOnly(event.target.checked)} className="size-5 accent-terracota" />
            Solo piezas incompletas
          </label>

          <Button variant="secondary" icon={Eraser} onClick={clearFilters}>
            Limpiar filtros
          </Button>
        </Card>

        <section className="flex flex-col gap-3" aria-label="Resultados">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-base text-gris-texto">
              <strong className="text-tinta">{result.total}</strong> resultado{result.total === 1 ? "" : "s"}
            </p>
            <div className="flex flex-wrap gap-2">
              {hasPermission("pieces.create") && (
                <Link href="/piezas/nueva" className={buttonClassName({})}>
                  <Plus size={18} aria-hidden="true" />
                  Nueva pieza
                </Link>
              )}
              {hasPermission("exports.run") && (
                <Button variant="outline" icon={FileSpreadsheet} onClick={() => setExported(true)}>
                  Exportar a Excel
                </Button>
              )}
            </div>
          </div>
          {exported && (
            <p role="status" className="rounded-md bg-verde-bg px-3 py-2 text-sm text-verde-exito">
              En el modo demostración no se genera el archivo; con datos reales se descarga un Excel con estos resultados.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {result.items.map((piece) => {
              const detail = getPieceDetail(piece.id);
              return <PieceCard key={piece.id} {...pieceCardProps(piece, detail ? alertsForPiece(detail) : [])} />;
            })}
            {result.items.length === 0 && (
              <Card className="flex flex-col items-center gap-2 border-dashed text-center text-base text-gris-texto sm:col-span-2">
                <SearchX size={24} aria-hidden="true" />
                No se encontraron piezas con estos filtros.
              </Card>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Todas</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

function BusquedaSwitch() {
  const searchParams = useSearchParams();
  if (getApiMode() !== "live") return <BusquedaContent />;
  // Los filtros de la dirección (enlaces compartidos, volver atrás y los del tablero de inicio).
  return <SearchLive initialFilters={filtersFromSearchParams(searchParams)} />;
}

export default function BusquedaPage() {
  return (
    <RequireSession>
      <Suspense fallback={null}>
        <BusquedaSwitch />
      </Suspense>
    </RequireSession>
  );
}
