## Why

Búsqueda es la pantalla que más se usa: desde ella se encuentra una pieza, se abre su ficha y, desde la fusión con el depósito, se verifica y se mueve. Al recorrerla con el seed aparecen fricciones que cuestan pasos y lectura:

- En celular y tableta el buscador está escondido dentro de «Filtros»: para buscar un código hay que abrir el panel primero.
- El subtítulo (unos 230 caracteres) repite lo que dice la ayuda del campo.
- Mover piezas pasa por dos etapas («Revisar el traslado» y «Confirmar el traslado») aunque el movimiento se puede deshacer moviendo de nuevo y queda en el historial.
- El número de piezas elegidas aparece dos veces (sobre la lista y en la barra de acciones).
- Los paneles de exportación (unas 15 casillas de columnas y «Mis exportaciones», aunque esté vacío) quedan siempre abiertos debajo de los resultados.
- «Nueva pieza» se muestra a quien no puede registrar piezas y lo lleva a una pantalla sin salida.
- En el árbol de ubicaciones, los botones para abrir y elegir un lugar miden 24 px en celular.
- Quedan identificadores de requisitos a la vista: «Exportación completa de la base (RF-044)» y el aviso de la descarga simulada «(RF-036)».

## What Changes

- Buscador **siempre visible** arriba de la pantalla, en todos los tamaños; los demás filtros siguen en el panel (y en «Filtros» por debajo de `lg`).
- Sin subtítulo: una sola ayuda bajo el buscador.
- **Mover a** en una sola etapa: destino, motivo y la lista de piezas con su ubicación actual en el mismo panel, y el botón «Mover N piezas».
- El conteo y «Quitar la selección» quedan solo en la barra de acciones.
- «Exportar resultados» plegado por defecto; «Mis exportaciones» solo aparece si hay exportaciones; textos de aviso más cortos.
- «Nueva pieza» solo con el permiso de registrar piezas.
- Árbol de ubicaciones con objetivos táctiles de 44 px por debajo de `lg`; la etiqueta «Ubicación» ya no repite la ayuda.
- Sin `RF-` en pantalla; prueba que lo vigila en los componentes de Búsqueda.
- Manual `docs/manual-usuario/busqueda.md` actualizado.

## Capabilities

### New Capabilities

### Modified Capabilities

- `busqueda-reportes`: se añaden requisitos de presentación de la pantalla de búsqueda (buscador visible, exportación plegada, texto sin identificadores).
- `ubicacion-movimientos`: se añade el requisito de mover en una sola etapa con vista previa.

## Impact

- Solo frontend (`apps/web`) y manual. Sin cambios de API, contrato, `operationId` ni reglas de negocio.
- Se conservan las direcciones (`/busqueda?…`, `/deposito`) y los nombres del manual («Más filtros», «Ver por ubicación», «Verificar», «Mover a…», «Mis exportaciones»).
- Pruebas afectadas: `SearchLive.test.tsx`, `SelectionBar.test.tsx`, `LocationTreeSelect.test.tsx`; cada ajuste se explica en `tasks.md`.

## Fuera del change

- Cambiar qué destinos se ofrecen al mover (supuesto Z1).
- Rediseñar la ficha, Reportes o Administración (changes propios de esta serie).
