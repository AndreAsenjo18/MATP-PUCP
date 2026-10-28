> Segundo rediseño de UX por vista (después de `rediseno-ux-importacion`). Solo frontend y copia; sin cambios de API ni de reglas de fusión. Se prueba con el seed (18 pares de catálogo) en Docker local.

## 1. Textos

- [x] 1.1 Reescribir a una o dos frases los textos de `DuplicateReview.tsx`, `app/duplicados/page.tsx`, `MergeWizard.tsx`, `merge-plan.ts` y `duplicates.ts` sin `RF-`/`RN-`/`RNF-` ni nombres de capacidad, y pasar los mensajes de la API por `plainMessage`; actualizar las pruebas que comparan esos textos y verificar con `npx vitest run src/components/domain src/lib/data` (Req: Lenguaje llano sin identificadores de requisitos en duplicados y fusión)
- [x] 1.2 Prueba que renderiza la cola, los diálogos y los tres pasos de la fusión y falla si el texto contiene un identificador de requisito (Req: Lenguaje llano sin identificadores de requisitos en duplicados y fusión)

## 2. Cola de pares

- [x] 2.1 `SimilarityMeter` (anillo, cifra grande, nivel en texto) y encabezado de la tarjeta con denominaciones, códigos y estado; pruebas de los tres niveles y de la ausencia de color como único portador (Req: Comparación de pares con la similitud destacada)
- [x] 2.2 `rowState` puro y `ComparisonTable` centrada con A | campo | B, texto pequeño, verde/ámbar/rojo con palabra e icono, y apilado bajo 640 px; pruebas de igual, distinto, conflicto, vacío y ficha no disponible (Req: Comparación de pares con la similitud destacada)
- [x] 2.3 `SignalList` con etiquetas cortas y detalle plegado; prueba de las etiquetas y del `<details>` cerrado (Req: Comparación de pares con la similitud destacada)
- [x] 2.4 `QueuePager` arriba y abajo de la lista, oculto con una sola página; pruebas de ambos y de la página única (Req: Paginación de la cola arriba y abajo)

## 3. Fusión

- [x] 3.1 `PieceCodes` en los pasos 1, 2 y 3 con el código I, los otros códigos y los históricos marcados, y «Sin código I»; pruebas de pieza con códigos, con históricos y sin ninguno (Req: Códigos a la vista durante la fusión)
- [x] 3.2 Diálogo con cuerpo desplazable y pie fijo, textos cortos, y paso 3 con el motivo arriba en móvil y al lado en escritorio y el detalle de la absorbida plegado; pruebas del orden del motivo, de la cabecera fija y del motivo vacío (Req: Fusión en un diálogo compacto con el motivo a la vista)

## 4. Documentación y verificación

- [x] 4.1 Actualizar `docs/manual-usuario/calidad-datos.md` (similitud, colores, paginación, códigos y motivo en la fusión) (Req: todos)
- [x] 4.2 Verificar en el navegador con el seed a 1280, 768 y 360 px: cola, paginación superior, fusión de un par con códigos (hasta el paso 3) y marcar uno como distinto; comprobar `npm test:web`, `npm run lint` y `openspec validate --all --strict`
  - Hecho (2026-10-27) en Docker local con el seed: cola con los 18 pares de catálogo, paginación arriba y abajo, fusión hasta el paso 3 (motivo al lado en 1280 px y arriba en 375 px, sin desplazamiento horizontal) y «Marcar como distinto» con su motivo obligatorio. No se confirmó una fusión real para no alterar los datos del seed.
