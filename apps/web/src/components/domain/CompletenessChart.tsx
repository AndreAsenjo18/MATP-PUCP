/**
 * Gráfico simple de evolución de un indicador de completitud (spec calidad-datos — Serie
 * histórica de completitud; design D5, tarea 3.2). Una línea con el porcentaje de completitud
 * por día. Sin librería de gráficos (el proyecto no usa ninguna): SVG a mano. Cuando ningún día
 * del rango tiene piezas a las que la alerta aplique, se muestra "no aplica" en vez de un
 * gráfico vacío o una división por cero (mismo criterio que el KPI, design D3).
 */
import type { SnapshotPoint } from "@/lib/data/quality";

const WIDTH = 480;
const HEIGHT = 120;
const PADDING = 24;

export function CompletenessChart({ points, alert }: { points: SnapshotPoint[]; alert: string }) {
  const series = points.filter((p) => p.alert === alert).sort((a, b) => a.taken_on.localeCompare(b.taken_on));
  if (series.length === 0) {
    return <p className="text-base text-gris-texto">Sin instantáneas en el rango elegido.</p>;
  }
  const applicable = series.filter((p) => p.completeness_ratio !== null && p.completeness_ratio !== undefined);
  if (applicable.length === 0) {
    return <p className="text-base text-gris-texto">No aplica: ninguna pieza del rango cumple la condición de esta alerta.</p>;
  }
  const n = series.length;
  const x = (index: number) => PADDING + (index * (WIDTH - 2 * PADDING)) / Math.max(1, n - 1);
  const y = (ratio: number) => HEIGHT - PADDING - ratio * (HEIGHT - 2 * PADDING);
  const coordinates = applicable.map((point) => ({ point, x: x(series.indexOf(point)), y: y(point.completeness_ratio as number) }));
  const polyline = coordinates.map(({ x: px, y: py }) => `${px},${py}`).join(" ");

  return (
    <figure className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Evolución del porcentaje de completitud de ${alert}`} className="w-full text-terracota">
        <polyline points={polyline} fill="none" stroke="currentColor" strokeWidth={2} />
        {coordinates.map(({ point, x: px, y: py }) => (
          <circle key={point.taken_on} cx={px} cy={py} r={3} className="fill-terracota" />
        ))}
      </svg>
      <figcaption className="flex justify-between text-sm text-gris-texto">
        <span>
          {series[0].taken_on}: {series[0].completeness_ratio === null || series[0].completeness_ratio === undefined ? "no aplica" : `${Math.round(series[0].completeness_ratio * 100)} %`}
        </span>
        <span>
          {series[n - 1].taken_on}:{" "}
          {series[n - 1].completeness_ratio === null || series[n - 1].completeness_ratio === undefined ? "no aplica" : `${Math.round((series[n - 1].completeness_ratio as number) * 100)} %`}
        </span>
      </figcaption>
    </figure>
  );
}
