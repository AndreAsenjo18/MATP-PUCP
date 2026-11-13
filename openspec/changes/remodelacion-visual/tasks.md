## 0. Inventario

- [x] 0.1 Inventario de pantallas, rutas y componentes base, y lista de qué se reutiliza, reemplaza y elimina del piloto, en `docs/remodelacion-visual.md`
- [x] 0.2 Capturas y mediciones «antes» en los siete anchos (320, 683, 911, 1366, 1920, 2560 y 3200 px)
- [x] 0.3 `docs/propuestas-ux-para-sergio.md` para anotar mejoras de experiencia y textos sin aplicarlas

## 1. Base

- [x] 1.1 Limpieza del piloto: Manrope en el layout raíz, regla global de títulos, sin Fraunces, Poppins, cenefa ni `span` provisional; retirar el change del piloto (Req: Tipografía e iconos disponibles sin internet; RNF-008)
- [x] 1.2 Tokens: escala de letra con mínimo de 16 px, radios, sombras, ancho máximo y par crema sobre terracota, con sus pruebas (Req: Sistema de diseño institucional con tokens y contraste accesible; RNF-010)
- [x] 1.3 Átomos con el estilo B: `Button` (44 px en todos los tamaños), `Badge`, `Card`, `Field`, `Input`, `Select`, `Textarea`, `IconCircle`, `StatChip` y la superficie; estilos de base para diálogos, casillas, foco y realce al tocar (Req: Botones que se adaptan al dispositivo; Identidad visual «Cabecera audaz»)
- [x] 1.4 Estructura: menú flotante con la cuenta al pie, botón «Menú» bajo 1024 px con foco atrapado, sin franja superior, contenedor con ancho máximo y nombres de tarea en el menú (Req: Navegación principal con barra lateral responsive; Cuenta de la persona al pie del menú; Barra lateral de navegación retraíble)
- [x] 1.5 Verificación en los siete anchos de todas las pantallas, pruebas del módulo, lint, `tsc`, `openspec validate --strict` y `openapi:check`
- [x] 1.6 Corrección del menú en ventanas bajas: alto de la ventana y fijo, secciones con desplazamiento propio solo si no caben, pie compacto siempre alcanzable, barra fina sin carril claro y «Contraer menú» pegado a la lista. Verificado con ventanas de 600, 720, 768 y 900 px y zoom de 150 % y 200 % (Req: Navegación principal con barra lateral responsive; Cuenta de la persona al pie del menú)
- [x] 1.7 Segunda corrección: listas desplegables sin aspecto nativo y con contorno de foco completo; comprobación del foco de todos los campos en 23 pantallas; mismo margen del menú en Administración; «desde el menú» en los avisos de cambio de rol; `inicio-guia-de-tareas` alineado con los nombres del menú (Req: Sistema de diseño institucional con tokens y contraste accesible)

## 2. Pantallas por grupos

- [x] 2.1 Inicio según la maqueta B y `PageHeader` en sus dos variantes (grande y compacta), aplicada a Buscar, la ficha (vista, alta y edición), Revisar pendientes, Importación, Reportes y Administración; menú con el rombo de la marca e iconos de la maqueta; enlaces «Volver» de 44 px; comparación de capturas a 1366 × 768, 150 % y 50 %; verificación en los siete anchos y auditoría web-design-guidelines (Req: Identidad visual «Cabecera audaz»; D2, D3, D7, D8)
- [x] 2.1b Cuerpo de Buscar según la maqueta B: tarjeta de filtros con el buscador en píldora y listas de 52 px, y resultados en filas enlazadas, en los dos modos (Req: Identidad visual «Cabecera audaz»)
- [x] 2.2 Ficha según la maqueta B: «Volver» y las insignias en la banda (también en alta y edición), acciones con «Eliminar pieza» discreta en ladrillo, color destructivo ladrillo, datos generales en los grupos del formulario y un solo estilo de pestañas en todo el sistema (ficha, Revisar pendientes y Administración, 44 px) (Req: Identidad visual «Cabecera audaz»)
- [x] 2.3 Revisar pendientes según la maqueta B: pestañas en contenedor con icono, «Buscar en todo el catálogo» con icono, filtros en tarjeta, pares en paneles con «vs», tabla común en Piezas incompletas y enlaces de Sugerencias de 44 px (Req: Identidad visual «Cabecera audaz»)
- [x] 2.4 Importación según la maqueta B: tarjetas grandes de origen con icono, etiqueta de tipo y botón redondo; pasos de los asistentes en el contenedor de las pestañas; tablas de importación con el estilo común (Req: Identidad visual «Cabecera audaz»)
- [x] 2.5 Reportes según la maqueta B: tipos en tarjetas con icono y el elegido con borde y visto, resultado con «Exportar a Excel» en verde junto al título, cantidad como etiqueta y tabla común; la vista de impresión sigue en blanco y negro (Req: Identidad visual «Cabecera audaz»)
- [x] 2.6 Administración según la maqueta B: áreas en el contenedor de pestañas y secciones subrayadas de 44 px, usuarios con iniciales y filas de 68 px, tablas comunes y Auditoría sin controles chicos ni textos cortados (Req: Controles compactos con color e icono en Administración)
- [x] 2.7 Acceso, cambio de contraseña, estado de los servicios y 404 con la banda terracota y la trama, centrados y sin menú donde no lo hay (Req: Identidad visual «Cabecera audaz»)

Cada grupo cierra con la auditoría de web-design-guidelines, sus correcciones y la verificación en los siete anchos.

## 3. Cierre

- [x] 3.1 Barrido de consistencia, capturas «después» (22 pantallas en local; conjunto mínimo en `docs/capturas-remodelacion/`), `docs/guia-visual.md` en la dirección B y reemplazo de las capturas del piloto
- [ ] 3.2 Prueba humana con la lista de «los zapatos del usuario» (la hace el equipo; no se marca ninguna historia como revisada por un humano)
- [x] 3.3 Alinear los nombres del menú con `inicio-guia-de-tareas` antes de archivar cualquiera de los dos (hecho; quedan los dos puntos de R1 en `docs/propuestas-ux-para-sergio.md`)
- [ ] 3.4 Tras aprobar el PR: `openspec archive remodelacion-visual -y`
