/**
 * KPIs de completitud (RF-035) y reportes (RF-033, RF-034, RF-044) calculados a partir del
 * catálogo sintético de `pieces.ts`, para que el tablero y los reportes sean consistentes entre
 * sí sin duplicar números a mano.
 */
import type { ApiSchemas } from "@/lib/api/client";

import { alertsForPiece, PIECES } from "./pieces";

type CompletenessKpis = ApiSchemas["CompletenessKpis"];
type AlertKpi = ApiSchemas["AlertKpi"];
type IncompletePiece = ApiSchemas["IncompletePiece"];
type ReportOut = ApiSchemas["ReportOut"];

type Piece = (typeof PIECES)[number];

const ALERT_DENOMINATOR: Record<AlertKpi["alert"], (piece: Piece) => boolean> = {
  MISSING_INVENTORY_CODE: (p) => p.tenure_regime === "Propiedad",
  MISSING_PHOTO: () => true,
  MISSING_LOCATION: () => true,
  MISSING_REQUIRED_FIELDS: () => true,
  MISSING_RECOMMENDED_FIELDS: () => true,
  UNNORMALIZABLE_IDENTIFIER: () => true,
};

function alertKpi(pieces: Piece[], alert: AlertKpi["alert"]): AlertKpi {
  const applicable = pieces.filter(ALERT_DENOMINATOR[alert]);
  const affected = applicable.filter((p) => alertsForPiece(p).find((a) => a.type === alert)?.applies);
  const denominator = applicable.length;
  const numerator = affected.length;
  return {
    alert,
    numerator,
    denominator,
    completeness_ratio: denominator === 0 ? null : Number((1 - numerator / denominator).toFixed(2)),
  };
}

const ALERT_CODES = Object.keys(ALERT_DENOMINATOR) as AlertKpi["alert"][];

export function computeCompletenessKpis(): CompletenessKpis {
  const byCollectionMap = new Map<string, { id: string; name: string; pieces: Piece[] }>();
  for (const piece of PIECES) {
    const key = piece.collection?.id ?? "sin-coleccion";
    const name = piece.collection?.name ?? "Piezas sueltas (sin colección)";
    const entry = byCollectionMap.get(key) ?? { id: key, name, pieces: [] };
    entry.pieces.push(piece);
    byCollectionMap.set(key, entry);
  }
  return {
    computed_at: "2026-09-17T07:00:00Z",
    total_pieces: PIECES.length,
    alerts: ALERT_CODES.map((alert) => alertKpi(PIECES, alert)),
    by_collection: [...byCollectionMap.values()].map((group) => ({
      collection_id: group.id,
      collection_name: group.name,
      alerts: ALERT_CODES.map((alert) => alertKpi(group.pieces, alert)),
    })),
  };
}

export function countPiecesByCollection(): { collection: string; count: number }[] {
  const byCollectionMap = new Map<string, number>();
  for (const piece of PIECES) {
    const key = piece.collection?.name ?? "Piezas sueltas (sin colección)";
    byCollectionMap.set(key, (byCollectionMap.get(key) ?? 0) + 1);
  }
  return [...byCollectionMap.entries()].map(([collection, count]) => ({ collection, count }));
}

export function computeIncompletePieces(): IncompletePiece[] {
  return PIECES.map((piece) => {
    const alerts = alertsForPiece(piece)
      .filter((a) => a.applies)
      .map((a) => a.type);
    return {
      piece_id: piece.id,
      title: piece.denomination,
      collection_name: piece.collection?.name ?? null,
      alerts,
    };
  }).filter((p) => p.alerts.length > 0);
}

/** Un reporte de demostración en una sola página: `rows` es el reporte completo. */
function singlePage(report: Omit<ReportOut, "page" | "page_size" | "total_rows">): ReportOut {
  return { ...report, page: 1, page_size: report.rows.length, total_rows: report.rows.length };
}

export function computeInventoryReport(): ReportOut {
  const rows = PIECES.map((p) => [
    p.denomination,
    p.collection?.name ?? "Sin colección",
    p.code_i ?? "Sin código I",
    p.tenure_regime,
    p.conservation_status?.label ?? "Sin registrar",
    p.location.path.length > 0 ? p.location.path.map((l) => l.name).join(" / ") : "Sin ubicación",
  ]);
  return singlePage({
    report_type: "inventory",
    title: "Inventario general (sintético)",
    generated_at: "2026-09-17T07:00:00Z",
    filters: {},
    columns: ["Denominación", "Colección", "Código I", "Régimen de tenencia", "Estado de conservación", "Ubicación"],
    rows,
    totals: { piezas: PIECES.length },
    download_url: null,
  });
}

export function computeByCollectionReport(): ReportOut {
  const counts = countPiecesByCollection();
  return singlePage({
    report_type: "by-collection",
    title: "Inventario por colección (sintético)",
    generated_at: "2026-09-17T07:00:00Z",
    filters: {},
    columns: ["Colección", "N.º de piezas"],
    rows: counts.map((row) => [row.collection, row.count]),
    totals: { colecciones: counts.length },
    download_url: null,
  });
}

export function computeByLocationReport(): ReportOut {
  const byLocation = new Map<string, number>();
  for (const piece of PIECES) {
    const key = piece.location.path.length > 0 ? piece.location.path[0].name : "Sin ubicación";
    byLocation.set(key, (byLocation.get(key) ?? 0) + 1);
  }
  return singlePage({
    report_type: "by-location",
    title: "Inventario por ubicación (sintético)",
    generated_at: "2026-09-17T07:00:00Z",
    filters: {},
    columns: ["Sede/ubicación", "N.º de piezas"],
    rows: [...byLocation.entries()].map(([location, count]) => [location, count]),
    totals: { piezas: PIECES.length },
    download_url: null,
  });
}

export function computeIncompleteReport(): ReportOut {
  const incomplete = computeIncompletePieces();
  return singlePage({
    report_type: "incomplete",
    title: "Piezas con información incompleta (sintético)",
    generated_at: "2026-09-17T07:00:00Z",
    filters: {},
    columns: ["Denominación", "Colección", "Alertas"],
    rows: incomplete.map((p) => [p.title, p.collection_name ?? "Sin colección", p.alerts.join(", ")]),
    totals: { piezas_incompletas: incomplete.length },
    download_url: null,
  });
}
