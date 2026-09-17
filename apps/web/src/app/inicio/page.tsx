"use client";

/**
 * Pantalla 2 — Inicio / tablero: KPIs de completitud, últimas cargas, pendientes de revisión
 * (duplicados, sugerencias de IA) (RF-035, RF-030, RIA-01..05).
 */
import Link from "next/link";

import { AlertBadge } from "@/components/Badges";
import { RequireSession } from "@/components/RequireSession";
import { useSession } from "@/lib/auth/session";
import { useMockStore } from "@/lib/data/mock-store";
import { alertsForPiece, computeCompletenessKpis, computeIncompletePieces, PIECES } from "@/lib/fixtures";

function KpiCard({ label, value, href, tone = "neutral" }: { label: string; value: number | string; href?: string; tone?: "neutral" | "warning" }) {
  const content = (
    <div className={`flex flex-col gap-1 rounded-lg border p-4 ${tone === "warning" ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-white"}`}>
      <p className="text-sm font-medium text-stone-600">{label}</p>
      <p className="text-3xl font-bold text-stone-900">{value}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block transition hover:opacity-80">
      {content}
    </Link>
  ) : (
    content
  );
}

function InicioContent() {
  const { currentRole, hasPermission } = useSession();
  const store = useMockStore();
  const kpis = computeCompletenessKpis();
  const incomplete = computeIncompletePieces();
  const pendingSuggestions = store.aiSuggestions.filter((s) => s.status === "PENDING");
  const pendingDuplicates = store.duplicateCandidates.filter((d) => d.status === "PENDING");
  const recentBatches = [...store.importBatches].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-stone-900">Inicio</h1>
        <p className="text-base text-stone-700">
          Sesión de demostración como <strong>{currentRole?.name}</strong>. Todos los datos son sintéticos y los
          cambios que haga aquí no se guardan al recargar la página.
        </p>
      </header>

      <section aria-labelledby="kpis" className="flex flex-col gap-3">
        <h2 id="kpis" className="text-lg font-semibold text-stone-900">
          Completitud del catálogo (RF-035)
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Piezas registradas" value={kpis.total_pieces} href="/busqueda" />
          <KpiCard label="Sin código I" value={kpis.without_inventory_code} href="/busqueda?incompleteOnly=1" tone="warning" />
          <KpiCard label="Sin fotografía" value={kpis.without_photo} href="/busqueda?incompleteOnly=1" tone="warning" />
          <KpiCard label="Sin ubicación" value={kpis.without_location} href="/busqueda?incompleteOnly=1" tone="warning" />
        </div>
        <p className="text-sm text-stone-600">
          Índice de completitud: <strong>{Math.round(kpis.completeness_ratio * 100)} %</strong> · calculado{" "}
          {new Date(kpis.computed_at).toLocaleString("es-PE")}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-stone-900">Últimas cargas de importación</h2>
            {hasPermission("imports.prepare") && (
              <Link href="/importacion" className="text-sm font-medium text-stone-700 underline">
                Ir al asistente
              </Link>
            )}
          </div>
          <ul className="flex flex-col gap-2">
            {recentBatches.map((batch) => (
              <li key={batch.id} className="flex items-center justify-between gap-2 text-base">
                <span className="text-stone-900">{batch.file_name}</span>
                <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-sm font-medium text-stone-700">{batch.status}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-stone-900">Pendientes de revisión</h2>
          </div>
          <ul className="flex flex-col gap-2 text-base text-stone-900">
            <li className="flex items-center justify-between">
              <span>Posibles duplicados</span>
              <Link href="/duplicados" className="font-semibold text-amber-800">
                {pendingDuplicates.length} pendientes
              </Link>
            </li>
            <li className="flex items-center justify-between">
              <span>Sugerencias de IA sin revisar</span>
              <Link href="/ia/sugerencias" className="font-semibold text-amber-800">
                {pendingSuggestions.length} pendientes
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <section aria-labelledby="incompletas" className="flex flex-col gap-3">
        <h2 id="incompletas" className="text-lg font-semibold text-stone-900">
          Piezas con información incompleta
        </h2>
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-left text-base">
            <thead className="bg-stone-50 text-sm text-stone-600">
              <tr>
                <th className="px-4 py-2 font-medium">Pieza</th>
                <th className="px-4 py-2 font-medium">Colección</th>
                <th className="px-4 py-2 font-medium">Alertas</th>
              </tr>
            </thead>
            <tbody>
              {incomplete.slice(0, 6).map((item) => {
                const piece = PIECES.find((p) => p.id === item.piece_id);
                return (
                  <tr key={item.piece_id} className="border-t border-stone-100">
                    <td className="px-4 py-2">
                      <Link href={`/piezas/${item.piece_id}`} className="font-medium text-stone-900 underline">
                        {item.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-stone-700">{item.collection_name ?? "Sin colección"}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {piece && alertsForPiece(piece).filter((a) => a.applies).map((alert) => <AlertBadge key={alert.type} alert={alert} />)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function InicioPage() {
  return (
    <RequireSession>
      <InicioContent />
    </RequireSession>
  );
}
