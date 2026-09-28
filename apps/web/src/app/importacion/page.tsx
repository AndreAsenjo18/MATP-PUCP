"use client";

/**
 * Pantalla 6 — Asistente de importación (RF-021..029): ingesta → mapeo → normalización y
 * validación → previsualización con diff y clasificación → aprobación → bitácora con rechazos
 * descargables. Usa el mismo lote y filas "sucias" de `sabana_sintetica_v1.xlsx` (RIA-01/02).
 */
import { ArrowLeft, ArrowRight, Check, Download, FileSpreadsheet, MinusCircle, SearchCheck } from "lucide-react";
import { useState } from "react";

import { ConfirmButton } from "@/components/domain/ConfirmButton";
import { ImportConflictModal } from "@/components/domain/ImportConflictModal";
import { importClassificationStatus, importDecisionStatus } from "@/components/domain/status-intents";
import { StatusBadge } from "@/components/domain/StatusBadges";
import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { RequireSession } from "@/components/layout/RequireSession";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { useSession } from "@/lib/auth/session";
import { useMockStore } from "@/lib/data/mock-store";
import { IMPORT_TEMPLATES, rowsForBatch } from "@/lib/fixtures";

const STEPS = ["Subir archivo", "Mapeo", "Normalización y validación", "Previsualización", "Aprobación", "Bitácora"] as const;

/** Filas que necesitan revisar la comparación con el catálogo antes de decidir (RF-026). */
const NEEDS_REVIEW = new Set(["CONFLICT", "POSSIBLE_DUPLICATE"]);

function ImportacionContent() {
  const { hasPermission, currentUser, currentRole } = useSession();
  const store = useMockStore();
  const [step, setStep] = useState(0);
  const batch = store.importBatches[0];
  const rows = rowsForBatch(batch.id).map((r) => store.importRows.find((sr) => sr.id === r.id) ?? r);
  const template = IMPORT_TEMPLATES[0];

  if (!hasPermission("imports.prepare")) {
    return <PermissionNotice>Su rol no tiene permiso para preparar cargas masivas (RF-027). Cambie de rol desde la cabecera para probarlo.</PermissionNotice>;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-tinta">Asistente de importación</h1>
        <p className="text-base text-gris-texto">Lote de demostración: {batch.file_name} ({batch.source_name}).</p>
      </header>

      <ol className="flex flex-wrap gap-2" aria-label="Pasos de la importación">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              aria-current={index === step ? "step" : undefined}
              onClick={() => setStep(index)}
              className={cn(
                "flex min-h-11 items-center gap-1 rounded-full px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota",
                index === step ? "bg-terracota text-white" : index < step ? "bg-verde-bg text-verde-exito" : "bg-crema text-tinta hover:bg-borde",
              )}
            >
              {index < step && <Check size={16} aria-hidden="true" />}
              {index + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Card as="section" className="flex flex-col gap-4">
          <p className="text-base text-gris-texto">
            Seleccione el archivo Excel a importar. En modo mock se usa el archivo sintético del arranque, que
            reproduce a propósito el &quot;caos de codificación&quot; (códigos con puntos, celdas con varios códigos,
            sin código I, etc.).
          </p>
          <div className="flex flex-col items-center gap-1 rounded-md border border-dashed border-borde p-6 text-center text-gris-texto">
            <FileSpreadsheet size={28} aria-hidden="true" className="text-terracota" />
            <p className="font-medium text-tinta">{batch.file_name}</p>
            <p className="text-sm">data/fixtures/sabana_sintetica_v1.xlsx (sintético, generado por el seed de la API)</p>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card as="section" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-tinta">Plantilla de mapeo: {template.name}</h2>
          <p className="text-sm text-gris-texto">{template.description}</p>
          <div className="overflow-x-auto">
          <table className="w-full text-left text-base">
            <thead className="text-sm text-gris-texto">
              <tr>
                <th className="py-1 pr-4 font-medium">Columna de origen</th>
                <th className="py-1 pr-4 font-medium">Campo destino</th>
                <th className="py-1 pr-4 font-medium">Celda con varios códigos</th>
              </tr>
            </thead>
            <tbody>
              {template.columns.map((col) => (
                <tr key={col.source_column} className="border-t border-borde">
                  <td className="py-1 pr-4 text-tinta">{col.source_column}</td>
                  <td className="py-1 pr-4 text-gris-texto">{col.target_field ?? "(se conserva como dato de origen, RF-008)"}</td>
                  <td className="py-1 pr-4 text-gris-texto">{col.split_compound ? "Sí (RF-023)" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card as="section" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-tinta">Resultado de normalización y validación</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {Object.entries(batch.counts ?? {}).map(([key, value]) => (
              <div key={key} className="rounded-md bg-crema-light p-3 text-center">
                <p className="font-heading text-2xl font-bold text-tinta">{value}</p>
                <p className="text-sm text-gris-texto">{key}</p>
              </div>
            ))}
          </div>
          <h3 className="mt-2 text-base font-semibold text-tinta">Errores de validación encontrados</h3>
          <ul className="flex flex-col gap-2">
            {rows
              .filter((r) => r.validation_errors.length > 0)
              .map((r) => (
                <li key={r.id} className="rounded-md bg-carmin-bg p-3 text-base text-carmin-texto">
                  Fila {r.source_row_number}:{" "}
                  {r.validation_errors.map((e) => (e as { message?: string }).message ?? JSON.stringify(e)).join("; ")}
                </li>
              ))}
            {rows.every((r) => r.validation_errors.length === 0) && <li className="text-base text-gris-texto">Sin errores de validación.</li>}
          </ul>
        </Card>
      )}

      {step === 3 && <PreviewStep rows={rows} />}

      {step === 4 && (
        <Card as="section" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-tinta">Aprobación de la carga masiva</h2>
          <p className="text-base text-gris-texto">
            Resumen: {rows.filter((r) => r.decision === "ACCEPTED").length} filas aceptadas,{" "}
            {rows.filter((r) => r.decision === "EXCLUDED").length} excluidas,{" "}
            {rows.filter((r) => r.decision === "REJECTED").length} rechazadas,{" "}
            {rows.filter((r) => r.decision === "PENDING").length} aún pendientes de decisión.
          </p>
          {!hasPermission("imports.approve") ? (
            <PermissionNotice>Su rol puede preparar la carga pero no aprobarla (RF-027). Cambie a Administrador o Gestor de colecciones.</PermissionNotice>
          ) : batch.status === "APPLIED" ? (
            <StatusBadge status={{ label: "Carga aplicada", intent: "success" }} />
          ) : (
            <ConfirmButton
              label="Aprobar y aplicar la carga masiva"
              variant="primary"
              icon={Check}
              className="self-start"
              confirmTitle="Aprobar carga masiva"
              confirmDescription={
                <>
                  Se aplicarán las {rows.filter((r) => r.decision === "ACCEPTED").length} filas aceptadas al catálogo.
                  Las filas rechazadas quedan en la bitácora, nunca se pierden (RN-005). Esta acción queda auditada
                  con su usuario.
                </>
              }
              onConfirm={() => store.applyImportBatch(batch.id, currentUser?.full_name ?? currentRole?.name ?? "Persona sintética", currentUser?.id ?? "")}
            />
          )}
        </Card>
      )}

      {step === 5 && (
        <Card as="section" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-tinta">Bitácora de la carga</h2>
          <ul className="flex flex-col gap-2 text-base text-tinta">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-borde pt-2 first:border-t-0 first:pt-0">
                <span>
                  Fila {r.source_row_number} — {importClassificationStatus(r.classification).label}
                </span>
                <StatusBadge status={importDecisionStatus(r.decision)} />
              </li>
            ))}
          </ul>
          <Button variant="outline" icon={Download} className="self-start" onClick={() => window.alert("Descarga simulada: en modo mock no se genera un archivo real (rechazos.xlsx).")}>
            Descargar rechazos (Excel)
          </Button>
        </Card>
      )}

      <div className="flex justify-between gap-3 border-t border-borde pt-4">
        <Button variant="secondary" icon={ArrowLeft} disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          Atrás
        </Button>
        <Button disabled={step === STEPS.length - 1} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
          Siguiente
          <ArrowRight size={18} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function PreviewStep({ rows }: { rows: ReturnType<typeof rowsForBatch> }) {
  const { hasPermission, currentUser, currentRole } = useSession();
  const store = useMockStore();
  const [reviewRowId, setReviewRowId] = useState<string | null>(null);
  const actor = currentUser?.full_name ?? currentRole?.name ?? "Persona sintética";
  const reviewRow = rows.find((r) => r.id === reviewRowId);

  return (
    <Card as="section" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-tinta">Previsualización con diff y clasificación</h2>
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-md border border-borde p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-tinta">Fila {row.source_row_number}</span>
              <StatusBadge status={importClassificationStatus(row.classification)} />
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm text-tinta sm:grid-cols-4">
              {Object.entries(row.raw_data).map(([key, value]) => (
                <div key={key} className="min-w-0">
                  <dt className="font-medium text-gris-texto">{key}</dt>
                  <dd className="break-words">{String(value)}</dd>
                </div>
              ))}
            </dl>
            {row.diff.length > 0 && (
              <div className="mt-2 rounded-md bg-ambar-bg p-2 text-sm text-ambar-texto">
                {row.diff.map((d) => (
                  <p key={d.field}>
                    <strong>{d.field}</strong>: {String(d.current_value ?? "—")} → {String(d.incoming_value ?? "—")}
                  </p>
                ))}
              </div>
            )}
            {row.validation_errors.length > 0 && (
              <p className="mt-2 text-sm font-medium text-carmin-texto">
                {row.validation_errors.map((e) => (e as { message?: string }).message).join("; ")}
              </p>
            )}
            {hasPermission("imports.prepare") && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-sm text-gris-texto">Decisión:</span>
                <StatusBadge status={importDecisionStatus(row.decision)} />
                {NEEDS_REVIEW.has(row.classification ?? "") && (
                  <Button variant="primary" icon={SearchCheck} onClick={() => setReviewRowId(row.id)}>
                    Revisar diferencias
                  </Button>
                )}
                <Button variant="outline" icon={Check} onClick={() => store.decideImportRow(row.id, "ACCEPTED", null, actor, currentUser?.id ?? "")}>
                  Aceptar
                </Button>
                <Button
                  variant="secondary"
                  icon={MinusCircle}
                  onClick={() => store.decideImportRow(row.id, "EXCLUDED", "Excluida manualmente en la previsualización.", actor, currentUser?.id ?? "")}
                >
                  Excluir
                </Button>
                <ConfirmButton
                  label="Rechazar"
                  variant="danger"
                  confirmTitle="Rechazar fila"
                  confirmDescription="La fila queda registrada como rechazada en la bitácora, con el motivo indicado (RF-028)."
                  requireReason
                  reasonLabel="Motivo del rechazo"
                  onConfirm={(reason) => store.decideImportRow(row.id, "REJECTED", reason, actor, currentUser?.id ?? "")}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      {reviewRow && (
        <ImportConflictModal
          row={reviewRow}
          open
          onClose={() => setReviewRowId(null)}
          onDecide={(decision, reason) => store.decideImportRow(reviewRow.id, decision, reason, actor, currentUser?.id ?? "")}
        />
      )}
    </Card>
  );
}

export default function ImportacionPage() {
  return (
    <RequireSession>
      <ImportacionContent />
    </RequireSession>
  );
}
