/**
 * Bitácora de auditoría sintética (RF-040, RNF-006/007): quién, cuándo, campo, valor anterior
 * y nuevo, y origen (manual/importación/IA/sistema). Nunca se borra información (RN-005): el
 * log solo crece, incluso cuando la maqueta simula nuevas acciones (ver lib/data/mock-store.tsx).
 */
import type { ApiSchemas } from "@/lib/api/client";

import { ids } from "./ids";

type AuditEntryOut = ApiSchemas["AuditEntryOut"];

function entry(n: number, e: Omit<AuditEntryOut, "id" | "change_set_id"> & { changeSet: number }): AuditEntryOut {
  return { id: ids.audit(n), change_set_id: ids.changeSet(e.changeSet), ...e };
}

export const AUDIT_LOG: AuditEntryOut[] = [
  entry(1, { changeSet: 1, entity_type: "piece", entity_id: ids.piece(1), action: "CREATE", field: null, old_value: null, new_value: null, occurred_at: "2026-01-15T09:00:00Z", user_id: ids.user(3), actor_label: "Practicante Catalogador (sintético)", origin: "MANUAL", origin_ref: null, reason: null }),
  entry(2, { changeSet: 2, entity_type: "piece", entity_id: ids.piece(1), action: "UPDATE", field: "location_id", old_value: "Depósito 1", new_value: "Depósito 1 / Rack A / Nivel 2", occurred_at: "2026-06-02T10:30:00Z", user_id: ids.user(5), actor_label: "Auxiliar de Depósito (sintético)", origin: "MANUAL", origin_ref: null, reason: "Reordenamiento de depósito 1." }),
  entry(3, { changeSet: 3, entity_type: "piece", entity_id: ids.piece(6), action: "CREATE", field: null, old_value: null, new_value: null, occurred_at: "2021-12-01T09:00:00Z", user_id: ids.user(2), actor_label: "Gestor de colecciones (sintético)", origin: "IMPORT", origin_ref: "Carga 2021-11 (sintética)", reason: null }),
  entry(4, {
    changeSet: 4,
    entity_type: "piece_identifier",
    entity_id: ids.identifier(108),
    action: "CORRECTION",
    field: "is_current",
    old_value: true,
    new_value: false,
    occurred_at: "2026-07-01T09:15:00Z",
    user_id: ids.user(1),
    actor_label: "Administrador MATP (sintético)",
    origin: "MANUAL",
    reason:
      "Corrección auditada (RN-002/RN-003): la pieza está en comodato (AJB) y nunca debió recibir código I. Se retira I-0999 y se conserva como identificador histórico no vigente.",
    origin_ref: null,
  }),
  entry(5, { changeSet: 4, entity_type: "piece", entity_id: ids.piece(6), action: "UPDATE", field: "inventory_code", old_value: "I-0999", new_value: null, occurred_at: "2026-07-01T09:15:00Z", user_id: ids.user(1), actor_label: "Administrador MATP (sintético)", origin: "MANUAL", origin_ref: null, reason: "Consecuencia de la corrección del identificador I-0999 (RN-003)." }),
  entry(6, { changeSet: 5, entity_type: "piece", entity_id: ids.piece(2), action: "CREATE", field: null, old_value: null, new_value: null, occurred_at: "2020-03-02T09:00:00Z", user_id: ids.user(3), actor_label: "Practicante Catalogador (sintético)", origin: "IMPORT", origin_ref: "Carga 2020 (sintética)", reason: null }),
  entry(7, { changeSet: 6, entity_type: "piece", entity_id: ids.piece(14), action: "CREATE", field: null, old_value: null, new_value: null, occurred_at: "2026-09-10T09:00:00Z", user_id: ids.user(3), actor_label: "Practicante Catalogador (sintético)", origin: "IMPORT", origin_ref: "Lote de importación 2026-09-10 (sintético)", reason: null }),
  entry(8, { changeSet: 7, entity_type: "piece", entity_id: ids.piece(14), action: "UPDATE", field: "category", old_value: null, new_value: "Cerámica", occurred_at: "2026-09-10T09:05:00Z", user_id: null, actor_label: "Proveedor de IA (mock) — pendiente de aprobación", origin: "AI", origin_ref: "Sugerencia IA " + ids.aiSuggestion(1), reason: "Propuesta de categoría, aún no aprobada por una persona (RN-009)." }),
];

export function auditForPiece(pieceId: string): AuditEntryOut[] {
  return AUDIT_LOG.filter((e) => e.entity_id === pieceId || (e.entity_type === "piece_identifier" && pieceId === ids.piece(6)))
    .slice()
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
}
