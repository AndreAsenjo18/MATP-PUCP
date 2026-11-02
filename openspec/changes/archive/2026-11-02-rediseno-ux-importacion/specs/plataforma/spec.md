## ADDED Requirements

### Requirement: Barra lateral de navegación retraíble
En escritorio (768 px o más), la barra lateral de `MainLayout` MUST poder contraerse a un riel de iconos y volver a expandirse con un control de etiqueta accesible, y SHALL recordar la preferencia de la persona en el navegador. En el riel cada sección MUST seguir siendo operable con teclado y mostrar su nombre mediante una etiqueta accesible y un texto de ayuda al pasar el cursor o enfocar. El contenido principal SHALL aprovechar el ancho liberado, y el menú de móvil con botón «Menú» MUST conservar su comportamiento. Si el navegador no permite guardar la preferencia, la barra SHALL funcionar expandida. (RNF-001, RNF-010)

#### Scenario: Contraer la barra
- **WHEN** la persona pulsa «Contraer menú»
- **THEN** la barra se reduce a un riel de iconos, el control cambia a «Expandir menú» y el contenido ocupa el ancho liberado

#### Scenario: Preferencia recordada
- **GIVEN** la persona contrajo la barra
- **WHEN** vuelve a abrir la aplicación en el mismo navegador
- **THEN** la barra aparece contraída desde el primer momento

#### Scenario: Almacenamiento no disponible
- **WHEN** el navegador bloquea el almacenamiento local
- **THEN** la barra aparece expandida, el control sigue funcionando durante la sesión y no se muestra ningún error

#### Scenario: Navegación en riel con teclado
- **WHEN** la persona recorre el riel con la tecla Tab
- **THEN** cada icono recibe el foco con un indicador visible y su nombre se anuncia y se muestra como ayuda
