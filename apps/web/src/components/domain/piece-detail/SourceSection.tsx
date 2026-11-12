"use client";

import { Card } from "@/components/ui/Card";
import type { ApiSchemas } from "@/lib/api/client";

type SourceRecord = ApiSchemas["SourceRecordOut"];

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Sin dato";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/** Lectura de las columnas de origen conservadas, nunca editables desde la ficha. */
export function SourceSection({ records }: { records: SourceRecord[] }) {
  if (records.length === 0) {
    return (
      <Card className="border-dashed text-center text-base text-gris-texto">
        Esta pieza no tiene datos de origen adicionales registrados.
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {records.map((record) => (
        <Card key={record.id} as="section" aria-label={`Origen: ${record.source_name}`}>
          <h3 className="text-base font-semibold text-tinta">{record.source_name}</h3>
          <p className="mt-1 text-base text-gris-texto">
            {record.source_file_name}{record.source_row_number !== null ? ` · fila ${record.source_row_number}` : ""}
          </p>
          {Object.keys(record.payload).length > 0 && (
            <details className="mt-3 rounded-md border border-borde p-3">
              <summary className="cursor-pointer text-base font-medium text-tinta">Ver columnas originales</summary>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                {Object.entries(record.payload).map(([name, value]) => (
                  <div key={name} className="min-w-0">
                    <dt className="break-words text-base font-semibold text-tinta">{name}</dt>
                    <dd className="break-words text-base text-gris-texto">{displayValue(value)}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
        </Card>
      ))}
    </div>
  );
}
