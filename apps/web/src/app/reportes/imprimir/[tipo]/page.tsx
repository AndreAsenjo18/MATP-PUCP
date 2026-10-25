"use client";

/**
 * Vista imprimible de un reporte (change `reportes-inventario`, tarea 3.2; RF-033, RNF-010): lee el
 * reporte completo hasta 2 000 filas, repite la cabecera (título, fecha, usuario y filtros) en cada
 * página impresa y salta de página por colección. Por encima del límite sugiere Excel.
 */
import { Printer } from "lucide-react";
import { notFound, useSearchParams } from "next/navigation";
import { Suspense, use, useEffect, useState } from "react";

import { PrintableReport } from "@/components/domain/ReportsLive";
import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { RequireSession } from "@/components/layout/RequireSession";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/lib/auth/session";
import { fetchPrintableReport, paramsFromSearch, type LiveReportType, type Report } from "@/lib/data/reports";

const PRINTABLE: LiveReportType[] = ["inventory", "by-collection", "by-location"];

function PrintContent({ type }: { type: LiveReportType }) {
  const { currentUser } = useSession();
  const search = useSearchParams();
  const key = search.toString();
  const [state, setState] = useState<{ key: string; report: (Report & { tooLarge: boolean }) | null; error: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    fetchPrintableReport(type, paramsFromSearch(new URLSearchParams(key)), currentUser?.email).then((result) => {
      if (!active) return;
      setState(result.status === "ok" ? { key, report: result.value, error: null } : { key, report: null, error: result.message });
    });
    return () => {
      active = false;
    };
  }, [type, key, currentUser?.email]);

  if (state?.key !== key) {
    return (
      <p role="status" className="text-base text-gris-texto">
        Preparando el reporte…
      </p>
    );
  }
  if (!state.report) return <PermissionNotice>{state.error}</PermissionNotice>;
  return (
    <div className="flex flex-col gap-4 bg-white">
      <div className="flex justify-end print:hidden">
        <Button icon={Printer} disabled={state.report.tooLarge} onClick={() => window.print()}>
          Imprimir
        </Button>
      </div>
      <PrintableReport report={state.report} tooLarge={state.report.tooLarge} />
    </div>
  );
}

export default function PrintReportPage({ params }: PageProps<"/reportes/imprimir/[tipo]">) {
  const { tipo } = use(params);
  if (!PRINTABLE.includes(tipo as LiveReportType)) notFound();
  return (
    <RequireSession>
      <Suspense fallback={null}>
        <PrintContent type={tipo as LiveReportType} />
      </Suspense>
    </RequireSession>
  );
}
