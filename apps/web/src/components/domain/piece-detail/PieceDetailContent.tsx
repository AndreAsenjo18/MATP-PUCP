"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useState } from "react";

import { ConfirmButton } from "@/components/domain/ConfirmButton";
import { MergeLinks } from "@/components/domain/MergedPieceLinks";
import { PieceAlertsPanel } from "@/components/domain/PieceAlertsPanel";
import { PieceDeletedNotice } from "@/components/domain/PieceDeletedNotice";
import {
  PieceGeneralData,
  PieceMediaGallery,
  PieceSheetHeader,
} from "@/components/domain/PieceSheet";
import {
  PieceDeleteDialog,
  PieceRestoreDialog,
  toDialogOutcome,
  type DialogOutcome,
} from "@/components/domain/PieceActionDialogs";
import { Button, buttonClassName } from "@/components/ui/Button";
import { useSession } from "@/lib/auth/session";
import { useMockStore } from "@/lib/data/mock-store";
import { maskPieceForRole } from "@/lib/data/masking";
import { getApiMode } from "@/lib/data/mode";
import { deletePiece, restorePiece } from "@/lib/data/pieces";
import {
  alertsForPiece,
  getPieceMedia,
  getPieceMovements,
  getPieceSourceRecords,
  ids,
} from "@/lib/fixtures";

import { AuditSection } from "./AuditSection";
import { IdentifierSection } from "./IdentifierSection";
import { LivePieceDetail } from "./LivePieceDetail";
import { LocationSection } from "./LocationSection";
import { RegisterSimilarButton } from "./RegisterSimilarButton";
import { SourceSection } from "./SourceSection";
import { PIECE_DETAIL_TABS, PieceDetailPanel, PieceDetailTabs, type PieceDetailTab } from "./PieceDetailTabs";

export function PieceDetailContent({ pieceId }: { pieceId: string }) {
  const { hasPermission, currentUser } = useSession();
  const store = useMockStore();
  const [tab, setTab] = useState<PieceDetailTab>("Datos generales");
  const [visitedTabs, setVisitedTabs] = useState<ReadonlySet<PieceDetailTab>>(() => new Set(["Datos generales"]));
  function selectTab(next: PieceDetailTab) {
    setTab(next);
    setVisitedTabs((current) => current.has(next) ? current : new Set([...current, next]));
  }
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const basePiece = store.pieces[pieceId];
  if (getApiMode() === "live") return <LivePieceDetail pieceId={pieceId} />;
  if (!basePiece) notFound();
  const piece = maskPieceForRole(basePiece, hasPermission);
  const alerts = alertsForPiece(piece);
  const media = getPieceMedia(pieceId);
  const sourceRecords = getPieceSourceRecords(pieceId);
  const audit = store.auditLog.filter((e) => e.entity_id === pieceId || (e.entity_type === "piece_identifier" && pieceId === ids.piece(6)));
  const movements = store.movementsFor(pieceId, getPieceMovements(pieceId));
  const parent = piece.parent_piece_id ? store.pieces[piece.parent_piece_id] : undefined;

  /** Eliminación lógica con motivo (design D7). Al terminar bien, la ficha pasa a mostrar el aviso de pieza eliminada. */
  async function handleDelete(reason: string): Promise<DialogOutcome> {
    const result = await deletePiece(pieceId, reason);
    if (result.status === "ok") setDeleted(true);
    return toDialogOutcome(result);
  }

  /** Restauración (design D7). Un 409 por código I duplicado llega como mensaje y se muestra dentro del diálogo. */
  async function handleRestore(reason: string | null): Promise<DialogOutcome> {
    const result = await restorePiece(pieceId, reason);
    if (result.status === "ok") setDeleted(false);
    return toDialogOutcome(result);
  }

  return (
    <div className="flex flex-col gap-6">
      <PieceSheetHeader
        piece={piece}
        alerts={alerts}
        actions={
          !deleted && (
            <div className="flex flex-wrap items-center gap-2">
              {hasPermission("pieces.update") && (
                <Link href={`/piezas/${pieceId}/editar`} className={buttonClassName({ variant: "primary" })}>
                  <Pencil size={18} aria-hidden="true" />
                  Editar ficha
                </Link>
              )}
              {hasPermission("pieces.create") && <RegisterSimilarButton piece={piece} />}
              {hasPermission("pieces.delete") && (
                <div className="sm:ml-2 sm:border-l sm:border-borde sm:pl-4">
                  <Button variant="danger" icon={Trash2} onClick={() => setDeleteOpen(true)}>
                    Eliminar pieza
                  </Button>
                </div>
              )}
            </div>
          )
        }
        notices={
          <>
            {piece.masked_fields && piece.masked_fields.length > 0 && (
              <p className="rounded-md bg-crema px-3 py-2 text-sm text-tinta">
                Su rol ({currentUser?.full_name}) no ve todos los campos: {piece.masked_fields.join(", ")}.
              </p>
            )}
            {parent && (
              <p className="text-sm text-gris-texto">
                Componente de{" "}
                <Link href={`/piezas/${parent.id}`} className="text-terracota underline">
                  {parent.denomination}
                </Link>
                .
              </p>
            )}
            <MergeLinks piece={piece} />
          </>
        }
      />

      <PieceDeleteDialog pieceName={piece.denomination} open={deleteOpen} onClose={() => setDeleteOpen(false)} onDelete={handleDelete} />
      <PieceRestoreDialog pieceName={piece.denomination} open={restoreOpen} onClose={() => setRestoreOpen(false)} onRestore={handleRestore} />

      {!deleted && <PieceAlertsPanel pieceId={pieceId} alerts={alerts} onNavigateToTab={(t) => { if (PIECE_DETAIL_TABS.includes(t as PieceDetailTab)) selectTab(t as PieceDetailTab); }} />}

      {deleted ? (
        <PieceDeletedNotice pieceName={piece.denomination} canRestore={hasPermission("pieces.restore")} onRestore={() => setRestoreOpen(true)} />
      ) : (
        <>
          <PieceDetailTabs activeTab={tab} onChange={selectTab} />

          <PieceDetailPanel tab="Datos generales" activeTab={tab} visited={visitedTabs.has("Datos generales")}><PieceGeneralData piece={piece} /></PieceDetailPanel>

          <PieceDetailPanel tab="Identificadores" activeTab={tab} visited={visitedTabs.has("Identificadores")}>
            <IdentifierSection pieceId={pieceId} piece={piece} />
          </PieceDetailPanel>

          <PieceDetailPanel tab="Fotografías" activeTab={tab} visited={visitedTabs.has("Fotografías")}>
            <PieceMediaGallery
              media={media}
              pieceTitle={piece.denomination}
              renderActions={() =>
                hasPermission("media.retire") && (
                  <ConfirmButton
                    label="Retirar foto"
                    variant="danger"
                    confirmTitle="Retirar fotografía"
                    confirmDescription="La foto se marca como retirada, pero se conserva en el historial. En la demostración no se modifica el catálogo."
                    confirmLabel="Retirar"
                    onConfirm={() => {}}
                    className="mt-1 self-start"
                  />
                )
              }
            />
          </PieceDetailPanel>

          <PieceDetailPanel tab="Ubicación e historial" activeTab={tab} visited={visitedTabs.has("Ubicación e historial")}>
            <LocationSection pieceId={pieceId} piece={piece} movements={movements} />
          </PieceDetailPanel>

          <PieceDetailPanel tab="Conservación" activeTab={tab} visited={visitedTabs.has("Conservación")}>
            <p className="text-base text-gris-texto">El historial de conservación está disponible en el sistema conectado.</p>
          </PieceDetailPanel>

          <PieceDetailPanel tab="Origen y auditoría" activeTab={tab} visited={visitedTabs.has("Origen y auditoría")}>
            <h2 className="text-lg font-semibold text-tinta">Datos de origen</h2>
            <SourceSection records={sourceRecords} />
            <h2 className="text-lg font-semibold text-tinta">Auditoría</h2>
            <AuditSection pieceId={pieceId} demoEntries={audit} />
          </PieceDetailPanel>

        </>
      )}
    </div>
  );
}
