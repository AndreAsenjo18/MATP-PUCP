/**
 * KPIs de completitud (RF-035) y reportes (RF-033, RF-034, RF-044) calculados a partir del
 * catálogo sintético de `pieces.ts`, para que el tablero y los reportes sean consistentes entre
 * sí sin duplicar números a mano.
 */
import type { ApiSchemas } from "@/lib/api/client";

import { alertsForPiece, MEDIA_BY_PIECE, PIECES } from "./pieces";

type CompletenessKpis = ApiSchemas["CompletenessKpis"];
type IncompletePiece = ApiSchemas["IncompletePiece"];
type ReportOut = ApiSchemas["ReportOut"];

export function computeCompletenessKpis(): CompletenessKpis {
  const total = PIECES.length;
  const withoutInventory = PIECES.filter((p) => alertsForPiece(p).find((a) => a.type === "WITHOUT_INVENTORY_CODE")?.applies).length;
  const withoutPhoto = PIECES.filter((p) => (MEDIA_BY_PIECE[p.id]?.length ?? 0) === 0).length;
  const withoutLocation = PIECES.filter((p) => p.location.path.length === 0).length;
  const missingRequired = PIECES.filter((p) => alertsForPiece(p).find((a) => a.type === "MISSING_REQUIRED_FIELDS")?.applies).length;
  const byCollectionMap = new Map<string, number>();
  for (const piece of PIECES) {
    const key = piece.collection?.name ?? "Piezas sueltas (sin colección)";
    byCollectionMap.set(key, (byCollectionMap.get(key) ?? 0) + 1);
  }
  return {
    computed_at: "2026-09-17T07:00:00Z",
    total_pieces: total,
    without_inventory_code: withoutInventory,
    without_photo: withoutPhoto,
    without_location: withoutLocation,
    missing_required_fields: missingRequired,
    completeness_ratio: Number((1 - (withoutInventory + withoutPhoto + withoutLocation) / (total * 3)).toFixed(2)),
    by_collection: [...byCollectionMap.entries()].map(([collection, count]) => ({ collection, count })),
  };
}

export function computeIncompletePieces(): IncompletePiece[] {
  return PIECES.map((piece) => {
    const alerts = alertsForPiece(piece)
      .filter((a) => a.applies)
      .map((a) => a.type);
    return {
      piece_id: piece.id,
      title: piece.title,
      collection_name: piece.collection?.name ?? null,
      alerts,
    };
  }).filter((p) => p.alerts.length > 0);
}

export function computeInventoryReport(): ReportOut {
  const rows = PIECES.map((p) => [
    p.title,
    p.collection?.name ?? "Sin colección",
    p.inventory_code ?? "Sin código I",
    p.tenure_regime,
    p.conservation_status?.label ?? "Sin registrar",
    p.location.path.length > 0 ? p.location.path.map((l) => l.name).join(" / ") : "Sin ubicación",
  ]);
  return {
    report_type: "inventory",
    title: "Inventario general (sintético)",
    generated_at: "2026-09-17T07:00:00Z",
    filters: {},
    columns: ["Denominación", "Colección", "Código I", "Régimen de tenencia", "Estado de conservación", "Ubicación"],
    rows,
    totals: { piezas: PIECES.length },
    download_url: null,
  };
}

export function computeByCollectionReport(): ReportOut {
  const kpis = computeCompletenessKpis();
  return {
    report_type: "by-collection",
    title: "Inventario por colección (sintético)",
    generated_at: "2026-09-17T07:00:00Z",
    filters: {},
    columns: ["Colección", "N.º de piezas"],
    rows: kpis.by_collection.map((row) => [row.collection as string, row.count as number]),
    totals: { colecciones: kpis.by_collection.length },
    download_url: null,
  };
}

export function computeByLocationReport(): ReportOut {
  const byLocation = new Map<string, number>();
  for (const piece of PIECES) {
    const key = piece.location.path.length > 0 ? piece.location.path[0].name : "Sin ubicación";
    byLocation.set(key, (byLocation.get(key) ?? 0) + 1);
  }
  return {
    report_type: "by-location",
    title: "Inventario por ubicación (sintético)",
    generated_at: "2026-09-17T07:00:00Z",
    filters: {},
    columns: ["Sede/ubicación", "N.º de piezas"],
    rows: [...byLocation.entries()].map(([location, count]) => [location, count]),
    totals: { piezas: PIECES.length },
    download_url: null,
  };
}

export function computeIncompleteReport(): ReportOut {
  const incomplete = computeIncompletePieces();
  return {
    report_type: "incomplete",
    title: "Piezas con información incompleta (sintético)",
    generated_at: "2026-09-17T07:00:00Z",
    filters: {},
    columns: ["Denominación", "Colección", "Alertas"],
    rows: incomplete.map((p) => [p.title, p.collection_name ?? "Sin colección", p.alerts.join(", ")]),
    totals: { piezas_incompletas: incomplete.length },
    download_url: null,
  };
}
