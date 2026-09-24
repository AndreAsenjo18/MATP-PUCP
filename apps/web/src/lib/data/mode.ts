/**
 * Modo de datos de la maqueta (spec plataforma: "Prototipo navegable en modo simulado").
 *
 * `mock` (por defecto): todas las pantallas leen `lib/fixtures` sin red. `live`: las pantallas
 * que ya están implementadas en el contrato (`contratos-api-borrador`) usan el cliente tipado
 * real; el resto informa con claridad que la función no está disponible en este entorno.
 */
export type ApiMode = "mock" | "live";

export function getApiMode(): ApiMode {
  const raw = process.env.NEXT_PUBLIC_API_MODE;
  return raw === "live" ? "live" : "mock";
}

export function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
}
