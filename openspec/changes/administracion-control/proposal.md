## Why

Corrección C23 de `docs/lista-maestra-funcionalidades.md` (paquete P5, historias HU-24 y HU-26): Administración › Control mide 5 500 px en producción. Medido el 2026-11-10 con el seed en Docker local (1280 px, 20 registros por página):

| Sección | Alto | Palabras | Alto de cada registro |
|---|---|---|---|
| Auditoría | 5 136 px | 708 | 198 px |
| Papelera | 4 294 px | 566 | 170 px |
| Exportación completa | 800 px | 44 | — |

Además:

- Cada registro es una tarjeta de 4 a 6 líneas: tipo, fecha, persona, alcance, motivo y botón, uno debajo del otro.
- Textos técnicos a la vista: «auth.login» como persona, «1 registro de tipo user_session», «conjuntos de cambios», «Plantilla de mapeo», «Término de vocabulario», «(RN-005)».
- La exportación a CSV de la auditoría ocupa un bloque abierto con una explicación de tres frases, aunque casi nunca se usa.
- Las pestañas de Administración miden 36 px de alto también en celular (C28, HU-20).

## What Changes

- **Papelera y Auditoría en filas compactas**: en escritorio, una fila por registro con lo esencial (qué, cuándo y quién, motivo de una línea y la acción); en celular, una tarjeta corta.
- **Textos llanos**: nombres de tipos según el glosario (código de pieza, valor de una lista, lista de valores, formato de archivo, sesión), procesos del sistema con nombre legible («Inicio de sesión» en lugar de «auth.login»), «cambios» en lugar de «conjuntos de cambios», introducciones de una frase y sin `RN-`.
- **Exportar la auditoría a CSV** plegado («Descargar en CSV»).
- **Inicios de sesión ocultos por defecto** en la consulta y en el CSV (decisión del equipo del 2026-11-10: llenaban la lista), con la casilla «Mostrar los inicios de sesión» en «Más filtros». Requiere el parámetro `exclude_entity_type` en `GET /audit-logs`.
- **Filtros plegados en celular y tableta** en Auditoría y Papelera, con el mismo botón «Filtros (N activos)» de Búsqueda (decisión del 2026-11-10).
- **«Cambio» en lugar de «conjunto de cambios»** también en la pestaña de auditoría de la ficha y en la reversión (decisión del 2026-11-10). «Conjunto» es además un tipo de pieza («Conjunto», «Componente de conjunto»), así que la palabra se prestaba a confusión.
- **Pestañas de Administración** de 44 px en celular y compactas desde 768 px.
- Manual `docs/manual-usuario/auditoria.md` y `administracion.md` actualizados.

## Capabilities

### New Capabilities

### Modified Capabilities

- `auditoria-trazabilidad`: presentación compacta y en lenguaje llano de la papelera y de la consulta de auditoría.
- `plataforma`: pestañas de Administración táctiles en celular.

## Impact

- Frontend (`apps/web`) y manual, más un parámetro opcional añadido a `GET /audit-logs` (`exclude_entity_type`, sin valor por defecto en la API), registrado en `docs/api/mapeo-endpoints-v1.md`, con OpenAPI y cliente tipado regenerados. El mensaje de la API para una reversión repetida dice «cambio» en lugar de «conjunto de cambios».
- Sin cambios de reglas: nada se borra, restaurar sigue siendo solo del Administrador y revisa dependencias, y el detalle campo a campo y el enmascaramiento de datos sensibles no cambian. Los inicios de sesión siguen registrándose; solo se ocultan de la vista por defecto.
- Se conservan las direcciones (`?pestana=papelera`, `auditoria`, `exportacion`) y los nombres de las secciones.

## Fuera del change

- El menú lateral (dueño: la Base) y las secciones de Personas, Catálogo e Importación, salvo el alto de las pestañas.
