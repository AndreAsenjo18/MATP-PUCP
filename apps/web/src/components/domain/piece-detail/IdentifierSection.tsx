"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";

import { IdentifierAddForm } from "@/components/domain/IdentifierAddForm";
import { inventoryIdentifierOf } from "@/components/domain/LivePieceActions";
import {
  InventoryCodeCorrectionDialog,
  toDialogOutcome,
  type DialogOutcome,
} from "@/components/domain/PieceActionDialogs";
import { PieceIdentifiersTable } from "@/components/domain/PieceSheet";
import { Button } from "@/components/ui/Button";
import type { ApiSchemas } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { useMockStore } from "@/lib/data/mock-store";
import { correctInventoryCode } from "@/lib/data/pieces";
import { IDENTIFIER_TYPES } from "@/lib/fixtures/reference-data";

type PieceDetail = ApiSchemas["PieceDetail"];

export function IdentifierSection({ pieceId, piece }: { pieceId: string; piece: PieceDetail }) {
  const { hasPermission, currentUser, currentRole } = useSession();
  const store = useMockStore();
  const [correcting, setCorrecting] = useState(false);
  const canCorrect = hasPermission("identifiers.correct_inventory_code");
  const actorLabel = currentUser?.full_name ?? currentRole?.name ?? "Persona sintética";
  const actorId = currentUser?.id ?? "";
  const inventoryIdentifier = inventoryIdentifierOf(piece);

  /** Corrección auditada (design D6): código nuevo + motivo. El store de la maqueta refleja el cambio en la sesión. */
  async function handleCorrect({ newValue, reason }: { newValue: string; reason: string }): Promise<DialogOutcome> {
    if (!inventoryIdentifier) return { ok: false, message: "La pieza no tiene un código I que corregir." };
    const result = await correctInventoryCode(pieceId, inventoryIdentifier.id, { new_value: newValue, reason });
    if (result.status === "ok") {
      store.correctInventoryCode(pieceId, result.identifier.original_value, reason, actorLabel, actorId);
    }
    return toDialogOutcome(result);
  }

  return (
    <PieceIdentifiersTable piece={piece}>
      {hasPermission("identifiers.manage") && (
        <IdentifierAddForm
          pieceId={pieceId}
          types={IDENTIFIER_TYPES.filter((type) => type.is_active)}
          onRegistered={(identifiers, originalValue) => store.addIdentifiers(pieceId, identifiers, originalValue, actorLabel, actorId)}
        />
      )}
      {piece.code_i && canCorrect && inventoryIdentifier && (
        <>
          <Button variant="danger" icon={ShieldCheck} className="self-start" onClick={() => setCorrecting(true)}>
            Corregir código I (procedimiento auditado)
          </Button>
          <InventoryCodeCorrectionDialog
            pieceName={piece.denomination}
            currentCode={piece.code_i}
            open={correcting}
            onClose={() => setCorrecting(false)}
            onCorrect={handleCorrect}
          />
        </>
      )}
    </PieceIdentifiersTable>
  );
}
