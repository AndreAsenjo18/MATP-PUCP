/**
 * `sessionStorage` en memoria para pruebas en el entorno `node` de Vitest (sin jsdom, ADR-012).
 * Cumple el contrato mínimo que usa `lib/forms/piece-draft.ts` (`DraftStorage`).
 */
import type { DraftStorage } from "@/lib/forms/piece-draft";

export interface MemoryStorage extends DraftStorage {
  /** Claves guardadas, para comprobar qué se escribió y qué no. */
  keys(): string[];
}

export function memoryStorage(): MemoryStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
    keys: () => [...data.keys()],
  };
}
