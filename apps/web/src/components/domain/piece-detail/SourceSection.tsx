"use client";

import { Card } from "@/components/ui/Card";
import { getPieceSourceRecords } from "@/lib/fixtures";

export function SourceSection({ records }: { records: ReturnType<typeof getPieceSourceRecords> }) {
  if (records.length === 0) {
    return (
      <Card className="border-dashed text-center text-base text-gris-texto">
        Esta pieza no proviene de una carga masiva: no hay columnas de origen sin mapear que preservar.
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {records.map((record) => (
        <Card key={record.id}>
          <p className="text-sm text-gris-texto">
            {record.source_name} · fila {record.source_row_number ?? "?"} · {record.source_file_name}
          </p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-crema-light p-3 text-sm text-tinta">{JSON.stringify(record.payload, null, 2)}</pre>
        </Card>
      ))}
    </div>
  );
}
