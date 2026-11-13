/**
 * Reporte de piezas con información incompleta (spec calidad-datos; RF-019, RF-035; change
 * `alertas-y-reporte-incompletas`, tarea 3.3). Filtra por alerta (varias = AND, igual que la API)
 * y por colección (con subcolecciones), pagina y descarga en Excel/CSV — solo en modo `live`, la
 * maqueta no genera archivos reales.
 */
import { Download, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { buttonClassName } from "@/components/ui/Button";
import { TABLE_CLASS, TD_CLASS, TH_CLASS, THEAD_CLASS } from "@/components/ui/Table";
import { TableScroller } from "@/components/ui/TableScroller";
import type { ApiSchemas } from "@/lib/api/client";
import { fetchDuplicateCollections } from "@/lib/data/duplicates";
import type { IncompleteUrlState } from "@/lib/data/reports";
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

export function IncompleteReportPanel({
  devUser,
  canDownload,
  initialState,
  onStateChange,
}: {
  devUser?: string;
  canDownload: boolean;
  /** Filtros guardados en la dirección (Reportes); la bandeja de pendientes no los usa. */
  initialState?: IncompleteUrlState;
  /** Avisa cada cambio de filtros para guardarlo en la dirección. */
  onStateChange?: (state: IncompleteUrlState) => void;
}) {
  const [collections, setCollections] = useState<CollectionOut[]>([]);
  const [alertFilter, setAlertFilter] = useState<AlertType[]>(() => (initialState?.alerts ?? []).filter((a): a is AlertType => ALERT_CODES.includes(a as AlertType)));
  const [collectionId, setCollectionId] = useState(initialState?.collectionId ?? "");
  const [includeSubcollections, setIncludeSubcollections] = useState(initialState?.includeSubcollections ?? true);
  // Cada cambio de filtros va a la dirección; el estado inicial ya está ahí.
  const reported = useRef(JSON.stringify({ alertFilter, collectionId, includeSubcollections }));
  useEffect(() => {
    const key = JSON.stringify({ alertFilter, collectionId, includeSubcollections });
    if (reported.current === key) return;
    reported.current = key;
    onStateChange?.({ alerts: alertFilter, collectionId, includeSubcollections });
  }, [alertFilter, collectionId, includeSubcollections, onStateChange]);
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
    // Las etiquetas de alerta (`Badge` de components/ui, de la Base) a 16 px solo aquí (reportes-vista-simplificada, D6).
    <div className="flex min-w-0 flex-col gap-4 [&_span.rounded-full]:text-base">
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="text-base font-medium text-gris-texto">Filtrar por alerta (se combinan con «y»)</legend>
        <div className="flex flex-wrap gap-2">
          {ALERT_CODES.map((code) => (
            <label key={code} className="flex min-h-11 max-w-full items-center gap-2 rounded-full bg-crema px-3 py-1 text-base text-tinta">
              <input
                type="checkbox"
                className="size-5 shrink-0 accent-terracota"
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

      <div className="flex min-w-0 flex-wrap items-end gap-3">
        <label className="flex min-w-0 max-w-full flex-col gap-1 text-base font-medium text-gris-texto">
          Colección
          <select
            value={collectionId}
            onChange={(event) => {
              setPage(1);
              setCollectionId(event.target.value);
            }}
            className="min-h-11 max-w-full rounded-md border border-borde bg-white px-3 py-2 text-base text-tinta"
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
          <label className="flex min-h-11 items-center gap-2 text-base text-tinta">
            <input type="checkbox" className="size-5 shrink-0 accent-terracota" checked={includeSubcollections} onChange={(event) => setIncludeSubcollections(event.target.checked)} />
            Incluir subcolecciones
          </label>
        )}
        {canDownload && (
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => handleDownload("xlsx")} className={buttonClassName({ variant: "neutral", size: "sm" })}>
              <FileSpreadsheet size={16} aria-hidden="true" />
              Excel
            </button>
            <button type="button" onClick={() => handleDownload("csv")} className={buttonClassName({ variant: "neutral", size: "sm" })}>
              <Download size={16} aria-hidden="true" />
              CSV
            </button>
          </div>
        )}
      </div>
      {downloadMessage && <p className="text-base text-gris-texto">{downloadMessage}</p>}

      {!result && (
        <p role="status" className="text-base text-gris-texto">
          Cargando…
        </p>
      )}
      {result?.status === "unavailable" && <p className="text-base text-gris-texto">{result.message}</p>}
      {result?.status === "ok" && (
        <>
          <TableScroller label="Tabla de piezas incompletas">
            <table className={TABLE_CLASS}>
              <thead className={THEAD_CLASS}>
                <tr>
                  <th className={TH_CLASS}>Pieza</th>
                  <th className={TH_CLASS}>Colección</th>
                  <th className={TH_CLASS}>Alertas</th>
                </tr>
              </thead>
              <tbody>
                {result.page.items.map((item) => (
                  <tr key={item.piece_id}>
                    <td className={TD_CLASS}>
                      <Link href={`/piezas/${item.piece_id}`} className="inline-flex min-h-11 items-center font-medium text-tinta underline hover:text-terracota">
                        {item.title}
                      </Link>
                    </td>
                    <td className={`${TD_CLASS} text-gris-texto`}>{item.collection_name ?? "Sin colección"}</td>
                    <td className={TD_CLASS}>
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
                    <td colSpan={3} className={`${TD_CLASS} text-center text-gris-texto`}>
                      Sin piezas incompletas con estos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableScroller>
          <div className="flex items-center justify-between text-base text-gris-texto">
            <span>
              {result.page.total} pieza{result.page.total === 1 ? "" : "s"} · página {result.page.page}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className={buttonClassName({ variant: "neutral", size: "sm" })}
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page * INCOMPLETE_PAGE_SIZE >= result.page.total}
                onClick={() => setPage((p) => p + 1)}
                className={buttonClassName({ variant: "neutral", size: "sm" })}
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
