# Manual de usuario (en construcción)

Manual para el personal del museo (Administrador, Gestora de colecciones, Catalogadores, Conservación, Personal de depósito y Consulta interna). Se escribe **en español claro** (RNF-010) y **solo con capturas de datos sintéticos** (RNF-014).

Cada change del backlog tiene como tarea de cierre actualizar su sección. Mientras una sección no exista, la funcionalidad aún no está implementada: la maqueta navegable (modo simulado) permite verla, con el guion de [`../maqueta/recorrido-demo.md`](../maqueta/recorrido-demo.md).

| Sección | Archivo | Change que la escribe | Estado |
|---|---|---|---|
| Acceso: iniciar sesión, contraseña, sesión expirada | `acceso.md` | `autenticacion-y-matriz-permisos` | pendiente |
| Catálogo: alta, edición, conflictos, eliminación, corrección de código I, conservación | `catalogo.md` | `ficha-pieza-crud`, `colecciones-y-vocabularios-admin` | pendiente |
| Fotografías | `fotografias.md` | `fotografias-multiples-por-pieza` | pendiente |
| Depósito: vista móvil, movimientos y verificaciones | `deposito.md` | `ubicacion-jerarquica-y-movimientos` | pendiente |
| Importación de sábanas Excel/CSV y plantillas | `importacion.md` | `importacion-pipeline-reconciliacion`, `plantillas-mapeo-y-normalizacion` | pendiente |
| Calidad de datos: alertas, tablero, duplicados | `calidad-datos.md` | `alertas-y-reporte-incompletas`, `deteccion-duplicados-y-cola-revision` | pendiente |
| Búsqueda y exportación | `busqueda.md` | `busqueda-avanzada-y-exportacion` | pendiente |
| Reportes e impresión | `reportes.md` | `reportes-inventario` | pendiente |
| Auditoría, reversión y papelera | `auditoria.md` | `auditoria-y-soft-delete-transversal` | pendiente |
| Asistencia de IA | `ia.md` | `ia-extraccion-texto-libre`, `ia-sugerencia-terminos` | pendiente |
| Administración: usuarios, permisos, colecciones, vocabularios, ubicaciones, parámetros, respaldos | `administracion.md` | varios (ver cada change) | pendiente |

## Convenciones de redacción

- Instrucciones en pasos numerados, un verbo por paso ("Pulse **Guardar**").
- Nombres de botones y pantallas en **negrita**, tal como aparecen en la interfaz.
- Cada sección termina con "Si algo sale mal" (mensajes de error frecuentes y qué hacer).
- Sin jerga técnica (no "endpoint", "API", "soft-delete"; sí "se marca como eliminada y puede restaurarse").
