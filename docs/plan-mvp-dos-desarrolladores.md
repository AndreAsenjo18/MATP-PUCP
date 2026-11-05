# Plan del MVP con dos desarrolladores

> **Estado: versión 2 (2026-10-24).** Reemplaza las asignaciones de desarrollo de [`plan-sprints.md`](plan-sprints.md) (v7) y de [`ownership.md`](ownership.md). Cubre hasta la **presentación del jueves 29 de octubre**; lo que sigue después se planifica aparte.

## Decisión del equipo

- **Todo el software lo construyen dos personas: Sergio (Sergio Chumbimuni, `SergioCB20`) y André (André Asenjo, `AndreAsenjo18`).** Cada uno revisa los PR del otro.
- **El MVP se termina el domingo 25 a las 23:59.**
- El resto del equipo se organiza así:

| Cuándo | Qué | Quién |
|---|---|---|
| Lun 26 | Revisar que el software funciona y proponer mejoras de UI/UX | 2 personas (por definir) |
| Mar 27 – Mié 28 | Armar la demo del proceso de importación | 2 personas (por definir) |
| Mar 27 – Mié 28 | Documentación | 2 personas (por definir) |
| **Jue 29** | **Exposición** | 3 personas (por definir) |

## Qué es «MVP terminado» el domingo

La meta es cerrar todas las tareas abiertas (~90) de los changes del MVP. Las prioridades no son un techo: dicen **en qué orden** se trabaja, para que si el tiempo no alcanza lo que falte sea lo menos importante. Lo mínimo es que la presentación y la demo de importación funcionen **en el ambiente de calidad**.

- **P0 (sin esto no hay demo):** importar un Excel sucio con su carpeta de fotos de punta a punta (subir → mapear con plantilla → validar → duplicados → previsualizar → aprobar → piezas creadas con sus fotos), ver la pieza resultante en el catálogo y en su ficha, y el dashboard con los KPI de incompletas. Todo en calidad con datos sintéticos.
- **P1 (se hace si P0 está listo):** edición de la ficha, reversión de un lote, administración de vocabularios y tipos de identificador, el reporte de inventario.
- **P2 (el resto de las tareas del MVP, en el orden de «Si terminan P0 y P1»):** lo que queda de cada change, su verificación en PostgreSQL con Docker y su archivo.
- **Fuera del MVP:** IA, descargas masivas, producción en la VM PUCP. Los manuales los hace el grupo de documentación.

## Estado al sábado 24

| Pantalla o flujo | Estado | Qué falta para el domingo |
|---|---|---|
| Login, usuarios y permisos | integrado (17/19) | nada para la demo |
| Catálogo y búsqueda | backend integrado (14/16) | pantalla `app/busqueda` en modo `live` (P1) |
| Ubicación | archivado | nada |
| Dashboard y reporte de incompletas | PR #87 resuelta en local, falta el push | integrarla (P0) |
| Duplicados | archivado | nada |
| Pipeline de importación | 16/19 | reversión 5.2 (P1) |
| Plantillas de mapeo | rama `feat/plantillas-mapeo-y-normalizacion-2` de Franz, 9/16, sin PR | integrarla con el asistente de mapeo (P0) |
| Importación masiva de fotos | 5/27 (modelo y emparejamiento por nombre) | subida, aplicación y paso «Fotografías» del asistente (P0) |
| Fotos de la pieza | backend integrado (PR #76), tareas sin marcar | galería en la ficha (P0) |
| Ficha de pieza | 6/22, 5 stubs | lectura (P0, ya funciona); edición y baja (P1) |
| Colecciones y vocabularios | 0/14, 3 stubs | P1 |
| Reportes de inventario | 0/11, 2 stubs | P1 |

## Reparto

| | **Sergio** | **André** |
|---|---|---|
| **P0** | PR #87; plantillas (rama de Franz) y el asistente de importación de punta a punta; despliegue en calidad y lote de demostración | Importación masiva de fotos (núcleo); galería de fotos en la ficha |
| **P1** | Reversión del lote; vocabularios y tipos de identificador; reporte de inventario | Edición, baja y restauración de la ficha; identificadores |

## Sábado 24 (noche)

| Sergio | André |
|---|---|
| Push de `resolve/pr87` a la rama `Sergio` e integrar la PR #87 | Marcar en `tasks.md` lo hecho por la PR #76 (`fotografias-multiples-por-pieza`) y la PR #85 (`ficha-pieza-crud`) |
| Rebasar `feat/plantillas-mapeo-y-normalizacion-2` sobre `main`, correr pruebas y abrir el PR | `importacion-masiva-fotografias` 2.1 y 2.2: URL de subida por tandas y verificación al completar |

## Domingo 25 · día del MVP

| Bloque | Sergio | André |
|---|---|---|
| **Mañana** (hasta 13:00) | Integrar plantillas. Probar el asistente de importación completo en `apps/web` con `data/fixtures/sabana_sintetica_v1.xlsx` y corregir lo que se rompa entre pasos | `importacion-masiva-fotografias` 3.3 (emparejar al validar y al llegar fotos) y 5.1–5.2 (registrar las fotos al aplicar el lote) |
| **Tarde** (13:00–19:00) | P1: `importacion-pipeline-reconciliacion` 5.2 (reversión). `colecciones-y-vocabularios-admin` 2.1–2.2 y 5.1 (vocabularios y tipos de identificador en Administración) | `importacion-masiva-fotografias` 6.1–6.2 (paso «Fotografías» del asistente: carpeta, avance, reanudar) y 4.1 con `assign` de 4.2 (bandeja mínima). `fotografias-multiples-por-pieza` 3.2 (galería en la ficha) |
| **19:00 · control** | 15 min entre los dos: ¿funciona el flujo P0 completo en local? Si no, se deja todo P1 y los dos van a P0 | ← |
| **Noche** (19:00–23:59) | Lote de demostración: sábana sintética de 30 filas con códigos sucios y carpeta de 80 fotos (`importacion-masiva-fotografias` 7.1). Desplegar `main` en calidad (CORS del bucket y URL prefirmadas) y recorrer el flujo P0 ahí | P1: `ficha-pieza-crud` 1.1, 2.2 y 4.5 (edición con control de concurrencia) y 2.4 (baja con motivo). Si sobra tiempo, `reportes-inventario` 2.1 y 3.1 |
| **23:59** | **MVP congelado en `main` y desplegado en calidad.** `/health` muestra el commit | ← |

## Si terminan P0 y P1

Cada uno sigue con su lista en este orden, sin esperar al otro. Lo que llegue integrado el domingo a las 23:59 entra en la revisión del lunes; lo que no, se replanifica después del jueves.

| Orden | Sergio | André |
|---|---|---|
| 1 | `busqueda-avanzada-y-exportacion` 4.1–4.2 (pantalla `live` y exportaciones) y archivo | `ficha-pieza-crud`: el resto de la sección 2 (2.1, 2.3, 2.5–2.7) y 3.1–3.2 (identificadores y corrección de I) |
| 2 | `reportes-inventario` completo (secciones 1 a 3) | `importacion-masiva-fotografias`: 2.3, 3.4, el resto de 4.2, 4.3, 5.3–5.5 y 6.3 |
| 3 | `colecciones-y-vocabularios-admin`: 1.1, 2.3–2.4, 3.1, 4.1, 5.2–5.3 | `fotografias-multiples-por-pieza` 3.1 y 3.3; verificación contra MinIO (4.1) |
| 4 | `alertas-y-reporte-incompletas`, `importacion-pipeline-reconciliacion`, `plantillas-mapeo-y-normalizacion`: tareas de cierre y archivo | `ficha-pieza-crud`, `fotografias-multiples-por-pieza`, `importacion-masiva-fotografias`: tareas de cierre y archivo |
| 5 | Cierre y archivo de `autenticacion-y-matriz-permisos` y `auditoria-y-soft-delete-transversal` | Cierre y archivo de `prestamos-y-exposiciones` con el supuesto vigente de K1 |
| 6 | `pipeline-despliegue-ambientes` 3.3–3.4 y 4.1–4.3 (`release.yml`, para etiquetar `v0.1.0`) | `npm run test:api:pg` en verde para todos los changes de Catálogo y Fotos |

## Lunes 26 · revisión y UI/UX

| Quién | Qué |
|---|---|
| **2 revisores** | Recorren en calidad las 12 pantallas del prototipo v3 y el flujo de importación con el lote de demostración. Cada error o mejora de UI/UX es un *issue* con pasos, captura, commit de `/health` y etiqueta `bug` o `ux`, más el módulo (`importacion`, `catalogo`, `consulta`, `plataforma`) |
| **Sergio y André** | Corrigen los `bug` el mismo día, por módulo como en el reparto. Las mejoras `ux` se priorizan con los revisores a las 18:00; entra lo que se pueda hacer el lunes |
| **23:59** | Despliegue final en calidad y etiqueta **`v0.1.0`**. Desde aquí, solo correcciones que bloqueen la demo |

## Martes 27 y miércoles 28 · demo y documentación

| Quién | Qué |
|---|---|
| **2 personas · demo de importación** | Guion y ensayo del proceso sobre `v0.1.0` en calidad: Excel sucio de las «sábanas» → mapeo con plantilla → normalización → duplicados → previsualización con diff → aprobación → piezas con fotos → bitácora (y reversión si entró). Respaldo: video grabado por si el ambiente falla el jueves |
| **2 personas · documentación** | Lo que pida la entrega: manual de usuario de las pantallas del MVP (`docs/manual-usuario/`) con capturas de calidad, y lo que falte del expediente |
| **Sergio y André** | Soporte a los dos grupos: dudas, datos de demostración y errores que bloqueen la demo (con PR, revisión y despliegue). **Miércoles 12:00: congelamiento total**; después de esa hora no se despliega nada |

## Jueves 29 · exposición

- Exponen 3 personas, con la demo de importación de los martes-miércoles.
- Antes de empezar: encender el ambiente de calidad de AWS Academy (dura unas 4 h), comprobar en `/health` que corre `v0.1.0` y tener el video de respaldo a mano.

## Reglas de trabajo entre los dos (sábado a lunes)

1. **PR pequeños, revisión inmediata.** El otro revisa en menos de una hora; si no puede, lo dice.
2. **Migraciones:** hoy la cabeza es `0012_completeness_rules` (al integrar la PR #87). Quien integra segundo rebasa su migración sobre la cabeza de `main`, con `revision` de 32 caracteres o menos.
3. **Archivos generados** (`docs/api/openapi.json`, `apps/web/src/lib/api/schema.d.ts`, `er.puml`): se regeneran después de cada rebase, nunca se resuelven a mano.
4. **Toda tabla nueva** hereda `SoftDeleteMixin` o se registra en `app/core/cross_cutting.py` con motivo (RN-005).
5. Se marca `- [x]` cada tarea terminada en su `tasks.md`, aunque el change no se archive todavía.

## Lo que queda para después del jueves

Lo que no se haya integrado de «Si terminan P0 y P1», más lo que está fuera del MVP (IA, descargas masivas, producción en la VM PUCP). Se replanifica después de la exposición.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Día y medio para todo el MVP | Se trabaja en orden de prioridad: si el tiempo no alcanza, lo que falta es lo menos importante. Control del domingo a las 19:00 que manda todo a P0 si hace falta |
| La rama de plantillas de Franz no integra limpio | Si el sábado no pasa las pruebas, el asistente usa el mapeo manual que ya existe en el pipeline y las plantillas pasan a P1 |
| La subida directa de fotos falla en calidad por CORS o permisos del bucket | Probarla en calidad el domingo en la noche, no el lunes; si falla, la demo sube las fotos desde local con MinIO |
| El ambiente de AWS Academy se apaga o no levanta el jueves | Video de la demo grabado el miércoles |
| Correcciones de última hora rompen la demo | Congelamiento total el miércoles a las 12:00 |
