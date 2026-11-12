"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";

import { AiSuggestPanel } from "@/components/domain/AiSuggestPanel";
import { ConservationLive } from "@/components/domain/ConservationPanel";
import {
  PieceDeleteDialog,
  PieceRestoreDialog,
  toDialogOutcome,
  type DialogOutcome,
} from "@/components/domain/PieceActionDialogs";
import {
  LiveIdentifierActions,
  LivePieceHeaderActions,
  inventoryIdentifierOf,
  pieceActionsCan,
} from "@/components/domain/LivePieceActions";
import { MergeLinks } from "@/components/domain/MergedPieceLinks";
import { PieceAlertsPanel } from "@/components/domain/PieceAlertsPanel";
import { PieceDeletedNotice } from "@/components/domain/PieceDeletedNotice";
import { PieceGallery } from "@/components/domain/PieceGallery";
import {
  PieceGeneralData,
  PieceIdentifiersTable,
  PieceSheetHeader,
} from "@/components/domain/PieceSheet";
import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { useSession } from "@/lib/auth/session";
import { fetchIdentifierTypes, type IdentifierType } from "@/lib/data/admin";
import { fetchPieceSheet, type PieceSheetResult } from "@/lib/data/duplicates";
import {
  correctInventoryCode,
  deletePiece,
  fetchPieceIdentifierHistory,
  restorePiece,
  type IdentifierHistoryResult,
} from "@/lib/data/pieces";
import { fetchPieceAlerts, type PieceAlert } from "@/lib/data/quality";

import { RegisterSimilarButton } from "./RegisterSimilarButton";

/**
 * Ficha en modo `live` de una pieza que no está en los fixtures, leída con la identidad de la sesión
 * (incluida una pieza fusionada, que la API devuelve con `merged_into`). Elimina, restaura, corrige
 * el código I y registra identificadores con los mismos diálogos que el modo de ejemplo (tarea 4.4).
 * Las demás pestañas se conectan a la API en sus changes.
 */
export function LivePieceDetail({ pieceId }: { pieceId: string }) {
  const { currentUser, hasPermission } = useSession();
  const devUser = currentUser?.email;
  const key = `${pieceId}|${devUser ?? ""}`;
  const [loaded, setLoaded] = useState<{ key: string; result: PieceSheetResult; history: IdentifierHistoryResult } | null>(null);
  const [alerts, setAlerts] = useState<PieceAlert[]>([]);
  // Vuelve a leer la ficha tras una acción sin pasar por «Cargando», que desmontaría sus formularios.
  const [reloads, setReloads] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [identifierTypes, setIdentifierTypes] = useState<IdentifierType[] | null>(null);
  const [typesError, setTypesError] = useState<string | null>(null);
  const canManageIdentifiers = hasPermission("identifiers.manage");

  useEffect(() => {
    let active = true;
    // Juntas, para que la tabla no mezcle una ficha nueva con los códigos de la lectura anterior.
    Promise.all([fetchPieceSheet(pieceId, devUser), fetchPieceIdentifierHistory(pieceId)]).then(([result, history]) => {
      if (active) setLoaded({ key, result, history });
    });
    fetchPieceAlerts(pieceId, devUser).then((result) => {
      if (active && result.status === "ok") setAlerts(result.alerts);
    });
    return () => {
      active = false;
    };
  }, [pieceId, devUser, key, reloads]);

  useEffect(() => {
    if (!canManageIdentifiers) return;
    let active = true;
    fetchIdentifierTypes(devUser).then((result) => {
      if (!active) return;
      if (result.status === "ok") setIdentifierTypes(result.value);
      else setTypesError(result.message);
    });
    return () => {
      active = false;
    };
  }, [canManageIdentifiers, devUser]);

  if (loaded?.key !== key) {
    return (
      <p role="status" className="text-base text-gris-texto">
        Cargando la ficha…
      </p>
    );
  }
  const { result, history } = loaded;
  if (result.status === "not_found") notFound();
  if (result.status !== "ok") return <PermissionNotice>{result.message}</PermissionNotice>;
  const piece = result.piece;
  const can = pieceActionsCan(piece, hasPermission);

  /** Eliminación lógica con motivo (design D7). La pieza ya no se puede volver a leer: la ficha muestra el aviso. */
  async function handleDelete(reason: string): Promise<DialogOutcome> {
    const outcome = await deletePiece(pieceId, reason);
    if (outcome.status === "ok") setDeleted(true);
    return toDialogOutcome(outcome);
  }

  /** Restauración (design D7). Un 409 por código I duplicado llega como mensaje y se muestra dentro del diálogo. */
  async function handleRestore(reason: string | null): Promise<DialogOutcome> {
    const outcome = await restorePiece(pieceId, reason);
    if (outcome.status === "ok") {
      setDeleted(false);
      setReloads((count) => count + 1);
    }
    return toDialogOutcome(outcome);
  }

  /** Corrección auditada del código I (design D6): el anterior queda en el historial como no vigente. */
  async function handleCorrect({ newValue, reason }: { newValue: string; reason: string }): Promise<DialogOutcome> {
    const identifier = inventoryIdentifierOf(piece);
    if (!identifier) return { ok: false, message: "La pieza no tiene un código I que corregir." };
    const outcome = await correctInventoryCode(pieceId, identifier.id, { new_value: newValue, reason });
    if (outcome.status === "ok") setReloads((count) => count + 1);
    return toDialogOutcome(outcome);
  }

  return (
    <div className="flex flex-col gap-6">
      <PieceSheetHeader
        piece={piece}
        alerts={alerts}
        actions={
          !deleted && (
            <LivePieceHeaderActions
              pieceId={pieceId}
              can={can}
              registerSimilar={hasPermission("pieces.create") ? <RegisterSimilarButton piece={piece} /> : undefined}
              onDelete={() => setDeleteOpen(true)}
            />
          )
        }
        notices={
          <>
            {piece.masked_fields && piece.masked_fields.length > 0 && (
              <p className="rounded-md bg-crema px-3 py-2 text-sm text-tinta">Su rol no ve todos los campos: {piece.masked_fields.join(", ")}.</p>
            )}
            <MergeLinks piece={piece} />
          </>
        }
      />
      <PieceDeleteDialog pieceName={piece.denomination} open={deleteOpen} onClose={() => setDeleteOpen(false)} onDelete={handleDelete} />
      <PieceRestoreDialog pieceName={piece.denomination} open={restoreOpen} onClose={() => setRestoreOpen(false)} onRestore={handleRestore} />
      {deleted ? (
        <PieceDeletedNotice pieceName={piece.denomination} canRestore={hasPermission("pieces.restore")} onRestore={() => setRestoreOpen(true)} />
      ) : (
        <>
          <PieceAlertsPanel pieceId={pieceId} alerts={alerts} />
          <PieceGeneralData piece={piece} />
          <PieceIdentifiersTable piece={history.status === "ok" ? { ...piece, identifiers: history.identifiers } : piece}>
            <LiveIdentifierActions
              piece={piece}
              can={can}
              types={identifierTypes}
              typesError={typesError}
              historyError={history.status === "ok" || piece.merged_into ? null : history.message}
              onRegistered={() => setReloads((count) => count + 1)}
              onCorrect={handleCorrect}
            />
          </PieceIdentifiersTable>
          <PieceGallery
            pieceId={pieceId}
            pieceTitle={piece.denomination}
            onChanged={() => {
              // La alerta «sin fotografía» depende de lo que acaba de cambiar.
              fetchPieceAlerts(pieceId, devUser).then((result) => {
                if (result.status === "ok") setAlerts(result.alerts);
              });
            }}
          />
          <ConservationLive pieceId={pieceId} />
          <AiSuggestPanel
            pieceId={pieceId}
            devUser={devUser}
            canRequest={hasPermission("ai.request")}
            canReview={hasPermission("ai.review")}
            onChanged={() => setReloads((count) => count + 1)}
          />
          <p className="text-sm text-gris-texto">Ubicación, datos de origen y auditoría de esta ficha se conectan a la API en sus changes.</p>
        </>
      )}
    </div>
  );
}
