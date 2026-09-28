## ADDED Requirements

### Requirement: Sistema de diseño institucional con tokens y contraste accesible
La interfaz web MUST definir sus colores y tipografías como tokens con nombre en un único lugar del frontend (paleta institucional: `terracota`, `terracota-dark`, `terracota-light`, `tinta`, `crema`, `crema-light`, `borde`, `gris-texto`, `verde-exito`, `verde-bg`, `ambar-alerta`, `ambar-bg`, `ambar-texto`, `carmin-peligro`, `carmin-bg`, `carmin-texto`; tipografías `heading` y `sans`), y los componentes y pantallas SHALL usar únicamente esos tokens, sin clases de la paleta genérica de Tailwind (`stone`, `gray`, `red`, `amber`, `emerald`, `sky`, etc.) ni valores hexadecimales sueltos. Todo par de texto sobre fondo que el sistema de diseño declare como combinación de uso MUST alcanzar una relación de contraste de al menos 4.5:1 (WCAG 2.2 AA para texto normal). Los valores de la paleta provienen del documento del equipo; que coincidan con la identidad visual oficial del museo es un [SUPUESTO]. (RNF-004, RNF-010)

#### Scenario: Cambio de un color institucional en un solo lugar
- **GIVEN** que todas las pantallas usan los tokens del sistema de diseño
- **WHEN** una persona del equipo cambia el valor del token `terracota`
- **THEN** botones primarios, enlaces activos y badges informativos de todas las pantallas cambian de color sin editar ningún otro archivo

#### Scenario: Clase de paleta genérica en un componente
- **WHEN** un componente o una pantalla usa una clase como `bg-stone-900` o `text-red-700`, o un color hexadecimal escrito a mano
- **THEN** la prueba automática del frontend falla e indica el archivo y la clase que debe reemplazarse por un token

#### Scenario: Par de colores sin contraste suficiente
- **WHEN** se declara una combinación de uso cuyo texto sobre fondo tiene un contraste menor de 4.5:1 (por ejemplo, `ambar-alerta` sobre `ambar-bg`, 2.7:1)
- **THEN** la prueba de contraste falla y la combinación no puede usarse para texto; el texto de advertencia usa `ambar-texto` sobre `ambar-bg`

### Requirement: Biblioteca de componentes por niveles
El frontend MUST organizar sus componentes compartidos en tres niveles con dependencias en un solo sentido: `ui` (átomos sin reglas del museo: `Button`, `Badge`, `Card`, `Input`, `Select`, `Textarea`), `domain` (moléculas que aplican reglas del museo: `PieceCard`, `PieceSheet`, `ImportConflictModal` y los badges de tenencia, alertas, candado y estado) y `layout` (estructura de pantalla: `Sidebar`, `MainLayout`). Un componente de `ui` MUST NOT importar de `domain`, `layout` ni de los datos del dominio; un componente de `layout` MUST NOT contener reglas de inventario. Las pantallas SHALL construirse combinando estos componentes, y los nombres de componentes y propiedades SHALL estar en inglés (ADR-002). (RNF-004)

#### Scenario: Botón reutilizado en una pantalla nueva
- **WHEN** una persona del equipo necesita un botón de acción principal con icono en una pantalla nueva
- **THEN** usa `Button` con `variant="primary"` e `icon`, sin repetir clases de estilo, y obtiene el mismo tamaño, color y estado deshabilitado que en el resto del sistema

#### Scenario: Átomo que importa lógica del museo
- **WHEN** un archivo de `components/ui/` importa de `components/domain/`, `components/layout/` o de `lib/fixtures`/`lib/data`
- **THEN** la prueba de arquitectura del frontend falla y nombra el archivo y la importación prohibida

#### Scenario: Acción irreversible con el botón de peligro
- **WHEN** una pantalla necesita una acción irreversible o masiva (fusionar duplicados, aprobar un lote)
- **THEN** usa el botón de confirmación del sistema, que se apoya en `Button` con `variant="danger"` o `"primary"` y sigue pidiendo confirmación explícita antes de aplicar (RNF-010, RN-005)

### Requirement: Representación uniforme de estados de pieza
El sistema MUST mostrar cada estado de una pieza siempre con la misma intención visual del componente `Badge` en todas las pantallas: `success` para pieza ubicada o decisión aprobada, `info` para comodato y préstamo temporal, `warning` para información incompleta, sin foto o decisión pendiente, `danger` para conflictos de importación, rechazos y alertas bloqueantes, y `default` para códigos y estados neutros. Todo badge SHALL incluir un texto visible en español (el color nunca es el único portador del significado), y el candado del código I SHALL mostrarse con un icono accesible, no con un emoji. (RNF-010, RN-002, RN-003, RN-008, RN-009)

#### Scenario: Pieza en comodato en búsqueda y ficha
- **WHEN** una pieza en comodato aparece en los resultados de búsqueda y en su ficha
- **THEN** en ambos lugares se muestra el badge «Comodato» con la intención `info`

#### Scenario: Pieza sin foto
- **WHEN** una pieza no tiene fotografías
- **THEN** su tarjeta muestra el aviso «Sin foto» con la intención `warning`, un icono y el texto, legible en blanco y negro

#### Scenario: Estado desconocido
- **WHEN** llega un valor de estado o de alerta que el frontend no tiene mapeado (por ejemplo, un nuevo tipo de alerta añadido en la API)
- **THEN** el badge se muestra con la intención `default` y un texto genérico legible, sin romper la pantalla

### Requirement: Navegación principal con barra lateral responsive
Las pantallas autenticadas MUST compartir una estructura común (`MainLayout`) con barra lateral de navegación en escritorio y, en pantallas menores de 768 px, un botón de menú con etiqueta visible que abre y cierra la navegación. La navegación SHALL mostrar solo las secciones permitidas al rol activo (RF-039), marcar la sección actual, poder usarse con teclado (el menú móvil se cierra con Escape y al elegir una sección) y no producir desplazamiento horizontal en un móvil de 360 px. (RNF-001, RNF-010, RF-039)

#### Scenario: Personal de depósito en móvil
- **GIVEN** un Personal auxiliar de depósito en un móvil de 360 px de ancho
- **WHEN** abre el menú y elige «Vista de depósito»
- **THEN** el menú se cierra, se muestra la pantalla elegida sin desplazamiento horizontal y en el menú solo aparecen las secciones que su rol permite

#### Scenario: Escritorio
- **WHEN** un usuario abre cualquier pantalla autenticada en un monitor de escritorio
- **THEN** ve la barra lateral fija con el nombre del sistema, las secciones permitidas y la actual resaltada, y un encabezado con su nombre, su rol y el cambio de rol

#### Scenario: Pantalla sin sesión
- **WHEN** no hay sesión iniciada (pantalla de acceso)
- **THEN** la pantalla se muestra sin barra lateral ni menú, igual que en la maqueta actual

### Requirement: Tipografía e iconos disponibles sin internet
Las tipografías (Poppins para títulos, Inter para texto) y los iconos del sistema de diseño MUST servirse desde el propio frontend, sin solicitar recursos a servicios externos ni durante la ejecución ni durante la compilación de la imagen, y SHALL tener una familia de respaldo del sistema si la fuente no carga. Los iconos decorativos SHALL ocultarse a lectores de pantalla y los iconos sin texto visible SHALL tener una etiqueta accesible en español. (RNF-008, RNF-010)

#### Scenario: Demo sin conexión
- **GIVEN** el frontend compilado y ejecutándose en una máquina sin internet
- **WHEN** se recorren las pantallas de la maqueta
- **THEN** los títulos se ven en Poppins, el texto en Inter y los iconos se muestran, sin peticiones de red a dominios externos

#### Scenario: Fuente no disponible
- **WHEN** el navegador no puede cargar el archivo de una fuente
- **THEN** el texto se muestra con la fuente de respaldo del sistema, legible y sin texto invisible durante la carga

#### Scenario: Botón solo con icono
- **WHEN** un botón muestra únicamente un icono (por ejemplo, cerrar un diálogo)
- **THEN** tiene una etiqueta accesible en español (por ejemplo, «Cerrar») que anuncia el lector de pantalla
