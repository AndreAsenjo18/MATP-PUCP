# ADR-011 — Despliegue en VM con proxy Caddy, respaldos cifrados con restic y tareas programadas con systemd

- **Estado**: Aceptado (ratificado por el Arquitecto de Software, 2026-09-26) — se implementa en el change `despliegue-vm-y-respaldos`
- **Fecha**: 2026-09-17
- **Versiones**: **no fijadas en este ADR**. Se consultan las versiones estables vigentes de Caddy, restic y del cliente de MinIO/rclone al implementar el change y se registran aquí en ese momento (guardrail 7).

## Contexto

La evaluación y el uso real requieren la VM Linux institucional PUCP con HTTPS (RNF-013), respaldos automáticos fuera del servidor con restauración probada (RNF-011) y una contingencia en free tier (RNF-002). Los datos incluyen información personal (RNF-014). Aún se desconocen el sistema operativo, recursos, dominio, certificado y destino externo de respaldos de la VM (preguntas registradas). La máquina del arranque no tiene el daemon de Docker disponible.

## Decisión

1. **Compose de producción** (`deploy/vm/docker-compose.prod.yml`) sobre el compose base: solo el proxy publica puertos; contenedores sin root, reinicio automático, límites de recursos y rotación de logs.
2. **Caddy** como proxy inverso: HTTPS automático o certificado institucional, redirección HTTP→HTTPS, HSTS y cabeceras de seguridad, web y API bajo el mismo dominio (requisito de ADR-009).
3. **Imágenes publicadas en GHCR** por etiqueta de versión desde GitHub Actions; **despliegue manual** en la VM con `scripts/deploy.sh` (respaldo previo, migración en contenedor efímero, verificación de salud, vuelta atrás). Sin credenciales de la VM en GitHub.
4. **restic** para respaldos: volcado de PostgreSQL en streaming y espejo del bucket, cifrados antes de salir de la VM, con retención (`forget --prune`) y verificación periódica (`check --read-data-subset`). Clave con custodia dual documentada.
5. **Simulacro de restauración** automatizado en un proyecto compose aislado, con registro en `docs/despliegue/simulacros/`.
6. **systemd timers** en la VM para respaldos, verificación, instantáneas de KPI, resumen de integridad de auditoría y alerta de disco.
7. **Estado del respaldo visible** en `/health` (`backup_status`) sin datos del catálogo.

## Alternativas consideradas

- **nginx + certbot**: más configuración; contingencia si la DTI lo exige.
- **`pg_dump` + `rclone` sin restic**: sin cifrado ni deduplicación integrados; contingencia.
- **Contenedor con cron**: menos trazable que systemd en la VM; descartada.
- **Despliegue continuo automático a producción**: requiere exponer acceso a la VM a GitHub; descartada en fase 1.
- **Kubernetes**: desproporcionado para 10 usuarios; descartada.

## Consecuencias

- El Implantador necesita acceso SSH a la VM y un destino externo de respaldos antes de S12.
- Hasta tener Docker y la VM, este diseño no está verificado; el riesgo se registra en `docs/estado-arranque.md`.
- La guía de free tier debe revisarse cada vez que cambien los límites de los proveedores (se fechan en la guía).
