/**
 * Capa de datos de ubicaciones y movimientos en modo `live` (change
 * `ubicacion-jerarquica-y-movimientos`, tareas 4.1 y 4.2; spec ubicacion-movimientos, RF-016,
 * RF-017, RF-020).
 *
 * Sigue el mismo patrón que `lib/data/imports.ts`: en modo `mock` todas las operaciones
 * responden `unavailable` (las pantallas de administración y depósito siguen usando
 * `lib/fixtures` y `mock-store` para ese modo), y en modo `live` se usa el cliente tipado contra
 * `/locations`, `/pieces/{id}/move` y `/movements/batch`.
 */
import { apiErrorMessage, createApiClient, isNotImplemented, type ApiSchemas } from "@/lib/api/client";

import { apiBaseUrl, getApiMode } from "./mode";

export type LocationOut = ApiSchemas["LocationOut"];
export type LocationNode = ApiSchemas["LocationNode"];
export type LocationCreateInput = ApiSchemas["LocationCreate"];
export type LocationUpdateInput = ApiSchemas["LocationUpdate"];
export type MovementOut = ApiSchemas["MovementOut"];
export type MovementCreateInput = ApiSchemas["MovementCreate"];
export type BatchMovementRequest = ApiSchemas["BatchMovementRequest"];
export type BatchMovementResponse = ApiSchemas["BatchMovementResponse"];
export type LocationLevelLabel = LocationOut["level"];

export type LocationFailure =
  | { status: "rejected"; code: string; message: string; details?: Record<string, unknown> }
  | { status: "unavailable"; message: string };

export type LocationResult<T> = { status: "ok"; value: T } | LocationFailure;

const MOCK_MESSAGE = "La administración de ubicaciones conectada a la API solo funciona con NEXT_PUBLIC_API_MODE=live.";
const CONNECTION_MESSAGE = "No se pudo conectar con el servidor. Intente nuevamente.";

/** Mensajes de pantalla para los errores conocidos del dominio; el resto usa el de la API. */
export const LOCATION_ERROR_MESSAGES: Record<string, string> = {
  invalid_location_parent: "Ese nivel no puede ubicarse ahí: revise el padre elegido.",
  duplicate_location_code: "Ya existe una ubicación activa con ese código.",
  location_not_empty: "Debe reubicar las piezas antes de desactivar esta ubicación.",
  location_cycle: "No se puede ubicar un lugar dentro de uno de sus propios niveles.",
  confirm_affected_count_mismatch: "El número de piezas afectadas cambió: confirme el número actual.",
  space_kind_not_applicable: "El tipo de espacio solo aplica al nivel Depósito.",
  space_required: "La ubicación debe indicar al menos sede y espacio.",
  same_location: "La pieza ya está en esa ubicación; registre una verificación.",
  location_changed: "La pieza ya cambió de ubicación: actualice la pantalla antes de continuar.",
  verification_location_mismatch: "La ubicación indicada no coincide con la registrada; registre un movimiento.",
  without_location: "La pieza no tiene ubicación registrada que verificar.",
  invalid_destination: "La ubicación de destino no está activa.",
  correction_requires_reference: "Indique el destino y el movimiento que se corrige.",
  availability_incoherent: "La disponibilidad indicada no coincide con la ubicación actual de la pieza.",
  batch_too_large: "El lote admite hasta 200 piezas.",
  batch_empty: "El lote debe incluir al menos una pieza.",
  idempotency_key_reused: "La clave de reintento ya se usó con una petición distinta.",
  permission_denied: "Su rol no tiene permiso para esta operación.",
};

function client(devUser: string | undefined) {
  return createApiClient({ baseUrl: apiBaseUrl(), devUser });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failureFrom(error: unknown): LocationFailure {
  if (isNotImplemented(error)) return { status: "unavailable", message: apiErrorMessage(error) };
  const code = isRecord(error) && typeof error.code === "string" ? error.code : "error";
  const details = isRecord(error) && isRecord(error.details) ? error.details : undefined;
  return {
    status: "rejected",
    code,
    message: LOCATION_ERROR_MESSAGES[code] ?? apiErrorMessage(error),
    ...(details ? { details } : {}),
  };
}

async function call<T>(request: () => Promise<{ data?: T; error?: unknown }>): Promise<LocationResult<T>> {
  if (getApiMode() === "mock") return { status: "unavailable", message: MOCK_MESSAGE };
  try {
    const { data, error } = await request();
    if (error !== undefined || data === undefined) return failureFrom(error);
    return { status: "ok", value: data };
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}

/** `GET /locations/tree` (RF-016): árbol completo, podado por rol (RF-041). */
export async function fetchLocationsTree(devUser?: string): Promise<LocationResult<LocationNode[]>> {
  return call(() => client(devUser).GET("/api/v1/locations/tree", {}));
}

/** `GET /locations`: lista plana, opcionalmente filtrada por padre (para formularios). */
export async function fetchLocations(
  filters: { parentId?: string | null; level?: LocationLevelLabel | null } = {},
  devUser?: string,
): Promise<LocationResult<LocationOut[]>> {
  return call(() =>
    client(devUser).GET("/api/v1/locations", {
      params: { query: { parent_id: filters.parentId ?? undefined, level: filters.level ?? undefined } },
    }),
  );
}

/** `POST /locations` (RF-016): código único entre ubicaciones activas, padre de nivel permitido. */
export async function createLocation(body: LocationCreateInput, devUser?: string): Promise<LocationResult<LocationOut>> {
  return call(() => client(devUser).POST("/api/v1/locations", { body }));
}

/** `PUT /locations/{id}`: editar, desactivar (rechaza con piezas) o reubicar (design D4). */
export async function updateLocation(
  locationId: string,
  body: LocationUpdateInput,
  devUser?: string,
): Promise<LocationResult<LocationOut>> {
  return call(() => client(devUser).PUT("/api/v1/locations/{location_id}", { params: { path: { location_id: locationId } }, body }));
}

/** `GET /pieces/{id}/location-history`: historial más reciente primero (ya enmascarado, RF-041). */
export async function fetchPieceLocationHistory(pieceId: string, devUser?: string): Promise<LocationResult<MovementOut[]>> {
  return call(() => client(devUser).GET("/api/v1/pieces/{piece_id}/location-history", { params: { path: { piece_id: pieceId } } }));
}

/** `POST /pieces/{id}/move`: movimiento, verificación o corrección (design D2). */
export async function movePiece(pieceId: string, body: MovementCreateInput, devUser?: string): Promise<LocationResult<MovementOut>> {
  return call(() => client(devUser).POST("/api/v1/pieces/{piece_id}/move", { params: { path: { piece_id: pieceId } }, body }));
}

/**
 * `POST /movements/batch` (design D3): todo o nada; `idempotencyKey` evita duplicar el lote si
 * el móvil reenvía la misma petición por una conexión lenta (RNF-005).
 */
export async function batchMovePieces(
  body: BatchMovementRequest,
  idempotencyKey: string,
  devUser?: string,
): Promise<LocationResult<BatchMovementResponse>> {
  return call(() =>
    client(devUser).POST("/api/v1/movements/batch", {
      params: { header: { "Idempotency-Key": idempotencyKey } },
      body,
    }),
  );
}

/** Clave de reintento nueva por lote (crypto.randomUUID, disponible en navegadores modernos). */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `key-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export type LocationRef = ApiSchemas["LocationRef"];

/** Ruta completa de una ubicación como texto, p. ej. «Sede › Depósito 1 › Rack A». */
export function locationPathLabel(path: readonly Pick<LocationRef, "name">[]): string {
  return path.map((node) => node.name).join(" › ");
}

export interface LocationFilters {
  query: string;
  /** `""` = todos los niveles. */
  level: "" | LocationLevelLabel;
}

function foldName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * El árbol reducido a las ubicaciones cuyo nombre contiene la búsqueda y que son del nivel elegido,
 * con sus ascendientes como contexto (aunque no coincidan). Sin filtros devuelve el árbol entero.
 */
export function filterLocationTree(nodes: readonly LocationNode[], filters: LocationFilters): LocationNode[] {
  const query = foldName(filters.query);
  if (!query && !filters.level) return [...nodes];
  const visit = (node: LocationNode): LocationNode | null => {
    const children = (node.children ?? []).map(visit).filter((child): child is LocationNode => child !== null);
    const matches = (!query || foldName(node.name).includes(query)) && (!filters.level || node.level_type === filters.level);
    return matches || children.length > 0 ? { ...node, children } : null;
  };
  return nodes.map(visit).filter((node): node is LocationNode => node !== null);
}

/** Un lugar donde puede quedar guardada una pieza, con su ruta completa desde la sede. */
export interface DestinationOption {
  id: string;
  label: string;
  /** Nivel jerárquico, para el texto de ayuda (p. ej. «Nivel»). */
  level: string;
}

/**
 * Lugares finales del árbol (los que no tienen otros dentro), con la ruta completa como etiqueta.
 * El selector «Mover a» de Depósito solo ofrece estos: una pieza queda en un nivel o un contenedor,
 * no en una sede o un mueble con niveles. La API acepta cualquier destino activo que no sea sede;
 * la restricción es de interfaz (`rediseno-ux-deposito`, D1).
 */
export function finalLocations(nodes: readonly LocationNode[], prefix: readonly string[] = []): DestinationOption[] {
  return nodes.flatMap((node) => {
    const path = [...prefix, node.name];
    const children = node.children ?? [];
    return children.length === 0 ? [{ id: node.id, label: path.join(" › "), level: node.level_type }] : finalLocations(children, path);
  });
}

/** Lo mismo que `finalLocations` para una lista plana con `parent_id` (datos de demostración). */
export function finalLocationsFromList(
  locations: readonly { id: string; name: string; level: string; parent_id?: string | null; is_active?: boolean }[],
): DestinationOption[] {
  const active = locations.filter((location) => location.is_active !== false);
  const byId = new Map(active.map((location) => [location.id, location]));
  const parents = new Set(active.map((location) => location.parent_id).filter((id): id is string => !!id));
  const pathOf = (id: string): string[] => {
    const location = byId.get(id);
    if (!location) return [];
    return [...(location.parent_id ? pathOf(location.parent_id) : []), location.name];
  };
  return active
    .filter((location) => !parents.has(location.id))
    .map((location) => ({ id: location.id, label: pathOf(location.id).join(" › "), level: location.level }));
}

/** Destinos cuya ruta contiene la búsqueda, sin distinguir mayúsculas ni acentos. */
export function filterDestinations(items: readonly DestinationOption[], query: string): DestinationOption[] {
  const needle = foldName(query);
  if (!needle) return [...items];
  return items.filter((item) => foldName(item.label).includes(needle));
}
