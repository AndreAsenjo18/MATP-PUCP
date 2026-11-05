import { describe, expect, it } from "vitest";

import { identifierTypeLabel } from "./status-intents";

describe("identifierTypeLabel", () => {
  it("muestra en español los tipos en inglés", () => {
    expect(identifierTypeLabel("COLLECTION")).toBe("Colección");
    expect(identifierTypeLabel("OWNER")).toBe("Propietario");
    expect(identifierTypeLabel("OTHER")).toBe("Otro");
  });

  it("deja tal cual los códigos que ya se entienden y los desconocidos", () => {
    expect(identifierTypeLabel("I")).toBe("I");
    expect(identifierTypeLabel("INC_RN")).toBe("INC_RN");
    expect(identifierTypeLabel("NUEVO_TIPO")).toBe("NUEVO_TIPO");
  });
});
