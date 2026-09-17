"use client";

/**
 * Pantalla 7 — Cola de posibles duplicados (RF-030, calidad-datos): comparación lado a lado,
 * fusionar o marcar como distinto. Nunca se borra ninguna de las dos piezas (RN-005): fusionar
 * en esta maqueta solo registra la decisión en la auditoría.
 */
import Link from "next/link";

import { PermissionNotice } from "@/components/AppShell";
import { StatusBadge, TenureBadge } from "@/components/Badges";
import { ConfirmButton } from "@/components/ConfirmButton";
import { RequireSession } from "@/components/RequireSession";
import { useSession } from "@/lib/auth/session";
import { useMockStore } from "@/lib/data/mock-store";
import { getPieceDetail } from "@/lib/fixtures";

function DuplicadosContent() {
  const { hasPermission, currentUser, currentRole } = useSession();
  const store = useMockStore();

  if (!hasPermission("duplicates.resolve")) {
    return <PermissionNotice>Su rol no tiene permiso para resolver duplicados (calidad-datos). Cambie de rol desde la cabecera para probarlo.</PermissionNotice>;
  }

  const pending = store.duplicateCandidates.filter((c) => c.status === "PENDING");
  const resolved = store.duplicateCandidates.filter((c) => c.status !== "PENDING");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-stone-900">Cola de posibles duplicados</h1>
        <p className="text-base text-stone-700">
          Candidatos detectados por similitud de título, colección e identificadores normalizados. Compare lado a
          lado y decida: nunca se elimina ninguna pieza, solo se registra la decisión (RN-005).
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {pending.map((candidate) => {
          const pieceA = getPieceDetail(candidate.piece_a_id);
          const pieceB = candidate.piece_b_id ? getPieceDetail(candidate.piece_b_id) : undefined;
          return (
            <div key={candidate.id} className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-stone-600">
                  Similitud: <strong>{Math.round(candidate.score * 100)} %</strong> · coincide en: {candidate.matched_fields.join(", ")}
                </span>
                <StatusBadge label="Pendiente" tone="pending" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <PieceSummaryCard title="Pieza A" piece={pieceA} />
                {pieceB ? (
                  <PieceSummaryCard title="Pieza B" piece={pieceB} />
                ) : (
                  <div className="rounded-md border border-dashed border-stone-300 p-3 text-base text-stone-700">
                    <p className="font-medium text-stone-900">Fila de importación {candidate.import_row_id}</p>
                    <p className="text-sm text-stone-600">Aún no forma parte del catálogo: viene del lote en previsualización.</p>
                    <Link href="/importacion" className="text-sm underline">
                      Ver en el asistente de importación →
                    </Link>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <ConfirmButton
                  label="Fusionar"
                  tone="primary"
                  confirmTitle="Fusionar como la misma pieza"
                  confirmDescription="Se registra que ambos registros corresponden a la misma pieza física. Ninguno de los dos se elimina; la fusión queda en la auditoría con su usuario y motivo (RN-005)."
                  requireReason
                  reasonLabel="Motivo / criterio de fusión"
                  onConfirm={(reason) => store.resolveDuplicate(candidate.id, "MERGED", reason, currentUser?.full_name ?? currentRole?.name ?? "Persona sintética", currentUser?.id ?? "")}
                />
                <ConfirmButton
                  label="Marcar como distinto"
                  confirmTitle="Marcar como piezas distintas"
                  confirmDescription="Se registra que, a pesar de la similitud, son piezas distintas. Queda documentado en la auditoría."
                  requireReason
                  reasonLabel="Motivo"
                  onConfirm={(reason) => store.resolveDuplicate(candidate.id, "DISTINCT", reason, currentUser?.full_name ?? currentRole?.name ?? "Persona sintética", currentUser?.id ?? "")}
                />
                <button
                  type="button"
                  className="rounded-md border border-stone-300 px-4 py-2 text-base text-stone-700 hover:bg-stone-100"
                  onClick={() => window.alert("Pospuesto: esta maqueta no guarda el estado \"pospuesto\" entre recargas.")}
                >
                  Posponer
                </button>
              </div>
            </div>
          );
        })}
        {pending.length === 0 && <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-base text-stone-600">No hay duplicados pendientes de revisión.</p>}
      </div>

      {resolved.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-stone-900">Ya resueltos en esta sesión</h2>
          <ul className="flex flex-col gap-2">
            {resolved.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-md border border-stone-200 bg-white p-3 text-base">
                <span>{getPieceDetail(c.piece_a_id)?.title}{c.piece_b_id ? ` ↔ ${getPieceDetail(c.piece_b_id)?.title}` : ""}</span>
                <StatusBadge label={c.status === "MERGED" ? "Fusionado" : "Distinto"} tone={c.status === "MERGED" ? "approved" : "neutral"} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PieceSummaryCard({ title, piece }: { title: string; piece: ReturnType<typeof getPieceDetail> }) {
  if (!piece) return null;
  return (
    <Link href={`/piezas/${piece.id}`} className="flex flex-col gap-1 rounded-md border border-stone-200 p-3 hover:border-stone-400">
      <p className="text-sm font-medium text-stone-600">{title}</p>
      <p className="text-lg font-semibold text-stone-900">{piece.title}</p>
      <div className="flex flex-wrap gap-1">
        <TenureBadge regime={piece.tenure_regime} />
      </div>
      <p className="text-sm text-stone-700">{piece.collection?.name ?? "Sin colección"}</p>
      <p className="text-sm text-stone-700">Código I: {piece.inventory_code ?? "Sin código I"}</p>
      <p className="text-sm text-stone-700">{piece.location.path.length > 0 ? piece.location.path.map((l) => l.name).join(" / ") : "Sin ubicación"}</p>
    </Link>
  );
}

export default function DuplicadosPage() {
  return (
    <RequireSession>
      <DuplicadosContent />
    </RequireSession>
  );
}
