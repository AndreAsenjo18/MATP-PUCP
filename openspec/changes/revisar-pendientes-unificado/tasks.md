> Corrección C26 (HU-29, HU-04). Paquete P2. Solo frontend, manual y supuestos; sin cambios de API ni de reglas de negocio. Antes de empezar: avisar a P4 de la tarea 1.3 (mueve su página sin cambiarla) y enviar a la Base la petición del menú del proposal.

## 1. Preparación

- [ ] 1.1 Leer en `apps/web/node_modules/next/dist/docs/` la guía de layouts anidados, `redirect` y `useSearchParams` de esta versión, y anotar en esta tarea lo que difiera del patrón de `app/deposito/page.tsx`. Verificación: nota escrita aquí (design D1, D6).
- [ ] 1.2 Mover `DuplicateQueue` de `app/duplicados/page.tsx` a `components/domain/DuplicateQueue.tsx` sin cambiar su comportamiento; `app/duplicados/page.tsx` la monta igual que antes. Verificación: `DuplicateReview.test.tsx` y `npx vitest run` en verde sin tocar expectativas (design D6).
- [ ] 1.3 Mover tal cual el contenido de `app/ia/sugerencias/page.tsx` (rama de demostración y `AiSuggestionsLive`) a `components/domain/AiSuggestionsQueue.tsx`, con la prop `embedded` que solo oculta su encabezado; PR pequeño separado con revisión de P4. Verificación: prueba de que con `embedded` no hay `h1` propio y sin ella se ve como hoy; pruebas existentes de sugerencias en verde (Req: Cola de sugerencias de IA dentro de la bandeja; design D6).

## 2. Bandeja y pestañas

- [ ] 2.1 Funciones puras `pendingTabs(hasPermission)` e `initialTab(visible, counts)` en `lib/data/pending.ts`. Verificación: pruebas unitarias para los tres permisos, uno solo, ninguno, primera pestaña sin pendientes y conteos `null` (Req: Bandeja única de pendientes con pestañas; design D2).
- [ ] 2.2 `fetchPendingCounts(devUser)` en `lib/data/pending.ts`: tres consultas existentes en paralelo con `page_size: 1`, sugerencias leyendo `total` de `GET /api/v1/ai/suggestions` sin tocar `lib/data/ai.ts`, demostración desde `useMockStore`, y `null` ante cualquier fallo. Verificación: pruebas con `fetch` simulado (los tres totales, uno que falla, modo demostración) (Req: Bandeja única… escenario «Total no disponible»; design D3).
- [ ] 2.3 `app/pendientes/layout.tsx` con el título «Revisar pendientes» y las pestañas como enlaces en `<nav aria-label="Pendientes">`, `aria-current="page"`, contador entre paréntesis solo si no es `null`, 16 px y 44 px. Verificación: prueba de render de pestañas por permiso, contadores, pestaña activa y navegación con teclado (Req: Bandeja única…; Req: Legibilidad de la bandeja de pendientes; design D1, D7).
- [ ] 2.4 `app/pendientes/page.tsx`: «Cargando…», luego redirección a `initialTab` o el aviso «Su rol no tiene pendientes que revisar». Verificación: prueba de los escenarios «Curador con los tres permisos», «La primera pestaña no tiene pendientes» y «Rol sin ninguno de los permisos».
- [ ] 2.5 Páginas `app/pendientes/duplicados`, `sugerencias` (con `AiSuggestionsQueue embedded`) e `incompletas` (con `IncompleteReportPanel`), cada una con `PermissionNotice` si falta el permiso y con aviso al layout para recalcular los contadores al resolver. Verificación: prueba de cada pestaña con y sin permiso, y de que una resolución vuelve a pedir los contadores (Req: Bandeja única… escenario «Pestaña sin permiso abierta por su dirección»; Req: Cola de sugerencias de IA dentro de la bandeja).

## 3. Duplicados compactos y etiquetas

- [ ] 3.1 Comprobar con qué permiso responde `GET /api/v1/identifier-types` (código de la API y prueba con un rol Curador del seed) y cargar los `label` en la pestaña de duplicados; si exige administración, quedarse con el mapa local. Verificación: resultado anotado en esta tarea y prueba de la carga (design D5, riesgo correspondiente).
- [ ] 3.2 `signalLabel` con un mapa `code → label` opcional, un mapa local de los seis tipos sembrados y «Otro dato» como caída; sin devolver `signal.field`. Verificación: pruebas con `identifier:INC_RN`, `author_provenance` y una señal desconocida `material_overlap`, y una prueba de render de que ningún nombre interno aparece en la lista ni en el detalle (Req: Etiquetas de las señales de duplicado en español; design D5).
- [ ] 3.3 `DuplicateCandidateRow`: denominaciones, código I o «Sin código I», colección, nivel en palabras, motivo principal y «Revisar» con `aria-expanded`; caso de fila de importación y de ficha no disponible; apilada a 360 px. Verificación: pruebas de cada escenario de «Lista compacta de posibles duplicados» salvo apertura y foco (Req: Lista compacta de posibles duplicados; design D4).
- [ ] 3.4 Un solo par abierto a la vez, que despliega la `DuplicateCandidateCard` actual con su `SimilarityMeter`; foco a la fila siguiente o al aviso tras resolver. Verificación: pruebas de «Abrir un par» y «Resolver el último par», y de que las pruebas vigentes de comparación, paginación y fusión siguen en verde (Req: Lista compacta…; requirement vigente «Comparación de pares con la similitud destacada»).
- [ ] 3.5 Subir a 16 px y 44 px los textos y controles de la cola, sus filtros y la tarjeta desplegada (sin tocar `MergeWizard` ni la pestaña de sugerencias). Verificación: prueba de clases en filas, filtros y botones, y recorrido a 150 % en 1366 × 768 sin desplazamiento horizontal (Req: Legibilidad de la bandeja de pendientes; design D7).

## 4. Redirecciones

- [ ] 4.1 Función pura `legacyPendingTarget(base, params)` que copia todos los parámetros. Verificación: pruebas con `/duplicados` sin parámetros, con varios y con `resaltar` (Req: Redirección de las direcciones antiguas a la bandeja).
- [ ] 4.2 `app/duplicados/page.tsx` y `app/ia/sugerencias/page.tsx` redirigen con el patrón de `app/deposito/page.tsx`. Verificación: prueba de cada página y comprobación en el navegador de que `/ia/sugerencias?resaltar=<id>` llega resaltada en los dos modos y de que un rol sin permiso ve el aviso de la bandeja (escenarios «Enlace que resalta una sugerencia» y «Dirección antigua sin permiso»).

## 5. Documentación y supuestos

- [ ] 5.1 Manual: sección nueva «Revisar pendientes» en `docs/manual-usuario/calidad-datos.md` (pestañas, contadores, fila compacta, «Revisar»); `ia.md` remite a la pestaña. Verificación: los nombres del manual coinciden con los de la pantalla.
- [ ] 5.2 Registrar en `docs/preguntas-contraparte.md` (sección nueva del change) los supuestos: un mismo lugar para los tres pendientes, el contador de incompletas como «piezas por completar» y los textos de los niveles de parecido. Verificación: sección añadida y enlazada desde la spec delta.
- [ ] 5.3 Avisar a P1 de que `identifierTypeLabel` (`status-intents.ts`) no traduce los tipos sembrados (`INC_RN` y otros llegan tal cual a la ficha y al asistente de fusión), y registrarlo como hallazgo de C19 en `docs/lista-maestra-funcionalidades.md`. Verificación: aviso enviado y línea añadida.

## 6. Cierre y prueba humana

- [ ] 6.1 Recorrido propio en Docker local con el seed, en modo conectado y en demostración, a 1366 × 768, 768 y 360 px, con Administrador, Curador y un rol de solo lectura. Tabla de antes y después (alto de la página de duplicados, palabras visibles, textos de menos de 16 px, nombres internos visibles, clics para resolver un par) y capturas para P5. Verificación: tabla y capturas en la nota de esta tarea.
- [ ] 6.2 **Prueba humana (no la hace el agente).** El humano prueba en su entorno local con datos sintéticos, sin manual, como alguien de 60 años o más que no conoce el sistema, diciendo en voz alta qué entiende, y el agente observa:
  - **HU-29:** «Encontrar lo que hay por revisar sin que nadie le diga dónde está.» Solo se cierra con la entrada «Revisar pendientes» de la Base ya en el menú; si aún no está, se prueba desde el Inicio y se anota la condición.
  - **HU-04:** «Resolver tres pares de posibles duplicados: uno distinto, uno pospuesto y uno fusionado. ¿Sabe qué pasa con cada pieza?»
  - Preguntas, en este orden: ¿qué esperaba ver al abrir la pantalla?, ¿era eso?; ¿en qué momento no supo qué hacer?, ¿qué palabra no entendió?; ¿cuántos clics le costó?, ¿sobró alguno?; ¿qué texto cambiaría o borraría?; ¿algún botón le pareció pequeño, lejano o parecido a otro?; ¿se equivocó?, ¿el sistema le dejó claro cómo corregirlo?
  - Lista de «los zapatos del usuario» (sección 1 de `docs/historias-de-usuario.md`), respondida una por una en el informe y con el motivo de cada una que no se cumpla:
    - (sí/no) Se entiende a primera vista: el título dice qué se hace aquí; hay una sola acción principal y se ve sin desplazarse.
    - (sí/no) Poco texto: un título y como máximo una línea de ayuda; sin siglas ni términos internos.
    - (sí/no) Pocas opciones a la vez: unas 7 o menos por pantalla; lo avanzado, plegado.
    - (sí/no) Legible: letra de 16 px o más; botones y campos de 44 px o más; contraste suficiente; no depende solo del color.
    - (sí/no) Mínimo de clics: la tarea frecuente se hace en 3 clics o menos.
    - (sí/no) Se perdona el error: confirmación en lenguaje llano antes de lo irreversible, «Deshacer» cuando se pueda, mensajes que dicen qué hacer.
    - (sí/no) Funciona con teclado, con la página ampliada al 150 % y en un portátil de 1366 × 768.
    - (sí/no) No se pierde lo escrito si la sesión caduca o se recarga la página (motivo de un rechazo o de posponer).
    - (sí/no) El humano la probó, la hizo sin ayuda y dijo qué le incomodó.
  - Verificación: informe con lo que encontró, lo corregido y lo pendiente; se corrige en este mismo change y se **repite la prueba** hasta que la haga de punta a punta sin trabarse. Solo entonces HU-04 y HU-29 pasan a «Revisada por un humano» en `docs/historias-de-usuario.md`.
- [ ] 6.3 `npm run lint:web`, `npx vitest run`, `npm run openapi:check` (debe seguir sin cambios) y `openspec validate --all --strict` en verde; PR `feat(pending): ...` con el change, los IDs cubiertos y la evidencia de 6.1 y 6.2. Tras aprobar el PR, `openspec archive revisar-pendientes-unificado -y`.
