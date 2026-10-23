# Almacenamiento de objetos: CORS y URL prefirmadas

Las fotos y los archivos de importación viven en un almacenamiento compatible con S3 (MinIO en la VM, Cloudflare R2 en la contingencia). La API nunca guarda binarios en la base de datos. Change `despliegue-vm-y-respaldos` (RNF-002, RNF-008).

## Cómo salen las fotos

1. El navegador pide a la API la foto o una URL de subida.
2. La API devuelve una **URL prefirmada**: una dirección con firma temporal (5 min para descargar y 15 min para subir por defecto, `MEDIA_URL_TTL_SECONDS` y `MEDIA_UPLOAD_URL_TTL_SECONDS`).
3. El navegador habla **directamente con el almacenamiento** usando esa URL.

La firma incluye el **host y la ruta exactos**. Por eso:

- En la VM, el almacenamiento tiene su propio subdominio `media.<dominio>` y el proxy lo reenvía **sin tocar el host ni la ruta** (`deploy/vm/Caddyfile`). Publicarlo bajo una ruta del dominio principal (por ejemplo `/media-store/`) obligaría a reescribir la ruta y **invalidaría todas las firmas**.
- `S3_PUBLIC_ENDPOINT_URL` debe ser exactamente la dirección que verá el navegador (`https://media.<dominio>`), y `S3_ENDPOINT_URL` la interna (`http://storage:9000`).

## CORS

El navegador solo deja que la web (`https://<dominio>`) suba a `media.<dominio>` si el almacenamiento lo permite explícitamente.

| Entorno | Dónde se configura | Qué permitir |
|---|---|---|
| VM (MinIO) | Variable `MINIO_API_CORS_ALLOW_ORIGIN` del contenedor `storage` | `https://<dominio>` |
| Contingencia (R2) | Panel de R2 → bucket → *Settings* → *CORS policy* | Origen `https://<web>.vercel.app`; métodos `GET`, `PUT`, `HEAD`; cabeceras `Content-Type`, `x-amz-*`; `ExposeHeaders: ETag` |
| Desarrollo | Ninguna: la web y MinIO se llaman en `localhost` | — |

Ejemplo de política CORS para R2 (JSON):

```json
[
  {
    "AllowedOrigins": ["https://<web>.vercel.app"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

La política de contenido del proxy (`Content-Security-Policy`) ya admite `https://media.<dominio>` en `img-src` y `connect-src`; si cambia el subdominio hay que cambiarlo allí también.

## Cómo comprobarlo

1. Abra una pieza con fotos: las imágenes cargan desde `media.<dominio>` (pestaña *Red* del navegador, sin errores de CORS).
2. Suba una foto de prueba: el `PUT` a `media.<dominio>` responde 200.
3. Si una foto da **403 `SignatureDoesNotMatch`**: el host o la ruta que firmó la API no es el que llegó al almacenamiento. Revise `S3_PUBLIC_ENDPOINT_URL` y que ningún proxy esté reescribiendo la ruta o el encabezado `Host`.
4. Si da un error de CORS en la consola: falta o está mal el origen permitido de la tabla de arriba.
