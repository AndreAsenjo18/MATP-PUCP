"use client";

/**
 * Pestaña «Importaciones pendientes» de la bandeja de pendientes (change
 * `digitalizacion-libro-registros`): lotes de importación en previsualización (`IN_PREVIEW`), a la
 * espera de que un Gestor de colecciones o un Administrador los revise y apruebe.
 *
 * Antes de esto, quien preparaba un lote (por ejemplo, desde una foto del libro de registros) no
 * tenía forma de avisarle a quien aprueba dónde encontrarlo: la única manera era pasarle la
 * dirección del lote a mano. Esta pestaña reusa `GET /imports` (ya existía, sin cambios de API) y
 * lleva a la misma pantalla de revisión de siempre — no hay pantalla de aprobación nueva.
 */
import { ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { importBatchStatus } from "@/components/domain/status-intents";
import { StatusBadge } from "@/components/domain/StatusBadges";
import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { fetchPendingImportBatches, type ImportBatch } from "@/lib/data/imports";

/** «9 piezas nuevas, 2 actualizaciones»: lo justo para decidir si vale la pena abrirlo. */
export function batchRowSummary(counts: Record<string, number> | null | undefined): string {
  const news = counts?.NEW ?? 0;
  const updates = counts?.UPDATE ?? 0;
  const parts: string[] = [];
  if (news > 0) parts.push(`${news.toLocaleString("es-PE")} ${news === 1 ? "pieza nueva" : "piezas nuevas"}`);
  if (updates > 0) parts.push(`${updates.toLocaleString("es-PE")} ${updates === 1 ? "actualización" : "actualizaciones"}`);
  return parts.length > 0 ? parts.join(", ") : "Sin filas para aplicar todavía.";
}

/** Fecha y hora en formato peruano; si no se puede leer, se muestra tal cual llegó. */
export function formatUploadedAt(isoDate: string): string {
  const moment = new Date(isoDate);
  return Number.isNaN(moment.getTime()) ? isoDate : moment.toLocaleString("es-PE");
}

export function pendingImportHref(batchId: string): string {
  return `/importacion?lote=${batchId}`;
}

export function PendingImports({ devUser }: { devUser?: string }) {
  const [state, setState] = useState<{ status: "loading" } | { status: "ok"; items: ImportBatch[] } | { status: "error"; message: string }>({ status: "loading" });

  useEffect(() => {
    let active = true;
    fetchPendingImportBatches(devUser).then((result) => {
      if (!active) return;
      if (result.status === "ok") setState({ status: "ok", items: result.value.items });
      else setState({ status: "error", message: result.message });
    });
    return () => {
      active = false;
    };
  }, [devUser]);

  if (state.status === "loading") {
    return (
      <p role="status" className="text-base text-gris-texto">
        Buscando lotes a la espera de aprobación…
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <Card className="border-carmin-peligro text-base text-carmin-texto" role="alert">
        {state.message}
      </Card>
    );
  }
  if (state.items.length === 0) {
    return <Card className="border-dashed text-center text-base text-gris-texto">No hay lotes a la espera de aprobación.</Card>;
  }
  return (
    <ol aria-label="Lotes de importación pendientes de aprobación" className="flex flex-col gap-3">
      {state.items.map((batch) => (
        <Card as="li" key={batch.id} className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={importBatchStatus(batch.status)} />
              <span className="font-semibold break-words text-tinta">{batch.source_name}</span>
            </div>
            <p className="text-sm text-gris-texto">{batchRowSummary(batch.counts)}</p>
            <p className="flex items-center gap-1 text-sm text-gris-texto">
              <Clock size={14} aria-hidden="true" />
              {formatUploadedAt(batch.created_at)}
            </p>
          </div>
          <Link href={pendingImportHref(batch.id)} className={buttonClassName({ variant: "outline" })}>
            Revisar y decidir
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </Card>
      ))}
    </ol>
  );
}
