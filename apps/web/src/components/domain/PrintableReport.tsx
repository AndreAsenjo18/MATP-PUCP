"use client";

/**
 * Vista imprimible (change `reportes-inventario`, tarea 3.2; `reportes-por-atributo`, tarea 3.3):
 * cabecera repetida en cada página, en horizontal porque un reporte de piezas lleva muchas columnas.
 * Cada colección empieza página. El agrupado por atributo corre seguido: el texto libre puede dar
 * cientos de grupos de una sola pieza, y una hoja por grupo sería un desperdicio.
 */
import { ReportSummary } from "@/components/domain/ReportPreview";
import { DESCRIPTION_COLUMN, PRINT_LIMIT, cellText, filtersText, groupRows, groupTitle, maskedNotice, type Report, type ReportRowGroup } from "@/lib/data/reports";

const PAGE_STYLE = "@page { size: landscape; }";

function PrintedRows({ report, group }: { report: Report; group: ReportRowGroup }) {
  return group.rows.map((row, rowIndex) => (
    <tr key={rowIndex} className="border-b border-borde print:break-inside-avoid">
      {row.map((cell, cellIndex) => (
        <td key={cellIndex} className={`py-0.5 pr-2 align-top [overflow-wrap:anywhere] ${report.columns[cellIndex] === DESCRIPTION_COLUMN ? "whitespace-pre-wrap" : ""}`}>
          {cellText(cell, report.columns[cellIndex])}
        </td>
      ))}
    </tr>
  ));
}

export function PrintableReport({ report, tooLarge }: { report: Report; tooLarge: boolean }) {
  const masked = report.masked_columns ?? [];
  const header = (
    <div className="flex flex-col gap-1 border-b border-tinta pb-2">
      <h1 className="text-xl font-bold text-tinta">{report.title}</h1>
      <p className="text-sm text-tinta">
        Generado el {new Date(report.generated_at).toLocaleString("es-PE")}
        {report.generated_by ? ` por ${report.generated_by}` : ""}
      </p>
      <p className="text-sm text-tinta">Filtros: {filtersText(report)}</p>
      {masked.length > 0 && <p className="text-sm text-tinta">{maskedNotice(masked)}</p>}
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
  const runsOn = report.columns.includes("Grupo");
  const sections = runsOn ? [groups] : groups.map((group) => [group]);
  return (
    <div className="flex flex-col gap-4 print:gap-0">
      <style>{PAGE_STYLE}</style>
      {sections.map((section, index) => (
        <section key={index} className={index > 0 ? "print:break-before-page" : undefined}>
          <table className="w-full text-left text-xs">
            <thead className="table-header-group">
              <tr>
                <th colSpan={report.columns.length} className="pb-2 font-normal">
                  {header}
                  {!runsOn && section[0].label && <p className="pt-1 text-sm font-semibold text-tinta">{groupTitle(section[0])}</p>}
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
            {section.map((group, groupIndex) => (
              <tbody key={`${group.label}-${groupIndex}`}>
                {runsOn && (
                  <tr className="print:break-after-avoid">
                    <th colSpan={report.columns.length} className="pt-2 pb-1 text-sm font-semibold text-tinta">
                      {groupTitle(group)}
                    </th>
                  </tr>
                )}
                <PrintedRows report={report} group={group} />
              </tbody>
            ))}
          </table>
        </section>
      ))}
      {report.message && <p className="text-sm text-tinta">{report.message}</p>}
      <ReportSummary report={report} />
    </div>
  );
}
