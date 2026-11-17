import { describe, expect, it } from "vitest";

import { sessionForMode, type Session } from "./session";

// La pantalla de acceso no debe quedar con el menú de una sesión que no existe (revisión del
// equipo, 2026-11-17): en modo `live`, un perfil guardado por la demostración no cuenta.
describe("sesión guardada según el modo", () => {
  const demo: Session = { userId: "u-1", roleCode: "ADMIN" };
  const real: Session = {
    userId: "u-2",
    roleCode: "ADMIN",
    live: { email: "admin@matp.local", fullName: "Administrador (sintético)", roles: ["ADMIN"], permissions: ["pieces.read"], mustChangePassword: false },
  };

  it("en modo live, el perfil de la demostración es sesión ausente; el real se conserva", () => {
    expect(sessionForMode(demo, "live")).toBeNull();
    expect(sessionForMode(real, "live")).toBe(real);
  });

  it("en la demostración todo perfil guardado vale, como antes", () => {
    expect(sessionForMode(demo, "mock")).toBe(demo);
    expect(sessionForMode(real, "mock")).toBe(real);
    expect(sessionForMode(null, "mock")).toBeNull();
  });
});
