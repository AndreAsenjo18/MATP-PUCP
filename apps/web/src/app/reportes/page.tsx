"use client";

/**
 * Pantalla 9 — Reportes: inventario general, por colección, por ubicación, incompletas
 * (RF-033..035) y exportación completa de la base en formato abierto (RF-044).
 */
import { useState } from "react";

import { PermissionNotice } from "@/components/AppShell";
import { RequireSession } from "@/components/RequireSession";
import { useSession } from "@/lib/auth/session";
import {
  computeByCollectionReport,
  computeByLocationReport,
  computeIncompleteReport,
  computeInventoryReport,
} from "@/lib/fixtures";

const REPORTS = [
  { key: "inventory", label: "Inventario general", compute: computeInventoryReport },
  { key: "by-collection", label: "Por colección", compute: computeByCollectionReport },
  { key: "by-location", label: "Por ubicación", compute: computeByLocationReport },
  { key: "incomplete", label: "Información incompleta", compute: computeIncompleteReport },
] as const;

function ReportesContent() {
  const { hasPermission } = useSession();
  const [selected, setSelected] = useState<(typeof REPORTS)[number]["key"]>("inventory");
  const [exported, setExported] = useState(false);

  if (!hasPermission("reports.view")) {
    return <PermissionNotice>Su rol no tiene permiso para ver reportes. Cambie de rol desde la cabecera para probarlo.</PermissionNotice>;
  }

  const report = REPORTS.find((r) => r.key === selected)!.compute();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-stone-900">Reportes</h1>
        <p className="text-base text-stone-700">Calculados en el momento a partir del catálogo sintético.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setSelected(r.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${selected === r.key ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200"}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-stone-900">{report.title}</h2>
          {hasPermission("exports.run") && (
            <button
              type="button"
              onClick={() => setExported(true)}
              className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-900 hover:bg-stone-100"
            >
              Exportar a Excel
            </button>
          )}
        </div>
        {exported && (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Descarga simulada de <code>{report.report_type}.xlsx</code> (RF-036). En modo conectado se generaría un
            archivo real.
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-base">
            <thead className="text-sm text-stone-600">
              <tr>
                {report.columns.map((col) => (
                  <th key={col} className="py-2 pr-4 font-medium">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, index) => (
                <tr key={index} className="border-t border-stone-100">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="py-2 pr-4 text-stone-900">
                      {String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-stone-600">
          Totales: {Object.entries(report.totals).map(([k, v]) => `${k}: ${v}`).join(" · ")}
        </p>
      </section>

      {hasPermission("exports.full") && (
        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-stone-900">Exportación completa de la base (RF-044)</h2>
          <p className="mt-1 text-base text-stone-700">
            Genera un archivo abierto (Excel/CSV) con todas las piezas y sus identificadores, para no depender de
            este sistema.
          </p>
          <button
            type="button"
            onClick={() => window.alert("Descarga simulada: en modo mock no se genera un archivo real (exportacion-completa.xlsx).")}
            className="mt-2 rounded-md bg-stone-900 px-4 py-2 text-base font-medium text-white hover:bg-stone-800"
          >
            Exportar base completa
          </button>
        </section>
      )}
    </div>
  );
}

export default function ReportesPage() {
  return (
    <RequireSession>
      <ReportesContent />
    </RequireSession>
  );
}
