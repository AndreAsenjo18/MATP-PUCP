## 1. Piezas compartidas

- [x] 1.1 `GeminiBadge`/`GeminiStar` a `components/ui/GeminiBadge.tsx` (usado por Inicio y Búsqueda) y texto del botón configurable en `SearchPill` (D3)
- [x] 1.2 `PageHeader`: `tramaAnimada` y `debajo` en la cabecera compacta, con prueba (D4, RNF-001)

## 2. Búsqueda

- [x] 2.1 `AiSearchBox`: caja de IA en la banda que interpreta al enviar o dictar, reemplaza filtros y avisa; con prueba (D3, RIA-06)
- [x] 2.2 `SearchBox` compacta «Código o nombre» con dictado que solo escribe texto y ayuda en un ícono (RF-032)
- [x] 2.3 `SearchFilterBar`: píldoras con `<select>` superpuesto, píldoras de filtros secundarios activos, «Más filtros» con contador y «Limpiar»; con prueba (D1, RF-038, RNF-010)
- [x] 2.4 Panel «Más filtros» en `<dialog>` con «La pieza», «Dónde está» y «Origen, época y ficha», y «Ver N piezas»; la píldora Ubicación lo abre en «Dónde está» (D2)
- [x] 2.5 `SearchLive` usa la caja de IA, la barra y el panel; se quitan «Ver por ubicación» y la fila de etiquetas activas

## 3. Cierre

- [x] 3.1 `npm run lint:web`, `npm run test:web` y `openspec validate --strict` en verde
- [x] 3.2 Manual de usuario (`docs/manual-usuario/busqueda.md`): barra de filtros, panel y caja de IA
- [ ] 3.3 `openspec archive busqueda-barra-compacta-ia -y` tras aprobar el PR (ajustar antes el requirement de `busqueda-lenguaje-natural`)
