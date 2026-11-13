import { describe, expect, it } from "vitest";

import { render, visibleText } from "@/test/render";

import type { PackageView, RoleOut, UserOut } from "@/lib/data/users-admin";

import { PermissionPackageCard, PermissionSaveBar, ROLE_HINTS, ROLE_REQUIRED, RoleButtons, RoleChoice, TemporaryPasswordNotice, UsersTable } from "./UsersAdmin";

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
    // Botones de opción desde `fotos-y-roles-menos-clics` (C35); antes era una lista desplegable.
    expect(String(html)).toMatch(/<input type="radio" disabled=""[^>]*value="EXTERNAL_RESEARCHER"/);
  });

  it("muestra cada rol con su línea y ninguno elegido si no se pasa valor (C35)", () => {
    const roles = [
      { code: "ADMIN", name: "Administrador", description: null, is_enabled: true, permissions: [] },
      { code: "INTERNAL_VIEWER", name: "Consulta interna", description: null, is_enabled: true, permissions: [] },
      { code: "NUEVO", name: "Rol nuevo", description: "Descripción que trae la API.", is_enabled: true, permissions: [] },
    ];
    const html = render(<RoleChoice roles={roles} value="" onChange={() => {}} />);
    const text = visibleText(html);
    expect(text).toContain(ROLE_HINTS.ADMIN);
    expect(text).toContain(ROLE_HINTS.INTERNAL_VIEWER);
    expect(text).toContain("Descripción que trae la API.");
    expect(html.match(/type="radio"/g)).toHaveLength(3);
    expect(html).not.toContain("checked");
    const withError = render(<RoleChoice roles={roles} value="" onChange={() => {}} error={ROLE_REQUIRED} />);
    expect(withError).toContain('role="alert"');
    expect(visibleText(withError)).toContain("Elija un rol.");
  });
});

const noop = () => {};
const ROLES_FOR_TABLE = [
  { code: "ADMIN", name: "Administrador", description: null, is_enabled: true, permissions: ["a", "b", "c"] },
  { code: "EXTERNAL_RESEARCHER", name: "Consulta externa", description: null, is_enabled: false, permissions: ["a"] },
] as unknown as RoleOut[];

function user(overrides: Partial<UserOut> = {}): UserOut {
  return { id: "u1", email: "ana@matp.local", full_name: "Ana García", roles: ["ADMIN"], is_active: true, must_change_password: false, ...overrides } as UserOut;
}

describe("UsersTable", () => {
  it("muestra el rol por su nombre, el estado con color y texto, y las acciones como iconos con su nombre", () => {
    const html = render(<UsersTable users={[user({ must_change_password: true })]} roles={ROLES_FOR_TABLE} onToggleActive={noop} onResetPassword={noop} />);
    const text = visibleText(html);
    expect(text).toContain("Ana García");
    expect(text).toContain("Administrador");
    expect(text).toContain("Activo");
    expect(text).toContain("Contraseña temporal");
    expect(html).toContain('aria-label="Desactivar a Ana García"');
    expect(html).toContain('aria-label="Restablecer contraseña de Ana García"');
    expect(html).toContain('title="Desactivar"');
    expect(html).toContain("min-h-11 gap-1.5 px-3.5"); // botones compactos, de 44 px
    expect(text).not.toMatch(/Desactivar\s+Restablecer/); // sin texto en los botones de icono
  });

  it("un usuario desactivado ofrece reactivar y se marca como desactivado", () => {
    const html = render(<UsersTable users={[user({ is_active: false })]} roles={ROLES_FOR_TABLE} onToggleActive={noop} onResetPassword={noop} />);
    expect(visibleText(html)).toContain("Desactivado");
    expect(html).toContain('aria-label="Reactivar a Ana García"');
  });

  it("sin usuarios dice que no hay con esos filtros", () => {
    expect(visibleText(render(<UsersTable users={[]} roles={ROLES_FOR_TABLE} onToggleActive={noop} onResetPassword={noop} />))).toContain("No hay usuarios con estos filtros.");
  });
});

const PACKAGE: PackageView = {
  id: "importacion",
  label: "Importación",
  permissions: [
    { code: "imports.prepare", description: "Preparar cargas masivas" },
    { code: "imports.approve", description: "Aprobar cargas masivas" },
    { code: "imports.revert", description: "Revertir cargas masivas" },
  ] as PackageView["permissions"],
};

describe("paquetes de permisos", () => {
  it("cuenta lo marcado del paquete y dice «parte» cuando está a medias", () => {
    const html = render(<PermissionPackageCard pkg={PACKAGE} working={["imports.prepare"]} onTogglePermission={noop} onTogglePackage={noop} />);
    expect(visibleText(html)).toContain("1 de 3 · parte");
    expect(html).toContain('data-state="partial"');
    expect(html).toContain('aria-label="Marcar todo el paquete Importación"');
    expect(html).toContain('title="imports.approve"');
  });

  it("completo dice «todo» y vacío dice «nada»", () => {
    const all = visibleText(render(<PermissionPackageCard pkg={PACKAGE} working={PACKAGE.permissions.map((p) => p.code)} onTogglePermission={noop} onTogglePackage={noop} />));
    expect(all).toContain("3 de 3 · todo");
    expect(visibleText(render(<PermissionPackageCard pkg={PACKAGE} working={[]} onTogglePermission={noop} onTogglePackage={noop} />))).toContain("0 de 3 · nada");
  });

  it("el rol se elige con botones que dicen cuántos permisos tiene y si está desactivado", () => {
    const html = render(<RoleButtons roles={ROLES_FOR_TABLE} value="ADMIN" onChange={noop} />);
    const text = visibleText(html);
    expect(text).toContain("Administrador 3");
    expect(text).toContain("Consulta externa 1 desactivado");
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  });

  it("la barra de guardado resume el cambio y pide el motivo antes de guardar", () => {
    const html = render(<PermissionSaveBar diff={{ added: ["imports.approve", "imports.revert"], removed: ["pieces.delete"] }} reason="" onReason={noop} onSave={noop} />);
    const text = visibleText(html);
    expect(text).toContain("Se agregan 2");
    expect(text).toContain("Se retiran 1");
    expect(text).toContain("+ imports.approve");
    expect(text).toContain("− pieces.delete");
    expect(text).toContain("Escriba el motivo");
    expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Guardar permisos/);
    expect(html).toContain("sticky");
    const withReason = render(<PermissionSaveBar diff={{ added: ["x"], removed: [] }} reason="Nueva función de la Gestora" onReason={noop} onSave={noop} />);
    expect(withReason).not.toMatch(/<button[^>]*\sdisabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Guardar permisos/);
  });
});
