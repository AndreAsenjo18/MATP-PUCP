"use client";

/**
 * Pantalla 4 — Ficha de pieza: Datos generales · Identificadores (I con candado) · Fotografías ·
 * Ubicación e historial de movimientos · Datos de origen · Auditoría · Sugerencias IA.
 * Badges de completitud y de régimen (comodato). Prioridad alta (docs/PROMPT_BASE.md Fase 6).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { use, useState } from "react";

import { AlertBadge, LockBadge, StatusBadge, TenureBadge } from "@/components/Badges";
import { ConfirmButton } from "@/components/ConfirmButton";
import { RequireSession } from "@/components/RequireSession";
import type { ApiSchemas } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { useMockStore } from "@/lib/data/mock-store";
import { maskPieceForRole } from "@/lib/data/masking";
import {
  alertsForPiece,
  getPieceMedia,
  getPieceMovements,
  getPieceSourceRecords,
  ids,
  LOCATIONS,
  locationPath,
} from "@/lib/fixtures";

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

  const basePiece = store.pieces[pieceId];
  if (!basePiece) notFound();
  const piece = maskPieceForRole(basePiece, hasPermission);
  const alerts = alertsForPiece(piece).filter((a) => a.applies);
  const media = getPieceMedia(pieceId);
  const sourceRecords = getPieceSourceRecords(pieceId);
  const audit = store.auditLog.filter((e) => e.entity_id === pieceId || (e.entity_type === "piece_identifier" && pieceId === ids.piece(6)));
  const suggestions = store.aiSuggestions.filter((s) => s.piece_id === pieceId);
  const movements = store.movementsFor(pieceId, getPieceMovements(pieceId));
  const parent = piece.parent_piece_id ? store.pieces[piece.parent_piece_id] : undefined;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link href="/busqueda" className="text-sm text-stone-600 underline">
          ← Volver a búsqueda
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-stone-900">{piece.title}</h1>
          {hasPermission("pieces.update") && (
            <Link href={`/piezas/${pieceId}/editar`} className="rounded-md bg-stone-900 px-4 py-2 text-base font-medium text-white hover:bg-stone-800">
              Editar ficha
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TenureBadge regime={piece.tenure_regime} />
          {piece.inventory_code && <LockBadge label={`Código I: ${piece.inventory_code}`} />}
          {alerts.map((alert) => (
            <AlertBadge key={alert.type} alert={alert} />
          ))}
        </div>
        {piece.masked_fields && piece.masked_fields.length > 0 && (
          <p className="rounded-md bg-stone-100 px-3 py-2 text-sm text-stone-700">
            Su rol ({currentUser?.full_name}) no ve todos los campos: {piece.masked_fields.join(", ")} (RF-041).
          </p>
        )}
        {parent && (
          <p className="text-sm text-stone-700">
            Componente de{" "}
            <Link href={`/piezas/${parent.id}`} className="underline">
              {parent.title}
            </Link>{" "}
            (RF-009).
          </p>
        )}
      </header>

      <nav aria-label="Pestañas de la ficha" className="flex flex-wrap gap-1 border-b border-stone-200">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-t-md px-3 py-2 text-base font-medium ${
              tab === t ? "border-b-2 border-stone-900 text-stone-900" : "text-stone-600 hover:text-stone-900"
            }`}
          >
            {t}
            {t === "Sugerencias IA" && suggestions.some((s) => s.status === "PENDING") && (
              <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-semibold text-white">
                {suggestions.filter((s) => s.status === "PENDING").length}
              </span>
            )}
          </button>
        ))}
      </nav>

      {tab === "Datos generales" && (
        <dl className="grid gap-x-8 gap-y-3 rounded-lg border border-stone-200 bg-white p-4 sm:grid-cols-2">
          <Field label="Colección" value={piece.collection?.name ?? "Sin colección (pieza suelta)"} />
          <Field label="Categoría" value={piece.category?.label ?? "Sin registrar"} />
          <Field label="Tipo de bien" value={piece.object_type?.label ?? "Sin registrar"} />
          <Field label="Materiales" value={piece.materials.length ? piece.materials.map((m) => m.label).join(", ") : "Sin registrar"} />
          <Field label="Estado de conservación" value={piece.conservation_status?.label ?? "Sin registrar"} />
          <Field label="Forma de adquisición" value={piece.acquisition_method?.label ?? "Sin registrar"} />
          <Field label="Disponibilidad" value={piece.availability?.label ?? "Sin registrar"} />
          <Field label="Procedencia" value={piece.provenance ?? "Sin registrar"} />
          <Field label="Época (texto original)" value={piece.period.text ?? "Sin registrar"} />
          <Field label="Medidas" value={piece.dimensions_text ?? "Sin registrar"} />
          <Field label="Fecha de ingreso" value={piece.entry_date ?? "Sin registrar"} />
          <Field label="Registrado por" value={piece.recorded_by ?? "Sin registrar"} />
          <Field label="Propietario legal" value={piece.legal_owner ?? "PUCP"} />
          {piece.tenure_regime === "LOAN_FOR_USE" && (
            <>
              <Field label="Comodante" value={piece.lender_name ?? "Restringido para su rol (RF-041)"} />
              <Field label="Convenio de comodato" value={piece.loan_agreement_ref ?? "Restringido para su rol (RF-041)"} />
            </>
          )}
          <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-stone-600">Descripción</dt>
            <dd className="text-base text-stone-900">{piece.description ?? "Sin descripción"}</dd>
          </div>
          {piece.notes && (
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-stone-600">Observaciones</dt>
              <dd className="text-base text-stone-900">{piece.notes}</dd>
            </div>
          )}
        </dl>
      )}

      {tab === "Identificadores" && (
        <IdentifiersTab pieceId={pieceId} piece={piece} />
      )}

      {tab === "Fotografías" && <MediaTab media={media} pieceTitle={piece.title} />}

      {tab === "Ubicación e historial" && <LocationTab pieceId={pieceId} piece={piece} movements={movements} />}

      {tab === "Datos de origen" && <SourceTab records={sourceRecords} />}

      {tab === "Auditoría" && <AuditTab entries={audit} />}

      {tab === "Sugerencias IA" && <SuggestionsTab suggestions={suggestions} />}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-medium text-stone-600">{label}</dt>
      <dd className="text-base text-stone-900">{value}</dd>
    </div>
  );
}

function IdentifiersTab({ pieceId, piece }: { pieceId: string; piece: PieceDetail }) {
  const { hasPermission, currentUser, currentRole } = useSession();
  const store = useMockStore();
  const canCorrect = hasPermission("identifiers.correct_inventory_code");

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4">
      <table className="w-full text-left text-base">
        <thead className="text-sm text-stone-600">
          <tr>
            <th className="py-2 pr-4 font-medium">Tipo</th>
            <th className="py-2 pr-4 font-medium">Valor original</th>
            <th className="py-2 pr-4 font-medium">Normalizado</th>
            <th className="py-2 pr-4 font-medium">Vigente</th>
            <th className="py-2 pr-4 font-medium">Notas</th>
          </tr>
        </thead>
        <tbody>
          {piece.identifiers.map((identifier) => (
            <tr key={identifier.id} className="border-t border-stone-100 align-top">
              <td className="py-2 pr-4 font-medium text-stone-900">
                {identifier.identifier_type_code}
                {identifier.is_locked && " 🔒"}
              </td>
              <td className="py-2 pr-4 text-stone-700">{identifier.original_value}</td>
              <td className="py-2 pr-4 text-stone-700">
                {identifier.normalized_value ?? <span className="text-red-700">No normalizable</span>}
              </td>
              <td className="py-2 pr-4">
                <StatusBadge label={identifier.is_current ? "Vigente" : "Histórico"} tone={identifier.is_current ? "approved" : "neutral"} />
              </td>
              <td className="py-2 pr-4 text-sm text-stone-600">{identifier.notes ?? "—"}</td>
            </tr>
          ))}
          {piece.identifiers.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-stone-600">
                Sin identificadores registrados.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {piece.inventory_code && (
        <div className="rounded-md bg-stone-50 p-3 text-sm text-stone-700">
          El código I está bloqueado una vez asignado (RN-002). Solo un Administrador puede corregirlo mediante un
          procedimiento auditado.
        </div>
      )}
      {piece.inventory_code && canCorrect && (
        <ConfirmButton
          label="Corregir código I (procedimiento auditado)"
          tone="danger"
          confirmTitle="Corregir el código I"
          confirmDescription={
            <>
              Está a punto de retirar el código <strong>{piece.inventory_code}</strong> de esta pieza. Esta acción
              queda registrada en la auditoría con su usuario y el motivo indicado, y nunca borra el historial
              (RN-005).
            </>
          }
          requireReason
          reasonLabel="Motivo de la corrección (obligatorio)"
          onConfirm={(reason) =>
            store.correctInventoryCode(pieceId, null, reason, currentUser?.full_name ?? currentRole?.name ?? "Administrador", currentUser?.id ?? "")
          }
        />
      )}
    </div>
  );
}

function MediaTab({ media, pieceTitle }: { media: ReturnType<typeof getPieceMedia>; pieceTitle: string }) {
  const { hasPermission } = useSession();
  if (media.length === 0) {
    return <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-base text-stone-600">Sin fotografías registradas.</p>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {media.map((asset) => (
        <figure key={asset.id} className="flex flex-col gap-2 overflow-hidden rounded-lg border border-stone-200 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element -- foto sintética en data: URI, sin optimización de imagen remota */}
          <img src={asset.download_url ?? undefined} alt={`${pieceTitle} — ${asset.view_type?.label ?? "vista"}`} className="aspect-[4/3] w-full object-cover" />
          <figcaption className="flex flex-col gap-1 p-3">
            <span className="text-sm font-medium text-stone-900">{asset.view_type?.label ?? "Vista"}</span>
            {asset.usage_restriction && asset.usage_restriction.code !== "SIN_RESTRICCION" && (
              <span className="text-sm text-amber-800">⚠ {asset.usage_restriction.label}{asset.restriction_note ? `: ${asset.restriction_note}` : ""}</span>
            )}
            {hasPermission("media.retire") && (
              <ConfirmButton
                label="Retirar foto"
                tone="danger"
                confirmTitle="Retirar fotografía"
                confirmDescription="La foto se marca como retirada; no se elimina del historial (RN-005). En esta maqueta el retiro es solo una simulación visual."
                confirmLabel="Retirar"
                onConfirm={() => {}}
                className="mt-1 self-start text-sm"
              />
            )}
          </figcaption>
        </figure>
      ))}
    </div>
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
      <div className="rounded-lg border border-stone-200 bg-white p-4">
        <h3 className="text-base font-semibold text-stone-900">Ubicación actual</h3>
        <p className="mt-1 text-base text-stone-900">
          {piece.location.path.length > 0 ? piece.location.path.map((l) => l.name).join(" / ") : "Sin ubicación registrada"}
          {!piece.location.is_exact && <span className="ml-2 text-sm text-stone-600">(ubicación exacta restringida para su rol, RF-041)</span>}
        </p>
      </div>

      {hasPermission("movements.register") && (
        <form
          className="flex flex-wrap items-end gap-3 rounded-lg border border-stone-200 bg-white p-4"
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
          <label className="flex flex-col gap-1 text-sm text-stone-900">
            Nueva ubicación
            <select value={targetLocationId} onChange={(event) => setTargetLocationId(event.target.value)} className="rounded-md border border-stone-300 p-2 text-base">
              {LOCATIONS.map((location) => (
                <option key={location.id} value={location.id}>
                  {locationPath(location.id).map((l) => l.name).join(" / ")}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-md bg-stone-900 px-4 py-2 text-base font-medium text-white hover:bg-stone-800">
            Registrar movimiento
          </button>
          <button
            type="button"
            onClick={() =>
              store.registerMovement(
                pieceId,
                piece.location.path.at(-1) ?? { id: "", code: "", name: "sin ubicación", level: "SITE" },
                "VERIFICATION",
                "Verificación física registrada desde la ficha.",
                currentUser?.full_name ?? currentRole?.name ?? "Persona sintética",
                currentUser?.id ?? "",
              )
            }
            className="rounded-md border border-stone-300 px-4 py-2 text-base text-stone-900 hover:bg-stone-100"
          >
            Registrar verificación física
          </button>
        </form>
      )}

      <div className="rounded-lg border border-stone-200 bg-white p-4">
        <h3 className="text-base font-semibold text-stone-900">Historial de movimientos (RF-017)</h3>
        <ul className="mt-2 flex flex-col gap-2">
          {movements
            .slice()
            .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
            .map((m) => (
              <li key={m.id} className="border-t border-stone-100 pt-2 text-base text-stone-900 first:border-t-0 first:pt-0">
                <span className="font-medium">{m.movement_type === "MOVE" ? "Movimiento" : m.movement_type === "VERIFICATION" ? "Verificación física" : "Corrección"}</span>{" "}
                — {new Date(m.occurred_at).toLocaleString("es-PE")} · {m.performed_by_label ?? "—"}
                {m.movement_type === "MOVE" && (
                  <p className="text-sm text-stone-600">
                    {m.from_location?.name ?? "Sin ubicación"} → {m.to_location?.name ?? "Sin ubicación"}
                  </p>
                )}
                {m.reason && <p className="text-sm text-stone-600">{m.reason}</p>}
              </li>
            ))}
          {movements.length === 0 && <li className="text-base text-stone-600">Sin movimientos registrados.</li>}
        </ul>
      </div>
    </div>
  );
}

function SourceTab({ records }: { records: ReturnType<typeof getPieceSourceRecords> }) {
  if (records.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-base text-stone-600">
        Esta pieza no proviene de una carga masiva: no hay columnas de origen sin mapear que preservar (RF-008).
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {records.map((record) => (
        <div key={record.id} className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-sm text-stone-600">
            {record.source_name} · fila {record.source_row_number ?? "?"} · {record.source_file_name}
          </p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-stone-50 p-3 text-sm text-stone-900">{JSON.stringify(record.payload, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
}

function AuditTab({ entries }: { entries: ReturnType<typeof useMockStore>["auditLog"] }) {
  const { hasPermission } = useSession();
  if (!hasPermission("audit.read")) {
    return <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-base text-amber-900">Su rol no tiene permiso para consultar la auditoría (RF-040).</p>;
  }
  return (
    <ol className="flex flex-col gap-3">
      {entries
        .slice()
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
        .map((entry) => (
          <li key={entry.id} className="rounded-lg border border-stone-200 bg-white p-3 text-base">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={entry.action} tone={entry.action === "CORRECTION" ? "rejected" : "neutral"} />
              <span className="text-sm text-stone-600">{new Date(entry.occurred_at).toLocaleString("es-PE")}</span>
              <span className="text-sm text-stone-600">· {entry.actor_label ?? "Sistema"} · origen {entry.origin}</span>
            </div>
            {entry.field && (
              <p className="mt-1 text-stone-900">
                <strong>{entry.field}</strong>: {String(entry.old_value ?? "—")} → {String(entry.new_value ?? "—")}
              </p>
            )}
            {entry.reason && <p className="mt-1 text-sm text-stone-700">{entry.reason}</p>}
          </li>
        ))}
      {entries.length === 0 && <li className="text-base text-stone-600">Sin registros de auditoría para esta pieza.</li>}
    </ol>
  );
}

function SuggestionsTab({ suggestions }: { suggestions: ReturnType<typeof useMockStore>["aiSuggestions"] }) {
  if (suggestions.length === 0) {
    return <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-base text-stone-600">Sin sugerencias de IA para esta pieza.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {suggestions.map((s) => (
        <div key={s.id} className="rounded-lg border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-stone-900">{s.function_code} · proveedor {s.provider}</span>
            <StatusBadge
              label={s.status === "PENDING" ? "Pendiente de revisión" : s.status === "APPROVED" ? "Aprobada" : s.status === "REJECTED" ? "Rechazada" : "Parcialmente aprobada"}
              tone={s.status === "PENDING" ? "pending" : s.status === "APPROVED" ? "approved" : s.status === "REJECTED" ? "rejected" : "neutral"}
            />
          </div>
          {s.status === "PENDING" && (
            <Link href={`/ia/sugerencias?resaltar=${s.id}`} className="mt-2 inline-block text-sm font-medium text-stone-700 underline">
              Revisar en la cola de sugerencias de IA →
            </Link>
          )}
        </div>
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
