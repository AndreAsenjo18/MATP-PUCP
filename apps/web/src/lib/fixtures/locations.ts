/**
 * Ubicaciones jerárquicas sintéticas (RF-016), reflejando la misma estructura del seed de
 * `apps/api` (sede → depósito/sala → rack → nivel → caja), pero reducida para la maqueta.
 */
import type { ApiSchemas } from "@/lib/api/client";

import { ids } from "./ids";

type LocationOut = ApiSchemas["LocationOut"];

const SITE: LocationOut = { id: ids.location(1), code: "SC", name: "Sede central (sintética)", level: "SITE", parent_id: null, is_active: true, description: null };
const DEP1: LocationOut = { id: ids.location(2), code: "SC-DEP1", name: "Depósito 1", level: "SPACE", parent_id: SITE.id, is_active: true, description: null };
const DEP2: LocationOut = { id: ids.location(3), code: "SC-DEP2", name: "Depósito 2", level: "SPACE", parent_id: SITE.id, is_active: true, description: "Ubicación parcial: solo sede y espacio registrados." };
const SALA1: LocationOut = { id: ids.location(4), code: "SC-SALA1", name: "Sala 1", level: "SPACE", parent_id: SITE.id, is_active: true, description: null };
const RACK_A: LocationOut = { id: ids.location(5), code: "SC-DEP1-RA", name: "Rack A", level: "FURNITURE", parent_id: DEP1.id, is_active: true, description: null };
const RACK_B: LocationOut = { id: ids.location(6), code: "SC-DEP1-RB", name: "Rack B", level: "FURNITURE", parent_id: DEP1.id, is_active: true, description: null };
const NIVEL_A2: LocationOut = { id: ids.location(7), code: "SC-DEP1-RA-N2", name: "Nivel 2", level: "SHELF_LEVEL", parent_id: RACK_A.id, is_active: true, description: null };
const NIVEL_A1: LocationOut = { id: ids.location(8), code: "SC-DEP1-RA-N1", name: "Nivel 1", level: "SHELF_LEVEL", parent_id: RACK_A.id, is_active: true, description: null };
const NIVEL_B3: LocationOut = { id: ids.location(9), code: "SC-DEP1-RB-N3", name: "Nivel 3", level: "SHELF_LEVEL", parent_id: RACK_B.id, is_active: true, description: null };
const CAJA_A2_01: LocationOut = { id: ids.location(10), code: "SC-DEP1-RA-N2-C01", name: "Caja 01", level: "CONTAINER", parent_id: NIVEL_A2.id, is_active: true, description: null };

export const LOCATIONS: LocationOut[] = [SITE, DEP1, DEP2, SALA1, RACK_A, RACK_B, NIVEL_A2, NIVEL_A1, NIVEL_B3, CAJA_A2_01];

const byId = new Map(LOCATIONS.map((l) => [l.id, l]));

/** Ruta completa (sede → ... → nodo) para pintar breadcrumbs o el árbol de administración. */
export function locationPath(locationId: string): ApiSchemas["LocationRef"][] {
  const path: ApiSchemas["LocationRef"][] = [];
  let current: LocationOut | undefined = byId.get(locationId);
  while (current) {
    path.unshift({ id: current.id, code: current.code, name: current.name, level: current.level });
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return path;
}

export const LOCATION_IDS = {
  site: SITE.id,
  deposit1: DEP1.id,
  deposit2: DEP2.id,
  room1: SALA1.id,
  rackA: RACK_A.id,
  rackB: RACK_B.id,
  shelfA2: NIVEL_A2.id,
  shelfA1: NIVEL_A1.id,
  shelfB3: NIVEL_B3.id,
  boxA2_01: CAJA_A2_01.id,
};
