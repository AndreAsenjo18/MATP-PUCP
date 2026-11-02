import { afterEach, describe, expect, it, vi } from "vitest";

import type { PhotoFile } from "./importPhotos";
import { fetchViewTypes, movedOrder, reorderPieceMedia, restrictionLabel, retirePieceMedia, updatePieceMedia, uploadPiecePhotos, type PiecePhotoProgress } from "./media";

// Subida y gestión de la galería de la ficha (fotografias-multiples-por-pieza 3.1). `fetch` simulado; datos sintéticos (RNF-014).
const PIECE = "01920000-0000-7000-8000-000000000101";
const SHA = "a".repeat(64);
const NO_PUBLICAR = { id: "r-1", code: "NO_PUBLICAR", label: "No publicar" };

function photo(name: string, size = 6): PhotoFile {
  return { file: new Blob(["x".repeat(size)]), relativePath: name, contentType: "image/jpeg" };
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

interface Handlers {
  authorize?: (body: Record<string, unknown>, attempt: number) => Response;
  register?: (body: Record<string, unknown>, attempt: number) => Response;
}

/** La API en modo `live`; devuelve lo que recibió cada ruta, en orden. */
function liveApi({ authorize, register }: Handlers = {}) {
  vi.stubEnv("NEXT_PUBLIC_API_MODE", "live");
  vi.stubEnv("API_INTERNAL_URL", "http://api.test");
  const authorized: Record<string, unknown>[] = [];
  const registered: Record<string, unknown>[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      const path = new URL(request.url).pathname;
      if (path.endsWith("/media/upload-url")) {
        const body = (await request.json()) as Record<string, unknown>;
        authorized.push(body);
        const attempt = authorized.length;
        return (
          authorize?.(body, attempt) ??
          json(201, { storage_key: `pieces/${PIECE}/pending/${attempt}.jpeg`, upload_url: `https://s3.test/${attempt}`, method: "PUT", headers: { "Content-Type": "image/jpeg" }, expires_at: "2026-11-02T12:00:00Z" })
        );
      }
      if (path.endsWith("/media")) {
        const body = (await request.json()) as Record<string, unknown>;
        registered.push(body);
        return register?.(body, registered.length) ?? json(201, { id: `foto-${registered.length}` });
      }
      throw new Error(`Ruta inesperada: ${path}`);
    }),
  );
  return { authorized, registered };
}

function run(files: PhotoFile[], extra: Parameters<typeof uploadPiecePhotos>[3] = {}) {
  const puts: string[] = [];
  const updates: PiecePhotoProgress[][] = [];
  const sleep = vi.fn(async (_ms: number) => {});
  const options = {
    hash: vi.fn(async () => SHA),
    put: vi.fn(async (upload: { url: string }, _file: Blob, onProgress: (loaded: number) => void) => {
      puts.push(upload.url);
      onProgress(3);
    }),
    sleep,
    ...extra.options,
  };
  const done = uploadPiecePhotos(PIECE, files, (next) => updates.push(next), { ...extra, options });
  return { done, puts, updates, options, sleep, last: () => updates.at(-1) ?? [] };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("subida de fotos a la pieza", () => {
  it("«Subida correcta de una vista frontal»: huella, autorización, subida directa y registro con su tipo de vista", async () => {
    const { authorized, registered } = liveApi();
    const upload = run([photo("frontal.jpg")], { viewTypeId: "vista-frontal" });

    expect(await upload.done).toEqual({ status: "ok", value: { uploaded: 0, registered: 1, rejected: 0, failed: 0 } });
    expect(authorized).toEqual([{ filename: "frontal.jpg", content_type: "image/jpeg", size_bytes: 6, content_sha256: SHA }]);
    expect(upload.puts).toEqual(["https://s3.test/1"]);
    expect(registered).toEqual([
      { storage_key: `pieces/${PIECE}/pending/1.jpeg`, original_filename: "frontal.jpg", content_type: "image/jpeg", size_bytes: 6, content_sha256: SHA, view_type_term_id: "vista-frontal", sort_order: 0, is_primary: false },
    ]);
    expect(upload.last()[0]).toMatchObject({ status: "registered", photoId: "foto-1", loaded: 6 });
  });

  it("muestra el avance de cada foto mientras sube", async () => {
    liveApi();
    const upload = run([photo("a.jpg")]);
    await upload.done;

    const statuses = upload.updates.map((progress) => progress[0]!.status);
    expect(statuses).toEqual(expect.arrayContaining(["hashing", "uploading", "uploaded", "registered"]));
    expect(upload.updates.some((progress) => progress[0]!.status === "uploading" && progress[0]!.loaded === 3)).toBe(true);
  });

  it("registra varias fotos en el orden elegido", async () => {
    const { registered } = liveApi();
    await run([photo("1-frente.jpg"), photo("2-perfil.jpg"), photo("3-base.jpg")]).done;
    expect(registered.map((body) => body.original_filename)).toEqual(["1-frente.jpg", "2-perfil.jpg", "3-base.jpg"]);
  });

  it("sin tipo de vista elegido, la foto queda sin especificar", async () => {
    const { registered } = liveApi();
    await run([photo("a.jpg")]).done;
    expect(registered[0]!.view_type_term_id).toBeNull();
  });

  it("una foto repetida no se sube hasta que la persona lo decide, sin recalcular la huella", async () => {
    const { registered } = liveApi({
      authorize: (_body, attempt) =>
        json(201, { storage_key: `pieces/${PIECE}/pending/${attempt}.jpeg`, upload_url: `https://s3.test/${attempt}`, method: "PUT", headers: {}, expires_at: "2026-11-02T12:00:00Z" }, { "X-Warning": "duplicate_content" }),
    });
    const first = run([photo("repetida.jpg")]);

    expect(await first.done).toMatchObject({ status: "ok", value: { registered: 0, rejected: 1 } });
    expect(first.last()[0]).toMatchObject({ status: "rejected", duplicate: true, reason: "Esta foto ya está en la pieza." });
    expect(first.puts).toEqual([]);
    expect(registered).toEqual([]);

    const second = run([photo("repetida.jpg")], { previous: first.last(), confirmedDuplicates: new Set(["repetida.jpg"]) });

    expect(await second.done).toMatchObject({ status: "ok", value: { registered: 1, rejected: 0 } });
    expect(second.options.hash).not.toHaveBeenCalled();
    expect(registered).toHaveLength(1);
    expect(second.last()[0]!.duplicate).toBeFalsy();
  });

  it("«Autorización de subida vencida»: reintenta, queda para reintentar y el nuevo intento pide otra autorización", async () => {
    const { authorized } = liveApi();
    const rejectedByStorage = vi.fn(async () => {
      throw new Error("HTTP 403");
    });
    const first = run([photo("a.jpg")], { options: { put: rejectedByStorage } });

    expect(await first.done).toMatchObject({ value: { registered: 0, failed: 1 } });
    expect(rejectedByStorage).toHaveBeenCalledTimes(4); // el intento y tres reintentos
    expect(first.sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000, 4000]);
    expect(first.last()[0]).toMatchObject({ status: "failed", reason: "El almacenamiento no aceptó la subida (HTTP 403)." });

    const second = run([photo("a.jpg")], { previous: first.last() });

    expect(await second.done).toMatchObject({ value: { registered: 1, failed: 0 } });
    expect(authorized).toHaveLength(2);
    expect(second.puts).toEqual(["https://s3.test/2"]);
    expect(second.options.hash).not.toHaveBeenCalled();
  });

  it("«Archivo con extensión engañosa»: el rechazo del servidor llega a la foto y no detiene las demás", async () => {
    const { registered } = liveApi({
      register: (body) =>
        body.original_filename === "falsa.jpg" ? json(422, { code: "unsupported_media_type", message: "El archivo no es una imagen admitida. Formatos: JPEG, PNG, TIFF." }) : json(201, { id: "foto-ok" }),
    });
    const upload = run([photo("falsa.jpg"), photo("buena.jpg")]);

    expect(await upload.done).toMatchObject({ value: { registered: 1, rejected: 1, failed: 0 } });
    expect(upload.last()[0]).toMatchObject({ status: "rejected", reason: "El archivo no es una imagen admitida. Formatos: JPEG, PNG, TIFF." });
    expect(upload.last()[1]).toMatchObject({ status: "registered", photoId: "foto-ok" });
    expect(registered).toHaveLength(2);
  });

  it("«Usuario sin permiso de subida»: no se sube nada", async () => {
    liveApi({ authorize: () => json(403, { code: "permission_denied", message: "Su rol no puede subir fotografías." }) });
    const upload = run([photo("a.jpg")]);

    expect(await upload.done).toMatchObject({ value: { rejected: 1 } });
    expect(upload.puts).toEqual([]);
    expect(upload.last()[0]).toMatchObject({ status: "rejected", reason: "Su rol no puede subir fotografías." });
  });

  it("sin conexión con la API la foto queda para reintentar, no rechazada", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "live");
    vi.stubEnv("API_INTERNAL_URL", "http://api.test");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("sin red"))));
    const upload = run([photo("a.jpg")]);

    expect(await upload.done).toMatchObject({ value: { failed: 1, rejected: 0 } });
    expect(upload.last()[0]!.status).toBe("failed");
  });

  it("reintentar no repite lo que ya quedó registrado ni lo que el servidor rechazó", async () => {
    const { authorized } = liveApi();
    const previous: PiecePhotoProgress[] = [
      { relativePath: "lista.jpg", size: 6, status: "registered", loaded: 6, sha256: SHA },
      { relativePath: "pdf.jpg", size: 6, status: "rejected", loaded: 0, sha256: SHA, reason: "No es una imagen." },
      { relativePath: "falta.jpg", size: 6, status: "failed", loaded: 2, sha256: SHA },
    ];
    await run([photo("lista.jpg"), photo("pdf.jpg"), photo("falta.jpg")], { previous }).done;
    expect(authorized.map((body) => body.filename)).toEqual(["falta.jpg"]);
  });

  it("en modo mock no llama a la API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const upload = run([photo("a.jpg")]);
    expect((await upload.done).status).toBe("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("gestión de la galería", () => {
  function live(handler: (request: Request) => Promise<Response>) {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "live");
    vi.stubEnv("API_INTERNAL_URL", "http://api.test");
    vi.stubGlobal("fetch", vi.fn(handler));
  }

  it("«Cambio de principal» y tipo de vista: envía solo lo que cambia", async () => {
    live(async (request) => {
      expect(request.method).toBe("PATCH");
      expect(new URL(request.url).pathname).toBe(`/api/v1/pieces/${PIECE}/media/foto-2`);
      expect(await request.json()).toEqual({ is_primary: true });
      return json(200, { id: "foto-2", is_primary: true });
    });
    expect(await updatePieceMedia(PIECE, "foto-2", { is_primary: true })).toMatchObject({ status: "ok", value: { is_primary: true } });
  });

  it("reordena con la lista completa en una sola operación", async () => {
    live(async (request) => {
      expect(request.method).toBe("PUT");
      expect(new URL(request.url).pathname).toBe(`/api/v1/pieces/${PIECE}/media/order`);
      expect(await request.json()).toEqual(["b", "a"]);
      return json(200, [{ id: "b" }, { id: "a" }]);
    });
    expect((await reorderPieceMedia(PIECE, ["b", "a"])).status).toBe("ok");
  });

  it("«Reordenamiento con lista incompleta»: explica que las fotos cambiaron", async () => {
    live(async () => json(422, { code: "invalid_reorder_list", message: "La lista debe contener exactamente todos los IDs." }));
    expect(await reorderPieceMedia(PIECE, ["a"])).toMatchObject({
      status: "rejected",
      code: "invalid_reorder_list",
      message: "Las fotos de la pieza cambiaron mientras tanto. Revise el orden y vuelva a intentarlo.",
    });
  });

  it("«Retiro de la foto principal»: envía el motivo y entiende la respuesta sin cuerpo", async () => {
    live(async (request) => {
      const url = new URL(request.url);
      expect(request.method).toBe("DELETE");
      expect(url.pathname).toBe(`/api/v1/pieces/${PIECE}/media/foto-1`);
      expect(url.searchParams.get("reason")).toBe("Foto movida");
      return new Response(null, { status: 204 });
    });
    expect(await retirePieceMedia(PIECE, "foto-1", "Foto movida")).toEqual({ status: "ok", value: null });
  });

  it("un retiro rechazado trae el motivo de la API", async () => {
    live(async () => json(403, { code: "permission_denied", message: "Su rol no puede retirar fotografías." }));
    expect(await retirePieceMedia(PIECE, "foto-1", "Foto movida")).toMatchObject({ status: "rejected", message: "Su rol no puede retirar fotografías." });
  });

  it("mover una foto cambia solo su lugar, y en los extremos no hace nada", () => {
    const media = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(movedOrder(media, "b", -1)).toEqual(["b", "a", "c"]);
    expect(movedOrder(media, "b", 1)).toEqual(["a", "c", "b"]);
    expect(movedOrder(media, "a", -1)).toBeNull();
    expect(movedOrder(media, "c", 1)).toBeNull();
    expect(movedOrder(media, "z", 1)).toBeNull();
  });

  it("ofrece los tipos de vista activos, y si no cargan la foto conserva el suyo", async () => {
    live(async (request) => {
      expect(new URL(request.url).pathname).toBe("/api/v1/vocabularies/PHOTO_VIEW_TYPE/terms");
      return json(200, [
        { id: "v-1", label: "Frontal", is_active: true },
        { id: "v-2", label: "Vieja", is_active: false },
      ]);
    });
    expect(await fetchViewTypes()).toEqual([{ id: "v-1", label: "Frontal" }]);

    live(async () => Promise.reject(new Error("sin red")));
    expect(await fetchViewTypes()).toEqual([]);
  });
});

describe("«Herencia desde la colección en comodato»: la etiqueta dice la restricción efectiva y su origen", () => {
  it("heredada de la colección, aunque la foto no tenga restricción propia", () => {
    expect(restrictionLabel({ effective_restriction: NO_PUBLICAR, restriction_origin: "colección", restriction_note: null })).toBe("No publicar (origen: colección)");
  });

  it("la nota se muestra sin citar requisitos", () => {
    expect(restrictionLabel({ effective_restriction: NO_PUBLICAR, restriction_origin: "pieza", restriction_note: "Restricción contractual del comodato (RN-008)" })).toBe(
      "No publicar (origen: pieza): Restricción contractual del comodato",
    );
  });

  it("sin restricción no se muestra nada", () => {
    expect(restrictionLabel({ effective_restriction: null, restriction_origin: "ninguna", restriction_note: null })).toBeNull();
    expect(restrictionLabel({ effective_restriction: { id: "s", code: "SIN_RESTRICCION", label: "Sin restricción" }, restriction_origin: "foto", restriction_note: null })).toBeNull();
  });
});
