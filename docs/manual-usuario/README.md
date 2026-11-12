# Manual de usuario (en construcción)

Manual para el personal del museo (Administrador, Gestora de colecciones, Catalogadores, Conservación, Personal de depósito y Consulta interna). Se escribe **en español claro** (RNF-010) y **solo con capturas de datos sintéticos** (RNF-014).

Cada change del backlog tiene como tarea de cierre actualizar su sección. Mientras una sección no exista, la funcionalidad aún no está implementada: la maqueta navegable (modo simulado) permite verla, con el guion de [`../maqueta/recorrido-demo.md`](../maqueta/recorrido-demo.md).

| Sección | Archivo | Change que la escribe | Estado |
|---|---|---|---|
| Acceso: iniciar sesión, contraseña, sesión expirada | `acceso.md` | `autenticacion-y-matriz-permisos` | escrita |
| Catálogo: alta, edición, conflictos, códigos, eliminación y restauración, conservación, registro a mano de piezas seguidas | `catalogo.md` | `ficha-pieza-crud`, `colecciones-y-vocabularios-admin`, `crud-manual-completo` | escrita |
| Fotografías: agregar, ordenar, principal, retirar y restricciones | `fotografias.md` | `fotografias-multiples-por-pieza` | escrita |
| Depósito: ahora en la Búsqueda (nota con los enlaces) | `deposito.md` | `ubicacion-jerarquica-y-movimientos`, `fusion-busqueda-deposito` | escrita |
| Importación de sábanas Excel/CSV y plantillas | `importacion.md` | `importacion-pipeline-reconciliacion`, `plantillas-mapeo-y-normalizacion` | parcial: asistente, aprobación, bitácora e imágenes (`importacion-pipeline-reconciliacion`); faltan plantillas y reversión |
| Cargar el histórico del museo (formatos reales, orden de carga, qué revisar) | `carga-historico.md` | `formatos-reales-importacion` | escrita |
| Importar el archivo fotográfico a piezas existentes | `importacion-fotos.md` | `importacion-fotos-a-catalogo` | escrita |
| Descarga masiva de fotografías en un paquete ZIP | [`descarga-masiva-fotos.md`](descarga-masiva-fotos.md) | `descargas-masivas-y-enriquecimiento-lote` | parcial: la descarga de fotos, que aún no tiene pantalla; la revisión de borradores de IA por lote llegará con la sección 3 del change |
| Calidad de datos: revisar pendientes, alertas, tablero, duplicados | `calidad-datos.md` | `alertas-y-reporte-incompletas`, `deteccion-duplicados-y-cola-revision`, `revisar-pendientes-unificado` | escrita |
| Búsqueda: filtros, verificar y mover piezas, exportación | `busqueda.md` | `busqueda-avanzada-y-exportacion`, `fusion-busqueda-deposito` | escrita |
| Reportes, vista previa e impresión | `reportes.md` | `reportes-inventario`, `reportes-por-atributo` | hecho (sin valorización) |
| Auditoría, reversión y papelera | `auditoria.md` | `auditoria-y-soft-delete-transversal` | hecho |
| Asistencia de IA | `ia.md` | `ia-extraccion-texto-libre`, `ia-sugerencia-terminos` | parcial: la pantalla de ejemplos de demostración (fuera del MVP, `rediseno-ux-sugerencias-ia`); falta el uso con un proveedor real |
| Administración: usuarios, permisos, colecciones, vocabularios, ubicaciones, parámetros, respaldos | `administracion.md` | varios (ver cada change) | parcial: «Copias de seguridad del sistema» (`despliegue-vm-y-respaldos`), «Usuarios y permisos» (`autenticacion-y-matriz-permisos`), «Ubicaciones» (`ubicacion-jerarquica-y-movimientos`) «Versión del sistema y actualizaciones» (`pipeline-despliegue-ambientes`) y «Colecciones, vocabularios y tipos de identificador» (`colecciones-y-vocabularios-admin`) |

## Cómo moverse por el sistema

- **Inicio** le pregunta **¿Qué desea hacer?** y le muestra tarjetas grandes con la tarea (**Buscar una pieza**, **Registrar una pieza nueva**, **Cargar datos o fotos**, **Revisar pendientes**, **Sacar un reporte**, **Configuración**). Cada tarjeta aparece solo si su rol puede hacer esa tarea; en **Revisar pendientes** se ve el número de elementos por revisar cuando hay alguno.
- **En computadora**: las secciones (Inicio, Búsqueda, Importación, Revisar pendientes, Reportes, Administración) están en la **barra lateral oscura** de la izquierda. La sección en la que está aparece resaltada. Para verificar o mover piezas use **Búsqueda**: la antigua Vista de depósito se unió a ella. Duplicados y Sugerencias de IA ahora son pestañas de **Revisar pendientes**; mientras el menú no se actualice, sus entradas llevan ahí.
- **En teléfono o tablet**: pulse **Menú** arriba a la izquierda para ver las secciones; el menú se cierra al elegir una sección, al pulsar **Cerrar menú** o con la tecla Escape.
- Solo aparecen las secciones que su rol permite usar.
- Los colores tienen siempre el mismo significado y van acompañados de texto: verde = correcto o aprobado; terracota claro = comodato o préstamo; ámbar = falta información o está pendiente de revisión; rojo = conflicto, rechazo o error.

## Convenciones de redacción

- Instrucciones en pasos numerados, un verbo por paso ("Pulse **Guardar**").
- Nombres de botones y pantallas en **negrita**, tal como aparecen en la interfaz.
- Cada sección termina con "Si algo sale mal" (mensajes de error frecuentes y qué hacer).
- Sin jerga técnica (no "endpoint", "API", "soft-delete"; sí "se marca como eliminada y puede restaurarse").
