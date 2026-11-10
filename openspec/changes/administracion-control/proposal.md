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
- **Pestañas de Administración** de 44 px en celular y compactas desde 768 px.
- Manual `docs/manual-usuario/auditoria.md` y `administracion.md` actualizados.

## Capabilities

### New Capabilities

### Modified Capabilities

- `auditoria-trazabilidad`: presentación compacta y en lenguaje llano de la papelera y de la consulta de auditoría.
- `plataforma`: pestañas de Administración táctiles en celular.

## Impact

- Solo frontend (`apps/web`) y manual. Sin cambios de API, contrato ni reglas: nada se borra, restaurar sigue siendo solo del Administrador y revisa dependencias, y el detalle campo a campo y el enmascaramiento de datos sensibles no cambian.
- Se conservan las direcciones (`?pestana=papelera`, `auditoria`, `exportacion`) y los nombres de las secciones.

## Fuera del change

- Ocultar por defecto los inicios de sesión en la auditoría (cambia qué se consulta; se propone al museo).
- El menú lateral (dueño: la Base) y las secciones de Personas, Catálogo e Importación, salvo el alto de las pestañas.
