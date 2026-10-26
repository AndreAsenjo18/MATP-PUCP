/**
 * Tarjeta «Volumen fotográfico» de Reportes (change `fotografias-multiples-por-pieza`, tarea 3.3;
 * spec multimedia, «Operación de estimación del volumen fotográfico»; RNF-003).
 *
 * Muestra el volumen actual por tipo de archivo, si se conservan los originales de las fotos
 * importadas (`MEDIA_KEEP_ORIGINALS`), la proyección para las fotos que espera el museo y, si hay
 * cuota configurada, si se supera. Con piezas, fotos por pieza y MB por foto calcula una
 * proyección a medida; los campos vacíos toman los promedios reales. La pantalla solo la monta con
 * el permiso `reports.view`, el mismo que exige la API.
 */
import { Calculator } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  expectedCollection,
  fetchStorageEstimate,
  formatBytes,
  projectionOf,
  type ProjectionParams,
  type StorageEstimate,
} from "@/lib/data/storage-estimate";

const FIELDS = [
  { key: "pieces", label: "Piezas" },
  { key: "photos_per_piece", label: "Fotos por pieza" },
  { key: "mb_per_photo", label: "MB por foto" },
] as const;

type Draft = Record<(typeof FIELDS)[number]["key"], string>;

const EMPTY: Draft = { pieces: "", photos_per_piece: "", mb_per_photo: "" };

function decimal(value: number | null | undefined): string {
  return value == null ? "—" : value.toLocaleString("es-PE", { maximumFractionDigits: 1 });
}

/** Lo que se proyecta: solo los campos escritos, como enteros no negativos. */
export function paramsFromDraft(draft: Draft): ProjectionParams | string {
  const params: ProjectionParams = {};
  for (const { key, label } of FIELDS) {
    const raw = draft[key].trim();
    if (!raw) continue;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) return `${label}: escriba un número entero mayor o igual a cero.`;
    params[key] = value;
  }
  return params;
}

export function StorageEstimateView({ estimate }: { estimate: StorageEstimate }) {
  const expected = expectedCollection(estimate);
  const projection = projectionOf(estimate);
  const byType = estimate.by_file_type;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-base text-tinta">
        {estimate.keeps_originals
          ? "Se conservan los originales de las fotos importadas, además de su miniatura y su versión de visualización."
          : "Las fotos importadas no conservan su original: se guardan solo su miniatura y su versión de visualización."}
      </p>
      <table className="w-full text-left text-base">
        <caption className="sr-only">Volumen actual por tipo de archivo</caption>
        <tbody>
          <tr className="border-t border-borde">
            <th scope="row" className="py-2 pr-4 font-medium text-gris-texto">Originales</th>
            <td className="py-2 text-tinta">{formatBytes(byType.original_bytes)}</td>
          </tr>
          <tr className="border-t border-borde">
            <th scope="row" className="py-2 pr-4 font-medium text-gris-texto">Versiones de visualización</th>
            <td className="py-2 text-tinta">{formatBytes(byType.display_bytes)}</td>
          </tr>
          <tr className="border-t border-borde">
            <th scope="row" className="py-2 pr-4 font-medium text-gris-texto">Miniaturas</th>
            <td className="py-2 text-tinta">{formatBytes(byType.thumb_bytes)}</td>
          </tr>
          <tr className="border-t border-borde">
            <th scope="row" className="py-2 pr-4 font-semibold text-tinta">Total</th>
            <td className="py-2 font-semibold text-tinta">{formatBytes(estimate.current_volume_bytes)}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-sm text-gris-texto">
        Promedios reales: {decimal(estimate.avg_photos_per_piece)} fotos por pieza con fotos · {decimal(estimate.avg_mb_per_photo)} MB por foto.
      </p>
      <p className="text-base text-tinta">
        Para las {expected.photos.toLocaleString("es-PE")} fotos que espera el museo, a {decimal(expected.mb_per_photo)} MB por foto:{" "}
        <strong>{formatBytes(expected.total_bytes)}</strong>.
      </p>
      {estimate.quota_bytes != null && (
        <p
          role={estimate.exceeds_quota ? "alert" : undefined}
          className={estimate.exceeds_quota ? "rounded-md bg-carmin-bg px-3 py-2 text-sm text-carmin-texto" : "text-sm text-gris-texto"}
        >
          {estimate.exceeds_quota
            ? `El volumen actual supera la cuota de ${formatBytes(estimate.quota_bytes)}.`
            : `Cuota configurada: ${formatBytes(estimate.quota_bytes)}; el volumen actual no la supera.`}
        </p>
      )}
      {projection && (
        <p className="rounded-md bg-crema px-3 py-2 text-base text-tinta">
          Proyección: {projection.pieces.toLocaleString("es-PE")} piezas × {decimal(projection.photos_per_piece)} fotos ×{" "}
          {decimal(projection.mb_per_photo)} MB = <strong>{formatBytes(projection.projected_total_bytes)}</strong> (originales{" "}
          {formatBytes(projection.projected_originals_bytes)} y derivados {formatBytes(projection.projected_derivatives_bytes)}).
        </p>
      )}
    </div>
  );
}

export function StorageEstimateCard({ devUser }: { devUser?: string }) {
  const [params, setParams] = useState<ProjectionParams>({});
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof fetchStorageEstimate>> | null>(null);

  useEffect(() => {
    let active = true;
    fetchStorageEstimate(params, devUser).then((outcome) => {
      if (active) setResult(outcome);
    });
    return () => {
      active = false;
    };
  }, [params, devUser]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next = paramsFromDraft(draft);
    if (typeof next === "string") return setInvalid(next);
    setInvalid(null);
    setParams(next);
  }

  return (
    <Card as="section" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-tinta">Volumen fotográfico (RNF-003)</h2>
      {result === null && <p className="text-base text-gris-texto">Calculando la estimación…</p>}
      {result?.status === "error" && (
        <p role="alert" className="text-base text-carmin-texto">
          {result.message}
        </p>
      )}
      {result?.status === "ok" && <StorageEstimateView estimate={result.estimate} />}
      <form className="flex flex-wrap items-end gap-3" onSubmit={handleSubmit} aria-label="Proyección a medida">
        {FIELDS.map(({ key, label }) => (
          <Input
            key={key}
            label={label}
            inputMode="numeric"
            value={draft[key]}
            onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
            fieldClassName="w-36"
          />
        ))}
        <Button type="submit" variant="outline" icon={Calculator}>
          Proyectar
        </Button>
      </form>
      {invalid && (
        <p role="alert" className="text-sm text-carmin-texto">
          {invalid}
        </p>
      )}
    </Card>
  );
}
