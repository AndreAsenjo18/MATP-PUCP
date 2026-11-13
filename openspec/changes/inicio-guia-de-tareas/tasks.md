## 1. Tabla de tareas y menú

- [x] 1.1 Crear `lib/help/tasks.ts` con la tabla de tareas (identificador, verbo, explicación de una línea, destino, permiso o permisos, si va en el menú) y una función pura que devuelve las tareas visibles para un rol. Prueba: cada destino es una ruta existente, cada permiso es conocido, y un rol de depósito, uno de catálogo y el administrador ven lo esperado. Cumple «Inicio como guía de tareas» y la navegación modificada.
- [ ] 1.2 **Pedir a la Base** (el menú lateral es solo de la Base, `docs/historias-de-usuario.md` sección 8, regla 3) que reescriba `NAV_ITEMS` en `navigation.ts` a partir de la tabla de tareas: Inicio, Buscar, Cargar datos, Revisar pendientes, Reportes y Administración, con los permisos de D2, y actualizar `Sidebar.tsx`. Prueba de las entradas visibles por rol, de «Administración» solo para administradores y de un máximo de cinco entradas sin ese permiso. Cumple «Navegación principal con barra lateral responsive».
- [ ] 1.3 Actualizar las pruebas del menú existentes (`layout.test.tsx`) que mencionen los nombres antiguos y cambiar el texto «Vista de depósito» del escenario del móvil por «Buscar». Cumple la navegación modificada.

## 2. Pantalla de Inicio

- [x] 2.1 Reescribir `app/inicio/page.tsx`: «¿Qué desea hacer?» y las tarjetas de tarea visibles (verbo, línea de explicación, enlace), apiladas en una columna a 360 px y al 150 %. Prueba de render por rol y de que no hay desplazamiento horizontal. Cumple «Inicio como guía de tareas».
- [x] 2.2 Mostrar la línea de estado («N piezas · N sin código I · N sin foto») con los indicadores existentes, con enlace a las piezas incompletas y aviso breve si la consulta falla sin bloquear las tarjetas. Prueba de los dos casos. Cumple «Inicio como guía de tareas».
- [x] 2.3 Mostrar en la tarjeta «Revisar pendientes» el número de elementos pendientes solo cuando es mayor que cero, con los conteos de `revisar-pendientes-unificado` (o los listados actuales mientras no esté aplicado). Prueba con 0 y con 90. Cumple «Inicio como guía de tareas».
- [x] 2.4 Retirar del Inicio la tabla por colección, la evolución de 14 días, las últimas cargas y la tabla de piezas incompletas, y dejar de leer el almacén de demostración en modo real; el encabezado de demostración solo en modo `mock`. Prueba: en modo `live` no hay texto de demostración ni datos de ejemplo. Cumple «Inicio como guía de tareas».
- [ ] 2.5 Verificar que la tabla por colección y los indicadores siguen disponibles en Reportes › Información incompleta y que la serie histórica sigue en la API; documentarlo. Cumple D4.
- [ ] 2.6 Ampliar la prueba de lenguaje llano con los textos del Inicio y del menú: sin identificadores de requisitos. Cumple «Inicio como guía de tareas».

## 3. Documentación y cierre

- [ ] 3.1 Actualizar `docs/manual-usuario/README.md` y `acceso.md` con el Inicio como guía y los nombres nuevos del menú, y regenerar las capturas afectadas. Cumple el manual de usuario del change.
- [x] 3.2 Registrar en `docs/preguntas-contraparte.md` como `[SUPUESTO]` los verbos de las tarjetas, los nombres del menú y la pregunta de dónde debe vivir la evolución de completitud.
- [ ] 3.3 Repetir la auditoría de legibilidad de Inicio antes de cerrar (letra bajo 16 px, controles bajo 44 px, opciones en la primera pantalla) y anotar el resultado en el PR; el antes es 35 textos bajo 16 px y 5 opciones.
- [ ] 3.4 Pruebas requeridas: `npm run test:web`, `npm run lint:web`, `npx tsc --noEmit` en `apps/web` y `openspec validate --all --strict` en verde; recorrido manual con los roles Administrador, Gestora y Personal de depósito. Sin cambios de OpenAPI ni de cliente tipado.
- [ ] 3.5 Archivar con `openspec archive inicio-guia-de-tareas -y` **solo tras la aprobación del PR**.
