"use client";

/**
 * Pantalla 6 — Asistente de importación (RF-021..029): ingesta → mapeo → normalización y
 * validación → previsualización con diff y clasificación → aprobación → bitácora con rechazos
 * descargables. Usa el mismo lote y filas "sucias" de `sabana_sintetica_v1.xlsx` (RIA-01/02).
 */
import { useState } from "react";

import { PermissionNotice } from "@/components/AppShell";
import { StatusBadge } from "@/components/Badges";
import { ConfirmButton } from "@/components/ConfirmButton";
import { RequireSession } from "@/components/RequireSession";
import { useSession } from "@/lib/auth/session";
import { useMockStore } from "@/lib/data/mock-store";
import { IMPORT_TEMPLATES, rowsForBatch } from "@/lib/fixtures";

const STEPS = ["Subir archivo", "Mapeo", "Normalización y validación", "Previsualización", "Aprobación", "Bitácora"] as const;

const CLASSIFICATION_LABEL: Record<string, string> = {
  NEW: "Nuevo",
  UPDATE: "Actualización",
  POSSIBLE_DUPLICATE: "Posible duplicado",
  CONFLICT: "Conflicto",
};

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
        <h1 className="text-2xl font-bold text-stone-900">Asistente de importación</h1>
        <p className="text-base text-stone-700">Lote de demostración: {batch.file_name} ({batch.source_name}).</p>
      </header>

      <ol className="flex flex-wrap gap-2">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => setStep(index)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                index === step ? "bg-stone-900 text-white" : index < step ? "bg-emerald-100 text-emerald-900" : "bg-stone-100 text-stone-600"
              }`}
            >
              {index + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="flex flex-col gap-4 rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-base text-stone-700">
            Seleccione el archivo Excel a importar. En modo mock se usa el archivo sintético del arranque, que
            reproduce a propósito el &quot;caos de codificación&quot; (códigos con puntos, celdas con varios códigos,
            sin código I, etc.).
          </p>
          <div className="rounded-md border border-dashed border-stone-300 p-6 text-center text-stone-600">
            <p className="font-medium text-stone-900">{batch.file_name}</p>
            <p className="text-sm">data/fixtures/sabana_sintetica_v1.xlsx (sintético, generado por el seed de la API)</p>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-stone-900">Plantilla de mapeo: {template.name}</h2>
          <p className="text-sm text-stone-700">{template.description}</p>
          <table className="w-full text-left text-base">
            <thead className="text-sm text-stone-600">
              <tr>
                <th className="py-1 pr-4 font-medium">Columna de origen</th>
                <th className="py-1 pr-4 font-medium">Campo destino</th>
                <th className="py-1 pr-4 font-medium">Celda con varios códigos</th>
              </tr>
            </thead>
            <tbody>
              {template.columns.map((col) => (
                <tr key={col.source_column} className="border-t border-stone-100">
                  <td className="py-1 pr-4 text-stone-900">{col.source_column}</td>
                  <td className="py-1 pr-4 text-stone-700">{col.target_field ?? "(se conserva como dato de origen, RF-008)"}</td>
                  <td className="py-1 pr-4 text-stone-700">{col.split_compound ? "Sí (RF-023)" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-stone-900">Resultado de normalización y validación</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {Object.entries(batch.counts ?? {}).map(([key, value]) => (
              <div key={key} className="rounded-md bg-stone-50 p-3 text-center">
                <p className="text-2xl font-bold text-stone-900">{value}</p>
                <p className="text-sm text-stone-600">{key}</p>
              </div>
            ))}
          </div>
          <h3 className="mt-2 text-base font-semibold text-stone-900">Errores de validación encontrados</h3>
          <ul className="flex flex-col gap-2">
            {rows
              .filter((r) => r.validation_errors.length > 0)
              .map((r) => (
                <li key={r.id} className="rounded-md bg-red-50 p-3 text-base text-red-900">
                  Fila {r.source_row_number}:{" "}
                  {r.validation_errors.map((e) => (e as { message?: string }).message ?? JSON.stringify(e)).join("; ")}
                </li>
              ))}
            {rows.every((r) => r.validation_errors.length === 0) && <li className="text-base text-stone-600">Sin errores de validación.</li>}
          </ul>
        </section>
      )}

      {step === 3 && <PreviewStep rows={rows} />}

      {step === 4 && (
        <section className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-stone-900">Aprobación de la carga masiva</h2>
          <p className="text-base text-stone-700">
            Resumen: {rows.filter((r) => r.decision === "ACCEPTED").length} filas aceptadas,{" "}
            {rows.filter((r) => r.decision === "EXCLUDED").length} excluidas,{" "}
            {rows.filter((r) => r.decision === "REJECTED").length} rechazadas,{" "}
            {rows.filter((r) => r.decision === "PENDING").length} aún pendientes de decisión.
          </p>
          {!hasPermission("imports.approve") ? (
            <PermissionNotice>Su rol puede preparar la carga pero no aprobarla (RF-027). Cambie a Administrador o Gestor de colecciones.</PermissionNotice>
          ) : batch.status === "APPLIED" ? (
            <StatusBadge label="Carga aplicada" tone="approved" />
          ) : (
            <ConfirmButton
              label="Aprobar y aplicar la carga masiva"
              tone="primary"
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
        </section>
      )}

      {step === 5 && (
        <section className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-stone-900">Bitácora de la carga</h2>
          <ul className="flex flex-col gap-2 text-base text-stone-900">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 border-t border-stone-100 pt-2 first:border-t-0 first:pt-0">
                <span>
                  Fila {r.source_row_number} — {CLASSIFICATION_LABEL[r.classification ?? ""] ?? "Sin clasificar"}
                </span>
                <StatusBadge
                  label={r.decision === "ACCEPTED" ? "Aceptada" : r.decision === "EXCLUDED" ? "Excluida" : r.decision === "REJECTED" ? "Rechazada" : "Pendiente"}
                  tone={r.decision === "ACCEPTED" ? "approved" : r.decision === "REJECTED" ? "rejected" : "neutral"}
                />
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => window.alert("Descarga simulada: en modo mock no se genera un archivo real (rechazos.xlsx).")} className="self-start rounded-md border border-stone-300 px-4 py-2 text-base text-stone-900 hover:bg-stone-100">
            Descargar rechazos (Excel)
          </button>
        </section>
      )}

      <div className="flex justify-between border-t border-stone-100 pt-4">
        <button type="button" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))} className="rounded-md border border-stone-300 px-4 py-2 text-base text-stone-900 disabled:opacity-40">
          Atrás
        </button>
        <button type="button" disabled={step === STEPS.length - 1} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} className="rounded-md bg-stone-900 px-4 py-2 text-base font-medium text-white disabled:opacity-40">
          Siguiente
        </button>
      </div>
    </div>
  );
}

function PreviewStep({ rows }: { rows: ReturnType<typeof rowsForBatch> }) {
  const { hasPermission, currentUser, currentRole } = useSession();
  const store = useMockStore();
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-stone-900">Previsualización con diff y clasificación</h2>
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-md border border-stone-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-stone-900">Fila {row.source_row_number}</span>
              <StatusBadge label={CLASSIFICATION_LABEL[row.classification ?? ""] ?? "Sin clasificar"} tone={row.classification === "CONFLICT" ? "rejected" : row.classification === "POSSIBLE_DUPLICATE" ? "pending" : "neutral"} />
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm text-stone-700 sm:grid-cols-4">
              {Object.entries(row.raw_data).map(([key, value]) => (
                <div key={key}>
                  <dt className="font-medium text-stone-600">{key}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
            </dl>
            {row.diff.length > 0 && (
              <div className="mt-2 rounded-md bg-amber-50 p-2 text-sm text-amber-900">
                {row.diff.map((d) => (
                  <p key={d.field}>
                    <strong>{d.field}</strong>: {String(d.current_value ?? "—")} → {String(d.incoming_value ?? "—")}
                  </p>
                ))}
              </div>
            )}
            {row.validation_errors.length > 0 && (
              <p className="mt-2 text-sm text-red-700">
                {row.validation_errors.map((e) => (e as { message?: string }).message).join("; ")}
              </p>
            )}
            {hasPermission("imports.prepare") && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-sm text-stone-600">Decisión:</span>
                <StatusBadge label={row.decision} tone={row.decision === "ACCEPTED" ? "approved" : row.decision === "REJECTED" ? "rejected" : "neutral"} />
                <button
                  type="button"
                  onClick={() => store.decideImportRow(row.id, "ACCEPTED", null, currentUser?.full_name ?? currentRole?.name ?? "Persona sintética", currentUser?.id ?? "")}
                  className="rounded-md border border-emerald-300 px-2 py-1 text-sm text-emerald-900 hover:bg-emerald-50"
                >
                  Aceptar
                </button>
                <button
                  type="button"
                  onClick={() => store.decideImportRow(row.id, "EXCLUDED", "Excluida manualmente en la previsualización.", currentUser?.full_name ?? currentRole?.name ?? "Persona sintética", currentUser?.id ?? "")}
                  className="rounded-md border border-stone-300 px-2 py-1 text-sm text-stone-700 hover:bg-stone-100"
                >
                  Excluir
                </button>
                <ConfirmButton
                  label="Rechazar"
                  tone="danger"
                  confirmTitle="Rechazar fila"
                  confirmDescription="La fila queda registrada como rechazada en la bitácora, con el motivo indicado (RF-028)."
                  requireReason
                  reasonLabel="Motivo del rechazo"
                  onConfirm={(reason) => store.decideImportRow(row.id, "REJECTED", reason, currentUser?.full_name ?? currentRole?.name ?? "Persona sintética", currentUser?.id ?? "")}
                  className="px-2 py-1 text-sm"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ImportacionPage() {
  return (
    <RequireSession>
      <ImportacionContent />
    </RequireSession>
  );
}
