"use client";

/**
 * Pantalla 9 — Reportes: inventario general, por colección, por ubicación, agrupado por atributo e
 * incompletas (RF-033..035, RF-047). La exportación completa de la base (RF-044) y la estimación del
 * volumen fotográfico (RNF-003) están en Administración › Control (change `reportes-vista-simplificada`).
 * En modo `live`, los inventarios vienen de `GET /reports/{report_type}` (change
 * `reportes-inventario`, 3.1).
 */
import { FileSpreadsheet } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";

import { IncompleteReportPanel } from "@/components/domain/IncompleteReportPanel";
import { ReportPreview } from "@/components/domain/ReportPreview";
import { ReportSelector } from "@/components/domain/ReportSelector";
import { ReportsLive } from "@/components/domain/ReportsLive";
import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { RequireSession } from "@/components/layout/RequireSession";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSession } from "@/lib/auth/session";
import { getApiMode } from "@/lib/data/mode";
import { incompleteStateFromSearch, paramsFromSearch, reportKeyFromSearch, reportsHref, type IncompleteUrlState, type ReportKey, type ReportParams } from "@/lib/data/reports";
import { computeByCollectionReport, computeByLocationReport, computeInventoryReport } from "@/lib/fixtures";

/** Los reportes del modo sintético; los demás solo existen con la API. */
const MOCK_REPORTS: Partial<Record<ReportKey, typeof computeInventoryReport>> = {
  inventory: computeInventoryReport,
  "by-collection": computeByCollectionReport,
  "by-location": computeByLocationReport,
};

function ReportesContent() {
  const { hasPermission, currentUser } = useSession();
  // El tipo de reporte y sus filtros viven en la dirección (prueba humana 7.2): F5 o un enlace los conservan.
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlType = reportKeyFromSearch(searchParams);
  const [selected, setSelected] = useState<ReportKey>(urlType);
  const [exported, setExported] = useState(false);
  // Los filtros de la dirección solo valen para el reporte que la dirección nombra (al cambiar de tipo, empieza sin filtros).
  const fromUrl = urlType === selected;
  const initialParams = useMemo<ReportParams | undefined>(
    () => (fromUrl && selected !== "incomplete" ? paramsFromSearch(new URLSearchParams(searchParams.toString())) : undefined),
    [fromUrl, selected, searchParams],
  );
  const initialIncomplete = useMemo<IncompleteUrlState | undefined>(
    () => (fromUrl && selected === "incomplete" ? incompleteStateFromSearch(new URLSearchParams(searchParams.toString())) : undefined),
    [fromUrl, selected, searchParams],
  );
  const replace = useCallback((href: string) => router.replace(href, { scroll: false }), [router]);
  const onParamsChange = useCallback((params: ReportParams) => replace(reportsHref(selected, params)), [replace, selected]);
  const onIncompleteChange = useCallback((state: IncompleteUrlState) => replace(reportsHref("incomplete", undefined, state)), [replace]);

  function choose(type: ReportKey) {
    setSelected(type);
    setExported(false);
    replace(reportsHref(type));
  }

  if (!hasPermission("reports.view")) {
    return <PermissionNotice>Su rol no tiene permiso para ver reportes. Cambie de rol desde el menú para probarlo.</PermissionNotice>;
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

      <ReportSelector selected={selected} onSelect={choose} />

      {selected === "incomplete" ? (
        <Card as="section" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-tinta">Piezas con información incompleta</h2>
          <IncompleteReportPanel
            devUser={currentUser?.email}
            canDownload={hasPermission("exports.run")}
            initialState={initialIncomplete}
            onStateChange={onIncompleteChange}
          />
        </Card>
      ) : live ? (
        <ReportsLive key={selected} type={selected} initialParams={initialParams} onParamsChange={onParamsChange} />
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
    </div>
  );
}

export default function ReportesPage() {
  // `useSearchParams` dentro de `Suspense`: sin él, `next build` falla.
  return (
    <RequireSession>
      <Suspense fallback={null}>
        <ReportesContent />
      </Suspense>
    </RequireSession>
  );
}
