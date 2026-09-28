"use client";

/**
 * Pantalla 7 — Cola de posibles duplicados (RF-030, calidad-datos): comparación lado a lado,
 * fusionar o marcar como distinto. Nunca se borra ninguna de las dos piezas (RN-005): fusionar
 * en esta maqueta solo registra la decisión en la auditoría.
 */
import { ArrowRight, Clock, GitMerge, Split } from "lucide-react";
import Link from "next/link";

import { ConfirmButton } from "@/components/domain/ConfirmButton";
import { duplicateStatus } from "@/components/domain/status-intents";
import { StatusBadge, TenureBadge } from "@/components/domain/StatusBadges";
import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { RequireSession } from "@/components/layout/RequireSession";
import { Button } from "@/components/ui/Button";
import { Card, cardClassName } from "@/components/ui/Card";
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
  const actor = currentUser?.full_name ?? currentRole?.name ?? "Persona sintética";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-tinta">Cola de posibles duplicados</h1>
        <p className="text-base text-gris-texto">
          Candidatos detectados por similitud de título, colección e identificadores normalizados. Compare lado a
          lado y decida: nunca se elimina ninguna pieza, solo se registra la decisión (RN-005).
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {pending.map((candidate) => {
          const pieceA = getPieceDetail(candidate.piece_a_id);
          const pieceB = candidate.piece_b_id ? getPieceDetail(candidate.piece_b_id) : undefined;
          return (
            <Card key={candidate.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-gris-texto">
                  Similitud: <strong className="text-tinta">{Math.round(candidate.score * 100)} %</strong> · coincide en: {candidate.matched_fields.join(", ")}
                </span>
                <StatusBadge status={duplicateStatus(candidate.status)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <PieceSummaryCard title="Pieza A" piece={pieceA} />
                {pieceB ? (
                  <PieceSummaryCard title="Pieza B" piece={pieceB} />
                ) : (
                  <div className="rounded-md border border-dashed border-borde p-3 text-base text-tinta">
                    <p className="font-medium">Fila de importación {candidate.import_row_id}</p>
                    <p className="text-sm text-gris-texto">Aún no forma parte del catálogo: viene del lote en previsualización.</p>
                    <Link href="/importacion" className="inline-flex items-center gap-1 text-sm text-terracota underline">
                      Ver en el asistente de importación
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <ConfirmButton
                  label="Fusionar"
                  variant="primary"
                  icon={GitMerge}
                  confirmTitle="Fusionar como la misma pieza"
                  confirmDescription="Se registra que ambos registros corresponden a la misma pieza física. Ninguno de los dos se elimina; la fusión queda en la auditoría con su usuario y motivo (RN-005)."
                  requireReason
                  reasonLabel="Motivo / criterio de fusión"
                  onConfirm={(reason) => store.resolveDuplicate(candidate.id, "MERGED", reason, actor, currentUser?.id ?? "")}
                />
                <ConfirmButton
                  label="Marcar como distinto"
                  variant="outline"
                  icon={Split}
                  confirmTitle="Marcar como piezas distintas"
                  confirmDescription="Se registra que, a pesar de la similitud, son piezas distintas. Queda documentado en la auditoría."
                  requireReason
                  reasonLabel="Motivo"
                  onConfirm={(reason) => store.resolveDuplicate(candidate.id, "DISTINCT", reason, actor, currentUser?.id ?? "")}
                />
                <Button
                  variant="secondary"
                  icon={Clock}
                  onClick={() => window.alert("Pospuesto: esta maqueta no guarda el estado \"pospuesto\" entre recargas.")}
                >
                  Posponer
                </Button>
              </div>
            </Card>
          );
        })}
        {pending.length === 0 && <Card className="border-dashed text-center text-base text-gris-texto">No hay duplicados pendientes de revisión.</Card>}
      </div>

      {resolved.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-tinta">Ya resueltos en esta sesión</h2>
          <ul className="flex flex-col gap-2">
            {resolved.map((c) => (
              <Card as="li" key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-base text-tinta">
                <span>
                  {getPieceDetail(c.piece_a_id)?.title}
                  {c.piece_b_id ? ` ↔ ${getPieceDetail(c.piece_b_id)?.title}` : ""}
                </span>
                <StatusBadge status={duplicateStatus(c.status)} />
              </Card>
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
    <Link href={`/piezas/${piece.id}`} className={cardClassName({ interactive: true, className: "flex flex-col gap-1 p-3 shadow-none" })}>
      <p className="text-sm font-medium text-gris-texto">{title}</p>
      <p className="text-lg font-semibold text-tinta">{piece.title}</p>
      <div className="flex flex-wrap gap-1">
        <TenureBadge regime={piece.tenure_regime} />
      </div>
      <p className="text-sm text-gris-texto">{piece.collection?.name ?? "Sin colección"}</p>
      <p className="text-sm text-gris-texto">
        Código I: <span className="font-mono font-bold text-terracota">{piece.inventory_code ?? "Sin código I"}</span>
      </p>
      <p className="text-sm text-gris-texto">{piece.location.path.length > 0 ? piece.location.path.map((l) => l.name).join(" / ") : "Sin ubicación"}</p>
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
