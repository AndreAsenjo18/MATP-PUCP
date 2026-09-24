import { describe, expect, it } from "vitest";

import { render, visibleText } from "./render";

describe("render", () => {
  it("devuelve el HTML estático de un elemento y su texto visible", () => {
    const html = render(
      <p className="text-tinta">
        Hola <strong>museo</strong>
      </p>,
    );
    expect(html).toBe('<p class="text-tinta">Hola <strong>museo</strong></p>');
    expect(visibleText(html)).toBe("Hola museo");
  });
});
