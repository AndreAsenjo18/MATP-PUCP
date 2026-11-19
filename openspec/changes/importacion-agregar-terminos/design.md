## Context

`importacion-aplicar-vocabularios` dejó como aviso de la fila (`term_not_in_vocabulary`) cada valor que no
está en la lista, con su texto en el registro de origen, y resolvió las ubicaciones inexistentes con un
panel en la revisión (`GET`/`PUT /imports/{id}/locations`). Los términos no tenían ese panel.

## Decisions

### D1. Los valores no reconocidos se guardan por lista
`MappedRow.unmatched_terms` (en `mapped_data`) guarda, por vocabulario de la ficha o forma de adquisición,
los textos que no coincidieron. La vista previa los devuelve (`unmatched_terms`) y la ficha los muestra
con su texto en ámbar. Las filas validadas antes no lo tienen: aparecen al validar de nuevo.

### D2. Agregar el término desde la revisión
`GET /imports/{id}/terms` agrupa los textos por lista (las grafías que solo difieren en mayúsculas,
tildes o espacios cuentan como una) con cuántas filas los usan, y si la lista tiene un término
desactivado con ese nombre. `POST /imports/{id}/terms` con `{vocabulary, text}`: si hay un término
desactivado con ese nombre lo reactiva; si no, crea uno con el texto como nombre y un código derivado
(«Piedra de Huamanga» → `PIEDRA_DE_HUAMANGA`, con sufijo si ya existe). Luego deja el lote en «mapeado»
y la web lo valida de nuevo: el valor ya coincide sin correspondencias en el mapeo. Se usa el alta de
términos de siempre (`create_term`), auditada.

### D3. Permisos
Agregar a una lista es administrar vocabularios (RN-010): el endpoint exige `imports.prepare` **y**
`vocabularies.manage` (Administrador y Gestor de colecciones). Un catalogador ve el panel con el aviso
de pedirlo a quien administra las listas. [SUPUESTO] Abrirlo a los catalogadores es una decisión de la
contraparte.

### D4. Plantillas instaladas
`refresh_predefined_templates` iguala el mapeo guardado de cada plantilla real al del código; el anterior
queda en la auditoría (RN-005). Una edición hecha en Administración a esas plantillas se reemplaza.

## Risks / Trade-offs

- Validar de nuevo descarta las decisiones ya tomadas; la pantalla lo avisa, igual que con ubicaciones.
- Un valor con una errata («Ceramica » vs. «Cerámica») coincide igual (sin tildes ni mayúsculas); una
  errata real se corrige en la celda, no agregándola a la lista.
