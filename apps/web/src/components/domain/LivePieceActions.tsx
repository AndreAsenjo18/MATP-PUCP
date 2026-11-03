"use client";

/**
 * Acciones de la ficha en modo conectado (change `ficha-pieza-crud`, tarea 4.4; RF-002, RF-023,
 * RN-002, RN-005): eliminar, corregir el código I y registrar identificadores, con los diálogos de
 * `PieceActionDialogs` y el formulario `IdentifierAddForm`.
 *
 * Son presentacionales: la pantalla (`LiveFichaContent`) lleva la sesión, la lectura de la ficha y las
 * llamadas a la API. Cada acción solo aparece con el permiso que exige su ruta; la API lo vuelve a
 * comprobar.
 */
import { Pencil, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { IdentifierAddForm, type IdentifierAddFormProps } from "@/components/domain/IdentifierAddForm";
import { InventoryCodeCorrectionDialog, type DialogOutcome } from "@/components/domain/PieceActionDialogs";
import { Button, buttonClassName } from "@/components/ui/Button";
import type { ApiSchemas } from "@/lib/api/client";

type PieceDetail = ApiSchemas["PieceDetail"];
type IdentifierType = ApiSchemas["IdentifierTypeOut"];
type Can = (permission: string) => boolean;

/** El código I que se corrige: el vigente y, si no lo hay, el último que tuvo la pieza. */
export function inventoryIdentifierOf(piece: Pick<PieceDetail, "identifiers">) {
  const codes = piece.identifiers.filter((identifier) => identifier.identifier_type_code === "I");
  return codes.find((identifier) => identifier.is_current) ?? codes[0];
}

/** Una pieza fusionada ya no admite cambios (la API respondería 404): su ficha solo enlaza a la que sobrevivió. */
export function pieceActionsCan(piece: Pick<PieceDetail, "merged_into">, can: Can): Can {
  return piece.merged_into ? () => false : can;
}

export function LivePieceHeaderActions({
  pieceId,
  can,
  registerSimilar,
  onDelete,
}: {
  pieceId: string;
  can: Can;
  /** «Registrar a partir de esta pieza», que abre el alta y por eso lo monta la pantalla. */
  registerSimilar?: ReactNode;
  onDelete: () => void;
}) {
  const canEdit = can("pieces.update");
  const canDelete = can("pieces.delete");
  if (!canEdit && !canDelete && !registerSimilar) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit && (
        <Link href={`/piezas/${pieceId}/editar`} className={buttonClassName({ variant: "primary" })}>
          <Pencil size={18} aria-hidden="true" />
          Editar ficha
        </Link>
      )}
      {registerSimilar}
      {canDelete && (
        <Button variant="danger" icon={Trash2} onClick={onDelete}>
          Eliminar pieza
        </Button>
      )}
    </div>
  );
}

export function LiveIdentifierActions({
  piece,
  can,
  types,
  typesError = null,
  historyError = null,
  onRegistered,
  onCorrect,
}: {
  piece: PieceDetail;
  can: Can;
  /** Tipos de código de la API; `null` mientras se cargan. */
  types: readonly IdentifierType[] | null;
  typesError?: string | null;
  /** Por qué la tabla solo muestra los códigos vigentes, si no se pudo leer el historial. */
  historyError?: string | null;
  onRegistered: NonNullable<IdentifierAddFormProps["onRegistered"]>;
  onCorrect: (input: { newValue: string; reason: string }) => Promise<DialogOutcome>;
}) {
  const [correcting, setCorrecting] = useState(false);
  const activeTypes = (types ?? []).filter((type) => type.is_active);
  const canCorrect = can("identifiers.correct_inventory_code") && Boolean(piece.code_i) && Boolean(inventoryIdentifierOf(piece));

  return (
    <>
      {historyError && (
        <p role="status" className="rounded-md bg-crema px-3 py-2 text-sm text-tinta">
          Solo se muestran los códigos vigentes: no se pudo leer el historial de códigos. {historyError}
        </p>
      )}
      {can("identifiers.manage") && typesError && (
        <p role="alert" className="rounded-md bg-carmin-bg px-3 py-2 text-base text-carmin-texto">
          No se pudo preparar el registro de códigos: {typesError}
        </p>
      )}
      {can("identifiers.manage") && activeTypes.length > 0 && <IdentifierAddForm pieceId={piece.id} types={activeTypes} onRegistered={onRegistered} />}
      {canCorrect && piece.code_i && (
        <>
          <Button variant="danger" icon={ShieldCheck} className="self-start" onClick={() => setCorrecting(true)}>
            Corregir código I (procedimiento auditado)
          </Button>
          <InventoryCodeCorrectionDialog
            pieceName={piece.denomination}
            currentCode={piece.code_i}
            open={correcting}
            onClose={() => setCorrecting(false)}
            onCorrect={onCorrect}
          />
        </>
      )}
    </>
  );
}
