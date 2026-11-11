"use client";

/**
 * Pantalla 9 — Reportes: inventario general, por colección, por ubicación, agrupado por atributo,
 * incompletas (RF-033..035, RF-047) y exportación completa de la base en formato abierto (RF-044).
 * En modo `live`, los inventarios vienen de `GET /reports/{report_type}` (change
 * `reportes-inventario`, 3.1).
 */
import { Download, FileSpreadsheet } from "lucide-react";
import { useState } from "react";

import { IncompleteReportPanel } from "@/components/domain/IncompleteReportPanel";
import { ReportPreview } from "@/components/domain/ReportPreview";
import { ReportSelector } from "@/components/domain/ReportSelector";
import { ReportsLive } from "@/components/domain/ReportsLive";
import { StorageEstimateCard } from "@/components/domain/StorageEstimateCard";
import { FullExportPanel } from "@/components/domain/SearchLive";
import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { RequireSession } from "@/components/layout/RequireSession";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSession } from "@/lib/auth/session";
import { getApiMode } from "@/lib/data/mode";
import type { ReportKey } from "@/lib/data/reports";
import { computeByCollectionReport, computeByLocationReport, computeInventoryReport } from "@/lib/fixtures";

/** Los reportes del modo sintético; los demás solo existen con la API. */
const MOCK_REPORTS: Partial<Record<ReportKey, typeof computeInventoryReport>> = {
  inventory: computeInventoryReport,
  "by-collection": computeByCollectionReport,
  "by-location": computeByLocationReport,
};

function ReportesContent() {
  const { hasPermission, currentUser } = useSession();
  const [selected, setSelected] = useState<ReportKey>("inventory");
  const [exported, setExported] = useState(false);

  if (!hasPermission("reports.view")) {
    return <PermissionNotice>Su rol no tiene permiso para ver reportes. Cambie de rol desde la cabecera para probarlo.</PermissionNotice>;
  }

  const live = getApiMode() === "live";
  const report = live ? null : (MOCK_REPORTS[selected]?.() ?? null);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-tinta">Reportes</h1>
        <p className="text-base text-gris-texto">
          {live ? "Generados en el momento sobre una instantánea consistente del catálogo." : "Calculados en el momento a partir del catálogo sintético."}
        </p>
      </header>

      <ReportSelector selected={selected} onSelect={setSelected} />

      {selected === "incomplete" ? (
        <Card as="section" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-tinta">Piezas con información incompleta</h2>
          <IncompleteReportPanel devUser={currentUser?.email} canDownload={hasPermission("exports.run")} />
        </Card>
      ) : live ? (
        <ReportsLive key={selected} type={selected} />
      ) : report ? (
        <Card as="section" className="flex flex-col gap-3">
          {/* La misma vista previa que el modo conectado: columnas principales y totales en frase. */}
          {hasPermission("exports.run") && (
            <div className="flex flex-wrap justify-end">
              <Button variant="outline" icon={FileSpreadsheet} onClick={() => setExported(true)}>
                Exportar a Excel
              </Button>
            </div>
          )}
          {exported && (
            <p className="rounded-md bg-verde-bg px-3 py-2 text-base text-verde-exito">
              En el modo demostración no se genera el archivo; con datos reales se descarga un Excel con todas las columnas.
            </p>
          )}
          <ReportPreview report={report} />
        </Card>
      ) : (
        <Card as="section">
          <p className="text-base text-gris-texto">Este reporte necesita la conexión con el sistema: no está disponible con los datos de ejemplo.</p>
        </Card>
      )}

      {/* La pantalla ya exige `reports.view`, el mismo permiso que la estimación (RNF-003). */}
      <StorageEstimateCard devUser={currentUser?.email} />

      {hasPermission("exports.full") && live && <FullExportPanel />}
      {hasPermission("exports.full") && !live && (
        <Card as="section">
          <h2 className="text-lg font-semibold text-tinta">Exportación completa de la base</h2>
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
