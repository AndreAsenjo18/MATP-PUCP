"use client";

/**
 * Gemini en la cola de posibles duplicados (change `ia-juicio-duplicados`; RIA-02, RN-005, RN-009):
 *
 * - «Deje que Gemini los ordene»: analiza los pares pendientes, con el avance en vivo y un número por
 *   grupo. Los pares con dos códigos I distintos los decide una regla, sin Gemini.
 * - Tres grupos: «misma pieza», «distintas» y «no está seguro». Cada par lleva el motivo y la
 *   confianza; en los dos primeros, una casilla para sacarlo del grupo antes de aprobar.
 * - «misma pieza» exige confirmar una muestra al azar antes de aprobar, y solo fusiona los pares sin
 *   valores en choque; los demás quedan para elegir los valores par por par.
 * - Nada se aplica sin «Aprobar» (RN-009). «No está seguro» se revisa uno por uno, con la cola de
 *   siempre.
 *
 * Solo la lógica de presentación vive aquí; la cola (`DuplicateQueue`) carga los datos y reutiliza su
 * lista y su tarjeta de revisión para mostrar cada grupo.
 */
import { Check, RotateCcw, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { GeminiBadge, GeminiStar } from "@/components/ui/GeminiBadge";
import { cn } from "@/lib/cn";
import type { AiDuplicateRun, AiGroupName, AiGroupPair } from "@/lib/data/duplicates";

export const AI_GROUPS: { key: AiGroupName; title: string; short: string }[] = [
  { key: "same", title: "Gemini cree que son la misma pieza", short: "Misma pieza" },
  { key: "distinct", title: "Gemini cree que son distintas", short: "Distintas" },
  { key: "unsure", title: "Gemini no está seguro", short: "No está seguro" },
];

export type SampleDecision = "confirmed" | "excluded";

export function confidencePercent(confidence: number): string {
  return `${Math.round(Math.min(Math.max(confidence, 0), 1) * 100)} %`;
}

/** «Analizó 40 de 102 pares», o el resultado al terminar. */
export function runProgressText(run: Pick<AiDuplicateRun, "status" | "processed_pairs" | "total_pairs" | "failed_batches">): string {
  const pairs = (n: number) => (n === 1 ? "1 par" : `${n.toLocaleString("es-PE")} pares`);
  // Recién lanzado, el trabajo aún no contó los pares.
  if (run.status === "RUNNING" && run.total_pairs === 0) return "Gemini está empezando…";
  if (run.status === "RUNNING") return `Gemini está analizando: ${run.processed_pairs.toLocaleString("es-PE")} de ${pairs(run.total_pairs)}.`;
  if (run.status === "FAILED") return "Gemini no respondió. Puede reanudar el análisis; la cola sigue par por par.";
  if (run.failed_batches > 0) return `Analizó ${run.processed_pairs.toLocaleString("es-PE")} de ${pairs(run.total_pairs)}: Gemini no respondió en algunos lotes.`;
  return `Analizó ${pairs(run.total_pairs)}.`;
}

/** Cuántos pares se aprobarían: los del grupo menos los sacados (y, en «misma pieza», los que chocan). */
export function approvableCount(group: AiGroupName, items: readonly AiGroupPair[], excluded: ReadonlySet<string>): number {
  return items.filter((item) => !excluded.has(item.candidate.id) && !(group === "same" && item.ready_to_merge === false)).length;
}

/** La muestra está completa cuando cada par fue confirmado o sacado (design D6). */
export function sampleComplete(sample: readonly AiGroupPair[], decisions: Readonly<Record<string, SampleDecision>>): boolean {
  return sample.every((item) => decisions[item.candidate.id] !== undefined);
}

/** La tarjeta «Deje que Gemini los ordene»: pedir el análisis, su avance y los tres grupos. */
export function GeminiJudgeCard({
  run,
  error,
  starting,
  selected,
  onStart,
  onResume,
  onSelect,
}: {
  run: AiDuplicateRun | null;
  error: string | null;
  starting: boolean;
  selected: AiGroupName | null;
  onStart: () => void;
  onResume: () => void;
  onSelect: (group: AiGroupName | null) => void;
}) {
  const running = run?.status === "RUNNING";
  const percent = run && run.total_pairs > 0 ? Math.round((run.processed_pairs / run.total_pairs) * 100) : 0;
  return (
    <Card as="section" aria-labelledby="gemini-ordena" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="gemini-ordena" className="text-xl font-extrabold text-tinta">
            Deje que Gemini los ordene
          </h2>
          <p className="text-base text-gris-texto">
            Gemini lee los datos de catálogo de cada par y los separa en tres grupos. Usted aprueba cada grupo; nada se aplica sin su aprobación.
          </p>
        </div>
        <GeminiBadge />
      </div>

      {run && (
        <div role="status" className="flex flex-col gap-2">
          <p className="text-base font-semibold text-tinta">{runProgressText(run)}</p>
          {running && (
            <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-borde">
              <span className="block h-full rounded-full bg-gemini-violeta motion-safe:transition-[width]" style={{ width: `${percent}%` }} />
            </span>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-carmin-bg p-3 text-base text-carmin-texto">
          {error}
        </p>
      )}

      {run && (
        <ul aria-label="Grupos de Gemini" className="grid gap-2.5 sm:grid-cols-3">
          {AI_GROUPS.map((group) => {
            const count = run.groups[group.key];
            const on = selected === group.key;
            return (
              <li key={group.key} className="flex">
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={running && count === 0}
                  onClick={() => onSelect(on ? null : group.key)}
                  className={cn(
                    "flex min-h-11 w-full flex-col items-start gap-0.5 rounded-xl border px-3.5 py-3 text-left shadow-sm focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota",
                    on ? "border-2 border-terracota bg-terracota-light" : "border-borde bg-white hover:border-gris-texto",
                  )}
                >
                  <span className="text-2xl leading-tight font-extrabold text-tinta tabular-nums">{count.toLocaleString("es-PE")}</span>
                  <span className={cn("text-base leading-snug font-semibold", on ? "text-terracota-dark" : "text-gris-texto")}>{group.title}</span>
                  {group.key === "distinct" && run.groups.by_rule > 0 && <span className="text-base text-gris-texto">{run.groups.by_rule} por regla</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        {!running && (
          <Button variant="secondary" icon={Sparkles} onClick={onStart} disabled={starting}>
            {starting ? "Iniciando…" : run ? "Analizar de nuevo con Gemini" : "Analizar con Gemini"}
          </Button>
        )}
        {run?.can_resume && !running && (
          <Button variant="neutral" icon={RotateCcw} onClick={onResume} disabled={starting}>
            Reanudar el análisis
          </Button>
        )}
      </div>
    </Card>
  );
}

/** El motivo y la confianza de Gemini (o la regla) bajo cada par. */
export function AiVerdictLine({ item }: { item: Pick<AiGroupPair, "verdict" | "merge_blocker"> }) {
  const { verdict } = item;
  return (
    <div className="flex flex-col gap-1 text-base">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-tinta">
        {verdict.source === "rule" ? (
          <span className="rounded-full bg-borde px-2.5 py-0.5 font-semibold text-tinta">Regla</span>
        ) : verdict.source === "review" ? (
          <span className="rounded-full bg-borde px-2.5 py-0.5 font-semibold text-tinta">Sacado del grupo</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-semibold text-gris-texto">
            <GeminiStar size={16} />
            Gemini
          </span>
        )}
        <span className="break-words">{verdict.reason}</span>
        {verdict.source === "ai" && <span className="text-gris-texto">· Confianza {confidencePercent(verdict.confidence)}</span>}
      </p>
      {item.merge_blocker && <p className="text-base font-semibold text-ambar-texto">{item.merge_blocker}</p>}
    </div>
  );
}

/** Casilla para dejar el par en la aprobación o sacarlo del grupo. */
export function IncludeInApproval({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-base font-semibold text-tinta">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-5 accent-terracota" />
      {label}
    </label>
  );
}

/** La muestra al azar de «misma pieza»: cada par se confirma o se saca del grupo (design D6). */
export function SampleCheck({
  items,
  decisions,
  names,
  onDecide,
}: {
  items: AiGroupPair[];
  decisions: Record<string, SampleDecision>;
  names: (item: AiGroupPair) => [string, string];
  onDecide: (candidateId: string, decision: SampleDecision | null) => void;
}) {
  const done = items.filter((item) => decisions[item.candidate.id]).length;
  return (
    <section aria-labelledby="muestra" className="flex flex-col gap-3 rounded-tarjeta border-2 border-ambar-alerta bg-ambar-bg/40 p-4">
      <div className="flex flex-col gap-1">
        <h3 id="muestra" className="text-lg font-extrabold text-tinta">
          Antes de aprobar, revise esta muestra al azar ({done} de {items.length})
        </h3>
        <p className="text-base text-gris-texto">Si Gemini acertó en estos pares, es probable que haya acertado en el resto. Saque del grupo los que no sean la misma pieza.</p>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const [a, b] = names(item);
          const decision = decisions[item.candidate.id];
          return (
            <li key={item.candidate.id} className="flex flex-col gap-2 rounded-md border border-borde bg-white p-3">
              <p className="text-lg font-semibold break-words text-tinta">
                {a} <span className="font-normal text-gris-texto">y</span> {b}
              </p>
              <AiVerdictLine item={item} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={decision === "confirmed" ? "create" : "secondary"} icon={Check} aria-pressed={decision === "confirmed"} onClick={() => onDecide(item.candidate.id, decision === "confirmed" ? null : "confirmed")}>
                  Sí, es la misma pieza
                </Button>
                <Button size="sm" variant={decision === "excluded" ? "danger-outline" : "neutral"} icon={X} aria-pressed={decision === "excluded"} onClick={() => onDecide(item.candidate.id, decision === "excluded" ? null : "excluded")}>
                  No, sacar del grupo
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** La barra para aprobar un grupo, con lo que pasará y por qué está deshabilitada. */
export function GroupApprovalBar({
  group,
  count,
  needsChoice,
  blockedReason,
  busy,
  onApprove,
}: {
  group: Exclude<AiGroupName, "unsure">;
  count: number;
  needsChoice: number;
  blockedReason: string | null;
  busy: boolean;
  onApprove: () => void;
}) {
  const pairs = count === 1 ? "1 par" : `${count} pares`;
  const label = group === "same" ? `Aprobar ${pairs} como la misma pieza` : `Aprobar ${pairs} como distintas`;
  return (
    <div className="flex flex-col gap-2 rounded-tarjeta border border-borde bg-white p-4 shadow-sm">
      <p className="text-base text-gris-texto">
        {group === "same"
          ? "Se fusionan los pares sin valores en choque, conservando la pieza con código I; las filas de Excel se resuelven hacia su pieza. Nada se borra y cada fusión se puede revertir desde la auditoría."
          : "Cada par queda como piezas distintas, con el motivo de Gemini en la nota."}
        {group === "same" && needsChoice > 0 && ` ${needsChoice === 1 ? "1 par tiene" : `${needsChoice} pares tienen`} valores distintos: quedan en la cola para elegirlos.`}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant={group === "same" ? "create" : "primary"} onClick={onApprove} disabled={busy || count === 0 || blockedReason !== null}>
          {busy ? "Aprobando…" : label}
        </Button>
        {blockedReason && <p className="text-base font-semibold text-ambar-texto">{blockedReason}</p>}
      </div>
    </div>
  );
}
