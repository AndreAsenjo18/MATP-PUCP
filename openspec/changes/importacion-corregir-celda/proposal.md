## Why

En el ensayo con el Excel real de la colección ACG (2026-11-17), la fila 34 trae el código I «I.-1814»:
una errata (un punto y un guion) que el normalizador, con razón, no reconoce. Hoy la única salida es
corregir el Excel y volver a subirlo, o dejar la fila fuera. El equipo decidió no relajar las reglas de
normalización para aceptar erratas: la persona debe poder corregir el valor en la misma revisión.

## What Changes

- En una fila con errores, **«Corregir el valor»**: se elige la columna (por defecto, la del valor que
  cita el error), se escribe el valor corregido y **«Guardar y validar de nuevo»**.
- El archivo original no cambia. La fila guarda el valor original de cada celda corregida, con quién
  y cuándo, y el cambio queda auditado (RN-005). «Ver datos del archivo» muestra lo que decía el
  archivo en una celda corregida.
- El lote se valida de nuevo con la validación de siempre: la clasificación de una fila depende de las
  demás (el mismo código I dos veces). Antes de guardar se avisa si se perderán decisiones ya tomadas.
- Las claves internas de la fila (`__merged`, `__corrections`) nunca pasan al registro de origen de la
  pieza ni al texto que se envía a la IA.

## Impact

- Capacidad `importacion-datos` (requirement nuevo).
- API: `PATCH /imports/{batch_id}/rows/{row_id}/cells` (operación añadida), `imports/corrections.py`;
  filtro de claves internas en `mapping.py`.
- Web: `correctImportCell`, `errorColumn`, `cellCorrections`; `CellCorrectionForm` en `ImportRowCard`;
  `LiveImportWizard`.
