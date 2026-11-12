import { describe, expect, it } from "vitest";

import { manyWithOneViewWarning, sameViewWarning, viewCounts, type PieceMedia } from "@/lib/data/media";
import { render, visibleText } from "@/test/render";

import { ViewSummary } from "./PieceGallery";
import { PiecePhotoUploadView } from "./PiecePhotoUpload";

// Change `aviso-fotos-repetidas` (C6, observación J6 de la JP). Datos sintéticos (RNF-014).
const FRONTAL = { id: "v-frontal", code: "FRONTAL", label: "Frontal" };
const PERFIL = { id: "v-perfil", code: "PERFIL", label: "Perfil" };
const VIEW_TYPES = [FRONTAL, PERFIL].map(({ id, label }) => ({ id, label }));
const asset = (view: typeof FRONTAL | null) => ({ view_type: view }) as Pick<PieceMedia, "view_type">;

const MEDIA = [asset(FRONTAL), asset(PERFIL), asset(FRONTAL), asset(null)];

describe("vistas repetidas: funciones puras", () => {
  it("cuenta las fotos por vista en el orden de la galería; sin vista no cuenta como repetida", () => {
    expect(viewCounts(MEDIA)).toEqual([
      { label: "Frontal", count: 2, unspecified: false },
      { label: "Perfil", count: 1, unspecified: false },
      { label: "Vista sin especificar", count: 1, unspecified: true },
    ]);
  });

  it("avisa si la vista elegida ya tiene fotos, con singular y plural, y calla si no", () => {
    expect(sameViewWarning(MEDIA, FRONTAL.id, VIEW_TYPES)).toBe("La pieza ya tiene 2 fotos de vista Frontal. Súbala solo si es otra toma.");
    expect(sameViewWarning(MEDIA, PERFIL.id, VIEW_TYPES)).toBe("La pieza ya tiene 1 foto de vista Perfil. Súbala solo si es otra toma.");
    expect(sameViewWarning(MEDIA, "", VIEW_TYPES)).toBeNull();
    expect(sameViewWarning([asset(PERFIL)], FRONTAL.id, VIEW_TYPES)).toBeNull();
  });

  it("avisa al subir varias fotos con una sola vista", () => {
    expect(manyWithOneViewWarning(3, FRONTAL.id, VIEW_TYPES)).toBe(
      "Las 3 fotos quedarán como Frontal. Si alguna es de otro ángulo, cambie su tipo de vista en la galería.",
    );
    expect(manyWithOneViewWarning(1, FRONTAL.id, VIEW_TYPES)).toBeNull();
    expect(manyWithOneViewWarning(3, "", VIEW_TYPES)).toBeNull();
  });
});

describe("avisos en la subida desde la ficha", () => {
  const base = { viewTypes: VIEW_TYPES, existing: MEDIA, ignored: null, running: false, message: null, error: null } as const;

  it("con una vista repetida avisa con icono y texto, sin desactivar la subida", () => {
    const html = render(<PiecePhotoUploadView {...base} viewTypeId={FRONTAL.id} progress={[]} />);
    expect(visibleText(html)).toContain("La pieza ya tiene 2 fotos de vista Frontal.");
    expect(html).toContain('role="status"');
    expect(html).not.toMatch(/<input[^>]*type="file"[^>]*disabled/);
  });

  it("sin vista elegida no avisa", () => {
    expect(visibleText(render(<PiecePhotoUploadView {...base} viewTypeId="" progress={[]} />))).not.toContain("La pieza ya tiene");
  });

  it("al subir varias fotos con una vista lo recuerda", () => {
    const progress = ["a.jpg", "b.jpg"].map((relativePath) => ({ relativePath, size: 10, loaded: 10, status: "registered" as const }));
    const text = visibleText(render(<PiecePhotoUploadView {...base} existing={[]} viewTypeId={PERFIL.id} progress={progress} />));
    expect(text).toContain("Las 2 fotos quedarán como Perfil.");
  });
});

describe("resumen de vistas en la galería", () => {
  it("lista las vistas y marca la repetida con icono y texto", () => {
    const html = render(<ViewSummary media={MEDIA} />);
    const text = visibleText(html);
    expect(text).toContain("Vistas:");
    expect(text).toContain("Frontal (2, repetida)");
    expect(text).toContain("Perfil");
    expect(text).toContain("Vista sin especificar");
    expect(text).not.toContain("Vista sin especificar (");
    expect(html).toContain("text-ambar-texto");
  });
});
