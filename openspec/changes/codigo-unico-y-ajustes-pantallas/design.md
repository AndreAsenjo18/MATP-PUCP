## Context

`duplicados-solo-por-codigo` dejó la cola de duplicados solo para pares con un código compartido. El código I ya era
único (`_ensure_unique`, RN-002); los demás tipos no. La importación detectaba códigos I repetidos dentro de un lote,
pero no los demás. La ficha mostraba las fotos solo en su pestaña, a 420 px como máximo.

## Decisions

### D1. El código se comprueba donde una persona lo registra
`ensure_code_is_free` (servicio de identificación) busca otra pieza activa con el mismo `(tipo, valor normalizado)`,
vigente o histórico, y responde 409 `code_in_use` con la denominación de esa pieza. Se llama desde
`POST /pieces/{id}/identifiers`. El código I sigue con su propia regla (también cubre piezas eliminadas).

No se puso en `add_identifier`. La semilla sintética crea pares a propósito para la cola (ahora sin pantalla) y
cientos de pruebas los usan. Además, la importación ya decide en la validación: fallar al aplicar desharía el lote
entero.

### D2. En una carga, el conflicto llega antes de aplicar
- **Rutas de entrada:** una fila con un código de una pieza ya es actualización (una pieza) o conflicto (varias), por
  el matching multi-código.
- **Filas del mismo lote:** `_batch_conflicts` compara ahora todos los códigos del lote, no solo el I. Dos filas con
  un código igual quedan en conflicto entre sí, con el tipo del código.
- **Marcar como nueva (`_check_as_new`):** se rechaza si la fila trae un código de una pieza del catálogo
  (`code_in_use`; el código I conserva `inventory_code_in_use`), o si otra fila del lote con el mismo código ya va a
  entrar como nueva (`code_in_use_in_batch`). Una fila dejada fuera o rechazada no cuenta.

### D3. La foto principal en «Datos generales»
`PiecePrimaryPhoto` lee las fotos (`fetchPieceMedia`, igual en `mock` y `live`) y muestra la principal (o la
primera). Va a la derecha de los datos en pantallas anchas y arriba en un celular. Sin fotos, lo dice y lleva a
«Fotografías». La galería avisa al cambiar algo (`onChanged`) y la foto se vuelve a leer.

### D4. Visor con zoom propio, sin dependencias
`PhotoZoomViewer` es un `<dialog>` nativo, como los demás de la aplicación: «Esc» cierra y el foco vuelve.
- **Niveles:** van de la foto entera a seis veces, por pasos de ×1,5.
- **Controles:** botones de 44 px con nombre, rueda (oyente no pasivo), doble clic (2,5× o vuelta a la foto
  entera) y teclas «+», «−» y «0».
- **Recorrido:** la foto acercada se recorre arrastrándola o con las barras.

No se agregó una librería de visor: el caso es simple y el resto de los diálogos ya son nativos.

### D5. Vaciar un ambiente de pruebas fuera de la aplicación
El script vive en `scripts/mantenimiento/` y no en `apps/api/app`. No es una función del sistema (RN-005 sigue
intacta) y se corre a mano dentro del contenedor de la API, después del respaldo de siempre (`scripts/backup`).

- **Qué hace:** usa `TRUNCATE` en una transacción. Las tablas de solo inserción también rechazan `TRUNCATE`, así
  que se desactivan sus disparadores de usuario solo dentro de esa transacción y se reactivan antes de confirmar.
  Si alguno quedara desactivado, se deshace todo.
- **Qué conserva:** lo decide el equipo (2026-11-21): personas, listas y tipos de código. Se agrega la
  configuración (reglas de completitud, ajustes de calidad), sin la que el sistema no calcula alertas.
- **Plantillas:** se vacían. La API vuelve a crear las de los formatos del museo al arrancar.

## Risks / Trade-offs

- **Códigos históricos ajenos:** un código histórico de otra pieza también bloquea, aunque una numeración antigua
  pueda repetirse por casualidad. Se elige así porque es la misma definición de duplicado de
  `duplicados-solo-por-codigo` ([SUPUESTO LC6]).
- **Datos viejos:** las piezas que ya comparten códigos (datos anteriores a este change) no se corrigen solas. El
  ambiente de pruebas se vacía y la cola sigue en la API.
- **Lotes ya validados:** un lote validado antes de este change conserva su clasificación hasta validarlo de nuevo.
