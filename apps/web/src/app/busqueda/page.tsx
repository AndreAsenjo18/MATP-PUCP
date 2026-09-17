"use client";

/**
 * Pantalla 3 — Búsqueda: barra única que acepta cualquier código (vigente o histórico,
 * normalizado o tal como está escrito) o denominación (RF-031), filtros combinados en AND
 * (RF-032) y exportación de resultados a Excel (RF-036).
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { AlertBadge, TenureBadge } from "@/components/Badges";
import { RequireSession } from "@/components/RequireSession";
import { useSession } from "@/lib/auth/session";
import { alertsForPiece, COLLECTIONS, getPieceDetail, listPieces, termsByVocabulary } from "@/lib/fixtures";

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

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-stone-900">Búsqueda</h1>
        <p className="text-base text-stone-700">
          Busque por cualquier código —vigente o histórico, con o sin formato (&quot;I 236&quot;, &quot;M.M.Z. 015&quot;,
          &quot;mmz 15&quot;)— o por denominación.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="flex flex-col gap-4 rounded-lg border border-stone-200 bg-white p-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="q" className="text-sm font-medium text-stone-900">
              Código o denominación
            </label>
            <input
              id="q"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="p. ej. I-0236, mmz 15, &quot;Toro de Pucará&quot;"
              className="rounded-md border border-stone-300 p-2.5 text-base text-stone-900"
            />
          </div>

          <FilterSelect label="Colección" value={collectionId} onChange={setCollectionId} options={COLLECTIONS.map((c) => ({ value: c.id, label: c.name }))} />
          <FilterSelect label="Categoría" value={categoryCode} onChange={setCategoryCode} options={categories.map((c) => ({ value: c.code, label: c.label }))} />
          <FilterSelect label="Material" value={materialCode} onChange={setMaterialCode} options={materials.map((c) => ({ value: c.code, label: c.label }))} />
          <FilterSelect label="Estado de conservación" value={conservationStatusCode} onChange={setConservationStatusCode} options={conservationStatuses.map((c) => ({ value: c.code, label: c.label }))} />
          <FilterSelect
            label="Régimen de tenencia"
            value={tenureRegime}
            onChange={setTenureRegime}
            options={[
              { value: "OWNED", label: "Propia" },
              { value: "LOAN_FOR_USE", label: "Comodato" },
              { value: "TEMPORARY_LOAN", label: "Préstamo temporal" },
            ]}
          />

          <label className="flex items-center gap-2 text-sm text-stone-900">
            <input type="checkbox" checked={incompleteOnly} onChange={(event) => setIncompleteOnly(event.target.checked)} />
            Solo piezas incompletas
          </label>

          <button
            type="button"
            onClick={() => {
              setQ("");
              setCollectionId("");
              setCategoryCode("");
              setMaterialCode("");
              setConservationStatusCode("");
              setTenureRegime("");
              setIncompleteOnly(false);
            }}
            className="rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-700 hover:bg-stone-100"
          >
            Limpiar filtros
          </button>
        </aside>

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-base text-stone-700">
              <strong>{result.total}</strong> resultado{result.total === 1 ? "" : "s"}
            </p>
            {hasPermission("exports.run") && (
              <button
                type="button"
                onClick={() => setExported(true)}
                className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-900 hover:bg-stone-100"
              >
                Exportar a Excel
              </button>
            )}
          </div>
          {exported && (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              Descarga simulada: en modo mock no se genera un archivo real; en modo conectado se descargaría
              {" "}
              <code>resultados-busqueda.xlsx</code> (RF-036).
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {result.items.map((piece) => {
              const detail = getPieceDetail(piece.id);
              const alerts = detail ? alertsForPiece(detail).filter((a) => a.applies) : [];
              return (
                <Link
                  key={piece.id}
                  href={`/piezas/${piece.id}`}
                  className="flex flex-col gap-2 rounded-lg border border-stone-200 bg-white p-4 hover:border-stone-400"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-semibold text-stone-900">{piece.title}</h3>
                    <TenureBadge regime={piece.tenure_regime} />
                  </div>
                  <p className="text-sm text-stone-600">{piece.collection?.name ?? "Sin colección"}</p>
                  <p className="text-sm text-stone-700">
                    Código I: <strong>{piece.inventory_code ?? "Sin código I"}</strong>
                  </p>
                  <p className="text-sm text-stone-700">{piece.location_label ?? "Sin ubicación"}</p>
                  {alerts.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {alerts.map((alert) => (
                        <AlertBadge key={alert.type} alert={alert} />
                      ))}
                    </div>
                  )}
                </Link>
              );
            })}
            {result.items.length === 0 && (
              <p className="col-span-2 rounded-lg border border-dashed border-stone-300 p-6 text-center text-base text-stone-600">
                No se encontraron piezas con estos filtros.
              </p>
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
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-stone-900">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-stone-300 p-2 text-base text-stone-900">
        <option value="">Todas</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function BusquedaPage() {
  return (
    <RequireSession>
      <Suspense fallback={null}>
        <BusquedaContent />
      </Suspense>
    </RequireSession>
  );
}
