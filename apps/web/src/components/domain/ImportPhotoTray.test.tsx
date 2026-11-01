import { afterEach, describe, expect, it, vi } from "vitest";
import { assignPhotos, fetchTrayPhotos, fetchTrayRows, type TrayPhoto, type TrayRow } from "@/lib/data/importPhotos";
import { render, visibleText } from "@/test/render";
import { ImportPhotoTray, ImportPhotoTrayView, trayReason } from "./ImportPhotoTray";

const BATCH = "01920000-0000-7000-8000-000000000601";
const noop = () => {};

const ROWS: TrayRow[] = [
  { id: "fila-4", number: 4, label: "Fila 4: Mate sintético" },
  { id: "fila-5", number: 5, label: "Fila 5: Manta sintética" },
];

function photo(id: string, overrides: Partial<TrayPhoto> = {}): TrayPhoto {
  return {
    id,
    relative_path: `lote/${id}.jpg`,
    original_filename: `${id}.jpg`,
    size_bytes: 1024,
    status: "VERIFIED",
    rejection_reason: null,
    match_status: "UNMATCHED",
    match_source: null,
    row_id: null,
    candidate_row_ids: null,
    sort_key: null,
    duplicate_of_existing: false,
    duplicate_confirmed: false,
    thumbnail_url: `https://media.test/${id}/thumb.webp?firma`,
    ...overrides,
  };
}

const PHOTOS = [photo("245", { match_status: "AMBIGUOUS", candidate_row_ids: ["fila-5", "fila-4"] }), photo("IMG_0001")];

function view(overrides: Partial<Parameters<typeof ImportPhotoTrayView>[0]> = {}) {
  return render(
    <ImportPhotoTrayView photos={PHOTOS} rows={ROWS} selected={[]} rowNumber="" busy={false} message={null} error={null} onToggle={noop} onRowNumber={noop} onAssign={noop} {...overrides} />,
  );
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function useLive(handler: (request: Request) => Promise<Response>) {
  vi.stubEnv("NEXT_PUBLIC_API_MODE", "live");
  vi.stubEnv("API_INTERNAL_URL", "http://api.test");
  const fetchMock = vi.fn(handler);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("bandeja de fotos del lote (Req: Bandeja de revisión de fotografías del lote)", () => {
  it("muestra las fotos por revisar con su miniatura y el motivo en números de fila", () => {
    const html = view();
    const text = visibleText(html);

    expect(text).toContain("Fotos por revisar (2)");
    expect(html).toContain('src="https://media.test/245/thumb.webp?firma"');
    expect(text).toContain("Ambigua: filas 4 o 5");
    expect(text).toContain("Sin emparejar: ninguna fila tiene su código");
    expect(html).toContain('aria-label="Elegir lote/IMG_0001.jpg"');
  });

  it("solo deja asignar con fotos elegidas y una fila que existe", () => {
    const button = (html: string) => html.match(/<button[^>]*>[\s\S]*?<\/button>/)![0];
    // The class carries `disabled:` variants: only the attribute tells whether it is disabled.
    const disabled = /\sdisabled=""/;

    const ready = view({ selected: ["245"], rowNumber: "4" });
    expect(visibleText(button(ready))).toBe("Asignar 1 a la fila");
    expect(button(ready)).not.toMatch(disabled);
    expect(visibleText(ready)).toContain("Fila 4: Mate sintético");

    const unknown = view({ selected: ["245"], rowNumber: "40" });
    expect(visibleText(unknown)).toContain("No hay una fila con ese número en el lote.");
    expect(button(unknown)).toMatch(disabled);
    expect(button(view({ selected: [], rowNumber: "4" }))).toMatch(disabled);
  });

  it("dice cuándo no queda nada por revisar", () => {
    expect(visibleText(view({ photos: [] }))).toContain("No hay fotos ambiguas ni sin emparejar.");
  });

  it("solo aparece en la previsualización", () => {
    expect(render(<ImportPhotoTray batch={{ id: BATCH, status: "MAPPED" }} />)).toBe("");
    expect(render(<ImportPhotoTray batch={{ id: BATCH, status: "APPROVED" }} />)).toBe("");
    expect(render(<ImportPhotoTray batch={{ id: BATCH, status: "IN_PREVIEW" }} />)).toContain("Fotos por revisar");
  });

  it("nombra las filas ambiguas aunque no estén en el índice", () => {
    expect(trayReason(photo("x", { match_status: "AMBIGUOUS", candidate_row_ids: ["otra"] }), ROWS)).toBe("Ambigua: varias filas tienen su código");
  });
});

describe("datos de la bandeja", () => {
  it("lee las ambiguas y las sin emparejar verificadas", async () => {
    const fetchMock = useLive(async (request) => {
      const query = new URL(request.url).searchParams;
      const items = query.get("match_status") === "AMBIGUOUS" ? [PHOTOS[0]] : [PHOTOS[1]];
      return json(200, { items, total: 1, page: 1, page_size: 100 });
    });

    const result = await fetchTrayPhotos(BATCH);

    expect(result).toEqual({ status: "ok", value: PHOTOS });
    const queries = fetchMock.mock.calls.map(([request]) => new URL(request.url).searchParams);
    expect(queries.map((query) => [query.get("match_status"), query.get("status")])).toEqual([
      ["AMBIGUOUS", "VERIFIED"],
      ["UNMATCHED", "VERIFIED"],
    ]);
  });

  it("arma el índice de filas por su número en el Excel", async () => {
    useLive(async () =>
      json(200, {
        items: [
          { id: "fila-4", source_row_number: 4, mapped_data: { fields: { denomination: "Mate sintético" } } },
          { id: "fila-5", source_row_number: 5, mapped_data: null },
        ],
        total: 2,
        page: 1,
        page_size: 100,
        rules: [],
        unassigned_images: [],
      }),
    );

    expect(await fetchTrayRows(BATCH)).toEqual({
      status: "ok",
      value: [
        { id: "fila-4", number: 4, label: "Fila 4: Mate sintético" },
        { id: "fila-5", number: 5, label: "Fila 5" },
      ],
    });
  });

  it("asigna con PATCH y op assign", async () => {
    const bodies: unknown[] = [];
    useLive(async (request) => {
      bodies.push(await request.json());
      return json(200, { batch_id: BATCH, photos: [photo("IMG_0001", { match_status: "MANUAL", row_id: "fila-4" })] });
    });

    const result = await assignPhotos(BATCH, ["IMG_0001"], "fila-4");

    expect(result.status === "ok" && result.value[0]!.match_status).toBe("MANUAL");
    expect(bodies).toEqual([{ op: "assign", photo_ids: ["IMG_0001"], row_id: "fila-4" }]);
  });
});
