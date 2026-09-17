"use client";

/**
 * Pantalla 8 — Revisión de sugerencias de IA (RIA-01..05): texto original vs propuesta
 * estructurada, aprobar/editar/rechazar. Ninguna sugerencia se aplica al catálogo sin esta
 * revisión humana explícita (RN-009) — el proveedor real es un mock determinista
 * (`AI_PROVIDER=mock`) mientras no exista un proveedor real habilitado.
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { PermissionNotice } from "@/components/AppShell";
import { StatusBadge } from "@/components/Badges";
import { ConfirmButton } from "@/components/ConfirmButton";
import { RequireSession } from "@/components/RequireSession";
import { useSession } from "@/lib/auth/session";
import { useMockStore } from "@/lib/data/mock-store";
import { getPieceDetail } from "@/lib/fixtures";

const FUNCTION_LABEL: Record<string, string> = {
  RIA_01: "Extracción de datos estructurados (RIA-01)",
  RIA_02: "Detección de duplicados/inconsistencias (RIA-02)",
  RIA_03: "Sugerencia de categorías/términos (RIA-03)",
  RIA_04: "Descripción preliminar (RIA-04)",
  RIA_05: "Asistente de consulta (RIA-05)",
};

function SuggestionCard({ id }: { id: string }) {
  const { currentUser, currentRole } = useSession();
  const store = useMockStore();
  const suggestion = store.aiSuggestions.find((s) => s.id === id);
  const [editedJson, setEditedJson] = useState(() => JSON.stringify(suggestion?.output_data ?? {}, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  if (!suggestion) return null;
  const piece = suggestion.piece_id ? getPieceDetail(suggestion.piece_id) : undefined;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-stone-900">{FUNCTION_LABEL[suggestion.function_code] ?? suggestion.function_code}</p>
          {piece && (
            <Link href={`/piezas/${piece.id}`} className="text-sm text-stone-600 underline">
              {piece.title}
            </Link>
          )}
        </div>
        <StatusBadge
          label={suggestion.status === "PENDING" ? "Pendiente" : suggestion.status === "APPROVED" ? "Aprobada" : suggestion.status === "REJECTED" ? "Rechazada" : "Parcialmente aprobada"}
          tone={suggestion.status === "PENDING" ? "pending" : suggestion.status === "APPROVED" ? "approved" : suggestion.status === "REJECTED" ? "rejected" : "neutral"}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-stone-50 p-3">
          <p className="text-sm font-medium text-stone-600">Texto / metadatos de entrada</p>
          <pre className="mt-1 overflow-x-auto text-sm text-stone-900">{JSON.stringify(suggestion.input_data, null, 2)}</pre>
        </div>
        <div className="rounded-md bg-stone-50 p-3">
          <p className="text-sm font-medium text-stone-600">Propuesta del proveedor de IA (proveedor: {suggestion.provider})</p>
          <pre className="mt-1 overflow-x-auto text-sm text-stone-900">{JSON.stringify(suggestion.output_data, null, 2)}</pre>
        </div>
      </div>

      {suggestion.status === "PENDING" && (
        <>
          <label className="flex flex-col gap-1 text-sm text-stone-900">
            Editar antes de aprobar (JSON)
            <textarea
              value={editedJson}
              onChange={(event) => {
                setEditedJson(event.target.value);
                try {
                  JSON.parse(event.target.value);
                  setJsonError(null);
                } catch {
                  setJsonError("JSON inválido: revise la sintaxis antes de aprobar.");
                }
              }}
              rows={4}
              className="rounded-md border border-stone-300 p-2 font-mono text-sm text-stone-900"
            />
            {jsonError && <span className="text-sm text-red-700">{jsonError}</span>}
          </label>
          <div className="flex flex-wrap gap-3">
            <ConfirmButton
              label="Aprobar"
              tone="primary"
              confirmTitle="Aprobar sugerencia de IA"
              confirmDescription="Se guarda la propuesta (editada o no) como dato revisado por una persona. Ninguna salida de IA se guarda sin esta aprobación explícita (RN-009)."
              disabled={Boolean(jsonError)}
              onConfirm={() => {
                let parsed: Record<string, unknown> = suggestion.output_data as Record<string, unknown>;
                try {
                  parsed = JSON.parse(editedJson);
                } catch {
                  // conserva la propuesta original si el JSON editado no es válido
                }
                store.approveAiSuggestion(suggestion.id, parsed, currentUser?.full_name ?? currentRole?.name ?? "Persona sintética", currentUser?.id ?? "");
              }}
            />
            <ConfirmButton
              label="Rechazar"
              tone="danger"
              confirmTitle="Rechazar sugerencia de IA"
              confirmDescription="La sugerencia queda marcada como rechazada, con el motivo indicado. No se aplica ningún cambio al catálogo."
              requireReason
              reasonLabel="Motivo del rechazo"
              onConfirm={(reason) => store.rejectAiSuggestion(suggestion.id, reason, currentUser?.full_name ?? currentRole?.name ?? "Persona sintética", currentUser?.id ?? "")}
            />
          </div>
        </>
      )}
      {suggestion.status === "REJECTED" && suggestion.rejection_reason && <p className="text-sm text-red-800">Motivo del rechazo: {suggestion.rejection_reason}</p>}
    </div>
  );
}

function SugerenciasContent() {
  const { hasPermission } = useSession();
  const store = useMockStore();
  const searchParams = useSearchParams();
  const highlighted = searchParams.get("resaltar");

  if (!hasPermission("ai.review")) {
    return <PermissionNotice>Su rol no tiene permiso para aprobar o rechazar sugerencias de IA (RN-009). Cambie de rol desde la cabecera para probarlo.</PermissionNotice>;
  }

  const pending = store.aiSuggestions.filter((s) => s.status === "PENDING");
  const reviewed = store.aiSuggestions.filter((s) => s.status !== "PENDING");
  const ordered = highlighted ? [...pending].sort((a) => (a.id === highlighted ? -1 : 0)) : pending;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-stone-900">Revisión de sugerencias de IA</h1>
        <p className="text-base text-stone-700">
          Proveedor simulado y determinista (<code>AI_PROVIDER=mock</code>). Nada se guarda en el catálogo sin
          revisión humana (RN-009).
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-stone-900">Pendientes ({pending.length})</h2>
        {ordered.map((s) => (
          <SuggestionCard key={s.id} id={s.id} />
        ))}
        {pending.length === 0 && <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-base text-stone-600">No hay sugerencias pendientes.</p>}
      </section>

      {reviewed.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-stone-900">Revisadas en esta sesión</h2>
          {reviewed.map((s) => (
            <SuggestionCard key={s.id} id={s.id} />
          ))}
        </section>
      )}
    </div>
  );
}

export default function SugerenciasIaPage() {
  return (
    <RequireSession>
      <Suspense fallback={null}>
        <SugerenciasContent />
      </Suspense>
    </RequireSession>
  );
}
