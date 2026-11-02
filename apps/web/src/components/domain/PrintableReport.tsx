"use client";

/** Vista imprimible (change `reportes-inventario`, tarea 3.2): cabecera repetida en cada página y salto por colección. */
import { ReportSummary } from "@/components/domain/ReportPreview";
import { PRINT_LIMIT, cellText, filtersText, groupRows, type Report } from "@/lib/data/reports";

export function PrintableReport({ report, tooLarge }: { report: Report; tooLarge: boolean }) {
  const header = (
    <div className="flex flex-col gap-1 border-b border-tinta pb-2">
      <h1 className="text-xl font-bold text-tinta">{report.title}</h1>
      <p className="text-sm text-tinta">
        Generado el {new Date(report.generated_at).toLocaleString("es-PE")}
        {report.generated_by ? ` por ${report.generated_by}` : ""}
      </p>
      <p className="text-sm text-tinta">Filtros: {filtersText(report)}</p>
    </div>
  );
  if (tooLarge) {
    return (
      <div className="flex flex-col gap-3">
        {header}
        <p role="alert" className="rounded-md bg-ambar-bg p-3 text-base text-ambar-texto">
          El reporte tiene {report.total_rows.toLocaleString("es-PE")} filas y supera el límite de impresión ({PRINT_LIMIT.toLocaleString("es-PE")}).
          Expórtelo a Excel desde la pantalla de Reportes, o filtre por colección.
        </p>
      </div>
    );
  }
  const groups = groupRows(report);
  return (
    <div className="flex flex-col gap-4 print:gap-0">
      {groups.map((group, index) => (
        <section key={`${group.label}-${index}`} className={index > 0 ? "print:break-before-page" : undefined}>
          <table className="w-full text-left text-xs">
            <thead className="table-header-group">
              <tr>
                <th colSpan={report.columns.length} className="pb-2 font-normal">
                  {header}
                  {group.label && (
                    <p className="pt-1 text-sm font-semibold text-tinta">
                      {group.heading}: {group.label}
                    </p>
                  )}
                </th>
              </tr>
              <tr>
                {report.columns.map((column) => (
                  <th key={column} className="border-b border-borde py-1 pr-2 font-semibold">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-borde">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="py-0.5 pr-2 align-top">
                      {cellText(cell, report.columns[cellIndex])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <ReportSummary report={report} />
    </div>
  );
}
