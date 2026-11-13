## 0. Inventario

- [x] 0.1 Inventario de pantallas, rutas y componentes base, y lista de qué se reutiliza, reemplaza y elimina del piloto, en `docs/remodelacion-visual.md`
- [x] 0.2 Capturas y mediciones «antes» en los siete anchos (320, 683, 911, 1366, 1920, 2560 y 3200 px)
- [x] 0.3 `docs/propuestas-ux-para-sergio.md` para anotar mejoras de experiencia y textos sin aplicarlas

## 1. Base

- [ ] 1.1 Limpieza del piloto: Manrope en el layout raíz, regla global de títulos, sin Fraunces, Poppins, cenefa ni `span` provisional; retirar el change del piloto (Req: Tipografía e iconos disponibles sin internet; RNF-008)
- [ ] 1.2 Tokens: escala de letra con mínimo de 16 px, radios, sombras, ancho máximo y par crema sobre terracota, con sus pruebas (Req: Sistema de diseño institucional con tokens y contraste accesible; RNF-010)
- [ ] 1.3 Átomos con el estilo B: `Button` (44 px en todos los tamaños), `Badge`, `Card`, `Field`, `Input`, `Select`, `Textarea`, `IconCircle`, `StatChip` y la superficie; estilos de base para diálogos, casillas, tablas y foco (Req: Botones que se adaptan al dispositivo; Identidad visual «Cabecera audaz»)
- [ ] 1.4 Estructura: menú flotante con la cuenta al pie, botón «Menú» bajo 1024 px con foco atrapado, sin franja superior, contenedor con ancho máximo, nombres de tarea en el menú y cabecera en dos variantes (Req: Navegación principal con barra lateral responsive; Cuenta de la persona al pie del menú; Barra lateral de navegación retraíble)
- [ ] 1.5 Verificación en los siete anchos de todas las pantallas, pruebas del módulo, lint, `tsc`, `openspec validate --strict` y `openapi:check`

## 2. Pantallas por grupos

- [ ] 2.1 Inicio y Búsqueda (Req: Identidad visual «Cabecera audaz»; D8)
- [ ] 2.2 Ficha: alta, vista y edición de pieza
- [ ] 2.3 Revisar pendientes: duplicados, sugerencias y piezas incompletas
- [ ] 2.4 Importación e importación de fotos
- [ ] 2.5 Reportes, incluida la vista de impresión
- [ ] 2.6 Administración: Personas, Catálogo, Importación y Control (Req: Controles compactos con color e icono en Administración)
- [ ] 2.7 Acceso, cambio de contraseña y estado de los servicios

Cada grupo cierra con la auditoría de web-design-guidelines, sus correcciones y la verificación en los siete anchos.

## 3. Cierre

- [ ] 3.1 Barrido de consistencia, capturas «después», `docs/guia-visual.md` en la dirección B y reemplazo de las capturas del piloto
- [ ] 3.2 Prueba humana con la lista de «los zapatos del usuario» (la hace el equipo; no se marca ninguna historia como revisada por un humano)
- [ ] 3.3 Alinear los nombres del menú con `inicio-guia-de-tareas` antes de archivar cualquiera de los dos
- [ ] 3.4 Tras aprobar el PR: `openspec archive remodelacion-visual -y`
