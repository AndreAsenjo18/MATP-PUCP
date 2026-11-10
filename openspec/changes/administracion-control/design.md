## Context

`TrashEntryList` y `AuditLogChangeSetList` pintan cada registro como una tarjeta con varias líneas. Los nombres de tipos vienen de `AUDIT_ENTITY_TYPES` (`lib/data/audit-query.ts`), de `TRASH_ENTITY_TYPES` (`lib/data/trash.ts`) y, en la papelera, del `type_label` que manda la API. Los procesos del sistema escriben su `actor_label` técnico (`auth.login`, `audit-digest`, `load_valuations`, `seed: plantillas`).

## Goals / Non-Goals

**Goals:** bajar el alto de Auditoría y Papelera a menos de la mitad; texto en el vocabulario del museo; sin cambiar API ni reglas.

**Non-Goals:** cambiar filtros, paginación (20 por página), restauración, reversión ni el detalle campo a campo.

## Decisions

### D1. Fila compacta con rejilla desde `lg`
Cada registro es un `li` con `grid` de cuatro columnas desde `lg` (qué · cuándo y quién · motivo · acción) y apilado por debajo. El motivo va en una línea con `truncate` y el texto completo en `title`. Las acciones mantienen su nombre («Restaurar», «Ver cambios») y su `aria-label` con el objeto. **Descartado:** una `<table>` (el panel de restauración y el detalle se abren debajo de la fila y en celular una tabla obliga a desplazarse de lado).

### D2. Nombres en el navegador
- Tipos de registro: se corrigen las etiquetas de `AUDIT_ENTITY_TYPES` y `TRASH_ENTITY_TYPES` y la papelera muestra la etiqueta local cuando conoce el tipo (la de la API queda de respaldo). Se añade `user_session` («sesión»).
- Procesos del sistema: `systemActorLabel` traduce los `actor_label` conocidos y deja los demás como están.

**Descartado:** cambiar los textos en la API (es otro contrato y otra célula; el navegador ya tiene la lista de tipos).

### D3. CSV plegado
`AuditLogExport` pasa a un `<details>` cerrado con el resumen «Descargar en CSV»; dentro, los dos botones y una frase.

### D4. Pestañas táctiles
Las pestañas de áreas y secciones usan `min-h-11` por debajo de `md` y `md:min-h-9` desde 768 px.

## Risks / Trade-offs

- [Motivo truncado] → el texto completo está en `title` y en el detalle; en celular no se trunca.
- [Pruebas que leen los textos antiguos] → se actualizan explicando el cambio en `tasks.md`.
