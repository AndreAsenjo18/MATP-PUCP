import { describe, expect, it } from "vitest";
import type { PhotoProgress } from "@/lib/data/importPhotos";
import { render, visibleText } from "@/test/render";
import { ignoredSentence, ImportPhotosPanel, ImportPhotosView, summarySentence } from "./ImportPhotosPanel";

const noop = () => {};

function item(relativePath: string, overrides: Partial<PhotoProgress> = {}): PhotoProgress {
  return { relativePath, size: 1000, status: "pending", loaded: 0, ...overrides };
}

const MIDWAY: PhotoProgress[] = [
  item("MMZ 045/DSC_0001.jpg", { status: "uploaded", loaded: 1000 }),
  item("MMZ 045/DSC_0002.jpg", { status: "registered", loaded: 1000 }),
  item("MMZ 045/DSC_0003.jpg", { status: "uploading", loaded: 450 }),
  item("I-1234.jpg", { status: "failed", reason: "Sin conexión con el almacenamiento." }),
  item("acta.jpg", { status: "rejected", reason: "Tipo «image/gif» no admitido." }),
];

describe("panel de fotografías del lote (Req: Fotografías del lote con subida reanudable)", () => {
  it("ofrece arrastrar o elegir la carpeta antes de empezar", () => {
    const html = render(<ImportPhotosView progress={[]} ignored={null} running={false} message={null} error={null} onPick={noop} onResume={noop} />);
    const text = visibleText(html);

    expect(text).toContain("Arrastre aquí la carpeta de fotografías");
    expect(text).toContain("o haga clic para elegirla en su equipo");
    expect(html).toContain('type="file"');
    expect(html).not.toContain('role="progressbar"');
  });

  it("muestra el avance global y el de cada foto, lo que falló primero", () => {
    const html = render(<ImportPhotosView progress={MIDWAY} ignored={null} running={true} message={null} error={null} onPick={noop} onResume={noop} />);
    const text = visibleText(html);

    expect(text).toContain("3 de 5 fotos listas (69 %)");
    expect(html).toContain('aria-valuenow="69"');
    expect(text).toContain("Subiendo 45 %");
    expect(text).toContain("Ya estaba en el lote");
    expect(text).toContain("Rechazada: Tipo «image/gif» no admitido.");
    expect(text.indexOf("Falló: Sin conexión")).toBeLessThan(text.indexOf("DSC_0001.jpg"));
    expect(text).not.toContain("Reanudar"); // not while it is running
  });

  it("ofrece reanudar cuando la subida se detuvo con fotos pendientes", () => {
    const stopped = MIDWAY.map((photo) => (photo.status === "uploading" ? { ...photo, status: "failed" as const, reason: "corte" } : photo));
    const html = render(
      <ImportPhotosView progress={stopped} ignored={null} running={false} message={null} error="El lote está en «Aprobado» y no admite fotos." onPick={noop} onResume={noop} />,
    );

    expect(visibleText(html)).toContain("Reanudar");
    expect(html).toContain('role="alert"');

    const done = MIDWAY.filter((photo) => ["uploaded", "registered", "rejected"].includes(photo.status));
    expect(visibleText(render(<ImportPhotosView progress={done} ignored={null} running={false} message={null} error={null} onResume={noop} />))).not.toContain("Reanudar");
  });

  it("dice cuántos archivos se ignoraron y por qué", () => {
    const html = render(
      <ImportPhotosView progress={[]} ignored={{ hidden: 1, system: 2, unsupported: 3 }} running={false} message={null} error={null} onPick={noop} />,
    );

    expect(visibleText(html)).toContain(
      "Se ignoraron 6 archivos: 1 oculto, 2 del sistema (Thumbs.db, .DS_Store) y 3 con extensión no admitida. Solo se suben JPEG, PNG y TIFF.",
    );
    expect(ignoredSentence({ hidden: 0, system: 0, unsupported: 0 })).toBeNull();
    expect(ignoredSentence({ hidden: 0, system: 0, unsupported: 1 })).toBe("Se ignoró 1 archivo: 1 con extensión no admitida. Solo se suben JPEG, PNG y TIFF.");
  });

  it("resume el resultado sin decir que las fotos ya están en el catálogo", () => {
    const sentence = summarySentence({ uploaded: 3, registered: 1, rejected: 1, failed: 2 });

    expect(sentence).toBe(
      "3 fotos subidas · 1 ya estaba en el lote · 1 rechazada · 2 pendientes de reanudar. El servidor verifica cada foto y la propone a su fila en unos segundos; nada llega al catálogo hasta aprobar el lote.",
    );
  });

  it("solo aparece con el lote mapeado o en previsualización", () => {
    expect(render(<ImportPhotosPanel batch={{ id: "lote-1", status: "MAPPED" }} />)).toContain("Fotografías del lote");
    expect(render(<ImportPhotosPanel batch={{ id: "lote-1", status: "IN_PREVIEW" }} />)).toContain("Fotografías del lote");
    expect(render(<ImportPhotosPanel batch={{ id: "lote-1", status: "UPLOADED" }} />)).toBe("");
    expect(render(<ImportPhotosPanel batch={{ id: "lote-1", status: "APPROVED" }} />)).toBe("");
  });
});
