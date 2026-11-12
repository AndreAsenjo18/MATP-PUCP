"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useState } from "react";

import { ConfirmButton } from "@/components/domain/ConfirmButton";
import { MergeLinks } from "@/components/domain/MergedPieceLinks";
import { ConservationLive } from "@/components/domain/ConservationPanel";
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
import { Badge } from "@/components/ui/Badge";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
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
import { SuggestionsSection } from "./SuggestionsSection";

const TABS = [
  "Datos generales",
  "Identificadores",
  "Fotografías",
  "Ubicación e historial",
  "Conservación",
  "Datos de origen",
  "Auditoría",
  "Sugerencias IA",
] as const;
type Tab = (typeof TABS)[number];

export function PieceDetailContent({ pieceId }: { pieceId: string }) {
  const { hasPermission, currentUser } = useSession();
  const store = useMockStore();
  const [tab, setTab] = useState<Tab>("Datos generales");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const basePiece = store.pieces[pieceId];
  if (!basePiece) {
    if (getApiMode() === "live") return <LivePieceDetail pieceId={pieceId} />;
    notFound();
  }
  const piece = maskPieceForRole(basePiece, hasPermission);
  const alerts = alertsForPiece(piece);
  const media = getPieceMedia(pieceId);
  const sourceRecords = getPieceSourceRecords(pieceId);
  const audit = store.auditLog.filter((e) => e.entity_id === pieceId || (e.entity_type === "piece_identifier" && pieceId === ids.piece(6)));
  const suggestions = store.aiSuggestions.filter((s) => s.piece_id === pieceId);
  const pendingSuggestions = suggestions.filter((s) => s.status === "PENDING").length;
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

      {!deleted && <PieceAlertsPanel pieceId={pieceId} alerts={alerts} onNavigateToTab={(t) => setTab(t as Tab)} />}

      {deleted ? (
        <PieceDeletedNotice pieceName={piece.denomination} canRestore={hasPermission("pieces.restore")} onRestore={() => setRestoreOpen(true)} />
      ) : (
        <>
          <div role="tablist" aria-label="Pestañas de la ficha" className="flex overflow-x-auto border-b border-borde">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-1 rounded-t-md px-2.5 py-2 text-base font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracota",
                  tab === t ? "border-b-2 border-terracota text-terracota" : "text-gris-texto hover:text-tinta",
                )}
              >
                {t}
                {t === "Sugerencias IA" && pendingSuggestions > 0 && (
                  <Badge intent="warning" className="px-2 py-0">
                    {pendingSuggestions}
                  </Badge>
                )}
              </button>
            ))}
          </div>

          {tab === "Datos generales" && <PieceGeneralData piece={piece} />}

          {tab === "Identificadores" && <IdentifierSection pieceId={pieceId} piece={piece} />}

          {tab === "Fotografías" && (
            <PieceMediaGallery
              media={media}
              pieceTitle={piece.denomination}
              renderActions={() =>
                hasPermission("media.retire") && (
                  <ConfirmButton
                    label="Retirar foto"
                    variant="danger"
                    confirmTitle="Retirar fotografía"
                    confirmDescription="La foto se marca como retirada; no se elimina del historial (RN-005). En esta maqueta el retiro es solo una simulación visual."
                    confirmLabel="Retirar"
                    onConfirm={() => {}}
                    className="mt-1 self-start"
                  />
                )
              }
            />
          )}

          {tab === "Ubicación e historial" && <LocationSection pieceId={pieceId} piece={piece} movements={movements} />}

          {tab === "Conservación" &&
            (getApiMode() === "live" ? (
              <ConservationLive pieceId={pieceId} />
            ) : (
              <p className="text-base text-gris-texto">El historial de conservación está disponible con la API (modo live).</p>
            ))}

          {tab === "Datos de origen" && <SourceSection records={sourceRecords} />}

          {tab === "Auditoría" && <AuditSection pieceId={pieceId} demoEntries={audit} />}

          {tab === "Sugerencias IA" && <SuggestionsSection suggestions={suggestions} />}
        </>
      )}
    </div>
  );
}
