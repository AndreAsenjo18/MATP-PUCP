## Why

La evaluación del curso (avance integrado S12, entrega S15) y el uso real por el museo exigen el sistema desplegado en la **VM Linux institucional PUCP**, con HTTPS, respaldos automáticos con restauración probada (RNF-011 *Must*) y un plan de contingencia en free tier (RNF-002). Hoy solo existe el `docker-compose.yml` de desarrollo (con puertos de base de datos y almacenamiento expuestos y credenciales de ejemplo), sin proxy, sin respaldos ni procedimiento de restauración: una falla de disco en la VM perdería el trabajo de catalogación.

## What Changes

- Configuración de producción `deploy/vm/` : `docker-compose.prod.yml` (sobre el compose base) con imágenes versionadas, contenedores sin privilegios, políticas de reinicio, límites de recursos, redes internas y solo el proxy expuesto.
- Proxy inverso con HTTPS obligatorio, redirección desde HTTP y cabeceras de seguridad, sirviendo web y API bajo el mismo dominio (requisito de las cookies de sesión de `autenticacion-y-matriz-permisos`).
- Script de despliegue idempotente (`scripts/deploy.sh` para la VM Linux) que respalda antes de migrar, aplica migraciones, verifica salud y permite volver a la versión anterior.
- Workflow de GitHub Actions que construye y publica imágenes etiquetadas por versión en GitHub Container Registry (despliegue manual en la VM; sin credenciales de la VM en GitHub).
- Respaldos automáticos cifrados de PostgreSQL y del almacenamiento de objetos a un destino fuera de la VM, con retención configurable [SUPUESTO C6: diario, 30 días], verificación de integridad y notificación de fallos.
- Procedimiento de restauración documentado y automatizado en un entorno aislado, con simulacro periódico registrado.
- Tareas programadas en la VM: respaldos, verificación, instantáneas de KPI (`alertas-y-reporte-incompletas`) y resumen de integridad de auditoría (`auditoria-y-soft-delete-transversal`).
- Monitoreo básico: chequeos de salud, espacio en disco, rotación de logs y alerta al Administrador.
- Guía de contingencia free tier (Vercel Hobby, Render Free, Neon, Cloudflare R2) con variables de entorno y limitaciones conocidas.

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `plataforma`: se añaden requirements de despliegue reproducible con contenedores endurecidos, proxy HTTPS con cabeceras de seguridad, migraciones protegidas por respaldo y vuelta atrás, respaldos cifrados fuera del servidor con verificación y alerta, simulacro de restauración registrado, monitoreo básico y guía de contingencia free tier.

## Impact

- **IDs cubiertos**: RNF-011, RNF-002, RNF-008, RNF-013, RNF-015 (monitoreo), RNF-004, RNF-014 (cifrado de respaldos con datos personales).
- **Célula dueña**: Plataforma.
- **Depende de**: `setup-monorepo-base` (Dockerfiles y compose). Coordinación con `autenticacion-y-matriz-permisos` (cookies `Secure` requieren HTTPS) y con los comandos programables de `alertas-y-reporte-incompletas` y `auditoria-y-soft-delete-transversal` (si aún no existen, sus entradas del programador quedan comentadas).
- **Afecta**: `deploy/vm/` (nuevo), `deploy/free-tier/` (nuevo), `scripts/deploy.sh`, `scripts/backup/` (nuevos), `.github/workflows/release.yml` (nuevo), `apps/*/Dockerfile` (usuario no root; la IA viaja en la imagen de la API, ADR-008), `.env.example` (sección producción), `docs/despliegue/` (nuevo), `package.json` (scripts `backup:local`, `restore:test`).
- **Dependencias nuevas** (versiones estables consultadas al implementar, no fijadas aquí): imagen de **Caddy** como proxy inverso (contingencia: nginx + certificados institucionales), **restic** para respaldos cifrados e incrementales con retención (contingencia: `pg_dump` + `rclone`), cliente `mc` de MinIO o `rclone` para copiar objetos. Decisión registrada en ADR-011 (Propuesto).
- **Bloqueo de entorno conocido**: el daemon de Docker no está disponible en la máquina del arranque; toda verificación de este change requiere Docker y acceso a la VM PUCP (datos de acceso, dominio y destino de respaldo pendientes de la DTI/contraparte).
- **Fuera de este change**: alta disponibilidad o réplicas; Kubernetes; gestión de la VM (SO, parches, firewall institucional) que corresponde a la DTI PUCP; despliegue continuo automático a producción; monitoreo con Prometheus/Grafana.
