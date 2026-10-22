import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createUser,
  describeUsersFailure,
  fetchUsers,
  permissionDiff,
  saveRolePermissions,
  togglePermission,
  updateUser,
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
