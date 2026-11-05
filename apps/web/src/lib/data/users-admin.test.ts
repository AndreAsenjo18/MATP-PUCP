import { afterEach, describe, expect, it, vi } from "vitest";

import { ROLES } from "@/lib/fixtures";

import {
  PERMISSION_PACKAGES,
  createUser,
  describeUsersFailure,
  fetchUsers,
  filterUsers,
  packagePermissions,
  packageState,
  permissionDiff,
  saveRolePermissions,
  togglePackage,
  togglePermission,
  updateUser,
  type PermissionOut,
  type UserOut,
} from "./users-admin";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function liveWith(handler: (request: Request) => Response) {
  vi.stubEnv("NEXT_PUBLIC_API_MODE", "live");
  const seen: Request[] = [];
  vi.stubGlobal("fetch", async (input: Request) => {
    seen.push(input);
    return handler(input);
  });
  return seen;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const USER = {
  id: "01920000-0000-7000-8000-000000000501",
  email: "nueva@matp.local",
  full_name: "Persona Nueva",
  is_active: true,
  roles: ["CATALOGUER"],
  last_login_at: null,
  locked_until: null,
  created_at: "2026-10-22T10:00:00Z",
  must_change_password: true,
  temporary_password: "Xk3-temporal-9f",
};

describe("users admin data layer", () => {
  it("is unavailable in the simulated mode", async () => {
    const result = await fetchUsers(false);
    expect(result.status).toBe("unavailable");
  });

  it("creates a user and hands back the one-time temporary password", async () => {
    const seen = liveWith(() => jsonResponse(201, USER));

    const result = await createUser({ email: "nueva@matp.local", full_name: "Persona Nueva", roles: ["CATALOGUER"] });

    expect(result).toEqual({ status: "ok", value: USER });
    expect(seen[0].method).toBe("POST");
    expect(seen[0].url).toContain("/api/v1/users");
  });

  it("explains the domain rules in Spanish", async () => {
    liveWith(() => jsonResponse(409, { code: "last_administrator", message: "texto técnico", details: {} }));
    const blocked = await updateUser(USER.id, { is_active: false });
    expect(blocked.status).toBe("rejected");
    if (blocked.status === "rejected") {
      expect(describeUsersFailure(blocked)).toContain("sin ningún administrador activo");
    }

    liveWith(() => jsonResponse(409, { code: "role_disabled", message: "x", details: {} }));
    const disabled = await createUser({ email: "a@b.c", full_name: "A", roles: ["EXTERNAL_RESEARCHER"] });
    expect(disabled.status === "rejected" && describeUsersFailure(disabled)).toContain("desactivado");
  });

  it("sends the new permission set with its reason", async () => {
    const seen = liveWith(() =>
      jsonResponse(200, { code: "CATALOGUER", name: "Catalogador", description: null, is_enabled: true, permissions: ["pieces.read"] }),
    );

    const result = await saveRolePermissions("CATALOGUER", ["pieces.read"], "Solo el gestor exporta");

    expect(result.status).toBe("ok");
    expect(seen[0].method).toBe("PUT");
    expect(seen[0].url).toContain("/api/v1/roles/CATALOGUER/permissions");
    expect(await seen[0].json()).toEqual({ permissions: ["pieces.read"], reason: "Solo el gestor exporta" });
  });
});

describe("permission editing helpers", () => {
  it("lists what a change adds and removes", () => {
    expect(permissionDiff(["a", "b"], ["b", "c"])).toEqual({ added: ["c"], removed: ["a"] });
    expect(permissionDiff(["a"], ["a"])).toEqual({ added: [], removed: [] });
  });

  it("toggles a permission without mutating the list", () => {
    const base = ["pieces.read"];
    expect(togglePermission(base, "exports.run")).toEqual(["exports.run", "pieces.read"]);
    expect(togglePermission(["a", "b"], "a")).toEqual(["b"]);
    expect(base).toEqual(["pieces.read"]);
  });
});

function permission(code: string): PermissionOut {
  return { code, description: `Permiso ${code}` } as PermissionOut;
}

describe("paquetes de permisos", () => {
  const IMPORTS = PERMISSION_PACKAGES.find((pkg) => pkg.id === "importacion")!.codes;

  it("todos los permisos de los roles del sistema pertenecen a un paquete", () => {
    const known = new Set(PERMISSION_PACKAGES.flatMap((pkg) => pkg.codes));
    const used = new Set(ROLES.flatMap((role) => role.permissions));
    expect([...used].filter((code) => !known.has(code))).toEqual([]);
  });

  it("ningún permiso está en dos paquetes", () => {
    const all = PERMISSION_PACKAGES.flatMap((pkg) => pkg.codes);
    expect(new Set(all).size).toBe(all.length);
  });

  it("reparte los permisos de la API en paquetes, omite los vacíos y manda los desconocidos a «Otros»", () => {
    const views = packagePermissions([permission("imports.approve"), permission("pieces.read"), permission("imports.prepare"), permission("algo.nuevo")]);
    expect(views.map((view) => view.label)).toEqual(["Fichas", "Importación", "Otros"]);
    expect(views[1].permissions.map((item) => item.code)).toEqual(["imports.prepare", "imports.approve"]); // orden del paquete
    expect(views[2].permissions.map((item) => item.code)).toEqual(["algo.nuevo"]);
  });

  it("sin permisos desconocidos no hay paquete «Otros»", () => {
    expect(packagePermissions([permission("pieces.read")]).map((view) => view.id)).toEqual(["fichas"]);
  });

  it("dice si el rol tiene ninguno, parte o todo el paquete", () => {
    expect(packageState([], IMPORTS)).toBe("none");
    expect(packageState(["imports.prepare"], IMPORTS)).toBe("partial");
    expect(packageState([...IMPORTS], IMPORTS)).toBe("all");
  });

  it("marcar un paquete lo completa y volver a marcarlo lo quita, sin tocar lo demás", () => {
    const marked = togglePackage(["pieces.read", "imports.prepare"], IMPORTS);
    expect(IMPORTS.every((code) => marked.includes(code))).toBe(true);
    expect(marked).toContain("pieces.read");
    const cleared = togglePackage(marked, IMPORTS);
    expect(IMPORTS.some((code) => cleared.includes(code))).toBe(false);
    expect(cleared).toEqual(["pieces.read"]);
  });
});

describe("filtro de usuarios", () => {
  const users = [
    { id: "1", email: "ana.garcia@matp.local", full_name: "Ana García", roles: ["ADMIN"], is_active: true },
    { id: "2", email: "luis@matp.local", full_name: "Luis Quispe", roles: ["CATALOGUER"], is_active: true },
  ] as unknown as UserOut[];

  it("busca por nombre o correo sin distinguir mayúsculas ni tildes", () => {
    expect(filterUsers(users, { query: "garcia", role: "" }).map((user) => user.id)).toEqual(["1"]);
    expect(filterUsers(users, { query: "LUIS@", role: "" }).map((user) => user.id)).toEqual(["2"]);
  });

  it("filtra por rol y combina ambos filtros", () => {
    expect(filterUsers(users, { query: "", role: "CATALOGUER" }).map((user) => user.id)).toEqual(["2"]);
    expect(filterUsers(users, { query: "ana", role: "CATALOGUER" })).toEqual([]);
    expect(filterUsers(users, { query: "", role: "" })).toHaveLength(2);
  });
});
