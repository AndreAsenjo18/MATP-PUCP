# Plan de sprints

> **Estado: versión 7 (2026-10-07), propuesta para la planificación del jueves 8 de octubre.** Reemplaza la versión 6. Se ajusta en cada planificación (ver «Cómo se modifica este plan»).
> Asignaciones basadas en [`ownership.md`](ownership.md), con refuerzos temporales a Importación y Catálogo indicados en cada sprint.

## Qué cambió y por qué

1. **La validación con el cliente ya se hizo**, con el prototipo [`prototipo-v3/`](../prototipo-v3/), y al MATP le gustó. Desaparece la reunión de validación del sprint 3 y la decisión A/B de la versión 6.
2. **Nuevo objetivo: un MVP a fines de octubre**, que es el **prototipo v3 funcionando de verdad** con Next.js (`apps/web`), FastAPI (`apps/api`) y servicios cloud (almacenamiento S3-compatible y el entorno de integración en AWS Academy). El prototipo es la **referencia de UX**: sus pantallas se construyen en `apps/web` contra la API, no se reutiliza su código.
3. **Pedido nuevo del cliente:** importar las fotos junto con los Excel, sin subirlas una por una. Se cubre con el change nuevo [`importacion-masiva-fotografias`](../openspec/changes/importacion-masiva-fotografias/) (RF-045). Hay unas 10 000 piezas con varias fotos cada una, alrededor de 25 000 imágenes.
4. **Semana de parciales (lunes 12 a domingo 18 de octubre): no se trabaja.**
5. **El sprint 1 (1 al 7 de octubre) casi no produjo integraciones.**
   - `alinear-api-endpoints-v1` sigue en 8/26.
   - Los changes del backlog siguen en 0.
   - Sí se integraron CD 1 (imágenes en GHCR), el job de migraciones en PostgreSQL, el backend de `prestamos-y-exposiciones` (11/13) y el prototipo v3.
   - Por eso el plan se comprime y se pone intenso.

## Ambiente de calidad

El **ambiente de calidad** es el entorno de pruebas (*staging*) de AWS Academy definido en [ADR-013](adr/ADR-013-entorno-integracion-aws-academy.md) y [ADR-014](adr/ADR-014-pipeline-despliegue-ambientes.md):
- usa EC2, RDS PostgreSQL y un bucket S3 privado, **solo con datos sintéticos**;
- recibe cada commit de `main` con CI en verde;
- `/health` muestra el commit desplegado.

Producción (VM PUCP) sigue siendo manual, por versión etiquetada.

**Regla del plan:** desde el sprint 2, **siempre hay una versión de `main` desplegada en calidad**, y todo lo que se muestra o se prueba se hace ahí, no en una máquina local.

| Hito | Cuándo | Responsable |
|---|---|---|
| **Primer despliegue en calidad**, manual, con el contrato cerrado (`alinear-api-endpoints-v1`) y los datos sintéticos del seed | Dom 11 oct (cierre S2) | Manuel Barrantes |
| **Despliegue automático** en calidad después de cada merge a `main` (CD 2) | Jue 22 oct (mitad de S3) | Manuel Barrantes |
| Revisión del sprint 3 hecha **sobre calidad** | Dom 25 oct | Cada célula; QA: Sergio Huamán |
| **MVP `v0.1.0` en calidad** con las 12 pantallas y la importación con fotos (almacenamiento S3 con CORS) | Sáb 31 oct (cierre S4) | Manuel Barrantes, Josué Moreno |
| Regresión y versión `v1.0.0` validadas en calidad antes de promoverlas a producción | Dom 8 nov (cierre S5) | Josué Moreno; QA: Sergio Huamán, Mathias Medina |

> Las sesiones de AWS Academy duran unas 4 horas. **El responsable del ambiente (Manuel Barrantes; respaldo: Álvaro Vargas) lo enciende para cada revisión y para las sesiones de QA anunciadas en el canal.** Al encenderlo, el temporizador de *pull* despliega la última versión de `main`.

## Calendario

Del 8 al 31 de octubre quedan **unos 18 días útiles**. Los sprints 3 y 4 pasan de jueves-miércoles a **lunes-domingo**, para que la vuelta de parciales empiece con una planificación.

| Sprint | Inicio | Cierre (23:59) | Días útiles | Foco |
|---|---|---|---|---|
| S0 | Lun 28 sep | Mié 30 sep | 3 | Adaptación al flujo (hecho) |
| S1 | Jue 1 oct | Mié 7 oct | 7 | Contrato y núcleo I (**no se cumplió**; ver «Qué pasa con lo atrasado») |
| **S2** | Jue 8 oct | **Dom 11 oct** | 4 | **Cerrar el contrato** y dejar lista la base de cada célula |
| — | Lun 12 oct | Dom 18 oct | 0 | **Parciales: no se trabaja** |
| **S3** | Lun 19 oct | Dom 25 oct | 7 | **Núcleo funcional**: backend de cada pantalla y primeras pantallas reales |
| **S4** | Lun 26 oct | **Sáb 31 oct** | 6 | **MVP integrado**: todas las pantallas del prototipo funcionando, desplegado; versión `v0.1.0` |
| S5 | Dom 1 nov | Dom 8 nov | 7 | Estabilización, regresión, deseables (IA) y versión `v1.0.0` |
| S6 | Lun 9 nov | Dom 15 nov | 7 | Documentación final y reserva |
| S7 | Lun 16 nov | Dom 22 nov | 7 | Regresión final, ensayo y entorno de la demo |
| S8 | Lun 23 nov | Mié 25 nov | 3 | **Demo** (lunes 23 nov [SUPUESTO: fecha por confirmar]) |

**Ritmo intenso (S2 a S4):**
- Cada persona integra **al menos un PR cada dos días**. Un PR que pasa más de 24 h sin revisión se avisa en el canal.
- Planificación el primer día del sprint: el jueves 8, el lunes 19 y el lunes 26.

## Alcance del MVP: el prototipo v3 funcional

Cada pantalla del prototipo cuenta como hecha cuando funciona en `apps/web` contra la API desplegada en el ambiente de calidad.

| Pantalla del prototipo | Changes que la hacen funcional | Célula |
|---|---|---|
| Login · Usuarios | `autenticacion-y-matriz-permisos` | Plataforma |
| Dashboard (KPI, sin código I, sin foto, sin ubicación) | `alertas-y-reporte-incompletas` | Consulta y control |
| Catálogo (listado, filtros, exportar) | `busqueda-avanzada-y-exportacion` | Consulta y control |
| Ficha estilo SURDOC · Registro | `ficha-pieza-crud`, `fotografias-multiples-por-pieza` | Catálogo |
| Colecciones · Tesauros | `colecciones-y-vocabularios-admin` | Catálogo |
| Ubicación | `ubicacion-jerarquica-y-movimientos` | Consulta y control |
| Importar (asistente de 5 pasos, duplicados) **+ fotos** | `plantillas-mapeo-y-normalizacion`, `deteccion-duplicados-y-cola-revision`, `importacion-pipeline-reconciliacion`, **`importacion-masiva-fotografias`** | Importación |
| Reportes | `reportes-inventario` | Consulta y control |
| Historial y auditoría en la ficha | `auditoria-y-soft-delete-transversal` | Plataforma |
| Configuración (módulo 7, parámetros) | Parcial: vocabularios y tipos de identificador de `colecciones-y-vocabularios-admin` (RN-010). El resto de parámetros **no tiene change** | Catálogo · **por decidir** |
| «Servicios cloud» | `pipeline-despliegue-ambientes` (CD 2), `despliegue-vm-y-respaldos` (compose de producción, proxy) | Plataforma |

**Fuera del MVP (se retoman en S5 si hay capacidad):**
- `ia-extraccion-texto-libre` e `ia-sugerencia-terminos`: el prototipo no tiene pantallas de IA.
- La pantalla de préstamos y exposiciones: el backend de `prestamos-y-exposiciones` se cierra y se archiva, pero no hay pantalla en el prototipo.
- Respaldos cifrados y VM PUCP: `despliegue-vm-y-respaldos`, secciones 3 a 5.

> **Decisiones pendientes para la planificación del jueves 8:**
> - ¿Entra la IA en el MVP o queda para S5?
> - ¿Hace falta pantalla de préstamos?
> - ¿Qué parámetros de «Configuración» son imprescindibles?
>
> Si alguna entra, se resta capacidad de S5 y no de S3–S4.

### Ruta crítica

```text
alinear-api-endpoints-v1 (S2) ─┬─> ficha-pieza-crud ──> fotografias-multiples-por-pieza ─┐
                               ├─> plantillas-mapeo ─┐                                    ├─> importacion-masiva-fotografias (S4)
                               ├─> deteccion-duplicados ─> importacion-pipeline-reconciliacion ─┘
                               └─> auditoria-y-soft-delete ─> (reversión de lotes)
```

**Lo más riesgoso es la cadena de importación:**
- son cuatro changes, con unas 77 tareas;
- `importacion-masiva-fotografias` depende de `fotografias-multiples-por-pieza` y del pipeline.

Por eso **la célula de IA (José Ávalos y Sergio Chumbimuni) se suma a Importación** durante S3 y S4.

## Carga por persona

**Regla: los 11 integrantes trabajan todas las semanas.** Hay solo dos excepciones acordadas:
- **Camilo Gomez no trabaja en S2** y lo compensa con carga doble en S3.
- **Nadie trabaja en la semana de parciales** (12 al 18 de octubre).

Ninguna celda depende de una condición sin alternativa: donde algo es «si entra» o «si hay acceso», la celda dice qué se hace si no.

Cada celda es el trabajo principal de esa persona en ese sprint. Las revisiones de PR se suman a esto.

| Integrante | S2 · 8 – 11 oct | S3 · 19 – 25 oct | S4 · 26 – 31 oct | S5 · 1 – 8 nov | S6 · 9 – 15 nov | S7 · 16 – 22 nov | S8 · 23 – 25 nov |
|---|---|---|---|---|---|---|---|
| **Germán Asenjo** | Preguntas L1–L8 al museo · revisar datos de `prototipo-v3/js/data.js` · alinear 6.3 · validar este plan | `deteccion-duplicados-y-cola-revision` | `importacion-masiva-fotografias` (bandeja y previsualización) con José | Lo recortado de `importacion-masiva-fotografias` (si aplica) o regresión de Importación · borrador del guion de la demo | Expediente de ingeniería y dossier de gestión (borrador) | Expediente final · guion general de la demo · ensayo | Conduce la demo |
| **Sergio Chumbimuni** | alinear 2.2, 4.2 y 5.1–5.3 · orden de integración del contrato | `importacion-pipeline-reconciliacion` (estados, ingesta, previsualización) | Cierre del pipeline (aplicación y reversión) con Franz · revisión de arquitectura | `ia-extraccion-texto-libre` si entra la IA; si no, correcciones del pipeline · `v1.0.0` con Josué | Documentación de arquitectura (ADR ratificados, diagramas, modelo de datos) | Revisión técnica de manuales y expediente · ensayo | Presenta la arquitectura |
| **Camilo Gomez** | — (no trabaja en S2) | **Carga doble:** `ficha-pieza-crud` (backend) **y** `colecciones-y-vocabularios-admin` (backend: colecciones, tesauros y parámetros) | Cierre de Catálogo: parámetros de Configuración · apoyo a `importacion-masiva-fotografias` en el registro de fotos de la ficha | Correcciones de Catálogo de la regresión | Manual de usuario de Catálogo | Correcciones de la regresión final · ensayo | Demo de Catálogo |
| **Yessica Ochante** | alinear 6.1 · mapa de rutas de `apps/web` desde el prototipo y componentes base (layout, barra lateral, tablas, chips) | Pantallas Catálogo, Ficha y Registro (frontend de `ficha-pieza-crud`) | Pantallas Colecciones, Tesauros y Configuración · galería de fotos | Ajustes de UX detectados en la regresión | Capturas y pantallas del manual de usuario | Guion de la demo y datos sintéticos de demostración | Soporte de la demo (datos y pantallas) |
| **Franz Vilcapoma** | alinear 2.4 y 4.4 | `plantillas-mapeo-y-normalizacion` (incluye la plantilla de 44 columnas de la consultoría y «No presenta» como vacío) | Cierre del pipeline con Sergio Ch. · asistente de importación en `apps/web` | Correcciones de Importación de la regresión | Manual de usuario de Importación | Lote de demostración (Excel y fotos sintéticas) · correcciones · ensayo | Demo de Importación |
| **Sergio Huamán** | alinear 4.5 y 6.2 | `alertas-y-reporte-incompletas` (backend y Dashboard) | `reportes-inventario` (backend y pantalla) | QA de extremo a extremo del MVP en calidad · regresión | Informe de QA: casos de prueba y resultados | Regresión final en calidad | Verificación del entorno antes de la demo |
| **Mathias Medina** | alinear 4.3 | `busqueda-avanzada-y-exportacion` (backend) | Cierre de búsqueda y exportación · pantalla Catálogo con filtros reales | QA de extremo a extremo en calidad · plantilla y formato del manual | Unificar el formato del manual de usuario | Integrar el manual final y la documentación de entrega | Entrega de la documentación |
| **Josué Moreno** | alinear 4.1 · archivar `ci-migraciones-postgresql` (5.4, 5.5) · revisiones | `ubicacion-jerarquica-y-movimientos` (backend y pantalla) | Pruebas de humo en calidad · versión `v0.1.0` del MVP | Congelamiento y versión `v1.0.0` | Documentación de CI/CD y del flujo de versiones | Versión de corrección (`v1.0.x`) si la regresión la exige · ensayo | Soporte de la demo |
| **José Ávalos** | alinear 4.6 · leer `fotografias-multiples-por-pieza` e `importacion-masiva-fotografias` | `fotografias-multiples-por-pieza` (backend: subida, derivados, restricciones) | `importacion-masiva-fotografias` (subida reanudable, emparejamiento, aplicación) con Germán | `ia-sugerencia-terminos` si entra la IA; si no, lo recortado de `importacion-masiva-fotografias` | Manual de fotografías (y de IA si entró) | Correcciones de fotos · ensayo | Demo de importación con fotos |
| **Álvaro Vargas** | `auditoria-y-soft-delete-transversal` (inicio) · cerrar y archivar `prestamos-y-exposiciones` | Cierre de auditoría · `autenticacion-y-matriz-permisos` (backend) | Cierre de autenticación · pantallas Login y Usuarios | Respaldos y simulacro de restauración en calidad · VM PUCP si hay acceso | Manual de administración (usuarios, permisos, auditoría) | Entorno de la demo estable con respaldo previo | Entorno de la demo |
| **Manuel Barrantes** | alinear 4.7 y 7.2 · CD 2: `deploy.sh` (`despliegue-vm-y-respaldos` 2.2) · **primer despliegue manual en calidad** | CD 2: despliegue automático en AWS Academy (`pipeline-despliegue-ambientes` 3.x) · compose de producción y proxy | MVP desplegado en calidad con MinIO o R2 (CORS, URL prefirmadas) · apoyo en Login y Usuarios | `release.yml` y procedimiento de versión (`pipeline-despliegue-ambientes` 4.x) | Manual técnico de despliegue | Ensayo del despliegue de la versión de la demo | Entorno de la demo |

## Detalle por sprint

### Sprint 2 · jue 8 – dom 11 oct · «Contrato cerrado y base lista»

> **Camilo Gomez no trabaja en el sprint 2** y compensa con carga doble en el sprint 3. Sus partes de `alinear-api-endpoints-v1` pasan a Sergio Chumbimuni (2.2, que sigue a su 2.1) y a Josué Moreno (4.1). Para equilibrar, la 6.3 de Sergio Chumbimuni pasa a Germán Asenjo.

**Meta:** `alinear-api-endpoints-v1` **integrado y archivado el domingo 11**, la prueba de conformidad del contrato en verde, y cada célula con su change leído y su rama creada para arrancar el lunes 19 sin esperar a nadie.

| Parte de `alinear-api-endpoints-v1` | Quién | Revisa PR | Orden |
|---|---|---|---|
| 2.2 `category` y `conservation_state` | Sergio Chumbimuni | José Ávalos | 1 (modelo) |
| 4.1 Rutas de piezas | Josué Moreno | Sergio Chumbimuni | 2 (después de 2.2) |
| 2.4 Seed y fixtures · 4.4 Rutas de importación | Franz Vilcapoma | Sergio Chumbimuni | 1 (modelo) |
| 4.2 Colecciones y catálogos · 5.1–5.3 Stubs y baja lógica de identificadores | Sergio Chumbimuni | José Ávalos | 2 |
| 6.3 Actualizar los changes del backlog a las rutas del contrato (`/opsx:update`) | Germán Asenjo | Sergio Chumbimuni | 3 |
| 4.3 Árbol de ubicaciones, movimiento e historial | Mathias Medina | Josué Moreno | 2 |
| 4.5 Búsqueda y paginación · 6.2 Documentación | Sergio Huamán | José Ávalos | 2 |
| 4.6 Carga de multimedia | José Ávalos | Sergio Chumbimuni | 2 |
| 4.7 `/auth/login` provisional y `/auth/me` · 7.2 Verificación en contenedores | Manuel Barrantes | Sergio Chumbimuni | 2 |
| 6.1 Cliente tipado, `lib/data` y fixtures de la web · 7.1 · 7.3 Archivo | Yessica Ochante | Josué Moreno | 3 (al final) |

**Además en S2:**

| Qué | Quién |
|---|---|
| Archivar los changes completos: `setup-monorepo-base`, `modelo-datos-nucleo`, `contratos-api-borrador`, `maqueta-ui-navegable`, `sistema-diseno-frontend`, `ci-migraciones-postgresql` | Josué Moreno (CI) y Yessica Ochante (frontend), en ese orden |
| Cerrar `prestamos-y-exposiciones` (3.3 con el supuesto vigente de K1) y archivarlo | Álvaro Vargas |
| Enviar al museo las preguntas L1–L8 (fotos, cuota, «Cesión de uso» y «Custodia», clasificación RN) | Germán Asenjo |
| Revisar que `prototipo-v3/js/data.js` no tenga nombres ni direcciones de personas tomados de los Excel del museo (Ley 29733, RNF-014); si los tiene, reemplazarlos por datos sintéticos | Germán Asenjo con Sergio Huamán (autor del prototipo) |
| Mapa de rutas de `apps/web` a partir de las 12 pantallas del prototipo y componentes base | Yessica Ochante |
| Revisión de specs de `importacion-masiva-fotografias` | Sergio Huamán (QA de Importación) |
| **Primer despliegue manual de `main` en el ambiente de calidad** (EC2, RDS y S3 de AWS Academy con `deploy.sh` y el seed sintético); `/health` con el commit | Manuel Barrantes (respaldo: Álvaro Vargas) |

### Sprint 3 · lun 19 – dom 25 oct · «Núcleo funcional»

**Meta:** el backend de cada pantalla integrado, las primeras pantallas reales (Catálogo, Ficha, Ubicación, Dashboard) leyendo de la API, y **despliegue automático en calidad desde el jueves 22**. La revisión del domingo 25 se hace sobre calidad.

| Change | Implementan | Revisa specs | Revisa PR |
|---|---|---|---|
| `ficha-pieza-crud` | Camilo Gomez (backend), Yessica Ochante (frontend) | Mathias Medina | José Ávalos |
| `colecciones-y-vocabularios-admin` (backend; adelantado desde S4 por la carga doble) | Camilo Gomez | Mathias Medina | José Ávalos |
| `fotografias-multiples-por-pieza` (backend) | José Ávalos | Mathias Medina | Sergio Chumbimuni |
| `plantillas-mapeo-y-normalizacion` | Franz Vilcapoma | Sergio Huamán | Sergio Chumbimuni |
| `deteccion-duplicados-y-cola-revision` | Germán Asenjo | Sergio Huamán | José Ávalos |
| `importacion-pipeline-reconciliacion` (estados, ingesta, previsualización) | Sergio Chumbimuni | Sergio Huamán | Josué Moreno |
| `ubicacion-jerarquica-y-movimientos` | Josué Moreno | Yessica Ochante | José Ávalos |
| `busqueda-avanzada-y-exportacion` | Mathias Medina | Yessica Ochante | Josué Moreno |
| `alertas-y-reporte-incompletas` | Sergio Huamán | Yessica Ochante | Josué Moreno |
| `auditoria-y-soft-delete-transversal` (cierre) · `autenticacion-y-matriz-permisos` (backend) | Álvaro Vargas | Franz Vilcapoma | Josué Moreno |
| CD 2 y compose de producción | Manuel Barrantes | Franz Vilcapoma | Josué Moreno |

> En S3, Franz Vilcapoma reemplaza a Camilo Gomez en la revisión de specs de Plataforma para que Camilo se dedique a sus dos changes.

**Control a mitad de sprint (jueves 22):** si `fotografias-multiples-por-pieza` o el pipeline van por debajo del 50 % de sus tareas, `importacion-masiva-fotografias` se reduce a su núcleo en S4:
- **se mantiene:** subida reanudable, emparejamiento por nombre de archivo y carpeta, aplicación conjunta;
- **pasa a S5:** la bandeja manual avanzada, `MEDIA_KEEP_ORIGINALS=false` y la columna de archivo del mapeo.

### Sprint 4 · lun 26 – sáb 31 oct · «MVP integrado»

**Meta:** las 12 pantallas del prototipo funcionando **en el ambiente de calidad** con datos sintéticos, incluida la importación de un Excel **con su carpeta de fotos**, y la versión `v0.1.0`.

| Change o pieza | Implementan | Revisa specs | Revisa PR |
|---|---|---|---|
| Pantallas Colecciones, Tesauros y Configuración sobre `colecciones-y-vocabularios-admin` (cierre y parámetros) | Yessica Ochante (frontend), Camilo Gomez (backend) | Mathias Medina | José Ávalos |
| Registro de fotos importadas en la ficha (apoyo a `importacion-masiva-fotografias`) | Camilo Gomez | Sergio Huamán | Sergio Chumbimuni |
| Cierre de `importacion-pipeline-reconciliacion` + asistente de importación en `apps/web` | Sergio Chumbimuni, Franz Vilcapoma | Sergio Huamán | Josué Moreno |
| `importacion-masiva-fotografias` | José Ávalos, Germán Asenjo | Sergio Huamán | Sergio Chumbimuni |
| `reportes-inventario` | Sergio Huamán | Yessica Ochante | Josué Moreno |
| Cierre de `busqueda-avanzada-y-exportacion` y de `ubicacion-jerarquica-y-movimientos` | Mathias Medina, Josué Moreno | Yessica Ochante | José Ávalos |
| Cierre de `autenticacion-y-matriz-permisos` + pantallas Login y Usuarios | Álvaro Vargas, Manuel Barrantes | Camilo Gomez | Josué Moreno |
| MVP desplegado en el ambiente de calidad (almacenamiento con CORS y URL prefirmadas) | Manuel Barrantes | Camilo Gomez | Josué Moreno |
| Pruebas de humo y versión `v0.1.0` | Josué Moreno | Sergio Huamán | Sergio Chumbimuni |

**Al cierre del sprint 4 (sábado 31 de octubre):** MVP congelado en main, `v0.1.0` desplegada en el ambiente de calidad y recorrido completo del prototipo hecho por QA (Sergio Huamán y Mathias Medina) **sobre calidad**.

### Sprint 5 · dom 1 – dom 8 nov · «Estabilización y deseables»

| Qué | Quién |
|---|---|
| Regresión de extremo a extremo y corrección de errores del MVP | Cada célula en su módulo; QA: Sergio Huamán, Mathias Medina |
| Lo recortado de `importacion-masiva-fotografias` en el control del jueves 22, si aplica | José Ávalos, Germán Asenjo |
| IA (`ia-extraccion-texto-libre`, `ia-sugerencia-terminos`) **si se decidió que entra**; si no, correcciones del pipeline y lo recortado de las fotos | Sergio Chumbimuni, José Ávalos |
| Respaldos y simulacro de restauración en calidad; VM PUCP si la DTI dio acceso | Álvaro Vargas |
| `release.yml` y procedimiento de versión | Manuel Barrantes |
| Congelamiento y versión `v1.0.0` (domingo 8) | Josué Moreno, Sergio Chumbimuni |

### Sprints 6 a 8 · lun 9 – mié 25 nov · «Documentación, reserva y demo»

El trabajo de cada semana está en la tabla «Carga por persona».

| Sprint | Meta |
|---|---|
| **S6** (9 – 15 nov) | Borradores completos de todos los manuales (usuario por módulo, administración, técnico de despliegue y CI/CD), documentación de arquitectura, informe de QA y expediente. |
| **S7** (16 – 22 nov) | Regresión final en calidad, correcciones (solo errores, nada de funcionalidades nuevas), manual integrado, entorno de la demo estable con respaldo previo y **ensayo general**. |
| **S8** (23 – 25 nov) | **Demo el lunes 23 de noviembre** [SUPUESTO]. La conduce Germán Asenjo, cada líder de célula presenta su módulo y Sergio Chumbimuni presenta la arquitectura. Después, entrega de la documentación. |

## Qué pasa con lo atrasado

- Lo que quedó del sprint 1 (`alinear-api-endpoints-v1` y el inicio de los changes del backlog) se absorbe en S2 y S3, como muestran las tablas.
- **Si `alinear-api-endpoints-v1` no se archiva el domingo 11**, el lunes 19 se dedica entero a cerrarlo antes de empezar los changes de S3. Ningún change del backlog se integra sobre un contrato a medias.
- Si un change no cumple la definición de «hecho» al cierre de su sprint, pasa al siguiente y la célula lo informa en la planificación. En S4 eso significa que **sale del MVP** y pasa a S5.

## CI/CD

**Lo que ya existe:**
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) corre en cada PR y en cada push a main con los jobs API, IA, Web y OpenSpec, más el job de **migraciones en PostgreSQL** (`ci-migraciones-postgresql`, PR #41 y #46).
- **CD 1**: imágenes en GHCR en cada merge a main con CI en verde, y `/health` con commit y release (PR #37 y #38, [ADR-014](adr/ADR-014-pipeline-despliegue-ambientes.md)).

**Lo que falta:**

| Sprint | Pieza | Responsable | Respaldo |
|---|---|---|---|
| S2 | Marcar «Migraciones (PostgreSQL)» como check requerido de `main` y archivar el change | Josué Moreno | `ci-migraciones-postgresql` 5.4 y 5.5 |
| S2 – S3 | **CD 2:** `scripts/deploy.sh` y despliegue automático por *pull* en la EC2 de AWS Academy | Manuel Barrantes | `despliegue-vm-y-respaldos` 2.2 y 6.3; `pipeline-despliegue-ambientes` 3.1–3.4 |
| S3 | Compose de producción y proxy con HTTPS | Manuel Barrantes, Álvaro Vargas | `despliegue-vm-y-respaldos` 1.1–1.3 |
| S4 | Almacenamiento de objetos del ambiente de calidad con CORS para la subida directa de fotos (individual y masiva) | Manuel Barrantes | `fotografias-multiples-por-pieza` 4.1; `importacion-masiva-fotografias` 7.2 |
| S4 | Pruebas de humo contra el entorno desplegado y versión `v0.1.0` | Josué Moreno | `pipeline-despliegue-ambientes` 4.1–4.3 |
| S5 | Respaldos cifrados, simulacro de restauración y VM PUCP | Álvaro Vargas, Manuel Barrantes | `despliegue-vm-y-respaldos` 3.x, 4.1 y 5.x |

**Almacenamiento de fotos:** con unas 25 000 imágenes, los originales ocuparían de 75 a 200 GB. `importacion-masiva-fotografias` agrega `MEDIA_KEEP_ORIGINALS` para guardar solo las versiones web (unos 8 GB) si la cuota de la PUCP no alcanza (pregunta L2). Para el MVP basta con los datos sintéticos.

## Definición de «hecho» de un change

Un change cuenta como hecho en su sprint solo si:

1. Todas sus tareas están marcadas `- [x]` y cada una tiene su prueba.
2. El PR está integrado en main con CI en verde y aprobación del revisor.
3. Está verificado contra PostgreSQL (con Docker o con el job de migraciones de CI), si toca la base de datos.
4. OpenAPI y el cliente tipado están actualizados, si toca la API.
5. **Está desplegado en el ambiente de calidad** (el commit del merge aparece en `/health`) y **su pantalla funciona ahí**, comparada con la del prototipo v3, si el change tiene pantalla en el prototipo.
6. Tiene su sección en el manual de usuario, si cambia una pantalla (puede hacerse en S5 a S7).
7. Está archivado (`openspec archive`) en un PR aparte.

## Ritmo de trabajo (S2 a S4)

| Cuándo | Qué | Duración |
|---|---|---|
| Primer día del sprint (jue 8, lun 19, lun 26) | Planificación: revisar el tablero, mover lo pendiente y confirmar lo de cada persona | 20 min |
| Todos los días | Seguimiento asíncrono en el canal: qué integré, qué integro hoy, qué me bloquea | — |
| Jueves 22 | Control a mitad de sprint de la cadena de importación (ver S3) | 15 min |
| Último día del sprint | Revisión **sobre el ambiente de calidad**: cada célula recorre su pantalla del prototipo con la versión desplegada | 30 min |

## Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| El sprint 1 no produjo integraciones; quedan unos 18 días útiles para el MVP | Ritmo intenso con PR pequeños; S2 se dedica solo a cerrar el contrato; lo que no esté hecho al cierre de S4 sale del MVP |
| La cadena de importación (4 changes, unas 77 tareas) es la ruta crítica | La célula de IA se suma a Importación en S3 y S4; control a mitad de S3 con un recorte ya definido para `importacion-masiva-fotografias` |
| El museo no sabe cómo nombra sus fotos | Emparejamiento en tres vías y bandeja manual; pregunta L1 (pantallazo de una carpeta) |
| La cuota de nube de la PUCP no alcanza para unas 25 000 fotos | `MEDIA_KEEP_ORIGINALS=false` y aviso de cuota; pregunta L2 |
| «Cesión de uso» y «Custodia» no existen en el modelo de tenencia | Pregunta L5 en S2; mientras tanto se importan como datos de origen sin cambiar el régimen de tenencia |
| El prototipo v3 podría contener datos personales reales de los Excel del museo | Revisión de `prototipo-v3/js/data.js` en S2 y reemplazo por datos sintéticos (RNF-014) |
| Una semana sin trabajo a mitad del desarrollo (parciales) | S2 deja todo listo para arrancar el lunes 19: ramas creadas, changes leídos y el contrato cerrado |
| Pantalla «Configuración» sin change que la respalde | Decisión en la planificación del jueves 8: se cubre con `colecciones-y-vocabularios-admin` o se propone un change pequeño |
| Camilo Gomez con carga doble en S3 (dos changes de Catálogo, 32 tareas) | Sin revisiones de specs de Plataforma en S3; en el control del jueves 22, si `colecciones-y-vocabularios-admin` va por debajo del 50 %, su cierre pasa a S4 sin afectar la pantalla Ficha |
| Muchos PR del mismo change en S2 | Orden de integración de la tabla de S2; rebase sobre main antes de cada merge |
| Conflictos de migraciones Alembic entre células en S3 | Rebase y una sola cabeza, verificada en CI con PostgreSQL |
| Sin acceso a la VM PUCP | El MVP y la demo usan el ambiente de calidad (ADR-013) |
| El ambiente de calidad se apaga con cada sesión de AWS Academy (unas 4 h) o el despliegue automático no llega a tiempo | Responsable de encenderlo en revisiones y sesiones de QA; hasta el jueves 22 se despliega a mano con `deploy.sh`; `/health` confirma qué commit está vivo |
| La fecha de la demo no está confirmada | S6 a S8 son de documentación y reserva |

## Cómo se modifica este plan

- Cualquier cambio se acuerda en la planificación y se refleja en un PR pequeño `docs(plan): ...` sobre este archivo.
- Mover un change entre sprints o entre personas lo decide la célula con su líder. Agregar o quitar alcance se coordina con el Líder de Proyecto.
- El tablero de GitHub Projects y este archivo deben decir lo mismo. Si no coinciden, manda el tablero y se actualiza este archivo.

## Registro de cambios del plan

| Versión | Fecha | Cambio |
|---|---|---|
| 1 | 2026-09-28 | Base inicial: 6 sprints semanales, validación con el cliente al cierre del sprint 4 y demo en el sprint 6 |
| 2 | 2026-09-28 | Los 11 integrantes con trabajo todas las semanas (`alinear-api-endpoints-v1` repartido); tabla de carga por persona; sección de CI/CD |
| 3 | 2026-09-28 | Change `ci-migraciones-postgresql`; despliegue continuo al entorno de integración de AWS Academy en cada merge a main |
| 4 | 2026-09-28 | Sprint 0 de adaptación al flujo (una tarea por persona, sin Mathias Medina por la presentación del proyecto) |
| 5 | 2026-09-28 | Sprints de jueves a miércoles 23:59; tareas del sprint 0 independientes entre sí; fin del desarrollo el 4 de noviembre y demo el 23 de noviembre [SUPUESTO] |
| 6 | 2026-09-28 | Sprint 0 centrado en aprender el flujo: reglas paso a paso, acompañantes; `develop` → `main` pasa a preparación del Arquitecto; `ci-migraciones-postgresql` repartido entre Josué Moreno y Sergio Huamán |
| 7 | 2026-10-07 | Validación hecha con el prototipo v3; MVP = prototipo v3 funcional al 31 de octubre; semana de parciales sin trabajo (12 al 18 de octubre); S3 y S4 de lunes a domingo; change nuevo `importacion-masiva-fotografias`; IA y préstamos fuera del MVP (por confirmar); refuerzo de Importación con la célula de IA; ambiente de calidad (staging AWS Academy) con hitos por sprint, revisiones sobre calidad y despliegue en calidad como parte de la definición de «hecho»; Camilo Gomez sin trabajo en S2 y con carga doble en S3 (2.2 → Sergio Chumbimuni, 4.1 → Josué Moreno, 6.3 → Germán Asenjo); regla explícita de trabajo semanal para todos, alternativas en S5 y S6, S7 y S8 detallados por semana |
