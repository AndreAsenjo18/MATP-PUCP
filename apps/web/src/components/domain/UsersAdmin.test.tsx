import { describe, expect, it } from "vitest";

import { render, visibleText } from "@/test/render";

import { RoleChoice, TemporaryPasswordNotice } from "./UsersAdmin";

describe("TemporaryPasswordNotice", () => {
  it("shows the password with the warning that it appears only once", () => {
    const text = visibleText(render(<TemporaryPasswordNotice email="nueva@matp.local" password="Xk3-temporal-9f" />));
    expect(text).toContain("Xk3-temporal-9f");
    expect(text).toContain("nueva@matp.local");
    expect(text).toContain("se muestra una sola vez");
  });
});

describe("RoleChoice", () => {
  it("warns that the disabled researcher role cannot be assigned", () => {
    const roles = [
      { code: "CATALOGUER", name: "Catalogador", description: null, is_enabled: true, permissions: [] },
      { code: "EXTERNAL_RESEARCHER", name: "Consulta externa", description: null, is_enabled: false, permissions: [] },
    ];
    const html = render(<RoleChoice roles={roles} value="CATALOGUER" onChange={() => {}} />);
    expect(visibleText(html)).toContain("Consulta externa — desactivado en fase 1");
    expect(String(html)).toMatch(/<option[^>]*disabled[^>]*>Consulta externa/);
  });
});
