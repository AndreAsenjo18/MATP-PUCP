## 1. Catálogo de tareas

- [ ] 1.1 Ampliar `lib/help/tasks.ts` (la tabla que crea `inicio-guia-de-tareas`) con palabras clave, sinónimos, el identificador del elemento a resaltar y la indicación de una línea, y añadir las tareas que no tienen tarjeta propia («Quiero mover una pieza», «Quiero agregar fotos a una pieza»). Si el otro change aún no está aplicado, crear la tabla con los mismos campos. Prueba: cada destino existe, cada permiso es conocido y cada elemento a resaltar está declarado. Cumple «Panel de tareas por rol» y «Llévame a la pantalla».
- [ ] 1.2 Crear la función pura de búsqueda (normaliza tildes y mayúsculas, prefijo de palabra, sinónimos) y su prueba con «fotos», «MOVER», «cargá» y una palabra sin coincidencias. Cumple «Búsqueda de tareas en el panel».

## 2. Panel y botón

- [ ] 2.1 Crear `components/layout/HelpAssistant.tsx`: botón fijo «¿Necesita ayuda?» (44 px o más), panel con la lista de tareas visibles por rol, cuadro de búsqueda y mensajes de rol sin tareas y de sin coincidencias. Prueba: tareas por rol, búsqueda, rol sin tareas. Cumple «Botón de ayuda fijo…», «Panel de tareas por rol» y «Búsqueda de tareas en el panel».
- [ ] 2.2 Accesibilidad del panel: `aria-expanded` y `aria-controls`, foco que entra al abrir y vuelve al botón al cerrar, Escape cierra, letra de 16 px o más. Prueba de teclado y de foco. Cumple «Panel de tareas por rol».
- [ ] 2.3 Montar el asistente desde `MainLayout.tsx` solo con sesión, no en la pantalla de acceso y con `print:hidden`; reservar el margen inferior y la variable de elevación para convivir con barras de acción fijas. Prueba: aparece con sesión, no aparece sin sesión, no se imprime, a 360 px no produce desplazamiento horizontal. Cumple «Botón de ayuda fijo…».

## 3. Llévame y resaltado

- [ ] 3.1 Implementar «Llévame»: navegar a la ruta con `ayuda=<id>` y, en la pantalla de destino, buscar el atributo `data-ayuda`, desplazar, enfocar y mostrar el contorno y la indicación; retirar el parámetro al usar el elemento o cerrar la indicación; no hacer nada si el elemento no existe. Prueba de los cuatro escenarios (llevar, elemento ausente, movimiento reducido, usar el elemento). Cumple «Llévame a la pantalla y señala por dónde empezar».
- [ ] 3.2 Declarar los atributos `data-ayuda` en las pantallas de las seis tareas (cuadro de búsqueda, «Nueva pieza», el selector de origen de la importación, «Mover a», «Revisar pendientes», selector de reportes). Prueba que comprueba que cada identificador de la tabla existe en su pantalla. Cumple «Llévame a la pantalla y señala por dónde empezar».
- [ ] 3.3 Anunciar la indicación con una región `aria-live` educada y comprobar que el contorno usa un token institucional con contraste suficiente y no depende solo del color. Prueba de render. Cumple «Llévame a la pantalla y señala por dónde empezar».

## 4. Privacidad y cierre

- [ ] 4.1 Prueba de que abrir el panel, escribir en la búsqueda y elegir tareas no dispara ninguna petición de red y de que lo escrito no se conserva al cerrar y volver a abrir. Cumple «La ayuda no envía ni guarda datos».
- [ ] 4.2 Ampliar la prueba de lenguaje llano con los textos del asistente: sin identificadores de requisitos ni términos internos. Cumple las reglas de lenguaje del sistema.
- [ ] 4.3 Actualizar `docs/manual-usuario/README.md` con una sección «Si no sabe cómo seguir» y regenerar las capturas afectadas. Cumple el manual de usuario del change.
- [ ] 4.4 Registrar en `docs/preguntas-contraparte.md` como `[SUPUESTO]` la etiqueta «¿Necesita ayuda?», las seis tareas y la pregunta de si se quiere una etapa 2 con un modelo que lea solo el manual.
- [ ] 4.5 Pruebas requeridas: `npm run test:web`, `npm run lint:web`, `npx tsc --noEmit` en `apps/web` y `openspec validate --all --strict` en verde; recorrido manual con los roles Administrador, Gestora y Personal de depósito, y con teclado solamente. Sin cambios de OpenAPI ni de cliente tipado.
- [ ] 4.6 Archivar con `openspec archive asistente-de-ayuda -y` **solo tras la aprobación del PR**.
