/**
 * Fotografías de una pieza para la galería de la ficha (change `fotografias-multiples-por-pieza`,
 * tareas 3.1 y 3.2; spec multimedia, «Subida verificada de fotografías», «Gestión de galería con foto
 * principal única» y «Restricción efectiva heredada»).
 *
 * `GET /pieces/{piece_id}/media` entrega las fotos en orden, con su restricción de uso y dos URL
 * prefirmadas de corta duración: la miniatura (`thumbnail_url`) y la copia de visualización
 * (`download_url`). En modo `mock` se leen los fixtures de la maqueta, y las operaciones que escriben
 * responden `unavailable`.
 *
 * La subida sigue el design D1, foto por foto para que queden en el orden elegido: huella SHA-256,
 * autorización de corta duración, `PUT` directo al almacenamiento con reintentos y registro, donde
 * el servidor verifica el archivo. La huella, el `PUT` y los reintentos son los de `importPhotos`.
 */
import { apiErrorMessage, createApiClient, type ApiSchemas } from "@/lib/api/client";
import { getPieceMedia } from "@/lib/fixtures";
import { initialProgress, sha256, summarize, wait, withRetries, xhrPut, type PhotoFile, type PhotoProgress, type UploadOptions, type UploadSummary } from "./importPhotos";
import { call, plainMessage, type ImportResult } from "./imports";
import { apiBaseUrl, getApiMode } from "./mode";
import { fetchTermOptions, type TermOption } from "./pieces";

export type PieceMedia = ApiSchemas["MediaAssetOut"];
export type PieceMediaResult = { status: "ok"; media: PieceMedia[] } | { status: "error"; message: string };

const CONNECTION_MESSAGE = "No se pudieron cargar las fotografías. Intente nuevamente.";
const MOCK_MESSAGE = "Subir y ordenar fotografías solo funciona conectado a la API (NEXT_PUBLIC_API_MODE=live).";
const VIEW_TYPE_VOCABULARY = "PHOTO_VIEW_TYPE";
const HASH_FAILED_MESSAGE = "Este navegador no pudo preparar la foto. Abra el sistema por su dirección con conexión segura (https) e intente de nuevo.";

/** Mensajes de pantalla para los errores conocidos; el resto usa el de la API, que ya explica el motivo. */
const MEDIA_ERROR_MESSAGES: Record<string, string> = {
  invalid_reorder_list: "Las fotos de la pieza cambiaron mientras tanto. Revise el orden y vuelva a intentarlo.",
};

function client(devUser: string | undefined) {
  return createApiClient({ baseUrl: apiBaseUrl(), devUser });
}

export async function fetchPieceMedia(pieceId: string, devUser?: string): Promise<PieceMediaResult> {
  if (getApiMode() === "mock") return { status: "ok", media: getPieceMedia(pieceId) };
  try {
    const { data, error } = await client(devUser).GET("/api/v1/pieces/{piece_id}/media", { params: { path: { piece_id: pieceId } } });
    if (error !== undefined || data === undefined) return { status: "error", message: apiErrorMessage(error) };
    return { status: "ok", media: data };
  } catch {
    return { status: "error", message: CONNECTION_MESSAGE };
  }
}

/** Tipos de vista activos para elegir; sin ellos la foto conserva el que tiene. */
export async function fetchViewTypes(): Promise<TermOption[]> {
  if (getApiMode() === "mock") return [];
  try {
    return (await fetchTermOptions(VIEW_TYPE_VOCABULARY)) ?? [];
  } catch {
    return [];
  }
}

/** La foto que se ve primero: la principal, o la primera si ninguna lo es. */
export function initialPhoto(media: PieceMedia[]): PieceMedia | null {
  return media.find((asset) => asset.is_primary) ?? media[0] ?? null;
}

/**
 * Restricción que se muestra junto a la foto, con su origen (RN-008): la efectiva, que puede venir
 * de la foto, de la pieza en comodato o de su colección. «Sin restricción» no se muestra.
 */
export function restrictionLabel(asset: Pick<PieceMedia, "effective_restriction" | "restriction_origin" | "restriction_note">): string | null {
  const restriction = asset.effective_restriction;
  if (!restriction || restriction.code === "SIN_RESTRICCION") return null;
  const label = `${restriction.label} (origen: ${asset.restriction_origin})`;
  return asset.restriction_note ? `${label}: ${plainMessage(asset.restriction_note)}` : label;
}

/**
 * Procedencia de la foto, de solo lectura (change `importacion-fotos-a-catalogo`, tarea 7.5; spec
 * multimedia, «Procedencia visible de las fotografías importadas»): la ruta y el lote de una foto
 * importada, y la versión de menor resolución que reemplazó; o que se subió desde la ficha.
 */
export function provenanceText(asset: Pick<PieceMedia, "provenance" | "original_filename">): string | null {
  const provenance = asset.provenance;
  if (!provenance) return null;
  if (provenance.source === "manual") {
    const name = provenance.original_filename ?? asset.original_filename;
    return name ? `${name} · subida desde la ficha` : "Subida desde la ficha";
  }
  const parts = [
    provenance.relative_path ?? provenance.original_filename ?? asset.original_filename,
    provenance.import_batch_name ? `lote «${provenance.import_batch_name}»` : "lote de importación",
  ];
  const replaced = provenance.replaced_lower_resolution ?? [];
  if (replaced.length > 0) parts.push(`reemplazó a la versión de menor resolución ${replaced.join(", ")}`);
  return parts.filter(Boolean).join(" · ");
}

// ---------------------------------------------------------------------------------------------
// Subida
// ---------------------------------------------------------------------------------------------

/** `duplicate`: la foto ya está en la pieza y espera que la persona decida si la sube igual. */
export interface PiecePhotoProgress extends PhotoProgress {
  duplicate?: boolean;
}

export interface PiecePhotoUpload {
  /** Tipo de vista con el que se registran; sin él, quedan sin especificar. */
  viewTypeId?: string | null;
  /** Lo sabido de una pasada anterior: no se repite lo registrado ni se recalcula la huella. */
  previous?: PiecePhotoProgress[];
  /** Fotos repetidas que la persona decidió subir igual, por su nombre. */
  confirmedDuplicates?: ReadonlySet<string>;
  devUser?: string;
  options?: Pick<UploadOptions, "hash" | "put" | "sleep">;
}

/**
 * Sube las fotos a la pieza y devuelve cuántas quedaron en cada estado; `onUpdate` recibe el avance
 * cada vez que una foto cambia. Lo que falló se reintenta volviendo a llamar con `previous`, y cada
 * intento pide una autorización nueva, así que sirve también si la anterior venció.
 */
export async function uploadPiecePhotos(
  pieceId: string,
  files: PhotoFile[],
  onUpdate: (progress: PiecePhotoProgress[]) => void,
  { viewTypeId = null, previous = [], confirmedDuplicates = new Set<string>(), devUser, options = {} }: PiecePhotoUpload = {},
): Promise<ImportResult<UploadSummary>> {
  if (getApiMode() === "mock") return { status: "unavailable", message: MOCK_MESSAGE };
  const hash = options.hash ?? sha256;
  const put = options.put ?? xhrPut;
  const sleep = options.sleep ?? wait;
  const reopened = previous.map((item) => (item.duplicate && confirmedDuplicates.has(item.relativePath) ? { ...item, status: "pending" as const } : item));
  const progress: PiecePhotoProgress[] = initialProgress(files, reopened);
  const set = (index: number, change: Partial<PiecePhotoProgress>) => {
    progress[index] = { ...(progress[index] as PiecePhotoProgress), ...change };
    onUpdate([...progress]);
  };
  onUpdate([...progress]);

  for (const [index, photo] of files.entries()) {
    if (progress[index]!.status !== "pending") continue;
    if (!progress[index]!.sha256) {
      set(index, { status: "hashing" });
      try {
        set(index, { sha256: await hash(photo.file), status: "pending" });
      } catch {
        // Sin `crypto.subtle` (página sin https) no hay huella, y sin huella el servidor no puede verificar.
        set(index, { status: "failed", reason: HASH_FAILED_MESSAGE });
        continue;
      }
    }
    const contentSha256 = progress[index]!.sha256!;
    const body = { content_type: photo.contentType, size_bytes: photo.file.size, content_sha256: contentSha256 };

    // La API avisa de una foto repetida en un encabezado: el cuerpo es el del contrato.
    const seen: { warning: string | null } = { warning: null };
    const authorized = await call(async () => {
      const answer = await client(devUser).POST("/api/v1/pieces/{piece_id}/media/upload-url", {
        params: { path: { piece_id: pieceId } },
        body: { ...body, filename: photo.relativePath },
      });
      seen.warning = answer.response.headers.get("X-Warning");
      return answer;
    }, MEDIA_ERROR_MESSAGES);
    if (authorized.status !== "ok") {
      set(index, { status: authorized.status === "rejected" ? "rejected" : "failed", reason: authorized.message });
      continue;
    }
    if (seen.warning === "duplicate_content" && !confirmedDuplicates.has(photo.relativePath)) {
      set(index, { status: "rejected", duplicate: true, reason: "Esta foto ya está en la pieza." });
      continue;
    }

    set(index, { status: "uploading", loaded: 0, reason: undefined });
    try {
      const upload = { url: authorized.value.upload_url, method: authorized.value.method, headers: authorized.value.headers ?? {} };
      await withRetries(() => put(upload, photo.file, (loaded) => set(index, { loaded })), sleep);
    } catch (error) {
      set(index, { status: "failed", reason: `El almacenamiento no aceptó la subida (${error instanceof Error ? error.message : String(error)}).` });
      continue;
    }
    set(index, { status: "uploaded", loaded: photo.file.size });

    const registered = await call(
      () =>
        client(devUser).POST("/api/v1/pieces/{piece_id}/media", {
          params: { path: { piece_id: pieceId } },
          // El orden y la principal los decide la API al registrar: la primera foto de la pieza es la principal.
          body: { ...body, storage_key: authorized.value.storage_key, original_filename: photo.relativePath, view_type_term_id: viewTypeId, sort_order: 0, is_primary: false },
        }),
      MEDIA_ERROR_MESSAGES,
    );
    if (registered.status === "ok") set(index, { status: "registered", photoId: registered.value.id });
    else set(index, { status: registered.status === "rejected" ? "rejected" : "failed", reason: registered.message });
  }
  return { status: "ok", value: summarize(progress) };
}

// ---------------------------------------------------------------------------------------------
// Gestión de la galería
// ---------------------------------------------------------------------------------------------

/** Cambia el tipo de vista o marca la principal; la API desmarca la anterior en la misma operación. */
export async function updatePieceMedia(pieceId: string, mediaId: string, changes: ApiSchemas["MediaAssetUpdate"], devUser?: string): Promise<ImportResult<PieceMedia>> {
  return call(
    () =>
      client(devUser).PATCH("/api/v1/pieces/{piece_id}/media/{media_id}", {
        params: { path: { piece_id: pieceId, media_id: mediaId } },
        body: changes,
      }),
    MEDIA_ERROR_MESSAGES,
  );
}

/** Guarda el orden completo en una sola operación: una lista incompleta se rechaza y nada cambia. */
export async function reorderPieceMedia(pieceId: string, mediaIds: string[], devUser?: string): Promise<ImportResult<PieceMedia[]>> {
  return call(
    () =>
      client(devUser).PUT("/api/v1/pieces/{piece_id}/media/order", {
        params: { path: { piece_id: pieceId } },
        body: mediaIds,
      }),
    MEDIA_ERROR_MESSAGES,
  );
}

/** Retira la foto con motivo: se conserva y, si era la principal, pasa a serlo la siguiente (RN-005). */
export async function retirePieceMedia(pieceId: string, mediaId: string, reason: string, devUser?: string): Promise<ImportResult<null>> {
  return call(async () => {
    const { error, response } = await client(devUser).DELETE("/api/v1/pieces/{piece_id}/media/{media_id}", {
      params: { path: { piece_id: pieceId, media_id: mediaId }, query: { reason } },
    });
    // Un 204 no trae cuerpo, y `call` toma la falta de datos por un fallo.
    return error === undefined && response.ok ? { data: null } : { error };
  }, MEDIA_ERROR_MESSAGES);
}

/** El orden completo tras mover una foto un lugar; `null` si ya está en ese extremo. */
export function movedOrder(media: readonly Pick<PieceMedia, "id">[], id: string, delta: -1 | 1): string[] | null {
  const ids = media.map((asset) => asset.id);
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return null;
  [ids[from], ids[to]] = [ids[to]!, ids[from]!];
  return ids;
}
