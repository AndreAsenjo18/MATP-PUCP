# Despliegue de la demo en el ambiente de calidad

Guía para dejar listo el ambiente de calidad (AWS Academy, [ADR-013](../adr/ADR-013-entorno-integracion-aws-academy.md)) para la revisión del lunes 26, la versión `v0.1.0` y la demo del jueves 29 de octubre ([plan](../plan-mvp-dos-desarrolladores.md)). Solo datos sintéticos (RNF-014).

## Cómo llega una versión al ambiente

No hay que desplegar a mano. Cada merge a `main` con CI en verde publica las imágenes `matp-api` y `matp-web` en GHCR. Mientras la EC2 está encendida, el temporizador `matp-pull-deploy.timer` detecta la imagen nueva, hace un respaldo de la base, aplica las migraciones y reinicia los contenedores ([pipeline.md](pipeline.md), «Evidencia CD2»).

- **Para desplegar:** integrar las PR en `main` y encender la sesión de AWS Academy (dura unas 4 horas).
- **Para saber qué versión corre:** `https://54-237-95-196.sslip.io/health` muestra el `commit` y el `release`. Debe coincidir con el último commit de `main`.

> **[SUPUESTO]** La dirección `54-237-95-196.sslip.io` es la que usa `pull-deploy.sh`; si la IP de la EC2 cambia al reiniciar la sesión, hay que actualizar `MATP_HEALTH_URL` y el `Caddyfile`.

## Antes de la revisión del lunes 26

| # | Qué | Quién | Cómo se comprueba |
|---|---|---|---|
| 1 | Integrar en `main` las PR del MVP con CI en verde | Sergio y André | `gh pr list --state open` sin PR del MVP pendientes |
| 2 | Encender la sesión de AWS Academy y esperar el despliegue (máx. 10 min) | Responsable del ambiente (grupo de demo) | `/health` muestra el último commit de `main` |
| 3 | Configurar CORS en el bucket S3 (una sola vez, ver abajo) | Quien tenga la sesión de AWS | Subir una foto desde la galería de una ficha sin error en la consola del navegador |
| 4 | Comprobar que el seed sintético está cargado | Responsable del ambiente | En Catálogo hay unas 300 piezas; existen `MMZ 1` y `RA 2` (las actualiza el lote de demostración) |
| 5 | Crear los usuarios de la demo desde **Administración › Usuarios** (Gestora de colecciones, Catalogador, Conservación) | Administrador | Cada uno inicia sesión y cambia su contraseña temporal |
| 6 | Recorrer el flujo P0 con el lote de demostración | Revisores | Ver «Ensayo del flujo» |

Si el seed no está, se carga una vez desde la EC2 (escribe en RDS y sube fotos sintéticas al bucket):

```
sudo docker compose -p matp-staging -f /opt/matp/deploy/staging/docker-compose.staging.yml exec api python -m app.seed
```

> **[SUPUESTO]** La ruta `/opt/matp` es la del despliegue de CD2 ([pipeline.md](pipeline.md)). El seed solo da contraseña al administrador si `SEED_ADMIN_PASSWORD` está en `/opt/matp/.env.pruebas`.

## CORS del bucket S3

Las fotos se suben del navegador directo al bucket con URL prefirmadas ([almacenamiento.md](almacenamiento.md)). S3 lo bloquea si el bucket no permite el origen de la web. Se configura una vez por bucket, con la sesión de AWS Academy abierta:

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://54-237-95-196.sslip.io"],
      "AllowedMethods": ["GET", "PUT", "HEAD"],
      "AllowedHeaders": ["Content-Type", "x-amz-*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

```
aws s3api put-bucket-cors --bucket <bucket de .env.pruebas (S3_BUCKET)> --cors-configuration file://cors.json
aws s3api get-bucket-cors --bucket <bucket>
```

También se puede pegar el JSON en la consola de AWS: **S3 → bucket → Permisos → Uso compartido de recursos entre orígenes (CORS)**.

**Contingencia:** si el día de la demo la subida directa falla, se cambia a subida por la API sin tocar el bucket. Para eso hay que poner `MEDIA_UPLOAD_MODE=proxy` en `/opt/matp/.env.pruebas` y reiniciar la API (`sudo docker compose -p matp-staging -f /opt/matp/deploy/staging/docker-compose.staging.yml up -d api`). Es más lento, pero no depende de CORS.

## Ensayo del flujo (lote de demostración)

Archivos en [`data/fixtures/lote_demo/`](../../data/fixtures/lote_demo/LEEME.md): la sábana `lote_demo_sabana.xlsx` y la carpeta `fotos/`.

1. **Importación › Subir archivo:** `lote_demo_sabana.xlsx`.
2. **Mapeo:** según la tabla de `LEEME.md` (o una plantilla guardada con ese mapeo).
3. **Validar:** deben salir 21 nuevas, 2 actualizaciones, 5 posibles duplicados, 2 conflictos y 1 error (el comodato con código I de la fila 15).
4. **Previsualización:** abrir la fila 19 o 20 para mostrar el diff de procedencia; resolver el conflicto de las filas 17 y 18 eligiendo la nueva o rechazando una.
5. **Aprobar** como Gestora de colecciones o Administrador.
6. **Bitácora:** descargar el Excel con las filas no aplicadas y su motivo.
7. **Revertir lote** (Administrador): las piezas creadas pasan a la papelera y las actualizadas recuperan su procedencia.
8. **Fotos:** soltar la carpeta `fotos/` en el paso «Fotografías», cuando esté integrado (`importacion-masiva-fotografias`). Mientras tanto, mostrar la subida de fotos desde la galería de una ficha.

Para repetir el ensayo, revertir el lote antes de volver a importarlo. Si no, sus códigos ya existen y las filas salen como actualizaciones.

## El día de la demo (jueves 29)

- Encender la sesión de AWS Academy **al menos 30 minutos antes** y comprobar `/health` (commit de `v0.1.0`), el inicio de sesión y que una ficha muestre sus fotos.
- Revertir los lotes de ensayo para que la demo empiece con el catálogo limpio.
- Tener a mano el video de respaldo del miércoles.
- Después de las 12:00 del miércoles no se integra nada en `main` (congelamiento): así el temporizador no despliega una versión nueva en medio de la demo.
