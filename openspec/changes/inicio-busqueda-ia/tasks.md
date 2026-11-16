## 1. Buscador con IA en el Inicio

- [x] 1.1 Extraer el dictado de `SearchBox` a `useVoiceDictation` y usarlo en Búsqueda sin cambiar su comportamiento (D3, RIA-06)
- [x] 1.2 `homeSearchTarget`: arma `/busqueda?<filtros>` desde la interpretación o `/busqueda?q=` si no hay filtros, con prueba unitaria (D1, RF-032)
- [x] 1.3 `HomeSearch` interpreta al enviar o al terminar de dictar, muestra el estado y navega; insignia «Powered by Gemini», borde de IA en `SearchPill` y ejemplos de frase, con prueba de componente (D1, D2, D5, RF-035)

## 2. Trama animada

- [x] 2.1 `TramaRombos` en SVG para la cabecera grande con estados `tejiendo` / `quieta` / `pensando` y animaciones en `globals.css`, sin animación con `prefers-reduced-motion` (D4, RNF-001)

## 3. Cierre

- [x] 3.1 `npm run lint:web`, `npm run test:web` y `openspec validate --strict` en verde
- [x] 3.2 Sección del manual de usuario (`docs/manual-usuario/busqueda.md`): buscar desde el Inicio
- [ ] 3.3 `openspec archive inicio-busqueda-ia -y` tras aprobar el PR
