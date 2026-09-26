# ADR-013 — Entorno de integración en AWS Academy (staging, no producción)

- **Estado**: Aceptado (ratificado por el Arquitecto de Software, 2026-09-26)
- **Fecha**: 2026-09-26
- **Origen**: pregunta I6 de `docs/preguntas-contraparte.md` (staging en AWS Academy vs ADR-007/ADR-011)

## Contexto

El equipo trabaja con AWS Academy Learner Lab (tablero con tareas de RDS y S3), pero ADR-007
(almacenamiento de objetos) y ADR-011 (despliegue, proxy y respaldos) solo contemplan local,
VM PUCP y contingencia free tier. Sin un ADR que defina el papel de AWS Academy, el staging queda
sin decidir (pregunta I6, prioridad B, impacto en `despliegue-vm-y-respaldos`, RNF-002).

## Decisión

1. **AWS Academy es el entorno de integración (staging), no de producción.** Solo contiene datos
   sintéticos del seed; nunca datos reales del museo (RNF-014).
2. **Infraestructura**: una EC2 t3.medium con Amazon Linux 2023, IP elástica y
   `LabInstanceProfile`, que ejecuta **el mismo overlay de Compose que producción**
   (`deploy/vm/docker-compose.prod.yml`) sin los servicios `db` y `storage`. Además:
   - Amazon RDS for PostgreSQL db.t3.micro (versión 18 si está disponible; si no, 17), sin acceso
     público y con `sslmode=require`;
   - bucket S3 privado con Block Public Access y CORS del dominio de staging.
3. **TLS con Caddy** y nombre `<ip-elastica>.sslip.io` (certificado ACME) para tener HTTPS real
   sin comprar dominio.
4. **Credenciales S3** obtenidas del rol de la instancia mediante la cadena por defecto de boto3,
   sin claves estáticas (ver Parte 2, tarea P2.1 del documento de ajustes cap6-8).
5. **Región us-east-1.**
6. **Operación por sesiones**: el Implantador inicia el laboratorio, levanta EC2 y RDS, publica la
   URL y al final detiene RDS para cuidar el crédito.

## Alternativas consideradas

- **EC2 con PostgreSQL y MinIO en contenedores**: más fiel a producción, pero no prueba la
  portabilidad a servicios gestionados; descartada para staging.
- **Staging directamente en la VM PUCP**: aún sin datos de G14 (recursos, acceso); queda como
  alternativa cuando la VM esté disponible.

## Consecuencias

- El staging no es permanente: las sesiones de AWS Academy duran ~4 h y los recursos se liberan
  al terminar; la URL de integración no siempre estará viva.
- Se prueba la portabilidad del sistema a servicios gestionados (RS01) con el mismo artefacto de
  Compose de producción.
- Requiere el ajuste de credenciales descrito en la Parte 2 del documento de ajustes (P2.1:
  S3 opcional vía cadena de credenciales por defecto).
- La URL publicada debe registrarse en `docs/estado-arranque.md` cuando se levante por primera vez.
