import { afterEach, describe, expect, it, vi } from "vitest";

import {
  batchMovePieces,
  createLocation,
  fetchLocationsTree,
  filterDestinations,
  filterLocationTree,
  finalLocations,
  locationPathLabel,
  movePiece,
  newIdempotencyKey,
  seenAgoText,
  updateLocation,
  type LocationNode,
  fetchDestinations,
  firstLocationBody,
} from "./locations";

const BASE_URL = "http://api.test";
const DEV_USER = "deposito@matp.local";

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

describe("modo mock", () => {
  it("fetchLocationsTree responde unavailable sin red", async () => {
    const result = await fetchLocationsTree(DEV_USER);
    expect(result.status).toBe("unavailable");
  });

  it("movePiece responde unavailable sin red", async () => {
    const result = await movePiece("piece-1", { movement_type: "MOVE", to_location_id: "loc-1" }, DEV_USER);
    expect(result.status).toBe("unavailable");
  });
});

describe("modo live", () => {
  it("fetchLocationsTree devuelve el árbol podado por rol", async () => {
    const tree: LocationNode[] = [{ id: "site-1", name: "Sede", level_type: "Sede", children: [] }];
    useLive(async () => json(200, tree));
    const result = await fetchLocationsTree(DEV_USER);
    expect(result).toEqual({ status: "ok", value: tree });
  });

  it("createLocation traduce un código repetido a un mensaje claro", async () => {
    useLive(async () =>
      json(409, { code: "duplicate_location_code", message: "ya existe", details: { existing_location_id: "x" } }),
    );
    const result = await createLocation({ level: "Depósito", code: "DEP-1", name: "Depósito 1" }, DEV_USER);
    expect(result).toEqual({
      status: "rejected",
      code: "duplicate_location_code",
      message: "Ya existe una ubicación activa con ese código.",
      details: { existing_location_id: "x" },
    });
  });

  it("updateLocation envía la reubicación con confirm_affected_count", async () => {
    const fetchMock = useLive(async (request) => {
      expect(request.method).toBe("PUT");
      const body = await request.clone().json();
      expect(body).toMatchObject({ parent_id: "dep-2", confirm_affected_count: 40 });
      return json(200, { id: "rack-1", code: "RACK-A", name: "Rack A", path: [] });
    });
    const result = await updateLocation("rack-1", { parent_id: "dep-2", confirm_affected_count: 40 }, DEV_USER);
    expect(result.status).toBe("ok");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("movePiece envía expected_from_location_id para el control de concurrencia", async () => {
    useLive(async (request) => {
      const body = await request.clone().json();
      expect(body.expected_from_location_id).toBe("loc-origin");
      return json(201, {
        id: "move-1",
        piece_id: "piece-1",
        movement_type: "MOVE",
        from_location: null,
        to_location: null,
        reason: null,
        performed_by_label: null,
        occurred_at: "2026-10-21T10:00:00Z",
      });
    });
    const result = await movePiece(
      "piece-1",
      { movement_type: "MOVE", to_location_id: "loc-dest", expected_from_location_id: "loc-origin" },
      DEV_USER,
    );
    expect(result.status).toBe("ok");
  });

  it("batchMovePieces envía la cabecera Idempotency-Key", async () => {
    const fetchMock = useLive(async (request) => {
      expect(request.headers.get("idempotency-key")).toBe("retry-key-1");
      return json(201, { registered: [], failures: [] });
    });
    const result = await batchMovePieces(
      { movement_type: "MOVE", to_location_id: "loc-dest", items: [{ piece_id: "p1" }] },
      "retry-key-1",
      DEV_USER,
    );
    expect(result.status).toBe("ok");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("un lote con fallas devuelve el detalle por pieza", async () => {
    useLive(async () =>
      json(409, {
        registered: [],
        failures: [{ piece_id: "p1", code: "location_changed", message: "La pieza ya cambió de ubicación." }],
      }),
    );
    const result = await batchMovePieces(
      { movement_type: "MOVE", to_location_id: "loc-dest", items: [{ piece_id: "p1" }] },
      newIdempotencyKey(),
      DEV_USER,
    );
    // Todo o nada: el 409 trae el detalle por pieza, que la barra de la búsqueda muestra (fusion-busqueda-deposito).
    expect(result).toEqual({
      status: "ok",
      value: { registered: [], failures: [{ piece_id: "p1", code: "location_changed", message: "La pieza ya cambió de ubicación." }] },
    });
  });
});

describe("lote rechazado sin detalle por pieza", () => {
  it("un error sin `failures` sigue siendo un rechazo con su mensaje", async () => {
    useLive(async () => json(422, { code: "batch_too_large", message: "Demasiadas piezas.", details: {} }));
    const result = await batchMovePieces({ movement_type: "MOVE", to_location_id: "loc-dest", items: [{ piece_id: "p1" }] }, newIdempotencyKey(), DEV_USER);
    expect(result).toMatchObject({ status: "rejected", code: "batch_too_large", message: "El lote admite hasta 200 piezas." });
  });
});

describe("locationPathLabel", () => {
  it("une los nombres de la ruta con ›", () => {
    expect(locationPathLabel([{ name: "Sede" }, { name: "Depósito 1" }, { name: "Rack A" }])).toBe("Sede › Depósito 1 › Rack A");
  });

  it("devuelve cadena vacía para una ruta vacía", () => {
    expect(locationPathLabel([])).toBe("");
  });
});

describe("newIdempotencyKey", () => {
  it("genera claves distintas en llamadas sucesivas", () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a).not.toBe(b);
  });
});

describe("filtro del árbol de ubicaciones", () => {
  const tree = [
    {
      id: "s1",
      name: "Sede Pueblo Libre",
      level_type: "Sede",
      children: [
        {
          id: "d1",
          name: "Depósito 1",
          level_type: "Depósito",
          children: [
            { id: "m1", name: "Rack A", level_type: "Mueble", children: [{ id: "c1", name: "Caja 3", level_type: "Contenedor", children: [] }] },
            { id: "m2", name: "Rack B", level_type: "Mueble", children: [] },
          ],
        },
        { id: "d2", name: "Depósito 2", level_type: "Depósito", children: [] },
      ],
    },
  ] as unknown as LocationNode[];
  const names = (nodes: LocationNode[]): string[] => nodes.flatMap((node) => [node.name, ...names(node.children ?? [])]);

  it("sin filtros devuelve el árbol entero", () => {
    expect(names(filterLocationTree(tree, { query: "", level: "" }))).toEqual(names(tree));
  });

  it("la búsqueda deja las coincidencias con sus ascendientes como contexto", () => {
    expect(names(filterLocationTree(tree, { query: "rack", level: "" }))).toEqual(["Sede Pueblo Libre", "Depósito 1", "Rack A", "Rack B"]);
    expect(names(filterLocationTree(tree, { query: "caja", level: "" }))).toEqual(["Sede Pueblo Libre", "Depósito 1", "Rack A", "Caja 3"]);
  });

  it("filtra por nivel, con las tildes plegadas, y combina con la búsqueda", () => {
    expect(names(filterLocationTree(tree, { query: "", level: "Depósito" }))).toEqual(["Sede Pueblo Libre", "Depósito 1", "Depósito 2"]);
    expect(names(filterLocationTree(tree, { query: "deposito 2", level: "Depósito" }))).toEqual(["Sede Pueblo Libre", "Depósito 2"]);
    expect(filterLocationTree(tree, { query: "rack", level: "Sede" })).toEqual([]);
  });

  it("no modifica el árbol original", () => {
    const before = JSON.stringify(tree);
    filterLocationTree(tree, { query: "rack", level: "" });
    expect(JSON.stringify(tree)).toBe(before);
  });
});

describe("destinos finales", () => {
  const tree: LocationNode[] = [
    {
      id: "s",
      name: "Sede central",
      level_type: "Sede",
      children: [
        {
          id: "d1",
          name: "Depósito 1",
          level_type: "Depósito",
          children: [
            { id: "ra", name: "Rack A", level_type: "Mueble", children: [{ id: "n2", name: "Nivel 2", level_type: "Nivel", children: [{ id: "c1", name: "Caja 01", level_type: "Contenedor", children: [] }] }, { id: "n1", name: "Nivel 1", level_type: "Nivel", children: [] }] },
            { id: "rb", name: "Rack B", level_type: "Mueble", children: [] },
          ],
        },
        { id: "d2", name: "Depósito 2", level_type: "Depósito", children: [] },
      ],
    },
  ];

  it("finalLocations devuelve solo los nodos sin hijos, con la ruta completa", () => {
    const finals = finalLocations(tree);
    expect(finals.map((item) => item.id)).toEqual(["c1", "n1", "rb", "d2"]);
    expect(finals[0]).toEqual({ id: "c1", label: "Sede central › Depósito 1 › Rack A › Nivel 2 › Caja 01", level: "Contenedor" });
  });

  it("no ofrece sedes, depósitos ni muebles que contienen otros lugares", () => {
    const ids = finalLocations(tree).map((item) => item.id);
    for (const intermediate of ["s", "d1", "ra", "n2"]) expect(ids).not.toContain(intermediate);
  });

  it("un árbol vacío no tiene lugares finales", () => {
    expect(finalLocations([])).toEqual([]);
  });

  it("filterDestinations busca en cualquier parte de la ruta sin acentos ni mayúsculas", () => {
    const finals = finalLocations(tree);
    expect(filterDestinations(finals, "rack a").map((item) => item.id)).toEqual(["c1", "n1"]);
    expect(filterDestinations(finals, "DEPOSITO 2").map((item) => item.id)).toEqual(["d2"]);
    expect(filterDestinations(finals, "  ")).toHaveLength(4);
    expect(filterDestinations(finals, "inexistente")).toEqual([]);
  });
});

describe("cuándo se vio la pieza (fusion-busqueda-deposito 3.3)", () => {
  const now = new Date(2026, 10, 1, 9, 30);
  it("cuenta días de calendario: hoy, ayer o hace N días", () => {
    expect(seenAgoText(new Date(2026, 10, 1, 0, 5).toISOString(), now)).toBe("visto hoy");
    expect(seenAgoText(new Date(2026, 9, 31, 23, 50).toISOString(), now)).toBe("visto ayer");
    expect(seenAgoText(new Date(2026, 9, 20, 12, 0).toISOString(), now)).toBe("visto hace 12 días");
  });

  it("una fecha posterior por un reloj adelantado se lee como hoy", () => {
    expect(seenAgoText(new Date(2026, 10, 2, 8, 0).toISOString(), now)).toBe("visto hoy");
  });
});

describe("ubicación inicial de una pieza nueva (crud-manual-completo 4.1)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function live(response: () => Response) {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "live");
    vi.stubEnv("API_INTERNAL_URL", "http://api.test");
    vi.stubGlobal("fetch", vi.fn(async () => response()));
  }

  it("es un movimiento normal, que dice por qué se hizo", () => {
    expect(firstLocationBody("caja-3")).toEqual({ movement_type: "MOVE", to_location_id: "caja-3", reason: "Ubicación inicial al registrar la pieza" });
  });

  it("solo ofrece lugares finales", async () => {
    const tree = [{ id: "sede", name: "Sede", level_type: "Sede", children: [{ id: "caja", name: "Caja", level_type: "Contenedor", children: [] }] }];
    live(() => new Response(JSON.stringify(tree), { status: 200, headers: { "content-type": "application/json" } }));
    expect((await fetchDestinations())?.map((option) => option.id)).toEqual(["caja"]);
  });

  it("si no cargan, responde null y el formulario no ofrece el campo", async () => {
    live(() => new Response(JSON.stringify({ code: "error", message: "Falla" }), { status: 500, headers: { "content-type": "application/json" } }));
    expect(await fetchDestinations()).toBeNull();
  });
});
