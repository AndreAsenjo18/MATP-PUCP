# ADR-007 — Almacenamiento de archivos en object storage S3-compatible con acceso por URL prefirmadas

- **Estado**: Aceptado (ratificado por el Arquitecto de Software, 2026-09-26)
- **Fecha**: 2026-09-17
- **Origen**: decisiones de `setup-monorepo-base` (ADR-003) consolidadas y ampliadas por el backlog (`fotografias-multiples-por-pieza`, `importacion-pipeline-reconciliacion`, `busqueda-avanzada-y-exportacion`, `despliegue-vm-y-respaldos`)

## Contexto

Las piezas 3D requieren varias fotos cada una; con el volumen objetivo (20 000 piezas) y los supuestos de C1 (5 fotos, 4 MB), el orden de magnitud es de cientos de GB (RNF-003). El despliegue principal es una VM PUCP y la contingencia es free tier (RNF-002). Además se almacenan archivos de importación originales y exportaciones temporales. Fase 1 es interna: nada público (RF-042). Las restricciones de comodato impiden ciertas descargas (RN-008).

## Decisión

1. **Los binarios nunca van a PostgreSQL**: se guardan en un bucket S3-compatible; la base guarda metadatos (`storage_key`, tipo, tamaño, SHA-256, dimensiones).
2. **Solo API S3 con direccionamiento por ruta** (boto3). Implementaciones: MinIO en local y VM (ADR-003), Cloudflare R2 en contingencia; RustFS o Garage como reemplazo de MinIO si su distribución se complica.
3. **Bucket privado** siempre. Lectura y subida desde el navegador mediante **URL prefirmadas de corta duración** emitidas por la API tras verificar sesión y permisos (`MEDIA_URL_TTL_SECONDS`, `MEDIA_UPLOAD_URL_TTL_SECONDS`).
4. **Subida en dos pasos** (autorización → PUT directo → registro con verificación de tipo real, tamaño y SHA-256). El original no se modifica; se generan derivados livianos (miniatura y visualización) para conexiones lentas (RNF-005). Contingencia: subida a través de la API (`MEDIA_UPLOAD_MODE=proxy`).
5. **Organización de claves**: `pieces/<piece_id>/<media_id>/original.<ext>` y derivados; `imports/<batch_id>/...`; `exports/<job_id>/...` (caducan por regla de ciclo de vida); `pending/` (subidas no registradas, caducan en 24 h). Las caducidades afectan solo a archivos temporales, nunca a información del catálogo (RN-005).
6. **Restricciones de uso** se calculan en el servidor y bloquean la emisión de URL de descarga externa cuando corresponde.
7. **Endpoints separados** `S3_ENDPOINT_URL` (interno) y `S3_PUBLIC_ENDPOINT_URL` (visto por el navegador) para que las firmas sean válidas detrás del proxy.

## Alternativas consideradas

- **Archivos en la base (bytea/large objects)**: respaldos enormes y lentos, presión sobre el free tier de Neon; descartada.
- **Sistema de archivos local de la VM**: sin portabilidad a la contingencia y sin URL firmadas; descartada.
- **Servir binarios a través de la API**: duplica ancho de banda y memoria; se mantiene solo como contingencia.

## Consecuencias

- CORS del bucket debe configurarse para `PUT` desde el origen web (documentación en `docs/despliegue/almacenamiento.md`, change de despliegue).
- Los respaldos deben cubrir base **y** bucket de forma coordinada (ADR-011).
- Sin Docker en la máquina del arranque, la subida real y las firmas detrás del proxy no están verificadas (pendiente).
