# Propuestas de experiencia y textos para Sergio

Salen de la remodelación visual (change `remodelacion-visual`). La remodelación es solo de diseño: **las propuestas no están aplicadas**, salvo las que se marcan como «Aplicado, para avisar», que André decidió aplicar. Cada una indica la pantalla, qué se ve hoy, la propuesta y el motivo, para que Sergio decida.

## Aplicado, para avisar

Cambios de texto o de contenido que André decidió aplicar el 2026-11-13 como consecuencia directa de la remodelación. Se anotan para que Sergio los conozca y pueda revisarlos.

### A1. «Cambie de rol desde la cabecera» pasa a «desde el menú»

- **Pantallas:** el aviso de permisos por defecto (`components/layout/PermissionNotice.tsx`) y los avisos de Administración, Cargar datos (dos), Cargar fotos, Registrar pieza, Editar pieza, Reportes y Sugerencias: nueve textos. También la ayuda del acceso: «Puede cambiar de rol en cualquier momento desde el menú».
- **Antes:** el botón «Cambiar de rol» estaba en la franja superior.
- **Ahora:** la franja superior ya no existe y el botón está al pie del menú, así que los textos dicen «desde el menú».
- **Motivo:** el texto mandaba a la persona a buscar algo que ya no existe.

### A2. El rol no se repite al pie del menú si el nombre ya lo dice

- **Pantalla:** el pie del menú, en todas las pantallas.
- **Antes:** nombre y rol, siempre en dos líneas («Administrador MATP (sintético)» y debajo «Administrador»).
- **Ahora:** el rol va debajo del nombre solo si el nombre no lo contiene. Con «Gabriela Curadora (sintética)» se sigue viendo «Gestor de colecciones (Curadora)».
- **Motivo:** el pie tiene que caber siempre a la vista en ventanas bajas; repetir el rol ocupaba una línea sin dar información nueva.

## Urgentes: textos que la remodelación deja desactualizados

### 2. Manual de usuario con los nombres antiguos del menú

- **Dónde:** `docs/manual-usuario/` (README, administración, auditoría, calidad de datos, catálogo, depósito, IA, importación y reportes).
- **Hoy:** nombra «Búsqueda», «Importación», «Duplicados» y «Sugerencias IA».
- **Después:** el menú dice «Buscar», «Cargar datos» y «Revisar pendientes», que junta duplicados y sugerencias.
- **Propuesta:** actualizar los nombres y las capturas del manual cuando entre la remodelación.

### 3. Dos nombres para Administración

- **Pantallas:** el Inicio y el menú.
- **Hoy:** la tarjeta del Inicio dice «Configuración» y el menú dice «Administración»; llevan al mismo lugar.
- **Ya resuelto:** el change `inicio-guia-de-tareas` se alineó el 2026-11-13 con los nombres del menú que decidió André («Buscar» y «Administración»). Su tarjeta del Inicio sigue diciendo «Configuración».
- **Propuesta:** un solo nombre en la tarjeta del Inicio y en el menú.

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
