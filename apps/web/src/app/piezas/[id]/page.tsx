"use client";

/**
 * Pantalla 4 — Ficha de pieza: Datos generales · Identificadores (I con candado) · Fotografías ·
 * Ubicación e historial de movimientos · Datos de origen · Auditoría · Sugerencias IA.
 * Badges de completitud y de régimen (comodato). Prioridad alta (docs/PROMPT_BASE.md Fase 6).
 * Las secciones visuales vienen de `components/domain/PieceSheet`; aquí quedan sesión, store y acciones.
 *
 * Tarea 4.4 de `ficha-pieza-crud` (diálogos de `components/domain/PieceActionDialogs`, operaciones de
 * `lib/data/pieces`):
 * - Eliminar la pieza (`pieces.delete`, motivo obligatorio). Tras eliminarla, la ficha muestra el aviso
 *   «Pieza eliminada» con «Restaurar pieza» (`pieces.restore`). Una pieza eliminada ya no se puede abrir
 *   (la API responde 404), así que restaurar solo se ofrece aquí, en la misma visita.
 * - Corregir el código I (`identifiers.correct_inventory_code`, código nuevo + motivo).
 * - Registrar identificadores (`identifiers.manage`); si el valor junta varios códigos, se pide
 *   confirmar la separación antes de registrarlos.
 *
 * Tarea 5.1 de `auditoria-y-soft-delete-transversal`: la pestaña «Auditoría» muestra el historial
 * agrupado por conjunto de cambios con vista previa de reversión, conflictos y confirmación en
 * lenguaje claro (`components/domain/AuditTrailPanel`). En modo `live` todo viene de la API; en
 * modo demostración se agrupan las filas del store de la sesión.
 */
import { ArrowRight, Pencil, ShieldCheck, Trash2, Truck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { use, useMemo, useState } from "react";

import { AuditTrailPanel } from "@/components/domain/AuditTrailPanel";
import { ConfirmButton } from "@/components/domain/ConfirmButton";
import { IdentifierAddForm } from "@/components/domain/IdentifierAddForm";
import {
  InventoryCodeCorrectionDialog,
  PieceDeleteDialog,
  PieceRestoreDialog,
  toDialogOutcome,
  type DialogOutcome,
} from "@/components/domain/PieceActionDialogs";
import { PieceDeletedNotice } from "@/components/domain/PieceDeletedNotice";
import {
  PieceCurrentLocation,
  PieceGeneralData,
  PieceIdentifiersTable,
  PieceMediaGallery,
  PieceSheetHeader,
} from "@/components/domain/PieceSheet";
import { suggestionStatus } from "@/components/domain/status-intents";
import { StatusBadge } from "@/components/domain/StatusBadges";
import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { RequireSession } from "@/components/layout/RequireSession";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import type { ApiSchemas } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { toEntryView } from "@/lib/data/audit";
import { useMockStore } from "@/lib/data/mock-store";
import { maskPieceForRole } from "@/lib/data/masking";
import { getApiMode } from "@/lib/data/mode";
import { correctInventoryCode, deletePiece, restorePiece } from "@/lib/data/pieces";
import {
  alertsForPiece,
  getPieceMedia,
  getPieceMovements,
  getPieceSourceRecords,
  ids,
  LOCATIONS,
  locationPath,
} from "@/lib/fixtures";
import { IDENTIFIER_TYPES } from "@/lib/fixtures/reference-data";

type PieceDetail = ApiSchemas["PieceDetail"];
type MovementOut = ApiSchemas["MovementOut"];

const TABS = [
  "Datos generales",
  "Identificadores",
  "Fotografías",
  "Ubicación e historial",
  "Datos de origen",
  "Auditoría",
  "Sugerencias IA",
] as const;
type Tab = (typeof TABS)[number];

function FichaContent({ pieceId }: { pieceId: string }) {
  const { hasPermission, currentUser } = useSession();
  const store = useMockStore();
  const [tab, setTab] = useState<Tab>("Datos generales");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const basePiece = store.pieces[pieceId];
  if (!basePiece) notFound();
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
              {hasPermission("pieces.delete") && (
                <Button variant="danger" icon={Trash2} onClick={() => setDeleteOpen(true)}>
                  Eliminar pieza
                </Button>
              )}
            </div>
          )
        }
        notices={
          <>
            {piece.masked_fields && piece.masked_fields.length > 0 && (
              <p className="rounded-md bg-crema px-3 py-2 text-sm text-tinta">
                Su rol ({currentUser?.full_name}) no ve todos los campos: {piece.masked_fields.join(", ")} (RF-041).
              </p>
            )}
            {parent && (
              <p className="text-sm text-gris-texto">
                Componente de{" "}
                <Link href={`/piezas/${parent.id}`} className="text-terracota underline">
                  {parent.denomination}
                </Link>{" "}
                (RF-009).
              </p>
            )}
          </>
        }
      />

      <PieceDeleteDialog pieceName={piece.denomination} open={deleteOpen} onClose={() => setDeleteOpen(false)} onDelete={handleDelete} />
      <PieceRestoreDialog pieceName={piece.denomination} open={restoreOpen} onClose={() => setRestoreOpen(false)} onRestore={handleRestore} />

      {deleted ? (
        <PieceDeletedNotice pieceName={piece.denomination} canRestore={hasPermission("pieces.restore")} onRestore={() => setRestoreOpen(true)} />
      ) : (
        <>
          <div role="tablist" aria-label="Pestañas de la ficha" className="flex flex-wrap gap-1 border-b border-borde">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex min-h-11 items-center gap-1 rounded-t-md px-3 py-2 text-base font-medium focus-visible:outline-2 focus-visible:outline-terracota",
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

          {tab === "Identificadores" && <IdentifiersTab pieceId={pieceId} piece={piece} />}

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

          {tab === "Ubicación e historial" && <LocationTab pieceId={pieceId} piece={piece} movements={movements} />}

          {tab === "Datos de origen" && <SourceTab records={sourceRecords} />}

          {tab === "Auditoría" && <AuditTab pieceId={pieceId} demoEntries={audit} />}

          {tab === "Sugerencias IA" && <SuggestionsTab suggestions={suggestions} />}
        </>
      )}
    </div>
  );
}

function IdentifiersTab({ pieceId, piece }: { pieceId: string; piece: PieceDetail }) {
  const { hasPermission, currentUser, currentRole } = useSession();
  const store = useMockStore();
  const [correcting, setCorrecting] = useState(false);
  const canCorrect = hasPermission("identifiers.correct_inventory_code");
  const actorLabel = currentUser?.full_name ?? currentRole?.name ?? "Persona sintética";
  const actorId = currentUser?.id ?? "";
  const inventoryIdentifier =
    piece.identifiers.find((identifier) => identifier.identifier_type_code === "I" && identifier.is_current) ??
    piece.identifiers.find((identifier) => identifier.identifier_type_code === "I");

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

function LocationTab({
  pieceId,
  piece,
  movements,
}: {
  pieceId: string;
  piece: PieceDetail;
  movements: MovementOut[];
}) {
  const { hasPermission, currentUser, currentRole } = useSession();
  const store = useMockStore();
  const [targetLocationId, setTargetLocationId] = useState(LOCATIONS[0]?.id ?? "");

  return (
    <div className="flex flex-col gap-4">
      <PieceCurrentLocation location={piece.location} />

      {hasPermission("movements.register") && (
        <Card
          as="section"
          aria-label="Registrar movimiento"
          className="flex flex-wrap items-end gap-3"
        >
          <form
            className="contents"
            onSubmit={(event) => {
              event.preventDefault();
              const location = LOCATIONS.find((l) => l.id === targetLocationId);
              if (!location) return;
              store.registerMovement(
                pieceId,
                { id: location.id, code: location.code, name: location.name, level: location.level },
                "MOVE",
                "Movimiento registrado desde la ficha (maqueta).",
                currentUser?.full_name ?? currentRole?.name ?? "Persona sintética",
                currentUser?.id ?? "",
              );
            }}
          >
            <Select label="Nueva ubicación" value={targetLocationId} onChange={(event) => setTargetLocationId(event.target.value)} fieldClassName="min-w-0 flex-1">
              {LOCATIONS.map((location) => (
                <option key={location.id} value={location.id}>
                  {locationPath(location.id).map((l) => l.name).join(" / ")}
                </option>
              ))}
            </Select>
            <Button type="submit" icon={Truck}>
              Registrar movimiento
            </Button>
            <Button
              variant="outline"
              icon={ShieldCheck}
              onClick={() =>
                store.registerMovement(
                  pieceId,
                  piece.location.path.at(-1) ?? { id: "", code: "", name: "sin ubicación", level: "Sede" },
                  "VERIFICATION",
                  "Verificación física registrada desde la ficha.",
                  currentUser?.full_name ?? currentRole?.name ?? "Persona sintética",
                  currentUser?.id ?? "",
                )
              }
            >
              Registrar verificación física
            </Button>
          </form>
        </Card>
      )}

      <Card as="section" aria-label="Historial de movimientos">
        <h3 className="text-base font-semibold text-tinta">Historial de movimientos (RF-017)</h3>
        <ul className="mt-2 flex flex-col gap-2">
          {movements
            .slice()
            .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
            .map((m) => (
              <li key={m.id} className="border-t border-borde pt-2 text-base text-tinta first:border-t-0 first:pt-0">
                <span className="font-medium">{m.movement_type === "MOVE" ? "Movimiento" : m.movement_type === "VERIFICATION" ? "Verificación física" : "Corrección"}</span>{" "}
                — {new Date(m.occurred_at).toLocaleString("es-PE")} · {m.performed_by_label ?? "—"}
                {m.movement_type === "MOVE" && (
                  <p className="text-sm text-gris-texto">
                    {m.from_location?.name ?? "Sin ubicación"} → {m.to_location?.name ?? "Sin ubicación"}
                  </p>
                )}
                {m.reason && <p className="text-sm text-gris-texto">{m.reason}</p>}
              </li>
            ))}
          {movements.length === 0 && <li className="text-base text-gris-texto">Sin movimientos registrados.</li>}
        </ul>
      </Card>
    </div>
  );
}

function SourceTab({ records }: { records: ReturnType<typeof getPieceSourceRecords> }) {
  if (records.length === 0) {
    return (
      <Card className="border-dashed text-center text-base text-gris-texto">
        Esta pieza no proviene de una carga masiva: no hay columnas de origen sin mapear que preservar (RF-008).
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {records.map((record) => (
        <Card key={record.id}>
          <p className="text-sm text-gris-texto">
            {record.source_name} · fila {record.source_row_number ?? "?"} · {record.source_file_name}
          </p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-crema-light p-3 text-sm text-tinta">{JSON.stringify(record.payload, null, 2)}</pre>
        </Card>
      ))}
    </div>
  );
}

/**
 * Pestaña «Auditoría»: historial agrupado por conjunto de cambios y reversión con vista previa
 * (RF-040, RF-041, RNF-007). Los permisos salen de la sesión aquí, no dentro del componente:
 * `pieces.update` para los cambios manuales, `imports.revert` para las cargas y Administrador
 * para el resto (design D1, [SUPUESTO B7]). El servidor los vuelve a comprobar.
 */
function AuditTab({ pieceId, demoEntries }: { pieceId: string; demoEntries: ReturnType<typeof useMockStore>["auditLog"] }) {
  const { hasPermission, currentRole } = useSession();
  const live = getApiMode() === "live";
  // En modo demostración el historial son las filas del store de la sesión; en `live` las trae la API.
  const entries = useMemo(() => (live ? undefined : demoEntries.map(toEntryView)), [live, demoEntries]);

  if (!hasPermission("audit.read")) {
    return <PermissionNotice>Su rol no tiene permiso para consultar la auditoría (RF-040).</PermissionNotice>;
  }
  return (
    <AuditTrailPanel
      pieceId={pieceId}
      access={{ hasPermission, isAdmin: currentRole?.code === "ADMIN" }}
      demoEntries={entries}
    />
  );
}

function SuggestionsTab({ suggestions }: { suggestions: ReturnType<typeof useMockStore>["aiSuggestions"] }) {
  if (suggestions.length === 0) {
    return <Card className="border-dashed text-center text-base text-gris-texto">Sin sugerencias de IA para esta pieza.</Card>;
  }
  return (
    <div className="flex flex-col gap-3">
      {suggestions.map((s) => (
        <Card key={s.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-tinta">
              {s.function_code} · proveedor {s.provider}
            </span>
            <StatusBadge status={suggestionStatus(s.status)} />
          </div>
          {s.status === "PENDING" && (
            <Link href={`/ia/sugerencias?resaltar=${s.id}`} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-terracota underline">
              Revisar en la cola de sugerencias de IA
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
        </Card>
      ))}
    </div>
  );
}

export default function FichaPage({ params }: PageProps<"/piezas/[id]">) {
  const { id } = use(params);
  return (
    <RequireSession>
      <FichaContent pieceId={id} />
    </RequireSession>
  );
}
