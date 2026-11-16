## ADDED Requirements

### Requirement: Filtros compactos y búsqueda con IA separada
La pantalla de Búsqueda MUST mostrar los filtros en una barra compacta de píldoras (Categoría, Material, Colección, Ubicación y Código I) que no empuje los resultados fuera de la pantalla; cada filtro activo, incluidos los de «Más filtros», SHALL verse como una píldora con su valor y un control para quitarlo. Los demás filtros MUST abrirse en un panel lateral que se superpone a la página, con el árbol de ubicaciones en un área con desplazamiento propio. La búsqueda con IA SHALL tener su propia caja, separada de la búsqueda por código o nombre, que identifique al proveedor de IA, acepte texto o dictado y, al enviarse, reemplace los filtros por los reconocidos; si la IA no está disponible, la frase MUST buscarse como texto libre. La caja de código o nombre SHALL aceptar dictado por voz como texto, sin interpretarlo. Ninguna interpretación se guarda. (RF-032, RF-038, RIA-06, RNF-001, RNF-010, RN-009)

#### Scenario: Llegar desde el Inicio con un filtro
- **WHEN** una persona pulsa «118 sin código de inventario» en el Inicio
- **THEN** Búsqueda muestra la píldora «Código I: Sin código I» con su control para quitarla, y los primeros resultados sin desplazarse

#### Scenario: Más filtros en el panel lateral
- **WHEN** la persona abre «Más filtros» y elige un estado de conservación y un lugar del árbol
- **THEN** los filtros se aplican, el botón del panel dice cuántas piezas verá, y al cerrarlo la barra muestra una píldora por cada filtro nuevo

#### Scenario: Búsqueda con IA
- **WHEN** la persona escribe o dicta «retablos del depósito 1 en estado regular» en la caja de IA y la envía
- **THEN** la pantalla indica que Gemini está interpretando, reemplaza los filtros por los reconocidos y dice cuáles aplicó

#### Scenario: IA no disponible
- **WHEN** la interpretación falla
- **THEN** la frase se busca como texto en la caja de código o nombre y la pantalla lo avisa, sin perder los filtros que había
