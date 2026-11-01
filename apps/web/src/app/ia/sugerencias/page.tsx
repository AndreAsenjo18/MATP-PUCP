"use client";

/**
 * Pantalla 8 — Sugerencias de la IA (RIA-01..05): texto de la ficha frente a la propuesta, con
 * aprobar, corregir o rechazar. Fuera del MVP: trabaja con ejemplos de demostración (datos
 * sintéticos del almacén local) y lo dice. Ninguna sugerencia se aplica sin aprobación humana
 * (RN-009). Change `rediseno-ux-sugerencias-ia`.
 */
import { Check, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AI_PURPOSE, AI_TITLE, dataView, FieldList, functionLabel, ScopeNotice } from "@/components/domain/AiSuggestionParts";
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
            {functionLabel(suggestion.function_code)}
          </p>
          {piece && (
            <Link href={`/piezas/${piece.id}`} className="text-sm text-terracota underline">
              {piece.denomination}
            </Link>
          )}
        </div>
        <StatusBadge status={suggestionStatus(suggestion.status)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section aria-label="Texto de la ficha" className="min-w-0 rounded-md bg-crema-light p-3">
          <h3 className="mb-2 text-sm font-semibold text-tinta">Texto de la ficha</h3>
          <FieldList view={dataView(suggestion.input_data)} />
        </section>
        <section aria-label="Propuesta de la IA" className="min-w-0 rounded-md border border-terracota/30 bg-terracota-light/30 p-3">
          <h3 className="mb-2 text-sm font-semibold text-tinta">Propuesta de la IA</h3>
          <FieldList view={dataView(suggestion.output_data)} />
        </section>
      </div>

      {suggestion.status === "PENDING" && (
        <>
          <details className="rounded-md border border-borde px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-tinta">Corregir antes de aprobar</summary>
            <Textarea
              label="Propuesta (JSON)"
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
              rows={5}
              error={jsonError ?? undefined}
              className="font-mono text-sm"
              fieldClassName="mt-2"
            />
          </details>
          <div className="flex flex-wrap gap-3">
            <ConfirmButton
              label="Aprobar"
              variant="primary"
              icon={Check}
              confirmTitle="Aprobar la sugerencia"
              confirmDescription="La propuesta, corregida o no, queda como dato revisado por una persona. En esta demostración no cambia el catálogo."
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
              confirmTitle="Rechazar la sugerencia"
              confirmDescription="La sugerencia queda como rechazada, con el motivo que indique. No cambia el catálogo."
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
    return <PermissionNotice>Su rol no puede revisar sugerencias de la IA. Cambie de rol desde la cabecera para probarlo.</PermissionNotice>;
  }

  const pending = store.aiSuggestions.filter((s) => s.status === "PENDING");
  const reviewed = store.aiSuggestions.filter((s) => s.status !== "PENDING");
  const ordered = highlighted ? [...pending].sort((a) => (a.id === highlighted ? -1 : 0)) : pending;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-tinta">{AI_TITLE}</h1>
        <p className="max-w-3xl text-base text-gris-texto">{AI_PURPOSE}</p>
      </header>

      <ScopeNotice />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-tinta">Ejemplos pendientes de revisión ({pending.length})</h2>
        {ordered.map((s) => (
          <SuggestionCard key={s.id} id={s.id} highlighted={s.id === highlighted} />
        ))}
        {pending.length === 0 && <Card className="border-dashed text-center text-base text-gris-texto">No hay ejemplos pendientes.</Card>}
      </section>

      {reviewed.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-tinta">Ejemplos ya revisados</h2>
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
