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
      { signal: "identifier", field: "identifier:COLLECTION", similarity: 1, weight: 0.35, contribution: 0.35, values: { normalized: "MMZ-015", a: "M.M.Z. 015", b: "mmz 15" } },
      { signal: "denomination", field: "denomination", similarity: 0.93, weight: 0.3, contribution: 0.279, values: { a: "Toro de Pucará", b: "Toro de Pucará (3 cuernos)" } },
      { signal: "collection", field: "collection_id", similarity: 1, weight: 0.1, contribution: 0.1, values: { a: ids.collection(1), b: ids.collection(1) } },
    ],
    blocking_conflict: false,
    postponed_until: null,
    detected_by: "rules",
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
      { signal: "denomination", field: "denomination", similarity: 0.95, weight: 0.3, contribution: 0.285, values: { a: "Charango", b: "Charango (sintético, fila de carga)" } },
      { signal: "collection", field: "collection_id", similarity: 1, weight: 0.1, contribution: 0.1 },
    ],
    blocking_conflict: false,
    postponed_until: null,
    detected_by: "rules",
    status: "PENDING",
    resolution_note: null,
    reviewed_at: null,
    // La fila del Excel (change revisar-duplicados-comparacion): solo campos de catálogo, sintéticos.
    import_row: {
      batch_id: ids.importBatch(1),
      batch_name: "Sábana de prueba (sintética)",
      source_row_number: 6,
      denomination: "Charango (sintético, fila de carga)",
      collection_name: "Colección LRM (ficticia)",
      tenure_regime: "Propiedad",
      author: null,
      provenance: "Ayacucho",
      period_text: "Siglo XX",
      dimensions_text: null,
      identifiers: [{ type: "COLECCION", original_value: "LRM 12", normalized_value: "LRM-12" }],
      resolution: null,
      editable: true,
    },
  },
  {
    id: ids.duplicate(3),
    piece_a_id: ids.piece(7),
    piece_b_id: ids.piece(12),
    import_row_id: null,
    score: 0.61,
    matched_fields: [
      { signal: "collection", field: "collection_id", similarity: 1, weight: 0.1, contribution: 0.1 },
      { signal: "denomination", field: "denomination", similarity: 0.42, weight: 0.3, contribution: 0.126, values: { a: "Juego de mates burilados", b: "Manta tejida" } },
    ],
    blocking_conflict: false,
    postponed_until: null,
    detected_by: "rules",
    status: "DISTINCT",
    resolution_note: "Piezas distintas dentro de la misma colección MBB; solo coinciden en material.",
    reviewed_at: "2026-08-20T09:00:00Z",
  },
];
