import { describe, expect, it } from "vitest";

import { render, visibleText } from "@/test/render";

import { PieceDeletedNotice } from "./PieceDeletedNotice";

const noop = () => {};

describe("PieceDeletedNotice", () => {
  it("anuncia que la pieza quedó eliminada pero conserva su historial", () => {
    const html = render(<PieceDeletedNotice pieceName="Toro de Pucará" canRestore onRestore={noop} />);
    const text = visibleText(html);

    expect(html).toContain('role="status"');
    expect(text).toContain("Pieza eliminada");
    expect(text).toContain("Toro de Pucará");
    expect(text).toContain("No se borró");
    expect(text).toContain("ya no aparece en el catálogo");
  });

  it("con permiso ofrece «Restaurar pieza» y no explica que falte permiso", () => {
    const html = render(<PieceDeletedNotice pieceName="Toro de Pucará" canRestore onRestore={noop} />);
    const text = visibleText(html);

    expect(text).toContain("Restaurar pieza");
    expect(text).not.toContain("Su rol no puede restaurarla");
  });

  it("sin permiso no muestra el botón de restaurar y dice a quién pedirlo", () => {
    const html = render(<PieceDeletedNotice pieceName="Toro de Pucará" canRestore={false} onRestore={noop} />);
    const text = visibleText(html);

    expect(text).not.toContain("Restaurar pieza");
    expect(html).not.toContain("<button");
    expect(text).toContain("Su rol no puede restaurarla");
  });

  it("siempre permite volver a la búsqueda", () => {
    const html = render(<PieceDeletedNotice pieceName="Toro de Pucará" canRestore={false} onRestore={noop} />);

    expect(html).toContain('href="/busqueda"');
    expect(visibleText(html)).toContain("Volver a búsqueda");
  });

  it("escapa el nombre de la pieza", () => {
    const html = render(<PieceDeletedNotice pieceName="<b>Toro</b>" canRestore onRestore={noop} />);

    expect(html).not.toContain("<b>Toro</b>");
    expect(html).toContain("&lt;b&gt;Toro&lt;/b&gt;");
  });
});
