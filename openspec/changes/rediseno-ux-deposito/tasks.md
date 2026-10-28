> Cuarto rediseño de UX por vista (después de Importación, Duplicados y Administración). Solo frontend; sin cambios de API ni de reglas. Se prueba en Docker local con el seed.

## 1. Plataforma: cierre de sesión y botón adaptable

- [x] 1.1 `Button` con `size="touch"` y prueba de sus clases (Req: Botones que se adaptan al dispositivo)
- [x] 1.2 `MainLayout`: botón de cierre solo desde `md` en el encabezado y bloque con nombre, rol y «Cerrar sesión»/«Cambiar de rol» en el panel del menú móvil, con una única función de salida; `MobileAccount` (nombre, rol y botón) en `layout/MobileAccount.tsx` con pruebas de render; el ocultamiento del botón del encabezado y el panel se verificaron en el navegador (Req: Cierre de sesión dentro del menú en pantallas angostas)

## 2. Destinos finales

- [x] 2.1 `finalLocations` y `filterDestinations` en `lib/data/locations.ts` (y el equivalente para `LOCATIONS` de demostración); pruebas de hojas, ruta, filtro sin acentos y vacío (Req: Destinos de movimiento limitados a lugares finales)
- [x] 2.2 `DestinationPicker` con buscador, lista de lugares finales con ruta, explicación y estado sin lugares; pruebas de render (Req: Destinos de movimiento limitados a lugares finales)

## 3. Nombre y código

- [x] 3.1 `CodeChip`, `PieceTitle` y `PieceResult` en `DepositoParts.tsx`; pruebas con y sin código I (Req: Nombre y código de la pieza destacados en Depósito)

## 4. Distribución

- [x] 4.1 `app/deposito/page.tsx` (modo demostración y conectado) con dos columnas desde `lg`, panel vacío, «Buscar otra pieza» en celular, tamaños de escritorio y copia corta; pruebas de render de las piezas compartidas (Req: Depósito aprovecha el ancho del escritorio)

## 5. Documentación y verificación

- [x] 5.1 `docs/manual-usuario/deposito.md` y `[SUPUESTO]` de destinos finales en `docs/preguntas-contraparte.md`
- [x] 5.2 Verificar en el navegador con el seed a 1280, 768 y 375 px: búsqueda, elegir pieza, mover a un lugar final, verificar, lote y cierre de sesión desde el menú; `npm run lint`, pruebas web y `openspec validate --all --strict`
  - Hecho (2026-10-27) en Docker local con el seed: modo demostración a 1280 y 375 px (resultados con nombre y código, panel, buscador de destinos «rack a», movimiento a un nivel, menú con «Cambiar de rol», sin desplazamiento horizontal) y modo conectado (búsqueda, destinos finales de la API, verificación, movimiento y envío de un lote). 768 px no se revisó (la pantalla de 751 px del panel usa el diseño de celular). No se probó una pieza sin ubicación. Tras la última prueba en el navegador solo se añadió limpiar el aviso anterior al iniciar cada acción (cubierto por tipos y lint, no por el navegador). Pruebas web: 953 en verde.
