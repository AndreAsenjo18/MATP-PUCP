## Decisiones

- **D1. Piloto aislado.** Los tokens nuevos se añaden sin modificar los existentes, y solo el Inicio los usa. La tipografía de título se importa en la propia pantalla, no en `layout.tsx`, para que ninguna otra vista cambie. Al homologar se moverá al layout.
- **D2. Tipografía.** Fraunces Variable (serif moderna de trazo suave), autoalojada con Fontsource, solo para el título y los nombres de las dos tareas principales. El texto sigue en Inter.
- **D3. Color con función.** Un color por tipo de tarea: buscar (terracota), registrar (verde), cargar (añil), revisar (ámbar), reportes (ciruela), configuración (piedra). El color nunca va solo: cada tarea tiene icono y nombre.
- **D4. Motivo.** Rombo escalonado de tejido, dibujado para este proyecto en SVG. Es decorativo y se oculta a los lectores de pantalla.
- **D5. Resumen.** El total deja de ser enlace, porque repetía «Buscar una pieza»; las dos fichas de faltantes siguen llevando a la búsqueda filtrada. «Sin código I» pasa a «sin código de inventario» solo en el Inicio.

## [SUPUESTO]

La paleta y el motivo no son identidad oficial de la Dirección de Cultura (pregunta J1 de `docs/preguntas-contraparte.md`). El nombre del museo es el de `CLAUDE.md`.
