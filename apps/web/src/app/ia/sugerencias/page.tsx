"use client";

/**
 * Pantalla 8 — Revisión de sugerencias de IA (RIA-01..05): texto original vs propuesta
 * estructurada, aprobar/editar/rechazar. Ninguna sugerencia se aplica al catálogo sin esta
 * revisión humana explícita (RN-009) — el proveedor real es un mock determinista
 * (`AI_PROVIDER=mock`) mientras no exista un proveedor real habilitado.
 */
import { Check, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { ConfirmButton } from "@/components/domain/ConfirmButton";
import { suggestionStatus } from "@/components/domain/status-intents";
import { StatusBadge } from "@/components/domain/StatusBadges";
import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { RequireSession } from "@/components/layout/RequireSession";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { useMockStore } from "@/lib/data/mock-store";
import { getPieceDetail } from "@/lib/fixtures";

const FUNCTION_LABEL: Record<string, string> = {
  RIA_01: "Extracción de datos estructurados (RIA-01)",
  RIA_02: "Detección de duplicados/inconsistencias (RIA-02)",
  RIA_03: "Sugerencia de categorías/términos (RIA-03)",
  RIA_04: "Descripción preliminar (RIA-04)",
  RIA_05: "Asistente de consulta (RIA-05)",
};

function SuggestionCard({ id, highlighted = false }: { id: string; highlighted?: boolean }) {
  const { currentUser, currentRole } = useSession();
  const store = useMockStore();
  const suggestion = store.aiSuggestions.find((s) => s.id === id);
  const [editedJson, setEditedJson] = useState(() => JSON.stringify(suggestion?.output_data ?? {}, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  if (!suggestion) return null;
  const piece = suggestion.piece_id ? getPieceDetail(suggestion.piece_id) : undefined;
  const actor = currentUser?.full_name ?? currentRole?.name ?? "Persona sintética";

  return (
    <Card className={cn("flex flex-col gap-3", highlighted && "border-terracota")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-base font-semibold text-tinta">
            <Sparkles size={18} aria-hidden="true" className="text-terracota" />
            {FUNCTION_LABEL[suggestion.function_code] ?? suggestion.function_code}
          </p>
          {piece && (
            <Link href={`/piezas/${piece.id}`} className="text-sm text-terracota underline">
              {piece.title}
            </Link>
          )}
        </div>
        <StatusBadge status={suggestionStatus(suggestion.status)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0 rounded-md bg-crema-light p-3">
          <p className="text-sm font-medium text-gris-texto">Texto / metadatos de entrada</p>
          <pre className="mt-1 overflow-x-auto text-sm text-tinta">{JSON.stringify(suggestion.input_data, null, 2)}</pre>
        </div>
        <div className="min-w-0 rounded-md bg-crema-light p-3">
          <p className="text-sm font-medium text-gris-texto">Propuesta del proveedor de IA (proveedor: {suggestion.provider})</p>
          <pre className="mt-1 overflow-x-auto text-sm text-tinta">{JSON.stringify(suggestion.output_data, null, 2)}</pre>
        </div>
      </div>

      {suggestion.status === "PENDING" && (
        <>
          <Textarea
            label="Editar antes de aprobar (JSON)"
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
            error={jsonError ?? undefined}
            className="font-mono text-sm"
          />
          <div className="flex flex-wrap gap-3">
            <ConfirmButton
              label="Aprobar"
              variant="primary"
              icon={Check}
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
                store.approveAiSuggestion(suggestion.id, parsed, actor, currentUser?.id ?? "");
              }}
            />
            <ConfirmButton
              label="Rechazar"
              variant="danger"
              icon={X}
              confirmTitle="Rechazar sugerencia de IA"
              confirmDescription="La sugerencia queda marcada como rechazada, con el motivo indicado. No se aplica ningún cambio al catálogo."
              requireReason
              reasonLabel="Motivo del rechazo"
              onConfirm={(reason) => store.rejectAiSuggestion(suggestion.id, reason, actor, currentUser?.id ?? "")}
            />
          </div>
        </>
      )}
      {suggestion.status === "REJECTED" && suggestion.rejection_reason && (
        <p className="text-sm font-medium text-carmin-texto">Motivo del rechazo: {suggestion.rejection_reason}</p>
      )}
    </Card>
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
        <h1 className="text-2xl font-bold text-tinta">Revisión de sugerencias de IA</h1>
        <p className="text-base text-gris-texto">
          Proveedor simulado y determinista (<code>AI_PROVIDER=mock</code>). Nada se guarda en el catálogo sin
          revisión humana (RN-009).
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-tinta">Pendientes ({pending.length})</h2>
        {ordered.map((s) => (
          <SuggestionCard key={s.id} id={s.id} highlighted={s.id === highlighted} />
        ))}
        {pending.length === 0 && <Card className="border-dashed text-center text-base text-gris-texto">No hay sugerencias pendientes.</Card>}
      </section>

      {reviewed.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-tinta">Revisadas en esta sesión</h2>
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
