"use client";

/**
 * Conservación de la ficha en modo `live` (change `colecciones-y-vocabularios-admin`, tarea 5.3;
 * RF-012, RN-005): historial de evaluaciones, la más reciente primero y marcada como estado
 * actual, y formulario de evaluación nueva para quien tiene `conservation.assess`. Una evaluación
 * con fecha antigua se agrega al historial sin cambiar el estado actual.
 */
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/domain/StatusBadges";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useSession } from "@/lib/auth/session";
import {
  fetchAssessments,
  fetchConservationStates,
  recordAssessment,
  type ConservationAssessment,
  type VocabularyTerm,
} from "@/lib/data/admin";

function day(value: string): string {
  return new Date(value).toLocaleDateString("es-PE", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export function ConservationHistory({ assessments }: { assessments: ConservationAssessment[] }) {
  if (assessments.length === 0) return <p className="text-base text-gris-texto">La pieza todavía no tiene evaluaciones de conservación.</p>;
  return (
    <ol className="flex flex-col gap-2">
      {assessments.map((item) => (
        <li key={item.id} className="flex flex-col gap-1 border-t border-borde pt-2 first:border-t-0 first:pt-0">
          <p className="flex flex-wrap items-center gap-2 text-base text-tinta">
            <span className="font-medium">{item.status.label}</span>
            <span className="text-sm text-gris-texto">{day(item.assessed_at)}</span>
            {item.is_current && <StatusBadge status={{ label: "Estado actual", intent: "success" }} />}
          </p>
          {item.assessed_by_label && <p className="text-sm text-gris-texto">Evaluó: {item.assessed_by_label}</p>}
          {item.notes && <p className="text-sm text-tinta">{item.notes}</p>}
        </li>
      ))}
    </ol>
  );
}

export interface AssessmentDraft {
  statusTermId: string;
  assessedOn: string;
  notes: string;
}

export function ConservationForm({
  states,
  busy,
  onSubmit,
}: {
  states: VocabularyTerm[];
  busy: boolean;
  onSubmit: (draft: AssessmentDraft) => void;
}) {
  const [draft, setDraft] = useState<AssessmentDraft>({ statusTermId: "", assessedOn: "", notes: "" });
  return (
    <form
      className="flex flex-col gap-3 border-t border-borde pt-3"
      aria-label="Nueva evaluación de conservación"
      onSubmit={(event) => {
        event.preventDefault();
        if (!draft.statusTermId) return;
        onSubmit(draft);
        setDraft({ statusTermId: "", assessedOn: "", notes: "" });
      }}
    >
      <h3 className="text-base font-semibold text-tinta">Nueva evaluación</h3>
      <Select label="Estado de conservación" required value={draft.statusTermId} onChange={(event) => setDraft((c) => ({ ...c, statusTermId: event.target.value }))}>
        <option value="">Elija un estado</option>
        {states.map((state) => (
          <option key={state.id} value={state.id}>
            {state.label}
          </option>
        ))}
      </Select>
      <Input
        label="Fecha de la evaluación"
        type="date"
        value={draft.assessedOn}
        onChange={(event) => setDraft((c) => ({ ...c, assessedOn: event.target.value }))}
        hint="Vacía = hoy. Una fecha anterior a la última evaluación se agrega al historial sin cambiar el estado actual."
      />
      <Textarea label="Notas" rows={2} value={draft.notes} onChange={(event) => setDraft((c) => ({ ...c, notes: event.target.value }))} />
      <Button type="submit" icon={Plus} className="self-start" disabled={busy || !draft.statusTermId}>
        Registrar evaluación
      </Button>
    </form>
  );
}

export function ConservationLive({ pieceId }: { pieceId: string }) {
  const { currentUser, hasPermission } = useSession();
  const devUser = currentUser?.email;
  const canAssess = hasPermission("conservation.assess");
  const [assessments, setAssessments] = useState<ConservationAssessment[]>([]);
  const [states, setStates] = useState<VocabularyTerm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetchAssessments(pieceId, devUser).then((result) => {
      if (!active) return;
      if (result.status === "ok") setAssessments(result.value);
      else setError(result.message);
    });
    if (canAssess) {
      fetchConservationStates(devUser).then((result) => {
        if (active && result.status === "ok") setStates(result.value);
      });
    }
    return () => {
      active = false;
    };
  }, [pieceId, devUser, canAssess]);

  async function handleSubmit(draft: AssessmentDraft) {
    setBusy(true);
    const result = await recordAssessment(pieceId, { statusTermId: draft.statusTermId, assessedOn: draft.assessedOn || null, notes: draft.notes }, devUser);
    setBusy(false);
    if (result.status !== "ok") {
      setMessage(null);
      return setError(result.message);
    }
    setError(null);
    setAssessments(result.value);
    const current = result.value.find((item) => item.is_current);
    setMessage(current ? `Evaluación registrada. Estado actual: ${current.status.label}.` : "Evaluación registrada.");
  }

  return (
    <Card as="section" aria-label="Conservación" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-tinta">Conservación</h2>
      <ConservationHistory assessments={assessments} />
      {canAssess && <ConservationForm states={states} busy={busy} onSubmit={handleSubmit} />}
      {message && <p className="rounded-md bg-verde-bg px-3 py-2 text-base text-verde-exito">{message}</p>}
      {error && (
        <p role="alert" className="rounded-md bg-carmin-bg px-3 py-2 text-base text-carmin-texto">
          {error}
        </p>
      )}
    </Card>
  );
}
