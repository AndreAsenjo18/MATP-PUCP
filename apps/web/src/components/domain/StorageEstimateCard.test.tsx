import { describe, expect, it } from "vitest";

import type { StorageEstimate } from "@/lib/data/storage-estimate";
import { render, visibleText } from "@/test/render";

import { paramsFromDraft, StorageEstimateView } from "./StorageEstimateCard";

// Datos sintéticos (RNF-014).

function estimate(overrides: Partial<StorageEstimate> = {}): StorageEstimate {
  return {
    current_volume_bytes: 1_250_000_000,
    current_originals_bytes: 1_000_000_000,
    current_derivatives_bytes: 250_000_000,
    avg_photos_per_piece: 2.5,
    avg_mb_per_photo: 4.2,
    keeps_originals: true,
    by_file_type: { original_bytes: 1_000_000_000, display_bytes: 230_000_000, thumb_bytes: 20_000_000 },
    expected_collection: {
      photos: 25000,
      mb_per_photo: 4.2,
      original_bytes: 110_000_000_000,
      display_bytes: 7_680_000_000,
      thumb_bytes: 512_000_000,
      total_bytes: 118_192_000_000,
    },
    projection: null,
    quota_bytes: null,
    exceeds_quota: null,
    ...overrides,
  };
}

describe("tarjeta de volumen fotográfico", () => {
  it("muestra el parámetro, el volumen por tipo de archivo y la proyección de las fotos esperadas", () => {
    const text = visibleText(render(<StorageEstimateView estimate={estimate()} />));

    expect(text).toContain("Se conservan los originales");
    expect(text).toContain("Originales 1.0 GB");
    expect(text).toContain("Versiones de visualización 230 MB");
    expect(text).toContain("Miniaturas 20.0 MB");
    expect(text).toContain("Total 1.3 GB");
    expect(text).toContain("2.5 fotos por pieza");
    expect(text).toContain("Para las 25,000 fotos que espera el museo");
    expect(text).toContain("118 GB");
    expect(text).not.toContain("cuota");
  });

  it("avisa cuando no se conservan los originales y cuando se supera la cuota", () => {
    const html = render(
      <StorageEstimateView estimate={estimate({ keeps_originals: false, quota_bytes: 1_000_000_000, exceeds_quota: true })} />,
    );
    const text = visibleText(html);

    expect(text).toContain("no conservan su original");
    expect(text).toContain("El volumen actual supera la cuota de 1.0 GB.");
    expect(html).toContain('role="alert"');
  });

  it("muestra la proyección a medida cuando se pidió", () => {
    const projection = {
      pieces: 20000,
      photos_per_piece: 5,
      mb_per_photo: 4,
      projected_originals_bytes: 419_430_400_000,
      projected_derivatives_bytes: 32_768_000_000,
      projected_total_bytes: 452_198_400_000,
    };
    const text = visibleText(render(<StorageEstimateView estimate={estimate({ projection })} />));

    expect(text).toContain("Proyección: 20,000 piezas × 5 fotos × 4 MB =");
    expect(text).toContain("452 GB");
    expect(text).toContain("originales 419 GB");
  });

  it("solo proyecta enteros no negativos y deja vacíos los campos sin escribir", () => {
    expect(paramsFromDraft({ pieces: "20000", photos_per_piece: "", mb_per_photo: " 4 " })).toEqual({ pieces: 20000, mb_per_photo: 4 });
    expect(paramsFromDraft({ pieces: "-1", photos_per_piece: "", mb_per_photo: "" })).toBe(
      "Piezas: escriba un número entero mayor o igual a cero.",
    );
    expect(paramsFromDraft({ pieces: "", photos_per_piece: "2.5", mb_per_photo: "" })).toContain("Fotos por pieza");
  });
});
