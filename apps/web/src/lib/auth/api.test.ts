import { afterEach, describe, expect, it, vi } from "vitest";

import { changePassword, signIn, signOut } from "./api";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const PROFILE = {
  id: "01920000-0000-7000-8000-000000000501",
  email: "catalogador@matp.local",
  full_name: "Catalogador (sintético)",
  roles: ["CATALOGUER"],
  permissions: ["pieces.read"],
  auth_mode: "session",
  must_change_password: false,
  csrf_token: "abc123",
  session_expires_at: "2026-10-22T20:00:00Z",
};

function mockFetch(handler: (request: Request) => Response) {
  const seen: Request[] = [];
  const fetchMock = vi.fn(async (input: Request) => {
    seen.push(input);
    return handler(input);
  });
  vi.stubGlobal("fetch", fetchMock);
  return seen;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("signIn", () => {
  it("posts the credentials with cookies enabled and returns the profile", async () => {
    const seen = mockFetch(() => jsonResponse(200, PROFILE));

    const result = await signIn("catalogador@matp.local", "una frase larga y propia");

    expect(result).toEqual({ status: "ok", profile: PROFILE });
    expect(seen[0].url).toContain("/api/v1/auth/login");
    expect(seen[0].method).toBe("POST");
    expect(seen[0].credentials).toBe("include");
    expect(await seen[0].json()).toEqual({
      username: "catalogador@matp.local",
      password: "una frase larga y propia",
    });
  });

  it("maps the generic failure, the limiter and a network error to Spanish messages", async () => {
    mockFetch(() =>
      jsonResponse(401, { code: "invalid_credentials", message: "Correo o contraseña incorrectos.", details: {} }),
    );
    expect(await signIn("a@b.c", "x")).toEqual({
      status: "invalid_credentials",
      message: "Correo o contraseña incorrectos.",
    });

    mockFetch(() => jsonResponse(429, { code: "too_many_attempts", message: "Demasiados intentos.", details: {} }));
    expect((await signIn("a@b.c", "x")).status).toBe("too_many_attempts");

    vi.stubGlobal("fetch", async () => {
      throw new TypeError("network down");
    });
    expect(await signIn("a@b.c", "x")).toEqual({
      status: "error",
      message: "No se pudo conectar con el servidor. Intente nuevamente.",
    });
  });
});

describe("changePassword", () => {
  it("reports a weak password with the policy message", async () => {
    mockFetch(() =>
      jsonResponse(422, {
        code: "weak_password",
        message: "La contraseña debe tener al menos 12 caracteres. La contraseña es demasiado común.",
        details: {},
      }),
    );
    const result = await changePassword("actual", "museo2026");
    expect(result.status).toBe("weak_password");
    expect(result).toMatchObject({ message: expect.stringContaining("al menos 12") });
  });
});

describe("signOut", () => {
  it("posts to logout and never throws when offline", async () => {
    const seen = mockFetch(() => new Response(null, { status: 204 }));
    await signOut();
    expect(seen[0].url).toContain("/api/v1/auth/logout");
    expect(seen[0].method).toBe("POST");

    vi.stubGlobal("fetch", async () => {
      throw new TypeError("offline");
    });
    await expect(signOut()).resolves.toBeUndefined();
  });
});
