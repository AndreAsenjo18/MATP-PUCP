# Checklist de datos y accesos para la VM (para la DTI)

Lo que el equipo necesita **antes** de poder desplegar en la VM institucional (RNF-004). Cada punto sin respuesta bloquea el primer despliegue; los valores propuestos son `[SUPUESTO]` y se registran como preguntas en [`../preguntas-contraparte.md`](../preguntas-contraparte.md) (sección U).

## Entregables de la DTI

| # | Qué necesitamos | Para qué | Valor propuesto |
|---|---|---|---|
| 1 | Sistema operativo y versión, vCPU, RAM y disco de la VM | Dimensionar contenedores y límites | Linux con systemd, 2 vCPU, 4 GB, 40 GB |
| 2 | Acceso SSH para dos personas del equipo (Implantador y respaldo) y política de claves | Desplegar y operar | Usuario `matp`, claves públicas, sin contraseña |
| 3 | Permiso para instalar Docker Engine con Compose >= 2.24, o que ya esté instalado | Ejecutar los contenedores | Docker oficial |
| 4 | **Dominio** del sistema y de `media.<dominio>` (DNS) | HTTPS y fotos | `matp.<dominio PUCP>` |
| 5 | **Certificado**: ¿automático (Let's Encrypt, requiere dominio público y puertos 80/443 abiertos) o institucional (archivos `fullchain.pem` y `privkey.pem`)? | HTTPS | Institucional si el dominio es interno |
| 6 | Puertos 80 y 443 abiertos desde la red PUCP (y desde Internet si el museo lo necesita) | Acceso | Solo red PUCP |
| 7 | Salida a Internet hacia `ghcr.io` (imágenes) y hacia el destino de respaldos | Despliegue y respaldos | Lista blanca por dominio |
| 8 | **Destino externo de respaldos** (S3 institucional, R2 u otro) y sus credenciales | Respaldos fuera de la VM (RNF-011) | Bucket S3 compatible dedicado |
| 9 | Canal de alertas: URL de webhook (Teams/Slack) o servidor SMTP y correo del Administrador | Avisos de respaldo y disco | Webhook |
| 10 | ¿Hay respaldo de la propia VM a nivel de infraestructura? | No duplicar ni dejar huecos | A definir |
| 11 | Reloj de la VM sincronizado (NTP) y zona horaria | Horarios de respaldo y marcador | UTC |
| 12 | Política de parches y reinicios de la VM | Planificar ventanas | Ventana nocturna avisada |
| 13 | Usuario responsable del museo para recibir alertas | Que alguien lea el aviso | Administrador del sistema |

## Antes de la primera entrega del curso

- [ ] Respuestas 1 a 9 recibidas.
- [ ] DNS de `<dominio>` y `media.<dominio>` resuelve a la VM.
- [ ] `/opt/matp/.env.production` creado con permisos 600.
- [ ] Clave de respaldos guardada en la VM **y** fuera de ella (dos custodios).
- [ ] `restic init` hecho en el destino externo.
- [ ] Primer despliegue con `scripts/deploy.sh vX.Y.Z` y `GET /health` en `ok`.
- [ ] Primer respaldo manual correcto (`npm run backup:local`) y `backup.status: ok`.
- [ ] **Simulacro de restauración registrado** (`npm run restore:test`) en `docs/despliegue/simulacros/`.
- [ ] Alerta de prueba recibida (apague el destino de respaldos un momento o ejecute `check.sh` con un repositorio inexistente).
- [ ] Escaneo de puertos desde otra máquina: solo responden 80 y 443.
