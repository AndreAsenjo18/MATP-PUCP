export type ServiceName = "api" | "ai";

export type ServiceState = "ok" | "degraded" | "unreachable";

export interface ServiceHealth {
  service: ServiceName;
  label: string;
  state: ServiceState;
  detail: string;
}

const LABELS: Record<ServiceName, string> = {
  api: "API de colecciones",
  ai: "Servicio de IA asistiva",
};

interface HealthPayload {
  status?: string;
  version?: string;
  provider?: string;
  checks?: Record<string, { status?: string }>;
}

/** Translate a /health payload (or a network failure) into a user-facing summary in Spanish. */
export function summarizeHealth(
  service: ServiceName,
  httpStatus: number | null,
  payload: HealthPayload | null,
): ServiceHealth {
  const label = LABELS[service];
  if (httpStatus === null || payload === null) {
    return { service, label, state: "unreachable", detail: "No se pudo contactar el servicio." };
  }
  if (httpStatus === 200 && payload.status === "ok") {
    const extras = [
      payload.version ? `versión ${payload.version}` : null,
      payload.provider ? `proveedor ${payload.provider}` : null,
    ].filter(Boolean);
    return { service, label, state: "ok", detail: ["Operativo", ...extras].join(" · ") };
  }
  const failing = Object.entries(payload.checks ?? {})
    .filter(([, check]) => check.status !== "ok")
    .map(([name]) => name);
  const detail =
    failing.length > 0
      ? `Con problemas en: ${failing.join(", ")}.`
      : "El servicio respondió con un estado no válido.";
  return { service, label, state: "degraded", detail };
}

export async function fetchHealth(
  service: ServiceName,
  baseUrl: string,
  timeoutMs = 5000,
): Promise<ServiceHealth> {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const payload = (await response.json()) as HealthPayload;
    return summarizeHealth(service, response.status, payload);
  } catch {
    return summarizeHealth(service, null, null);
  }
}
