/**
 * Colecciones sintéticas: mismas siglas ilustrativas que `apps/api/app/seed/synthetic.py`
 * (MMZ, RA/RAB, MBB, AJB en comodato, LRM) para que la maqueta y el seed real cuenten la misma
 * historia de demostración a la contraparte.
 */
import type { ApiSchemas } from "@/lib/api/client";

import { ids } from "./ids";

type CollectionOut = ApiSchemas["CollectionOut"];

const NOW = "2026-09-16T09:00:00Z";

export const COLLECTIONS: CollectionOut[] = [
  { id: ids.collection(1), acronym: "MMZ", acronym_normalized: "MMZ", name: "Colección MMZ (ficticia)", description: "Cerámica y máscaras populares.", parent_id: null, default_tenure_regime: "OWNED", origin_description: "Origen sintético", piece_count: 4, is_active: true, created_at: NOW, updated_at: NOW },
  { id: ids.collection(2), acronym: "RA", acronym_normalized: "RA", name: "Colección RA (ficticia)", description: "Retablos ayacuchanos y juguetería popular.", parent_id: null, default_tenure_regime: "OWNED", origin_description: "Origen sintético", piece_count: 3, is_active: true, created_at: NOW, updated_at: NOW },
  { id: ids.collection(3), acronym: "RAB", acronym_normalized: "RAB", name: "Subcolección RAB (ficticia)", description: "Subcolección de retablos, derivada de RA.", parent_id: ids.collection(2), default_tenure_regime: "OWNED", origin_description: "Origen sintético", piece_count: 1, is_active: true, created_at: NOW, updated_at: NOW },
  { id: ids.collection(4), acronym: "MBB", acronym_normalized: "MBB", name: "Colección MBB (ficticia)", description: "Textiles y mates burilados.", parent_id: null, default_tenure_regime: "OWNED", origin_description: "Origen sintético", piece_count: 2, is_active: true, created_at: NOW, updated_at: NOW },
  { id: ids.collection(5), acronym: "AJB", acronym_normalized: "AJB", name: "Colección AJB en comodato (ficticia)", description: "Imaginería y platería en régimen de comodato: nunca recibe código I (RN-003).", parent_id: null, default_tenure_regime: "LOAN_FOR_USE", origin_description: "Comodante sintético (sin datos personales reales)", piece_count: 2, is_active: true, created_at: NOW, updated_at: NOW },
  { id: ids.collection(6), acronym: "LRM", acronym_normalized: "LRM", name: "Colección LRM (ficticia)", description: "Instrumentos musicales y pintura popular.", parent_id: null, default_tenure_regime: "OWNED", origin_description: "Origen sintético", piece_count: 2, is_active: true, created_at: NOW, updated_at: NOW },
];

export function collectionRef(acronym: string): ApiSchemas["CollectionRef"] {
  const collection = COLLECTIONS.find((c) => c.acronym === acronym);
  if (!collection) throw new Error(`Fixture: colección ${acronym} no existe`);
  return { id: collection.id, name: collection.name, acronym: collection.acronym };
}
