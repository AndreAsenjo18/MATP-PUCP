/**
 * Lote de importación sintético (RF-021..029): ingesta → mapeo → normalización/validación →
 * previsualización con diff → aprobación → bitácora. Basado en las mismas filas "sucias" que
 * `apps/api/app/seed/fixtures.py` (sabana_sintetica_v1.xlsx), para reflejar el mismo caso de uso.
 */
import type { ApiSchemas } from "@/lib/api/client";

import { ids } from "./ids";

type ImportBatchOut = ApiSchemas["ImportBatchOut"];
type ImportRowOut = ApiSchemas["ImportRowOut"];
type MappingTemplateOut = ApiSchemas["MappingTemplateOut"];

export const IMPORT_TEMPLATES: MappingTemplateOut[] = [
  {
    id: ids.importBatch(900),
    name: "Sábana consultoría 2024/25 (columnas estándar)",
    description: "Plantilla reutilizable para las sábanas Excel con el formato de la consultoría 2024/25 (RF-022).",
    source_name: "Sábana consultoría 2024/25 (sintética)",
    header_signature: "sha256-sintetico-encabezados-sabana-v1",
    columns: [
      { source_column: "CÓDIGOS", target_field: "identifier:I", identifier_type_code: "I", split_compound: true },
      { source_column: "COLECCIÓN", target_field: "collection_acronym", identifier_type_code: null, split_compound: false },
      { source_column: "DENOMINACIÓN", target_field: "title", identifier_type_code: null, split_compound: false },
      { source_column: "ÉPOCA", target_field: "period_text", identifier_type_code: null, split_compound: false },
      { source_column: "MATERIAL", target_field: "materials_raw", identifier_type_code: null, split_compound: false },
      { source_column: "MEDIDAS", target_field: "dimensions_text", identifier_type_code: null, split_compound: false },
      { source_column: "PROCEDENCIA", target_field: "provenance", identifier_type_code: null, split_compound: false },
      { source_column: "UBICACIÓN", target_field: "location_raw", identifier_type_code: null, split_compound: false },
      { source_column: "OBS. CONSULTORÍA", target_field: null, identifier_type_code: null, split_compound: false },
    ],
    created_at: "2026-01-10T09:00:00Z",
  },
];

export const IMPORT_BATCHES: ImportBatchOut[] = [
  {
    id: ids.importBatch(1),
    file_name: "sabana_sintetica_v1.xlsx",
    file_sha256: "sha256-sintetico-batch-1",
    source_name: "Sábana consultoría 2024/25 (sintética)",
    template_id: IMPORT_TEMPLATES[0].id,
    status: "IN_PREVIEW",
    counts: { total: 12, new: 3, update: 2, possible_duplicate: 1, conflict: 1, pending: 5 },
    stage_timestamps: {
      uploaded: "2026-09-10T08:50:00Z",
      mapped: "2026-09-10T08:55:00Z",
      validated: "2026-09-10T09:00:00Z",
      in_preview: "2026-09-10T09:05:00Z",
    },
    status_reason: null,
    uploaded_by_id: ids.user(3),
    approved_by_id: null,
    approved_at: null,
    created_at: "2026-09-10T08:50:00Z",
  },
  {
    id: ids.importBatch(2),
    file_name: "sabana_deposito_2_2026.xlsx",
    file_sha256: "sha256-sintetico-batch-2",
    source_name: "Inventario depósito 2 (sintético)",
    template_id: IMPORT_TEMPLATES[0].id,
    status: "APPLIED",
    counts: { total: 8, new: 6, update: 1, possible_duplicate: 0, conflict: 1, rejected: 1, applied: 7 },
    stage_timestamps: {
      uploaded: "2026-08-01T09:00:00Z",
      approved: "2026-08-02T10:00:00Z",
      applied: "2026-08-02T10:05:00Z",
    },
    status_reason: null,
    uploaded_by_id: ids.user(2),
    approved_by_id: ids.user(1),
    approved_at: "2026-08-02T10:00:00Z",
    created_at: "2026-08-01T09:00:00Z",
  },
];

function row(
  n: number,
  batchId: string,
  sourceRow: number,
  classification: ImportRowOut["classification"],
  decision: ImportRowOut["decision"],
  raw: Record<string, unknown>,
  mapped: Record<string, unknown> | null,
  diff: ApiSchemas["FieldDiff"][],
  opts: Partial<ImportRowOut> = {},
): ImportRowOut {
  return {
    id: ids.importRow(n),
    batch_id: batchId,
    source_row_number: sourceRow,
    raw_data: raw,
    mapped_data: mapped,
    classification,
    decision,
    decision_reason: opts.decision_reason ?? null,
    diff,
    matches: opts.matches ?? [],
    target_piece_id: opts.target_piece_id ?? null,
    validation_errors: opts.validation_errors ?? [],
  };
}

export const IMPORT_ROWS: ImportRowOut[] = [
  row(1, ids.importBatch(1), 1, "UPDATE", "PENDING",
    { "N°": 1, CÓDIGOS: "I-0236 / M.M.Z. 015", COLECCIÓN: "MMZ", DENOMINACIÓN: "Toro de Pucará", ÉPOCA: "s. XX" },
    { title: "Toro de Pucará", collection_acronym: "MMZ", inventory_code: "I-0236" },
    [{ field: "location_label", current_value: "Depósito 1 / Rack A / Nivel 2", incoming_value: null }],
    { target_piece_id: ids.piece(1), matches: [{ piece_id: ids.piece(1), matched_by: "identifier I-0236", score: 1 }] }),
  row(2, ids.importBatch(1), 2, "POSSIBLE_DUPLICATE", "PENDING",
    { "N°": 2, CÓDIGOS: "I 236", COLECCIÓN: "M.M.Z.", DENOMINACIÓN: "Toro de pucara", ÉPOCA: "S. XX" },
    { title: "Toro de pucara", collection_acronym: "MMZ", inventory_code: "I-0236" },
    [{ field: "title", current_value: "Toro de Pucará", incoming_value: "Toro de pucara" }],
    { matches: [{ piece_id: ids.piece(1), matched_by: "identificador normalizado I-0236", score: 0.97 }] }),
  row(3, ids.importBatch(1), 3, "NEW", "ACCEPTED",
    { "N°": 3, CÓDIGOS: "I 2362 / RA 28", COLECCIÓN: "RA", DENOMINACIÓN: "Retablo ayacuchano", ÉPOCA: "ca. 1950" },
    { title: "Retablo ayacuchano", collection_acronym: "RA", inventory_code: "I-2362" },
    []),
  row(4, ids.importBatch(1), 4, "NEW", "PENDING",
    { "N°": 4, CÓDIGOS: "S/N", COLECCIÓN: "RAB", DENOMINACIÓN: "Cajón San Marcos", ÉPOCA: "1960-1970" },
    { title: "Cajón San Marcos", collection_acronym: "RAB", inventory_code: null },
    []),
  row(5, ids.importBatch(1), 5, "CONFLICT", "PENDING",
    { "N°": 5, CÓDIGOS: "AJB 12 / I-0100", COLECCIÓN: "AJB", DENOMINACIÓN: "Niño Manuelito", ÉPOCA: "s. XIX" },
    { title: "Niño Manuelito", collection_acronym: "AJB", inventory_code: "I-0100" },
    [{ field: "inventory_code", current_value: null, incoming_value: "I-0100" }],
    {
      validation_errors: [
        { field: "inventory_code", message: "Una pieza en comodato nunca puede recibir código I (RN-003)." },
      ],
    }),
  row(6, ids.importBatch(1), 9, "UPDATE", "PENDING",
    { "N°": 9, CÓDIGOS: "INC 1234 ; RN 004521", COLECCIÓN: "LRM", DENOMINACIÓN: "Charango", ÉPOCA: "desconocida" },
    { title: "Charango", collection_acronym: "LRM" },
    [{ field: "identifiers", current_value: "INC-1234 (histórico)", incoming_value: "RN-004521 (vigente)" }],
    { target_piece_id: ids.piece(9) }),
];

export function rowsForBatch(batchId: string): ImportRowOut[] {
  return IMPORT_ROWS.filter((r) => r.batch_id === batchId);
}
