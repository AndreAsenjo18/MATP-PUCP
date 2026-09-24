"use client";

/**
 * Pantalla 9 — Reportes: inventario general, por colección, por ubicación, incompletas
 * (RF-033..035) y exportación completa de la base en formato abierto (RF-044).
 */
import { Download, FileSpreadsheet } from "lucide-react";
import { useState } from "react";

import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { RequireSession } from "@/components/layout/RequireSession";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
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
        <h1 className="text-2xl font-bold text-tinta">Reportes</h1>
        <p className="text-base text-gris-texto">Calculados en el momento a partir del catálogo sintético.</p>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de reporte">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            type="button"
            aria-pressed={selected === r.key}
            onClick={() => setSelected(r.key)}
            className={cn(
              "min-h-11 rounded-full px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota",
              selected === r.key ? "bg-terracota text-white" : "bg-crema text-tinta hover:bg-borde",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <Card as="section" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-tinta">{report.title}</h2>
          {hasPermission("exports.run") && (
            <Button variant="outline" icon={FileSpreadsheet} onClick={() => setExported(true)}>
              Exportar a Excel
            </Button>
          )}
        </div>
        {exported && (
          <p className="rounded-md bg-verde-bg px-3 py-2 text-sm text-verde-exito">
            Descarga simulada de <code>{report.report_type}.xlsx</code> (RF-036). En modo conectado se generaría un
            archivo real.
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-base">
            <thead className="text-sm text-gris-texto">
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
                <tr key={index} className="border-t border-borde">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="py-2 pr-4 text-tinta">
                      {String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gris-texto">
          Totales: {Object.entries(report.totals).map(([k, v]) => `${k}: ${v}`).join(" · ")}
        </p>
      </Card>

      {hasPermission("exports.full") && (
        <Card as="section">
          <h2 className="text-lg font-semibold text-tinta">Exportación completa de la base (RF-044)</h2>
          <p className="mt-1 text-base text-gris-texto">
            Genera un archivo abierto (Excel/CSV) con todas las piezas y sus identificadores, para no depender de
            este sistema.
          </p>
          <Button
            icon={Download}
            onClick={() => window.alert("Descarga simulada: en modo mock no se genera un archivo real (exportacion-completa.xlsx).")}
            className="mt-2"
          >
            Exportar base completa
          </Button>
        </Card>
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
