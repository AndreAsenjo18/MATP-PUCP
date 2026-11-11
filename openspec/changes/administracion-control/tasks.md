> Corrección C23 (paquete P5, HU-24 y HU-26) y pestañas táctiles de C28 (HU-20). Solo frontend y manual; sin cambios de API ni de reglas.

## 1. Filas compactas

- [x] 1.1 `TrashEntryList`: una fila por registro desde `lg` (nombre y tipo · eliminado por · motivo de una línea · «Restaurar») y tarjeta corta debajo, con «Restaurar» junto al nombre; prueba de rejilla (Req: Papelera y auditoría compactas y en lenguaje llano)
- [x] 1.2 `AuditLogChangeSetList`: una fila por cambio desde `lg` (acción · alcance · cuándo, quién y origen · «Ver cambios») con el motivo en una segunda línea; prueba de rejilla (Req: Papelera y auditoría compactas… — escenario «Página de auditoría en escritorio»)

## 2. Lenguaje llano

- [x] 2.1 Nombres del glosario en `AUDIT_ENTITY_TYPES`, `TRASH_ENTITY_TYPES` y `ENTITY_LABELS` de la ficha; la papelera prefiere la etiqueta local a la de la API; tipos desconocidos como «otro registro»; `user_session` como «sesión»; prueba (Req: Papelera y auditoría compactas… — escenarios «Inicio de sesión registrado» y «Papelera con un formato de archivo eliminado»)
  - Pruebas ajustadas por los nombres nuevos: `TrashEntryList`, `TrashFilterBar`, `AuditLogFilterBar`, `AuditLogChangeSetList`, `AuditChangeSetList`, `AuditLogPanel` y `audit-query`. Cada una sigue comprobando lo mismo con el texto nuevo; donde cambió el criterio (tipos desconocidos) hay un comentario.
- [x] 2.2 `systemActorLabel` para los procesos del sistema («Inicio de sesión», «Resumen diario de auditoría», «Carga de valorizaciones», «Datos iniciales», «Recuperación de cargas»); prueba
- [x] 2.3 Introducciones de una frase, sin `RN-005` (también en el panel de restauración), «cambios» en lugar de «conjuntos de cambios» en Administración; prueba con regex estricta en `ControlPlainLanguage.test.tsx`
- [x] 2.4 «Descargar en CSV» plegado, con «Un cambio por fila» y «Un campo por fila» (Req: Papelera y auditoría compactas… — escenario «Descargar la auditoría»)

## 3. Navegación

- [x] 3.1 Pestañas de áreas y secciones con `min-h-11` por debajo de `md`; prueba (Req: Pestañas de Administración táctiles en celular)
- [x] 3.2 La dirección refleja la sección elegida (`?pestana=`), hallazgo del recorrido: al cambiar de pestaña quedaba la sección anterior en la dirección
  - Sin prueba de render (usa `window.history`); verificado en el navegador.

## 5. Decisiones del equipo del 2026-11-10

- [x] 5.1 `exclude_entity_type` en `GET /audit-logs` (`AuditFilters`, lista, detalle y CSV); prueba de API con y sin el parámetro; OpenAPI y cliente tipado regenerados; parámetro registrado en `docs/api/mapeo-endpoints-v1.md` (Req: Inicios de sesión fuera de la consulta por defecto — escenario «API sin el parámetro»)
- [x] 5.2 Web: filtro `sessions` y casilla «Mostrar los inicios de sesión» en «Más filtros»; `hidesSessions` no oculta al filtrar por «Sesión» ni al pedir un cambio o registro concreto; la demostración aplica la misma regla; pruebas (Req: Inicios de sesión fuera… — escenarios «Consulta sin filtros» y «Pedir los inicios de sesión»)
  - Tres pruebas ajustadas porque la consulta sin filtros ahora lleva `exclude_entity_type=user_session` (`audit-query.test.ts` ×2, `AuditLogPanel.test.tsx`).
- [x] 5.3 Filtros de Auditoría y Papelera plegados por debajo de `lg` con `FiltersDrawer` (ganó un `id` por pantalla) (Req: Filtros plegados y una sola palabra… — escenario «Auditoría en el celular»)
  - Sin prueba de render propia: `FiltersDrawer` ya tiene la suya en `SearchLive.test.tsx`.
- [x] 5.4 «Cambio» en lugar de «conjunto de cambios» en la pestaña de auditoría de la ficha, la reversión, el aviso de movimientos, el mensaje de la API para una reversión repetida y el manual (Req: Filtros plegados y una sola palabra… — escenario «Revertir desde la ficha»)
  - Cinco pruebas ajustadas al texto nuevo (`AuditChangeSetList`, `AuditTrailPanel`, `AuditLogChangeSetList`, `RevertChangeSetPanel` ×2) y `audit.test.ts`. Pruebas de API de auditoría y reversión: 163 en verde.
- [ ] 5.5 Verificación en el navegador de 5.1 a 5.4 a 1280 y 375 px
  - Pendiente (2026-11-11): Docker Desktop se apagó antes de reconstruir la API y la web.
- [ ] 5.6 `npm run test:api:pg` (PostgreSQL en Docker) con la condición nueva `entity_type <> valor` de `exclude_entity_type`
  - Pendiente: las pruebas de API corrieron con la base de pruebas local, no con PostgreSQL. Requiere Docker.
- [ ] 5.7 Avisar a los dueños de lo que este change toca fuera de Control: P1 (pestaña de auditoría y reversión de la ficha: textos «cambio»), P2 (`FiltersDrawer` de `SearchFilters.tsx` ganó la prop opcional `id`, sin cambio de comportamiento) y Sergio y André (`exclude_entity_type` es un parámetro añadido al contrato, pendiente de su visto bueno como los demás añadidos)

## 4. Cierre

- [x] 4.1 Manual `docs/manual-usuario/auditoria.md` (papelera, consulta global, CSV) y `administracion.md` (dirección por sección, pestañas, título de la exportación)
- [x] 4.2 Recorrido en el navegador con el seed (Administrador, Docker local, modo conectado) a 1280, 768 y 375 px
  - 2026-11-10. Antes → después (20 registros por página):

    | Medida | Antes | Después |
    |---|---|---|
    | Auditoría a 1280 px | 5 136 px · 708 palabras · 198 px por registro | 2 631 px · 610 palabras · 91 px por fila |
    | Papelera a 1280 px | 4 294 px · 566 palabras · 170 px por registro | 2 034 px · 564 palabras · 61 px por fila |
    | Papelera a 768 px | — | 125 px por registro |
    | Auditoría y Papelera a 375 px | 206 y 186 px por registro | 177 y 165 px por registro |
    | Pestañas a 375 px | 36 px | 44 px (36 px desde 768) |
    | Textos técnicos visibles | «auth.login», «user_session», «(RN-005)» ×2, «conjuntos de cambios», «Plantilla de mapeo», «Término de vocabulario» | 0 |

  - Sin desplazamiento horizontal en los tres anchos. «Restaurar» abre su panel (no se confirmó ninguna restauración). La dirección cambia a `?pestana=auditoria` al elegir la pestaña.
  - **No verificado**: rol Gestor de colecciones (botón desactivado), restauración confirmada con dependencias, descargas CSV reales, detalle campo a campo abierto, teclado y lector de pantalla.
  - Los dos pendientes que se anotaron aquí (filtros en celular y «conjunto de cambios» en la ficha) se resolvieron en la sección 5.
- [ ] 4.3 `npm run lint:web`, `npx vitest run` y `openspec validate --all --strict` en verde; tras aprobar el PR, `openspec archive administracion-control -y`
  - Parcial (2026-11-11): lint web y API en verde, `openapi:check` al día, 1302 pruebas web en 99 archivos, 27 de 27 specs válidas. Falta el archivo tras aprobar el PR.
