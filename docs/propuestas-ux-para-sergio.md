# Propuestas de experiencia y textos para Sergio

Salen de la remodelación visual (change `remodelacion-visual`). La remodelación es solo de diseño: **ninguna de estas propuestas está aplicada**. Cada una indica la pantalla, qué se ve hoy, la propuesta y el motivo, para que Sergio decida.

## Urgentes: textos que la remodelación deja desactualizados

### 1. «Cambie de rol desde la cabecera»

- **Pantallas:** el aviso de permisos por defecto (`components/layout/PermissionNotice.tsx`) y los avisos de Administración, Cargar datos, Cargar fotos, Registrar pieza, Editar pieza, Reportes y Sugerencias. En el acceso, la ayuda «Puede cambiar de rol en cualquier momento desde la cabecera».
- **Hoy:** el botón «Cambiar de rol» está en la franja superior.
- **Después de la remodelación:** la franja superior desaparece y el botón queda al pie del menú.
- **Propuesta:** «Cambie de rol desde el pie del menú», o un texto que no dependa del lugar.
- **Motivo:** el texto mandaría a la persona a buscar algo que ya no existe.

### 2. Manual de usuario con los nombres antiguos del menú

- **Dónde:** `docs/manual-usuario/` (README, administración, auditoría, calidad de datos, catálogo, depósito, IA, importación y reportes).
- **Hoy:** nombra «Búsqueda», «Importación», «Duplicados» y «Sugerencias IA».
- **Después:** el menú dice «Buscar», «Cargar datos» y «Revisar pendientes», que junta duplicados y sugerencias.
- **Propuesta:** actualizar los nombres y las capturas del manual cuando entre la remodelación.

### 3. Dos nombres para Administración

- **Pantallas:** el Inicio y el menú.
- **Hoy:** la tarjeta del Inicio dice «Configuración» y el menú dice «Administración»; llevan al mismo lugar.
- **Además:** el change `inicio-guia-de-tareas` propone para el menú «Buscar piezas» y «Configuración», y la remodelación usa «Buscar» y «Administración», como se decidió.
- **Propuesta:** un solo nombre en el Inicio y en el menú, y alinear los dos changes antes de archivarlos.

### 3b. Enlace para saltar al contenido

- **Pantallas:** todas las que tienen menú.
- **Hoy:** con el teclado hay que pasar por las seis entradas del menú y la cuenta antes de llegar al contenido.
- **Propuesta:** un enlace «Saltar al contenido» que solo aparece al usar el teclado, como primer elemento de la página.
- **Motivo:** lo pide la auditoría de web-design-guidelines. Es texto nuevo de pantalla, así que no lo añadí.

## Términos internos o siglas en pantalla

### 4. «Fuera del MVP»

- **Pantalla:** Revisar pendientes › Sugerencias de IA (etiqueta en cada sugerencia).
- **Motivo:** «MVP» es una sigla interna. Hoy la exige el spec `ia-asistiva`, así que cambiarla pide modificar ese requisito.
- **Propuesta:** algo como «Función en prueba».

### 5. «Fase 1» en el acceso y en Estado

- **Pantallas:** acceso («Uso interno · Fase 1» y «Desactivado en fase 1» junto a algunos roles) y Estado de los servicios («Uso interno · Fase 1»). En Administración, «Desactivado en fase 1» junto a algunos roles.
- **Motivo:** «fase 1» es un término del proyecto, no del museo.
- **Propuesta:** «Uso interno del museo» y «No disponible por ahora».

## Coherencia de textos

### 6. «Volver a la búsqueda» y «Volver a búsqueda»

- **Pantallas:** Registrar pieza dice «Volver a la búsqueda»; la ficha dice «Volver a búsqueda».
- **Propuesta:** un solo texto en las dos.
