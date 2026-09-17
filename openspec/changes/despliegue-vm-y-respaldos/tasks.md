## 1. Imágenes y configuración de producción

- [ ] 1.1 Ajustar `apps/api/Dockerfile`, `services/ai/Dockerfile` y `apps/web/Dockerfile` para usuario no root y etiquetas OCI; verificar con `docker build` y `docker run --rm <img> id -u` distinto de 0 (requiere Docker) (Req: Despliegue reproducible con contenedores endurecidos)
- [ ] 1.2 Crear `deploy/vm/docker-compose.prod.yml` (sin puertos internos, `restart`, límites, `read_only`, redes, rotación de logs) y sección de producción en `.env.example`; verificar con `docker compose -f docker-compose.yml -f deploy/vm/docker-compose.prod.yml config` y prueba que falla si falta una variable obligatoria (Req: Despliegue reproducible…; Req: Monitoreo básico de operación)
- [ ] 1.3 Consultar versiones estables vigentes de Caddy y restic, crear `deploy/vm/Caddyfile` (redirección, HSTS, CSP, rutas `/api`, `/media-store`, límite de cuerpo) y registrar las versiones consultadas en `docs/adr/ADR-011-despliegue-proxy-respaldos.md` (ya Propuesto); verificar con `caddy validate` en contenedor (Req: Proxy inverso con HTTPS y cabeceras de seguridad)

## 2. Publicación y despliegue

- [ ] 2.1 Crear `.github/workflows/release.yml` (build y push a GHCR por tag, sin secretos de la VM); verificar con `actionlint` o validación YAML y una ejecución en un tag de prueba (Req: Despliegue reproducible…)
- [ ] 2.2 Crear `scripts/deploy.sh` (validación de variables, pull, respaldo previo, migración en contenedor efímero, `up -d`, espera de salud, registro de versión, `--rollback`); verificar con `shellcheck` y ensayo en una VM local o contenedor Linux con Docker (Req: Migraciones protegidas por respaldo y vuelta atrás)

## 3. Respaldos y restauración

- [ ] 3.1 Crear `scripts/backup/backup.sh` (pg_dump en streaming a restic, espejo del bucket, retención, registro estructurado, notificación por webhook/SMTP) y marcador de estado leído por `/health` (`backup_status`); prueba de la API para `backup_status: stale` sin exponer datos; `shellcheck` (Req: Respaldos cifrados fuera del servidor con verificación y alerta)
- [ ] 3.2 Crear `scripts/backup/check.sh` (`restic check --read-data-subset`) y `scripts/backup/restore-test.sh` (proyecto compose aislado, verificación de esquema, conteos y huellas de fotos, registro en `docs/despliegue/simulacros/`); scripts npm `backup:local` y `restore:test`; ejecutar un simulacro completo con datos sintéticos (requiere Docker) (Req: Simulacro de restauración registrado)

## 4. Programación y monitoreo

- [ ] 4.1 Crear `deploy/vm/systemd/` (backup, backup-check, kpis-snapshot, audit-digest, disk-check) con las entradas de comandos aún inexistentes comentadas; verificar con `systemd-analyze verify` en un contenedor o VM Linux (Req: Monitoreo básico de operación)

## 5. Documentación

- [ ] 5.1 Escribir `docs/despliegue/vm.md` (requisitos, checklist de datos para la DTI, instalación, despliegue, vuelta atrás, custodia de la clave de respaldos) y `docs/despliegue/checklist-vm.md` (RNF-004)
- [ ] 5.2 Escribir `deploy/free-tier/README.md` (Vercel, Render, Neon, R2; variables; respaldo equivalente con GitHub Actions programado; límites con fecha de consulta) y `docs/despliegue/almacenamiento.md` (CORS y URL prefirmadas) (Req: Guía de contingencia en free tier; RNF-002)

## 6. Cierre del change

- [ ] 6.1 Tests requeridos: prueba de configuración de compose de producción, prueba de `backup_status`, `shellcheck` de scripts y `npm test`/`npm run lint` en verde; despliegue real en la VM PUCP y un simulacro de restauración registrado cuando haya Docker y acceso a la VM
- [ ] 6.2 Actualizar OpenAPI: documentar el campo `backup_status` en `/health` (sin datos del catálogo); `npm run openapi`, `npm run openapi:check` en verde
- [ ] 6.3 Actualizar el manual de usuario: `docs/manual-usuario/administracion.md` (qué significa el aviso de respaldo desactualizado y a quién avisar) y el manual técnico en `docs/despliegue/`
- [ ] 6.4 Registrar supuestos (RPO/RTO, frecuencia y retención, canal de alertas, destino externo, dominio y certificado) en `docs/preguntas-contraparte.md`, `openspec validate despliegue-vm-y-respaldos --strict` y, tras aprobar el PR, `openspec archive despliegue-vm-y-respaldos -y`
