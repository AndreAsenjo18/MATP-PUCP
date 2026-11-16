## Why

El buscador de la cabecera del Inicio («Buscar una pieza») es una versión inferior del de la
pantalla Búsqueda: solo manda el texto como `?q=…`. Desde `busqueda-lenguaje-natural` (RIA-06)
Búsqueda ya entiende frases escritas o dictadas y las convierte en filtros. El equipo pidió el
2026-11-15 que el Inicio use esa misma capacidad, que se note que la búsqueda la hace una IA
(Gemini, el proveedor en producción) y que la trama de rombos de la cabecera tenga una animación
que no rompa el diseño.

## What Changes

- El buscador del Inicio pasa a ser **«Busque con sus propias palabras»**: acepta texto o dictado
  por voz y, al pulsar «Buscar» o terminar de dictar, interpreta la frase con
  `POST /api/v1/ai/interpret-search` y lleva a `/busqueda` con los filtros reconocidos en la
  dirección (el mismo formato que Búsqueda ya lee). Si la IA no responde o el sistema está en modo
  demostración, lleva a `/busqueda?q=<frase>` como hasta ahora.
- Una insignia **«Powered by Gemini»** junto al título del buscador y un borde con el degradado de
  Gemini alrededor de la caja. Tres ejemplos de frase que se pueden pulsar.
- La trama de rombos de la cabecera grande se dibuja como SVG y se anima: **se teje** al entrar
  (cada rombo dibuja su contorno y luego su nudo, en diagonal) y, **mientras Gemini interpreta**,
  una ola con el degradado de Gemini la recorre de derecha a izquierda. Con «reducir movimiento»
  activado no hay animación.

## Impact

- Capacidad afectada: `plataforma` (requirement nuevo sobre el buscador del Inicio, que se suma a
  «Inicio como guía de tareas» de `inicio-guia-de-tareas` sin modificarlo). Reutiliza RIA-06 de
  `busqueda-lenguaje-natural`; no agrega operaciones de IA ni cambios de API ni de base de datos.
- Frontend: `HomeGuide.tsx` (`HomeSearch`), `PageHeader.tsx` (trama animada solo en tamaño
  `grande`), `SearchPill.tsx` (variante con borde de IA), `globals.css` (animaciones),
  `SearchFilters.tsx` (el dictado por voz se comparte).
- RN-009 no aplica: la interpretación no se guarda; solo arma filtros que la persona ve y quita
  en Búsqueda.
