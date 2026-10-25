import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acceptsPhotos,
  canResume,
  entriesFromDrop,
  entriesFromInput,
  ignoredTotal,
  listPhotoFiles,
  overallProgress,
  PHOTO_RETRY_DELAYS_MS,
  sha256,
  uploadBatchPhotos,
  type PhotoFile,
  type PhotoProgress,
  type PutFile,
} from "./importPhotos";

// Modo `mock` por defecto; `useLive` sustituye `fetch` por un simulacro (sin API real ni red).
const BASE_URL = "http://api.test";
const BATCH = "01920000-0000-7000-8000-000000000601";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function useLive(handler: (request: Request) => Promise<Response>) {
  vi.stubEnv("NEXT_PUBLIC_API_MODE", "live");
  vi.stubEnv("API_INTERNAL_URL", BASE_URL);
  const fetchMock = vi.fn(handler);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function blob(text: string): Blob {
  return new Blob([text], { type: "image/jpeg" });
}

function photos(count: number): PhotoFile[] {
  return Array.from({ length: count }, (_, index) => ({
    file: blob(`foto sintética ${index}`),
    relativePath: `MMZ 045/DSC_${String(index).padStart(4, "0")}.jpg`,
    contentType: "image/jpeg",
  }));
}

/** Servidor simulado: guarda qué huellas ya tiene el lote, como el índice `(batch_id, sha256)`. */
function fakeApi({ known = new Set<string>(), rejectPaths = new Set<string>() } = {}) {
  const calls: { path: string; body: { files?: { relative_path: string; content_sha256: string }[]; photo_ids?: string[] } }[] = [];
  const handler = async (request: Request) => {
    const path = new URL(request.url).pathname;
    const body = await request.json();
    calls.push({ path, body });
    if (path.endsWith("/photos/upload-urls")) {
      return json(200, {
        batch_id: BATCH,
        items: body.files.map((file: { relative_path: string; content_sha256: string }) => {
          const base = { relative_path: file.relative_path, content_sha256: file.content_sha256 };
          if (rejectPaths.has(file.relative_path)) return { ...base, result: "rejected", reason: "Tipo no admitido." };
          const photoId = `foto-${file.content_sha256.slice(0, 8)}`;
          if (known.has(file.content_sha256)) return { ...base, result: "already_registered", photo_id: photoId, photo_status: "UPLOADED" };
          return { ...base, result: "upload", photo_id: photoId, upload_url: `https://media.test/${photoId}`, method: "PUT", headers: { "Content-Type": "image/jpeg" } };
        }),
      });
    }
    for (const id of body.photo_ids ?? []) known.add(id);
    return json(202, { batch_id: BATCH, photos: [] });
  };
  return { calls, handler, known };
}

const quickHash = async (file: Blob) => (await sha256(file)).padEnd(64, "0");

describe("listado de la carpeta (diseño D2)", () => {
  it("separa las fotos de lo ignorado y cuenta cada motivo", () => {
    const listing = listPhotoFiles(
      [
        "lote/MMZ 045/DSC_0001.JPG",
        "lote/MMZ 045/DSC_0002.jpeg",
        "lote/I-1234.png",
        "lote/escaneo.tif",
        "lote/Thumbs.db",
        "lote/.DS_Store",
        "lote/.oculta/DSC_0003.jpg",
        "lote/._DSC_0004.jpg",
        "lote/acta.pdf",
        "lote/LEEME",
      ].map((relativePath) => ({ file: blob(relativePath), relativePath })),
    );

    expect(listing.files.map((file) => [file.relativePath, file.contentType])).toEqual([
      ["lote/MMZ 045/DSC_0001.JPG", "image/jpeg"],
      ["lote/MMZ 045/DSC_0002.jpeg", "image/jpeg"],
      ["lote/I-1234.png", "image/png"],
      ["lote/escaneo.tif", "image/tiff"],
    ]);
    expect(listing.ignored).toEqual({ hidden: 2, system: 2, unsupported: 2 });
    expect(ignoredTotal(listing.ignored)).toBe(6);
  });

  it("toma la ruta relativa del selector de carpeta", () => {
    const file = new File(["x"], "DSC_0001.jpg") as File & { webkitRelativePath: string };
    Object.defineProperty(file, "webkitRelativePath", { value: "lote/MMZ 045/DSC_0001.jpg" });

    expect(entriesFromInput([file]).map((entry) => entry.relativePath)).toEqual(["lote/MMZ 045/DSC_0001.jpg"]);
  });

  it("recorre las carpetas soltadas con su ruta relativa", async () => {
    const fileEntry = (fullPath: string) => ({
      isFile: true,
      isDirectory: false,
      name: fullPath.split("/").pop(),
      fullPath,
      file: (success: (file: File) => void) => success(new File(["x"], fullPath.split("/").pop() ?? "")),
    });
    const parts = [[fileEntry("/lote/MMZ 045/DSC_0001.jpg"), fileEntry("/lote/I-1234.jpg")], []];
    const folder = {
      isFile: false,
      isDirectory: true,
      name: "lote",
      fullPath: "/lote",
      createReader: () => ({ readEntries: (success: (entries: unknown[]) => void) => success(parts.shift() ?? []) }),
    };

    const entries = await entriesFromDrop([{ webkitGetAsEntry: () => folder }]);

    expect(entries.map((entry) => entry.relativePath)).toEqual(["lote/MMZ 045/DSC_0001.jpg", "lote/I-1234.jpg"]);
  });
});

describe("huella SHA-256", () => {
  const ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

  it("se calcula sin Web Worker donde no lo hay", async () => {
    expect(await sha256(new Blob(["abc"]))).toBe(ABC);
  });

  it("si el worker no carga (404, CSP) se calcula en este hilo en lugar de quedar esperando", async () => {
    const created: string[] = [];
    class BrokenWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(url: string) {
        created.push(url);
      }
      postMessage() {
        setTimeout(() => this.onerror?.(), 0);
      }
    }
    vi.stubGlobal("Worker", BrokenWorker);
    vi.resetModules();
    const fresh = await import("./importPhotos");

    expect(await fresh.sha256(new Blob(["abc"]))).toBe(ABC);
    expect(await fresh.sha256(new Blob(["abc"]))).toBe(ABC);
    expect(created).toEqual([fresh.SHA256_WORKER_URL]); // tried once, then this thread
  });
});

describe("subida reanudable por tandas (Req: Fotografías del lote con subida reanudable)", () => {
  it("pide las URL por tandas de 100, sube cuatro a la vez y avisa cada tanda", async () => {
    const api = fakeApi();
    useLive(api.handler);
    let running = 0;
    let maxRunning = 0;
    const put: PutFile = async (_upload, file, onProgress) => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((resolve) => setTimeout(resolve, 1));
      onProgress(file.size);
      running -= 1;
    };
    const updates: PhotoProgress[][] = [];

    const result = await uploadBatchPhotos(BATCH, photos(150), (progress) => updates.push(progress), {
      options: { put, hash: quickHash },
    });

    expect(result).toEqual({ status: "ok", value: { uploaded: 150, registered: 0, rejected: 0, failed: 0 } });
    const paths = api.calls.map((call) => call.path.split("/").pop());
    expect(paths).toEqual(["upload-urls", "complete", "upload-urls", "complete"]);
    expect(api.calls[0]!.body.files).toHaveLength(100);
    expect(api.calls[2]!.body.files).toHaveLength(50);
    expect(api.calls[1]!.body.photo_ids).toHaveLength(100);
    expect(maxRunning).toBe(4);
    expect(overallProgress(updates.at(-1)!)).toEqual({ percent: 100, done: 150, total: 150 });
  });

  it("reintenta una subida con espera exponencial antes de darla por fallida", async () => {
    const api = fakeApi();
    useLive(api.handler);
    let attempts = 0;
    const put: PutFile = async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("corte de red");
    };
    const delays: number[] = [];
    const sleep = async (ms: number) => void delays.push(ms);

    const ok = await uploadBatchPhotos(BATCH, photos(1), () => {}, { options: { put, sleep, hash: quickHash } });
    expect(ok.status === "ok" && ok.value.uploaded).toBe(1);
    expect(delays).toEqual([1000, 2000]);

    const always: PutFile = async () => {
      throw new Error("Sin conexión con el almacenamiento.");
    };
    const updates: PhotoProgress[][] = [];
    const failed = await uploadBatchPhotos(BATCH, photos(1).map((p) => ({ ...p, relativePath: "otra.jpg", file: blob("otra") })), (p) => updates.push(p), {
      options: { put: always, sleep: async () => {}, hash: quickHash },
    });
    expect(failed.status === "ok" && failed.value.failed).toBe(1);
    expect(updates.at(-1)![0]).toMatchObject({ status: "failed", reason: "Sin conexión con el almacenamiento." });
    expect(PHOTO_RETRY_DELAYS_MS).toEqual([1000, 2000, 4000]);
  });

  it("al reanudar no vuelve a subir lo que el lote ya tiene ni a calcular sus huellas", async () => {
    const api = fakeApi();
    useLive(api.handler);
    const files = photos(3);
    const failSecond: PutFile = async (_upload, file) => {
      if (file === files[1]!.file) throw new Error("corte de red");
    };
    let last: PhotoProgress[] = [];
    await uploadBatchPhotos(BATCH, files, (p) => (last = p), { options: { put: failSecond, sleep: async () => {}, hash: quickHash } });
    expect(last.map((item) => item.status)).toEqual(["uploaded", "failed", "uploaded"]);
    expect(canResume(last)).toBe(true);

    const hashed: Blob[] = [];
    const uploads: string[] = [];
    const before = api.calls.length;
    const resumed = await uploadBatchPhotos(BATCH, files, (p) => (last = p), {
      previous: last,
      options: {
        put: async (upload) => void uploads.push(upload.url),
        sleep: async () => {},
        hash: async (file) => (hashed.push(file), quickHash(file)),
      },
    });

    expect(resumed.status).toBe("ok");
    expect(hashed).toEqual([]); // the hash of the failed photo was kept
    expect(api.calls[before]!.body.files!.map((file) => file.relative_path)).toEqual([files[1]!.relativePath]);
    expect(uploads).toHaveLength(1);
    expect(last.map((item) => item.status)).toEqual(["uploaded", "uploaded", "uploaded"]);
    expect(canResume(last)).toBe(false);
  });

  it("muestra lo que el lote ya tenía y lo rechazado con su motivo", async () => {
    const files = photos(3);
    const known = new Set<string>([await quickHash(files[0]!.file)]);
    const api = fakeApi({ known, rejectPaths: new Set([files[2]!.relativePath]) });
    useLive(api.handler);
    let last: PhotoProgress[] = [];

    const result = await uploadBatchPhotos(BATCH, files, (p) => (last = p), { options: { put: async () => {}, hash: quickHash } });

    expect(result).toEqual({ status: "ok", value: { uploaded: 1, registered: 1, rejected: 1, failed: 0 } });
    expect(last[2]).toMatchObject({ status: "rejected", reason: "Tipo no admitido." });
    expect(api.calls.at(-1)!.body.photo_ids).toHaveLength(1);
  });

  it("se detiene con el error de la API si el lote ya no admite fotos", async () => {
    useLive(async () => json(409, { code: "batch_not_accepting_photos", message: "El lote está en «Aprobado» y no admite fotos." }));
    let last: PhotoProgress[] = [];

    const result = await uploadBatchPhotos(BATCH, photos(2), (p) => (last = p), { options: { put: async () => {}, hash: quickHash } });

    expect(result).toMatchObject({ status: "rejected", code: "batch_not_accepting_photos" });
    expect(canResume(last)).toBe(true);
  });

  it("en modo mock da las fotos por subidas sin red", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadBatchPhotos(BATCH, photos(2), () => {}, { options: { hash: quickHash } });

    expect(result).toEqual({ status: "ok", value: { uploaded: 2, registered: 0, rejected: 0, failed: 0 } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("estados del lote que admiten fotos", () => {
  it("solo con el lote mapeado o en previsualización", () => {
    expect(["UPLOADED", "MAPPED", "VALIDATED", "IN_PREVIEW", "APPROVED", "APPLIED"].map((status) => acceptsPhotos({ status: status as never }))).toEqual([
      false,
      true,
      true,
      true,
      false,
      false,
    ]);
  });
});
