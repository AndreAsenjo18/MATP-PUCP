/**
 * Punto único de acceso a los datos sintéticos de la maqueta (RNF-002/RNF-008/RNF-010:
 * navegable sin backend). `lib/data/*` construye sobre estas funciones "de solo lectura" y le
 * añade el estado mutable de la sesión de demostración (aprobar, fusionar, decidir…).
 */
import type { ApiSchemas } from "@/lib/api/client";

import { AI_SUGGESTIONS } from "./ai-suggestions";
import { AUDIT_LOG, auditForPiece } from "./audit";
import { COLLECTIONS } from "./collections";
import { DUPLICATE_CANDIDATES } from "./duplicates";
import { IDENTIFIER_TYPES, ROLES, TERMS, USERS, VOCABULARIES, termsByVocabulary } from "./reference-data";
import { IMPORT_BATCHES, IMPORT_ROWS, IMPORT_TEMPLATES, rowsForBatch } from "./imports";
import { computeByCollectionReport, computeByLocationReport, computeCompletenessKpis, computeIncompleteReport, computeIncompletePieces, computeInventoryReport } from "./kpis-reports";
import { LOCATIONS, locationPath } from "./locations";
import { alertsForPiece, MEDIA_BY_PIECE, MOVEMENTS_BY_PIECE, PIECES, SOURCE_RECORDS_BY_PIECE } from "./pieces";

export * from "./ids";
export { COLLECTIONS, DUPLICATE_CANDIDATES, IDENTIFIER_TYPES, LOCATIONS, locationPath, ROLES, TERMS, USERS, VOCABULARIES };
export { AI_SUGGESTIONS, AUDIT_LOG, IMPORT_BATCHES, IMPORT_ROWS, IMPORT_TEMPLATES, PIECES };
export { alertsForPiece, auditForPiece, rowsForBatch, termsByVocabulary };
export {
  computeByCollectionReport,
  computeByLocationReport,
  computeCompletenessKpis,
  computeIncompleteReport,
  computeIncompletePieces,
  computeInventoryReport,
};

type PieceDetail = ApiSchemas["PieceDetail"];
type PieceSummary = ApiSchemas["PieceSummary"];
type SearchHit = ApiSchemas["SearchHit"];
type Page<T> = { items: T[]; total: number; page: number; page_size: number };

export function toSummary(detail: PieceDetail): PieceSummary {
  return {
    id: detail.id,
    title: detail.title,
    collection: detail.collection,
    tenure_regime: detail.tenure_regime,
    inventory_code: detail.inventory_code,
    codes: detail.identifiers
      .filter((i) => i.is_current)
      .map((i) => ({ identifier_type_code: i.identifier_type_code, original_value: i.original_value, normalized_value: i.normalized_value })),
    category: detail.category,
    conservation_status: detail.conservation_status,
    has_location: detail.location.path.length > 0,
    location_label: detail.location.path.length > 0 ? detail.location.path.map((l) => l.name).join(" / ") : null,
    media_count: detail.media_count,
    period_text: detail.period.text ?? null,
    updated_at: detail.updated_at,
  };
}

export interface PieceFilters {
  q?: string;
  collectionId?: string;
  categoryCode?: string;
  materialCode?: string;
  periodType?: string;
  conservationStatusCode?: string;
  tenureRegime?: string;
  incompleteOnly?: boolean;
  page?: number;
  pageSize?: number;
}

function matchesQuery(piece: PieceDetail, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (piece.title.toLowerCase().includes(needle)) return true;
  const compactNeedle = needle.replace(/[.\s]/g, "");
  return piece.identifiers.some(
    (i) =>
      i.original_value.toLowerCase().replace(/[.\s]/g, "").includes(compactNeedle) ||
      (i.normalized_value?.toLowerCase().includes(needle) ?? false),
  );
}

function matchesFilters(piece: PieceDetail, filters: PieceFilters): boolean {
  if (filters.q && !matchesQuery(piece, filters.q)) return false;
  if (filters.collectionId && piece.collection?.id !== filters.collectionId) return false;
  if (filters.categoryCode && piece.category?.code !== filters.categoryCode) return false;
  if (filters.materialCode && !piece.materials.some((m) => m.code === filters.materialCode)) return false;
  if (filters.conservationStatusCode && piece.conservation_status?.code !== filters.conservationStatusCode) return false;
  if (filters.tenureRegime && piece.tenure_regime !== filters.tenureRegime) return false;
  if (filters.periodType && piece.period.type !== filters.periodType) return false;
  if (filters.incompleteOnly && !alertsForPiece(piece).some((a) => a.applies)) return false;
  return true;
}

/** Filtros combinados (AND, RF-032) sobre el catálogo sintético. */
export function listPieces(filters: PieceFilters = {}): Page<PieceSummary> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const filtered = PIECES.filter((p) => matchesFilters(p, filters));
  const start = (page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize).map(toSummary),
    total: filtered.length,
    page,
    page_size: pageSize,
  };
}

export function getPieceDetail(id: string): PieceDetail | undefined {
  return PIECES.find((p) => p.id === id);
}

/** Búsqueda por cualquier código (vigente o histórico, normalizado o tal como está escrito) o denominación (RF-031). */
export function searchPieces(query: string, page = 1, pageSize = 20): Page<SearchHit> {
  const q = query.trim().toLowerCase();
  if (!q) return { items: [], total: 0, page, page_size: pageSize };
  const hits: SearchHit[] = [];
  for (const piece of PIECES) {
    const identifierHit = piece.identifiers.find(
      (i) =>
        i.original_value.toLowerCase().replace(/[.\s]/g, "").includes(q.replace(/[.\s]/g, "")) ||
        (i.normalized_value?.toLowerCase().includes(q) ?? false),
    );
    if (identifierHit) {
      hits.push({
        piece: toSummary(piece),
        match_type: "IDENTIFIER",
        matched_identifier: { identifier_type_code: identifierHit.identifier_type_code, original_value: identifierHit.original_value, normalized_value: identifierHit.normalized_value },
      });
      continue;
    }
    if (piece.title.toLowerCase().includes(q)) {
      hits.push({ piece: toSummary(piece), match_type: "TITLE", matched_identifier: null });
    }
  }
  const start = (page - 1) * pageSize;
  return { items: hits.slice(start, start + pageSize), total: hits.length, page, page_size: pageSize };
}

export function getPieceMedia(pieceId: string): ApiSchemas["MediaAssetOut"][] {
  return MEDIA_BY_PIECE[pieceId] ?? [];
}

export function getPieceMovements(pieceId: string): ApiSchemas["MovementOut"][] {
  return MOVEMENTS_BY_PIECE[pieceId] ?? [];
}

export function getPieceSourceRecords(pieceId: string): ApiSchemas["SourceRecordOut"][] {
  return SOURCE_RECORDS_BY_PIECE[pieceId] ?? [];
}

export function getPieceAiSuggestions(pieceId: string): ApiSchemas["AiSuggestionOut"][] {
  return AI_SUGGESTIONS.filter((s) => s.piece_id === pieceId);
}
