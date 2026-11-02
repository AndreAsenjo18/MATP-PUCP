import { afterEach, describe, expect, it, vi } from "vitest";

import { allowedTypesSentence, createLocation, finalLocations, proposedPlaceCode, updateLocation, type LocationNode } from "@/lib/data/locations";
import { render, visibleText } from "@/test/render";

import { LocationPlaceDialogs, NewPlaceFields, newPlaceForm } from "./LocationPlaceDialogs";

// Lugares desde el árbol de la búsqueda (crud-manual-completo 3.1). Ubicaciones sintéticas (RNF-014).
const noop = () => {};
const BOX: LocationNode = { id: "caja-3", name: "Caja 3", level_type: "Contenedor", allowed_child_types: [], children: [] };
const LEVEL: LocationNode = { id: "niv-1", name: "Nivel 1", level_type: "Nivel", allowed_child_types: ["Contenedor"], children: [BOX] };
const SHELF: LocationNode = { id: "est-c", name: "Estante C", level_type: "Mueble", allowed_child_types: ["Nivel", "Contenedor"], children: [LEVEL] };
const DEPOT: LocationNode = { id: "dep-2", name: "Depósito 2", level_type: "Depósito", allowed_child_types: ["Mueble"], children: [SHELF] };
const SITE: LocationNode = { id: "sede", name: "Sede Central", level_type: "Sede", allowed_child_types: ["Depósito"], children: [DEPOT] };
const TREE = [SITE];
const TRAIL = [SITE, DEPOT, SHELF, LEVEL];

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

describe("agregar un lugar", () => {
  it("«Agregar una caja en un nivel»: propone Contenedor, el único tipo que admite", () => {
    expect(newPlaceForm(LEVEL).level).toBe("Contenedor");
    const html = render(<NewPlaceFields parent={LEVEL} trail={TRAIL} form={newPlaceForm(LEVEL)} onChange={noop} />);
    expect(html.match(/<option/g)).toHaveLength(1);
    expect(html).toContain("Contenedor");
  });

  it("«Lugar que la jerarquía no admite»: no ofrece ese tipo y explica cuáles admite", () => {
    const text = visibleText(render(<NewPlaceFields parent={LEVEL} trail={TRAIL} form={newPlaceForm(LEVEL)} onChange={noop} />));
    expect(text).not.toContain("Sede");
    expect(text).toContain("Dentro de «Nivel 1» (nivel) se puede agregar: contenedor.");
    expect(allowedTypesSentence(SHELF)).toBe("Dentro de «Estante C» (mueble) se puede agregar: nivel o contenedor.");
    expect(allowedTypesSentence(BOX)).toBe("En «Caja 3» (contenedor) no se pueden agregar lugares.");
  });

  it("propone el código a partir de la ruta sin la sede: un mismo nombre puede repetirse en otro estante", () => {
    expect(proposedPlaceCode(TRAIL, "Caja 14")).toBe("DEPOSITO_2_ESTANTE_C_NIVEL_1_CAJA_14");
    expect(proposedPlaceCode(TRAIL, "x".repeat(200))).toHaveLength(80);
    const html = render(<NewPlaceFields parent={LEVEL} trail={TRAIL} form={{ ...newPlaceForm(LEVEL), name: "Caja 14" }} onChange={noop} />);
    expect(html).toContain('value="DEPOSITO_2_ESTANTE_C_NIVEL_1_CAJA_14"');
  });

  it("el código escrito manda sobre el propuesto", () => {
    const html = render(<NewPlaceFields parent={LEVEL} trail={TRAIL} form={{ level: "Contenedor", name: "Caja 14", code: "C-14" }} onChange={noop} />);
    expect(html).toContain('value="C-14"');
    expect(html).not.toContain("DEPOSITO_2");
  });

  it("envía el tipo, el código y el padre; la caja nueva queda como destino de «Mover a»", async () => {
    useLive(async (request) => {
      expect(request.method).toBe("POST");
      expect(new URL(request.url).pathname).toBe("/api/v1/locations");
      expect(await request.json()).toEqual({ level: "Contenedor", code: "C-14", name: "Caja 14", parent_id: "niv-1" });
      return json(201, { id: "caja-14", name: "Caja 14" });
    });
    expect((await createLocation({ level: "Contenedor", code: "C-14", name: "Caja 14", parent_id: "niv-1" })).status).toBe("ok");
    const after: LocationNode[] = [{ ...LEVEL, children: [BOX, { ...BOX, id: "caja-14", name: "Caja 14" }] }];
    expect(finalLocations(after).map((option) => option.id)).toContain("caja-14");
  });
});

describe("desactivar un lugar", () => {
  it("«Desactivar un lugar con piezas»: dice cuántas hay que mover, con el mensaje de la API", async () => {
    const message = "Debe reubicar 3 piezas y desactivar 1 lugar que contiene antes de desactivar esta ubicación.";
    useLive(async () => json(409, { code: "location_in_use", message, details: { affected_pieces: 3, active_places: 1 } }));
    expect(await updateLocation("est-c", { is_active: false })).toMatchObject({ status: "rejected", code: "location_in_use", message });
  });

  it("explica que no se borra", () => {
    const text = visibleText(render(<LocationPlaceDialogs action={{ kind: "deactivate", node: SHELF }} nodes={TREE} onClose={noop} onChanged={noop} />));
    expect(text).toContain("Desactivar «Estante C»");
    expect(text).toContain("No se borra");
  });
});

describe("editar un lugar", () => {
  it("ofrece el nombre actual y solo envía el nombre", async () => {
    const html = render(<LocationPlaceDialogs action={{ kind: "edit", node: SHELF }} nodes={TREE} onClose={noop} onChanged={noop} />);
    expect(visibleText(html)).toContain("Editar «Estante C»");
    expect(html).toContain('value="Estante C"');
    useLive(async (request) => {
      expect(request.method).toBe("PUT");
      expect(await request.json()).toEqual({ name: "Estante D" });
      return json(200, { id: "est-c", name: "Estante D" });
    });
    expect((await updateLocation("est-c", { name: "Estante D" })).status).toBe("ok");
  });
});

describe("sin acción", () => {
  it("no hay diálogo", () => {
    expect(render(<LocationPlaceDialogs action={null} nodes={TREE} onClose={noop} onChanged={noop} />)).toBe("");
  });
});
