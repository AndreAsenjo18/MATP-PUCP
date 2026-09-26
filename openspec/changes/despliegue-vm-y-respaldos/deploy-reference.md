# Anexo de referencia de despliegue (capítulo 8 del expediente)

Referencia para las tareas 1.2 y 1.3 (overlay de producción y `Caddyfile`), tomada del Anexo A
del documento de ajustes de los capítulos 6-8. **No son archivos finales**: las versiones de
imagen y las rutas se confirman al implementarlas (tarea 1.3).

## A.1 `deploy/vm/docker-compose.prod.yml` (overlay; requiere Compose ≥ 2.24 por `!reset` y `!override`)

```yaml
x-logging: &logging
  driver: json-file
  options: { max-size: "10m", max-file: "5" }

services:
  proxy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    env_file: [/opt/matp/.env.production]
    volumes:
      - ./deploy/vm/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
    depends_on:
      web: { condition: service_healthy }
      api: { condition: service_healthy }
    logging: *logging

  api:
    image: ghcr.io/<organizacion>/matp-api:${MATP_VERSION:?}
    build: !reset null
    ports: !reset []
    env_file: !override [/opt/matp/.env.production]
    read_only: true
    tmpfs: [/tmp]
    deploy: { resources: { limits: { memory: 1536m } } }
    logging: *logging

  web:
    image: ghcr.io/<organizacion>/matp-web:${MATP_VERSION:?}
    build: !reset null
    ports: !reset []
    deploy: { resources: { limits: { memory: 512m } } }
    logging: *logging

  db:
    ports: !reset []
    env_file: [/opt/matp/.env.production]
    deploy: { resources: { limits: { memory: 2g } } }
    logging: *logging

  storage:
    ports: !reset []
    env_file: [/opt/matp/.env.production]
    logging: *logging

volumes:
  caddy-data:
```

En staging (AWS Academy, ADR-013) se usa el mismo overlay **sin `db` ni `storage`**; la opción
elegida (`profiles` de Compose frente a `docker compose up proxy web api`) se documenta al
implementar la tarea 6.3.

## A.2 `deploy/vm/Caddyfile`

```caddyfile
{$MATP_DOMAIN} {
    encode zstd gzip
    request_body { max_size 60MB }
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options    "nosniff"
        Referrer-Policy           "strict-origin-when-cross-origin"
        Permissions-Policy        "camera=(self), geolocation=(), microphone=()"
        -Server
    }
    handle /api/*    { reverse_proxy api:8000 }
    handle /health*  { reverse_proxy api:8000 }
    handle           { reverse_proxy web:3000 }
    # /ai/* no se publica: la IA solo se invoca dentro del proceso de la API (ADR-008)
}

media.{$MATP_DOMAIN} {
    request_body { max_size 60MB }
    reverse_proxy storage:9000    # conserva el Host firmado en la URL prefirmada
}
```

Falta la Content-Security-Policy que exige la tarea 1.3: se define al implementarla según los
orígenes reales (web, API y `media.`).
