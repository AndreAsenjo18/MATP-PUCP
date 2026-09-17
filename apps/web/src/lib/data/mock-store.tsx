"use client";

/**
 * Estado mutable de la sesión de demostración en modo mock (RNF-002/008/010).
 *
 * Todas las acciones "irreversibles" de las 11 pantallas (aprobar/rechazar sugerencias de IA,
 * fusionar/marcar distinto un duplicado, decidir una fila de importación, aplicar un lote,
 * registrar un movimiento, corregir un código I) viven aquí, en memoria del navegador. No hay
 * persistencia entre recargas ni llamadas de red: es intencional (RN-009 exige revisión humana
 * antes de guardar cualquier salida de IA; RN-005 exige que nada se borre, por eso la auditoría
 * solo crece). El modo `live` reemplaza este store por el cliente tipado real cuando exista.
 */
import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";

import type { ApiSchemas } from "@/lib/api/client";
import {
  AI_SUGGESTIONS,
  AUDIT_LOG,
  DUPLICATE_CANDIDATES,
  IMPORT_BATCHES,
  IMPORT_ROWS,
  PIECES,
  ids,
} from "@/lib/fixtures";

type AiSuggestionOut = ApiSchemas["AiSuggestionOut"];
type DuplicateCandidateOut = ApiSchemas["DuplicateCandidateOut"];
type ImportBatchOut = ApiSchemas["ImportBatchOut"];
type ImportRowOut = ApiSchemas["ImportRowOut"];
type PieceDetail = ApiSchemas["PieceDetail"];
type AuditEntryOut = ApiSchemas["AuditEntryOut"];
type MovementOut = ApiSchemas["MovementOut"];

interface MockState {
  pieces: Record<string, PieceDetail>;
  aiSuggestions: AiSuggestionOut[];
  duplicateCandidates: DuplicateCandidateOut[];
  importBatches: ImportBatchOut[];
  importRows: ImportRowOut[];
  auditLog: AuditEntryOut[];
  extraMovements: Record<string, MovementOut[]>;
  nextSeq: number;
}

function initialState(): MockState {
  return {
    pieces: Object.fromEntries(PIECES.map((p) => [p.id, p])),
    aiSuggestions: AI_SUGGESTIONS,
    duplicateCandidates: DUPLICATE_CANDIDATES,
    importBatches: IMPORT_BATCHES,
    importRows: IMPORT_ROWS,
    auditLog: AUDIT_LOG,
    extraMovements: {},
    nextSeq: 5000,
  };
}

type Action =
  | { type: "APPROVE_AI_SUGGESTION"; id: string; approvedData: Record<string, unknown>; actor: string; actorId: string }
  | { type: "REJECT_AI_SUGGESTION"; id: string; reason: string; actor: string; actorId: string }
  | { type: "RESOLVE_DUPLICATE"; id: string; status: "MERGED" | "DISTINCT"; note: string; actor: string; actorId: string }
  | { type: "DECIDE_IMPORT_ROW"; rowId: string; decision: ImportRowOut["decision"]; reason: string | null; actor: string; actorId: string }
  | { type: "APPLY_IMPORT_BATCH"; batchId: string; actor: string; actorId: string }
  | { type: "REGISTER_MOVEMENT"; pieceId: string; toLocation: ApiSchemas["LocationRef"]; movementType: MovementOut["movement_type"]; reason: string; actor: string; actorId: string }
  | { type: "CORRECT_INVENTORY_CODE"; pieceId: string; newValue: string | null; reason: string; actor: string; actorId: string }
  | { type: "UPDATE_PIECE"; pieceId: string; patch: Partial<PieceDetail>; actor: string; actorId: string };

function pushAudit(
  state: MockState,
  entry: Omit<AuditEntryOut, "id" | "change_set_id" | "occurred_at"> & { occurred_at?: string },
): { auditLog: AuditEntryOut[]; seq: number; changeSetId: string } {
  const seq = state.nextSeq;
  const changeSetId = ids.changeSet(seq);
  const full: AuditEntryOut = {
    id: ids.audit(seq),
    change_set_id: changeSetId,
    occurred_at: entry.occurred_at ?? new Date().toISOString(),
    ...entry,
  };
  return { auditLog: [...state.auditLog, full], seq: seq + 1, changeSetId };
}

function reducer(state: MockState, action: Action): MockState {
  switch (action.type) {
    case "APPROVE_AI_SUGGESTION": {
      const suggestion = state.aiSuggestions.find((s) => s.id === action.id);
      if (!suggestion) return state;
      const { auditLog, seq } = pushAudit(state, {
        entity_type: "ai_suggestion",
        entity_id: suggestion.id,
        action: "UPDATE",
        field: "status",
        old_value: "PENDING",
        new_value: "APPROVED",
        user_id: action.actorId,
        actor_label: action.actor,
        origin: "MANUAL",
        origin_ref: null,
        reason: "Aprobación humana de sugerencia de IA (RN-009).",
      });
      return {
        ...state,
        nextSeq: seq,
        auditLog,
        aiSuggestions: state.aiSuggestions.map((s) =>
          s.id === action.id
            ? { ...s, status: "APPROVED", approved_data: action.approvedData, reviewed_by_id: action.actorId, reviewed_at: new Date().toISOString() }
            : s,
        ),
      };
    }
    case "REJECT_AI_SUGGESTION": {
      const suggestion = state.aiSuggestions.find((s) => s.id === action.id);
      if (!suggestion) return state;
      const { auditLog, seq } = pushAudit(state, {
        entity_type: "ai_suggestion",
        entity_id: suggestion.id,
        action: "UPDATE",
        field: "status",
        old_value: "PENDING",
        new_value: "REJECTED",
        user_id: action.actorId,
        actor_label: action.actor,
        origin: "MANUAL",
        origin_ref: null,
        reason: action.reason,
      });
      return {
        ...state,
        nextSeq: seq,
        auditLog,
        aiSuggestions: state.aiSuggestions.map((s) =>
          s.id === action.id
            ? { ...s, status: "REJECTED", rejection_reason: action.reason, reviewed_by_id: action.actorId, reviewed_at: new Date().toISOString() }
            : s,
        ),
      };
    }
    case "RESOLVE_DUPLICATE": {
      const candidate = state.duplicateCandidates.find((d) => d.id === action.id);
      if (!candidate) return state;
      const { auditLog, seq } = pushAudit(state, {
        entity_type: "duplicate_candidate",
        entity_id: candidate.id,
        action: action.status === "MERGED" ? "MERGE" : "UPDATE",
        field: "status",
        old_value: "PENDING",
        new_value: action.status,
        user_id: action.actorId,
        actor_label: action.actor,
        origin: "MANUAL",
        origin_ref: null,
        reason: action.note || (action.status === "MERGED" ? "Fusión de duplicados confirmada." : "Marcado como piezas distintas."),
      });
      return {
        ...state,
        nextSeq: seq,
        auditLog,
        duplicateCandidates: state.duplicateCandidates.map((d) =>
          d.id === action.id ? { ...d, status: action.status, resolution_note: action.note || null, reviewed_at: new Date().toISOString() } : d,
        ),
      };
    }
    case "DECIDE_IMPORT_ROW": {
      const row = state.importRows.find((r) => r.id === action.rowId);
      if (!row) return state;
      const { auditLog, seq } = pushAudit(state, {
        entity_type: "import_row",
        entity_id: row.id,
        action: "UPDATE",
        field: "decision",
        old_value: row.decision,
        new_value: action.decision,
        user_id: action.actorId,
        actor_label: action.actor,
        origin: "MANUAL",
        origin_ref: null,
        reason: action.reason,
      });
      return {
        ...state,
        nextSeq: seq,
        auditLog,
        importRows: state.importRows.map((r) =>
          r.id === action.rowId ? { ...r, decision: action.decision, decision_reason: action.reason } : r,
        ),
      };
    }
    case "APPLY_IMPORT_BATCH": {
      const batch = state.importBatches.find((b) => b.id === action.batchId);
      if (!batch) return state;
      const { auditLog, seq } = pushAudit(state, {
        entity_type: "import_batch",
        entity_id: batch.id,
        action: "UPDATE",
        field: "status",
        old_value: batch.status,
        new_value: "APPLIED",
        user_id: action.actorId,
        actor_label: action.actor,
        origin: "MANUAL",
        origin_ref: null,
        reason: "Aprobación explícita de carga masiva por rol autorizado (RF-027).",
      });
      return {
        ...state,
        nextSeq: seq,
        auditLog,
        importBatches: state.importBatches.map((b) =>
          b.id === action.batchId ? { ...b, status: "APPLIED", approved_by_id: action.actorId, approved_at: new Date().toISOString() } : b,
        ),
      };
    }
    case "REGISTER_MOVEMENT": {
      const piece = state.pieces[action.pieceId];
      if (!piece) return state;
      const seqMovement = state.nextSeq;
      const movement: MovementOut = {
        id: ids.movement(seqMovement),
        piece_id: action.pieceId,
        movement_type: action.movementType,
        from_location: piece.location.path.at(-1) ?? null,
        to_location: action.movementType === "VERIFICATION" ? piece.location.path.at(-1) ?? null : action.toLocation,
        occurred_at: new Date().toISOString(),
        performed_by_label: action.actor,
        reason: action.reason,
      };
      const { auditLog, seq } = pushAudit(state, {
        entity_type: "piece",
        entity_id: action.pieceId,
        action: "UPDATE",
        field: "location_id",
        old_value: piece.location.path.at(-1)?.name ?? null,
        new_value: action.movementType === "VERIFICATION" ? piece.location.path.at(-1)?.name ?? null : action.toLocation.name,
        user_id: action.actorId,
        actor_label: action.actor,
        origin: "MANUAL",
        origin_ref: null,
        reason: action.reason,
      });
      const updatedPiece: PieceDetail =
        action.movementType === "VERIFICATION"
          ? piece
          : { ...piece, location: { location_id: action.toLocation.id, path: [...piece.location.path.slice(0, -1), action.toLocation], is_exact: true } };
      return {
        ...state,
        nextSeq: seq + 1,
        auditLog,
        pieces: { ...state.pieces, [action.pieceId]: updatedPiece },
        extraMovements: { ...state.extraMovements, [action.pieceId]: [...(state.extraMovements[action.pieceId] ?? []), movement] },
      };
    }
    case "CORRECT_INVENTORY_CODE": {
      const piece = state.pieces[action.pieceId];
      if (!piece) return state;
      const { auditLog, seq } = pushAudit(state, {
        entity_type: "piece",
        entity_id: action.pieceId,
        action: "CORRECTION",
        field: "inventory_code",
        old_value: piece.inventory_code,
        new_value: action.newValue,
        user_id: action.actorId,
        actor_label: action.actor,
        origin: "MANUAL",
        origin_ref: null,
        reason: action.reason,
      });
      return {
        ...state,
        nextSeq: seq,
        auditLog,
        pieces: { ...state.pieces, [action.pieceId]: { ...piece, inventory_code: action.newValue } },
      };
    }
    case "UPDATE_PIECE": {
      const piece = state.pieces[action.pieceId];
      if (!piece) return state;
      const changedFields = Object.keys(action.patch);
      let audit = state.auditLog;
      let seq = state.nextSeq;
      for (const field of changedFields) {
        const pushed = pushAudit(
          { ...state, auditLog: audit, nextSeq: seq },
          {
            entity_type: "piece",
            entity_id: action.pieceId,
            action: "UPDATE",
            field,
            old_value: (piece as unknown as Record<string, unknown>)[field] ?? null,
            new_value: (action.patch as unknown as Record<string, unknown>)[field] ?? null,
            user_id: action.actorId,
            actor_label: action.actor,
            origin: "MANUAL",
            origin_ref: null,
            reason: null,
          },
        );
        audit = pushed.auditLog;
        seq = pushed.seq;
      }
      return {
        ...state,
        nextSeq: seq,
        auditLog: audit,
        pieces: { ...state.pieces, [action.pieceId]: { ...piece, ...action.patch, updated_at: new Date().toISOString() } },
      };
    }
    default:
      return state;
  }
}

interface MockStoreValue extends MockState {
  approveAiSuggestion: (id: string, approvedData: Record<string, unknown>, actor: string, actorId: string) => void;
  rejectAiSuggestion: (id: string, reason: string, actor: string, actorId: string) => void;
  resolveDuplicate: (id: string, status: "MERGED" | "DISTINCT", note: string, actor: string, actorId: string) => void;
  decideImportRow: (rowId: string, decision: ImportRowOut["decision"], reason: string | null, actor: string, actorId: string) => void;
  applyImportBatch: (batchId: string, actor: string, actorId: string) => void;
  registerMovement: (pieceId: string, toLocation: ApiSchemas["LocationRef"], movementType: MovementOut["movement_type"], reason: string, actor: string, actorId: string) => void;
  correctInventoryCode: (pieceId: string, newValue: string | null, reason: string, actor: string, actorId: string) => void;
  updatePiece: (pieceId: string, patch: Partial<PieceDetail>, actor: string, actorId: string) => void;
  movementsFor: (pieceId: string, seeded: MovementOut[]) => MovementOut[];
}

const MockStoreContext = createContext<MockStoreValue | null>(null);

export function MockStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  const approveAiSuggestion = useCallback((id: string, approvedData: Record<string, unknown>, actor: string, actorId: string) => dispatch({ type: "APPROVE_AI_SUGGESTION", id, approvedData, actor, actorId }), []);
  const rejectAiSuggestion = useCallback((id: string, reason: string, actor: string, actorId: string) => dispatch({ type: "REJECT_AI_SUGGESTION", id, reason, actor, actorId }), []);
  const resolveDuplicate = useCallback((id: string, status: "MERGED" | "DISTINCT", note: string, actor: string, actorId: string) => dispatch({ type: "RESOLVE_DUPLICATE", id, status, note, actor, actorId }), []);
  const decideImportRow = useCallback((rowId: string, decision: ImportRowOut["decision"], reason: string | null, actor: string, actorId: string) => dispatch({ type: "DECIDE_IMPORT_ROW", rowId, decision, reason, actor, actorId }), []);
  const applyImportBatch = useCallback((batchId: string, actor: string, actorId: string) => dispatch({ type: "APPLY_IMPORT_BATCH", batchId, actor, actorId }), []);
  const registerMovement = useCallback((pieceId: string, toLocation: ApiSchemas["LocationRef"], movementType: MovementOut["movement_type"], reason: string, actor: string, actorId: string) => dispatch({ type: "REGISTER_MOVEMENT", pieceId, toLocation, movementType, reason, actor, actorId }), []);
  const correctInventoryCode = useCallback((pieceId: string, newValue: string | null, reason: string, actor: string, actorId: string) => dispatch({ type: "CORRECT_INVENTORY_CODE", pieceId, newValue, reason, actor, actorId }), []);
  const updatePiece = useCallback((pieceId: string, patch: Partial<PieceDetail>, actor: string, actorId: string) => dispatch({ type: "UPDATE_PIECE", pieceId, patch, actor, actorId }), []);
  const movementsFor = useCallback((pieceId: string, seeded: MovementOut[]) => [...seeded, ...(state.extraMovements[pieceId] ?? [])], [state.extraMovements]);

  const value = useMemo<MockStoreValue>(
    () => ({ ...state, approveAiSuggestion, rejectAiSuggestion, resolveDuplicate, decideImportRow, applyImportBatch, registerMovement, correctInventoryCode, updatePiece, movementsFor }),
    [state, approveAiSuggestion, rejectAiSuggestion, resolveDuplicate, decideImportRow, applyImportBatch, registerMovement, correctInventoryCode, updatePiece, movementsFor],
  );

  return <MockStoreContext.Provider value={value}>{children}</MockStoreContext.Provider>;
}

export function useMockStore(): MockStoreValue {
  const ctx = useContext(MockStoreContext);
  if (!ctx) throw new Error("useMockStore debe usarse dentro de <MockStoreProvider>");
  return ctx;
}
