"use client";

/**
 * Pantalla 2 — Inicio / tablero: KPIs de completitud, últimas cargas, pendientes de revisión
 * (duplicados, sugerencias de IA) (RF-035, RF-030, RIA-01..05).
 *
 * Tarea 3.2 de `alertas-y-reporte-incompletas`: el tablero de completitud (global, por colección
 * y la evolución) se lee de `lib/data/quality.ts`, consciente del modo (`mock`: fixtures; `live`:
 * `GET /reports/dashboard-stats[?by_collection]` y `GET /reports/dashboard-stats/history`).
 */
import Link from "next/link";
import { useEffect, useState } from "react";

import { CompletenessChart } from "@/components/domain/CompletenessChart";
import { importBatchStatus } from "@/components/domain/status-intents";
import { AlertBadge, StatusBadge } from "@/components/domain/StatusBadges";
import { RequireSession } from "@/components/layout/RequireSession";
import { Card, cardClassName } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { useSession } from "@/lib/auth/session";
import {
  fetchDashboardHistory,
  fetchDashboardKpis,
  recentDateRange,
  type AlertType,
  type CompletenessKpis,
  type SnapshotPoint,
} from "@/lib/data/quality";
import { useMockStore } from "@/lib/data/mock-store";
import { alertsForPiece, computeIncompletePieces, PIECES } from "@/lib/fixtures";

const ALERT_LABELS: Record<AlertType, string> = {
  MISSING_INVENTORY_CODE: "Sin código I",
  MISSING_PHOTO: "Sin fotografía",
  MISSING_LOCATION: "Sin ubicación",
  MISSING_REQUIRED_FIELDS: "Campos obligatorios vacíos",
  MISSING_RECOMMENDED_FIELDS: "Campos recomendados vacíos",
  UNNORMALIZABLE_IDENTIFIER: "Identificador no normalizable",
};

function KpiCard({ label, value, href, tone = "neutral" }: { label: string; value: number | string; href?: string; tone?: "neutral" | "warning" }) {
  const className = cardClassName({
    interactive: Boolean(href),
    className: cn("flex flex-col gap-1", tone === "warning" && "border-ambar-alerta bg-ambar-bg"),
  });
  const content = (
    <>
      <p className={cn("text-sm font-medium", tone === "warning" ? "text-ambar-texto" : "text-gris-texto")}>{label}</p>
      <p className="font-heading text-3xl font-bold text-tinta">{value}</p>
    </>
  );
  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function alertKpi(kpis: CompletenessKpis, alert: AlertType) {
  return kpis.alerts.find((a) => a.alert === alert);
}

function ratioLabel(ratio: number | null | undefined): string {
  return ratio === null || ratio === undefined ? "No aplica" : `${Math.round(ratio * 100)} %`;
}

/** Tablero de completitud: KPI globales y por colección, y su evolución (design D3, D5). */
function CompletenessDashboard() {
  const { currentUser } = useSession();
  const devUser = currentUser?.email;
  const [kpis, setKpis] = useState<CompletenessKpis | null>(null);
  const [history, setHistory] = useState<SnapshotPoint[]>([]);
  const [chartAlert, setChartAlert] = useState<AlertType>("MISSING_PHOTO");

  useEffect(() => {
    let active = true;
    fetchDashboardKpis(true, devUser).then((result) => {
      if (active && result.status === "ok") setKpis(result.kpis);
    });
    const { from, to } = recentDateRange(new Date(), 14);
    fetchDashboardHistory(from, to, undefined, devUser).then((result) => {
      if (active && result.status === "ok") setHistory(result.points);
    });
    return () => {
      active = false;
    };
  }, [devUser]);

  if (!kpis) {
    return (
      <p role="status" className="text-base text-gris-texto">
        Calculando los indicadores de completitud…
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Piezas registradas" value={kpis.total_pieces} href="/busqueda" />
        <KpiCard label="Sin código I" value={alertKpi(kpis, "MISSING_INVENTORY_CODE")?.numerator ?? 0} href="/busqueda?incompleteOnly=1" tone="warning" />
        <KpiCard label="Sin fotografía" value={alertKpi(kpis, "MISSING_PHOTO")?.numerator ?? 0} href="/busqueda?incompleteOnly=1" tone="warning" />
        <KpiCard label="Sin ubicación" value={alertKpi(kpis, "MISSING_LOCATION")?.numerator ?? 0} href="/busqueda?incompleteOnly=1" tone="warning" />
      </div>
      <p className="text-sm text-gris-texto">calculado {new Date(kpis.computed_at).toLocaleString("es-PE")}</p>

      {kpis.by_collection.length > 0 && (
        <Card padded={false} className="overflow-x-auto">
          <table className="w-full text-left text-base">
            <thead className="bg-crema-light text-sm text-gris-texto">
              <tr>
                <th className="px-4 py-2 font-medium">Colección</th>
                {kpis.alerts.map((a) => (
                  <th key={a.alert} className="px-4 py-2 font-medium">
                    {ALERT_LABELS[a.alert]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kpis.by_collection.map((group) => (
                <tr key={group.collection_id} className="border-t border-borde">
                  <td className="px-4 py-2 font-medium text-tinta">{group.collection_name}</td>
                  {group.alerts.map((a) => (
                    <td key={a.alert} className="px-4 py-2 text-gris-texto">
                      {ratioLabel(a.completeness_ratio)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-tinta">Evolución (últimos 14 días)</h3>
          <Select
            label="Indicador"
            value={chartAlert}
            onChange={(event) => setChartAlert(event.target.value as AlertType)}
            fieldClassName="w-auto"
          >
            {kpis.alerts.map((a) => (
              <option key={a.alert} value={a.alert}>
                {ALERT_LABELS[a.alert]}
              </option>
            ))}
          </Select>
        </div>
        <CompletenessChart points={history} alert={chartAlert} />
      </Card>
    </>
  );
}

function InicioContent() {
  const { currentRole, hasPermission } = useSession();
  const store = useMockStore();
  const incomplete = computeIncompletePieces();
  const pendingSuggestions = store.aiSuggestions.filter((s) => s.status === "PENDING");
  const pendingDuplicates = store.duplicateCandidates.filter((d) => d.status === "PENDING");
  const recentBatches = [...store.importBatches].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-tinta">Inicio</h1>
        <p className="text-base text-gris-texto">
          Sesión de demostración como <strong className="text-tinta">{currentRole?.name}</strong>. Todos los datos son sintéticos y
          los cambios que haga aquí no se guardan al recargar la página.
        </p>
      </header>

      <section aria-labelledby="kpis" className="flex flex-col gap-3">
        <h2 id="kpis" className="text-lg font-semibold text-tinta">
          Completitud del catálogo (RF-035)
        </h2>
        <CompletenessDashboard />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-tinta">Últimas cargas de importación</h2>
            {hasPermission("imports.prepare") && (
              <Link href="/importacion" className="text-sm font-medium text-terracota underline">
                Ir al asistente
              </Link>
            )}
          </div>
          <ul className="flex flex-col gap-2">
            {recentBatches.map((batch) => (
              <li key={batch.id} className="flex flex-wrap items-center justify-between gap-2 text-base">
                <span className="break-all text-tinta">{batch.file_name}</span>
                <StatusBadge status={importBatchStatus(batch.status)} />
              </li>
            ))}
          </ul>
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-tinta">Pendientes de revisión</h2>
          <ul className="flex flex-col gap-2 text-base text-tinta">
            <li className="flex items-center justify-between gap-2">
              <span>Posibles duplicados</span>
              <Link href="/duplicados" className="font-semibold text-ambar-texto underline">
                {pendingDuplicates.length} pendientes
              </Link>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span>Sugerencias de IA sin revisar</span>
              <Link href="/ia/sugerencias" className="font-semibold text-ambar-texto underline">
                {pendingSuggestions.length} pendientes
              </Link>
            </li>
          </ul>
        </Card>
      </section>

      <section aria-labelledby="incompletas" className="flex flex-col gap-3">
        <h2 id="incompletas" className="text-lg font-semibold text-tinta">
          Piezas con información incompleta
        </h2>
        <Card padded={false} className="overflow-x-auto">
          <table className="w-full text-left text-base">
            <thead className="bg-crema-light text-sm text-gris-texto">
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
                  <tr key={item.piece_id} className="border-t border-borde">
                    <td className="px-4 py-2">
                      <Link href={`/piezas/${item.piece_id}`} className="font-medium text-tinta underline hover:text-terracota">
                        {item.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-gris-texto">{item.collection_name ?? "Sin colección"}</td>
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
        </Card>
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
