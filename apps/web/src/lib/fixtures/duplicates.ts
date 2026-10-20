/**
 * Cola de posibles duplicados por similitud (RF-030, calidad-datos): comparación lado a lado,
 * fusionar o marcar como distinto — nunca borrar (RN-005).
 */
import type { ApiSchemas } from "@/lib/api/client";

import { ids } from "./ids";

type DuplicateCandidateOut = ApiSchemas["DuplicateCandidateOut"];

export const DUPLICATE_CANDIDATES: DuplicateCandidateOut[] = [
  {
    id: ids.duplicate(1),
    piece_a_id: ids.piece(1),
    piece_b_id: ids.piece(2),
    import_row_id: null,
    score: 0.93,
    matched_fields: [
      { signal: "identifier", field: "identifier:COLECCION", similarity: 1, weight: 0.35, contribution: 0.35 },
      { signal: "denomination", field: "denomination", similarity: 0.93, weight: 0.3, contribution: 0.279 },
      { signal: "collection", field: "collection_id", similarity: 1, weight: 0.1, contribution: 0.1 },
    ],
    blocking_conflict: false,
    postponed_until: null,
    detected_by: "similarity-index-v1 (rapidfuzz + pg_trgm) [SUPUESTO]",
    status: "PENDING",
    resolution_note: null,
    reviewed_at: null,
  },
  {
    id: ids.duplicate(2),
    piece_a_id: ids.piece(9),
    piece_b_id: null,
    import_row_id: ids.importRow(6),
    score: 0.87,
    matched_fields: [
      { signal: "denomination", field: "denomination", similarity: 0.95, weight: 0.3, contribution: 0.285 },
      { signal: "collection", field: "collection_id", similarity: 1, weight: 0.1, contribution: 0.1 },
    ],
    blocking_conflict: false,
    postponed_until: null,
    detected_by: "similarity-index-v1 (rapidfuzz + pg_trgm) [SUPUESTO]",
    status: "PENDING",
    resolution_note: null,
    reviewed_at: null,
  },
  {
    id: ids.duplicate(3),
    piece_a_id: ids.piece(7),
    piece_b_id: ids.piece(12),
    import_row_id: null,
    score: 0.61,
    matched_fields: [
      { signal: "collection", field: "collection_id", similarity: 1, weight: 0.1, contribution: 0.1 },
      { signal: "denomination", field: "denomination", similarity: 0.42, weight: 0.3, contribution: 0.126 },
    ],
    blocking_conflict: false,
    postponed_until: null,
    detected_by: "similarity-index-v1 (rapidfuzz + pg_trgm) [SUPUESTO]",
    status: "DISTINCT",
    resolution_note: "Piezas distintas dentro de la misma colección MBB; solo coinciden en material.",
    reviewed_at: "2026-08-20T09:00:00Z",
  },
];
