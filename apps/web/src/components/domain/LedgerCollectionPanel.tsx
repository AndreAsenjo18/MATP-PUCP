"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { fetchCollectionList, type CollectionItem } from "@/lib/data/admin";
import { fetchImportDiffs, type ImportRow } from "@/lib/data/imports";

export type LedgerCollectionChange = { rowId: string; value: string };

export function LedgerCollectionPanel({ batchId, devUser, busy, canEdit, notice, onSave }: {
  batchId: string;
  devUser?: string;
  busy: boolean;
  canEdit: boolean;
  notice: string | null;
  onSave: (changes: LedgerCollectionChange[]) => Promise<void>;
}) {
  const [data, setData] = useState<{ rows: ImportRow[]; collections: CollectionItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"common" | "individual" | "">("");
  const [common, setCommon] = useState("");
  const [individual, setIndividual] = useState<Record<string, string>>({});
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      const collections = await fetchCollectionList(devUser);
      if (!active) return;
      if (collections.status !== "ok") { setError(collections.message); return; }
      const rows: ImportRow[] = [];
      for (let page = 1; ; page += 1) {
        const result = await fetchImportDiffs(batchId, { page, pageSize: 100 }, devUser);
        if (!active) return;
        if (result.status !== "ok") { setError(result.message); return; }
        rows.push(...result.value.items);
        if (rows.length >= result.value.total) break;
        if (result.value.items.length === 0) { setError("No se pudieron leer todas las filas."); return; }
      }
      setData({ rows, collections: collections.value.filter((item) => item.is_active) });
      setError(null);
    }
    void load();
    return () => { active = false; };
  }, [batchId, devUser, retry]);

  const current = (row: ImportRow) => {
    const mapped = row.mapped_data as { collection_id?: string | null } | null;
    return mapped?.collection_id ?? "";
  };
  const selected = (row: ImportRow) => individual[row.id] ?? current(row);
  const options = data?.collections ?? [];
  const valid = (id: string) => options.some((item) => item.id === id);
  const changes = (data?.rows ?? []).flatMap((row) => {
    const id = mode === "common" ? common : selected(row);
    return id && valid(id) && id !== current(row) ? [{ rowId: row.id, value: `id:${id}` }] : [];
  });
  const missing = data?.rows.filter((row) => !valid(current(row))).length ?? 0;
  const disabled = busy || !canEdit || !data;
  const renderOptions = () => options.map((item) => (
    <option key={item.id} value={item.id}>{item.name}{item.acronym ? ` (${item.acronym})` : ""}</option>
  ));

  return (
    <Card as="section" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-tinta">Colecciones de las piezas</h2>
      {error && <><p role="alert" className="text-carmin-texto">{error}</p><Button variant="secondary" onClick={() => setRetry((n) => n + 1)}>Reintentar</Button></>}
      {!data && !error && <p>Obteniendo piezas y colecciones…</p>}
      {data && <>
        <p className="text-sm text-gris-texto">{missing ? `Falta asignar colección a ${missing} de ${data.rows.length} piezas.` : "Todas las piezas tienen una colección asignada."}</p>
        <p className="font-medium">¿Todas las piezas pertenecen a una misma colección?</p>
        <div className="flex flex-wrap gap-2">
          <Button variant={mode === "common" ? "primary" : "secondary"} disabled={disabled} onClick={() => setMode("common")}>Sí</Button>
          <Button variant={mode === "individual" ? "primary" : "secondary"} disabled={disabled} onClick={() => setMode("individual")}>No / editar por pieza</Button>
        </div>
        {mode === "common" && <>
          <Select label="Colección para todas las piezas" value={common} disabled={disabled} onChange={(event) => setCommon(event.target.value)}>
            <option value="">Seleccione una colección</option>{renderOptions()}
          </Select>
          <p className="text-sm text-gris-texto">Se reemplazarán las colecciones asignadas anteriormente en este lote.</p>
        </>}
        {mode === "individual" && <div className="grid gap-3 sm:grid-cols-2">
          {data.rows.map((row) => <Select key={row.id} label={`Fila ${row.source_row_number} · ${String(row.raw_data["Código de inventario"] ?? "")} · ${String(row.raw_data["Denominación sugerida"] ?? "")}`} value={selected(row)} disabled={disabled} onChange={(event) => setIndividual((prev) => ({ ...prev, [row.id]: event.target.value }))}>
            <option value="" disabled>Seleccione una colección</option>{renderOptions()}
          </Select>)}
        </div>}
        {mode && <>
          {notice && <p className="text-sm text-ambar-texto">{notice}</p>}
          <Button className="self-start" disabled={disabled || changes.length === 0} onClick={() => void onSave(changes)}>{busy ? "Guardando…" : `Guardar colecciones (${changes.length}) y validar`}</Button>
        </>}
      </>}
    </Card>
  );
}
