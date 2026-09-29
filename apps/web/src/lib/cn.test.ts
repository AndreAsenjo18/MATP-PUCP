import { describe, expect, it } from "vitest";

import { cn } from "./cn";

describe("cn", () => {
  it("une clases y descarta valores vacíos", () => {
    expect(cn("a", false, "b", null, undefined, "", "c")).toBe("a b c");
  });

  it("devuelve cadena vacía sin clases", () => {
    expect(cn()).toBe("");
  });
});
