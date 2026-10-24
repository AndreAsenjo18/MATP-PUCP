/**
 * Reporte de piezas con información incompleta (spec calidad-datos; RF-019, RF-035; change
 * `alertas-y-reporte-incompletas`, tarea 3.3). Filtra por alerta (varias = AND, igual que la API)
 * y por colección (con subcolecciones), pagina y descarga en Excel/CSV — solo en modo `live`, la
 * maqueta no genera archivos reales.
 */
import { Download, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { ApiSchemas } from "@/lib/api/client";
import { fetchDuplicateCollections } from "@/lib/data/duplicates";
import {
  downloadIncompleteReport,
  fetchIncompleteReport,
  INCOMPLETE_PAGE_SIZE,
  type AlertType,
  type IncompletePage,
} from "@/lib/data/quality";

import { AlertBadge } from "./StatusBadges";
import { alertStatus } from "./status-intents";

type CollectionOut = ApiSchemas["CollectionOut"];

const ALERT_CODES: AlertType[] = [
  "MISSING_INVENTORY_CODE",
  "MISSING_PHOTO",
  "MISSING_LOCATION",
  "MISSING_REQUIRED_FIELDS",
  "MISSING_RECOMMENDED_FIELDS",
  "UNNORMALIZABLE_IDENTIFIER",
];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function IncompleteReportPanel({ devUser, canDownload }: { devUser?: string; canDownload: boolean }) {
  const [collections, setCollections] = useState<CollectionOut[]>([]);
  const [alertFilter, setAlertFilter] = useState<AlertType[]>([]);
  const [collectionId, setCollectionId] = useState("");
  const [includeSubcollections, setIncludeSubcollections] = useState(true);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ status: "ok"; page: IncompletePage } | { status: "unavailable"; message: string } | null>(null);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchDuplicateCollections(devUser).then(setCollections);
  }, [devUser]);

  useEffect(() => {
    let active = true;
    fetchIncompleteReport(
      { alert: alertFilter, collectionId: collectionId || undefined, includeSubcollections, page, pageSize: INCOMPLETE_PAGE_SIZE },
      devUser,
    ).then((r) => {
      if (active) setResult(r);
    });
    return () => {
      active = false;
    };
  }, [alertFilter, collectionId, includeSubcollections, page, devUser]);

  async function handleDownload(format: "xlsx" | "csv") {
    setDownloadMessage(null);
    const outcome = await downloadIncompleteReport(
      { alert: alertFilter, collectionId: collectionId || undefined, includeSubcollections },
      format,
      devUser,
    );
    if (outcome.status !== "ok") return setDownloadMessage(outcome.message);
    const url = URL.createObjectURL(outcome.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `piezas-incompletas.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-gris-texto">Filtrar por alerta (se combinan con «y»)</legend>
        <div className="flex flex-wrap gap-2">
          {ALERT_CODES.map((code) => (
            <label key={code} className="flex min-h-11 items-center gap-2 rounded-full bg-crema px-3 py-1 text-sm text-tinta">
              <input
                type="checkbox"
                checked={alertFilter.includes(code)}
                onChange={() => {
                  setPage(1);
                  setAlertFilter((current) => toggle(current, code));
                }}
              />
              {alertStatus(code).label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-gris-texto">
          Colección
          <select
            value={collectionId}
            onChange={(event) => {
              setPage(1);
              setCollectionId(event.target.value);
            }}
            className="min-h-11 rounded-md border border-borde bg-white px-3 py-2 text-base text-tinta"
          >
            <option value="">Todas</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {collectionId && (
          <label className="flex min-h-11 items-center gap-2 text-sm text-tinta">
            <input type="checkbox" checked={includeSubcollections} onChange={(event) => setIncludeSubcollections(event.target.checked)} />
            Incluir subcolecciones
          </label>
        )}
        {canDownload && (
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => handleDownload("xlsx")} className="inline-flex min-h-11 items-center gap-1 rounded-md border border-borde px-3 py-2 text-sm font-medium text-tinta hover:bg-crema">
              <FileSpreadsheet size={16} aria-hidden="true" />
              Excel
            </button>
            <button type="button" onClick={() => handleDownload("csv")} className="inline-flex min-h-11 items-center gap-1 rounded-md border border-borde px-3 py-2 text-sm font-medium text-tinta hover:bg-crema">
              <Download size={16} aria-hidden="true" />
              CSV
            </button>
          </div>
        )}
      </div>
      {downloadMessage && <p className="text-sm text-gris-texto">{downloadMessage}</p>}

      {!result && (
        <p role="status" className="text-base text-gris-texto">
          Cargando…
        </p>
      )}
      {result?.status === "unavailable" && <p className="text-base text-gris-texto">{result.message}</p>}
      {result?.status === "ok" && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-base">
              <thead className="text-sm text-gris-texto">
                <tr>
                  <th className="py-2 pr-4 font-medium">Pieza</th>
                  <th className="py-2 pr-4 font-medium">Colección</th>
                  <th className="py-2 pr-4 font-medium">Alertas</th>
                </tr>
              </thead>
              <tbody>
                {result.page.items.map((item) => (
                  <tr key={item.piece_id} className="border-t border-borde">
                    <td className="py-2 pr-4">
                      <Link href={`/piezas/${item.piece_id}`} className="font-medium text-tinta underline hover:text-terracota">
                        {item.title}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-gris-texto">{item.collection_name ?? "Sin colección"}</td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {item.alerts.map((type) => (
                          <AlertBadge key={type} alert={{ type, applies: true, message: "", suggested_action: "" }} />
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {result.page.items.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-gris-texto">
                      Sin piezas incompletas con estos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm text-gris-texto">
            <span>
              {result.page.total} pieza{result.page.total === 1 ? "" : "s"} · página {result.page.page}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="min-h-11 rounded-md border border-borde px-3 py-1 text-sm font-medium text-tinta disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page * INCOMPLETE_PAGE_SIZE >= result.page.total}
                onClick={() => setPage((p) => p + 1)}
                className="min-h-11 rounded-md border border-borde px-3 py-1 text-sm font-medium text-tinta disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
