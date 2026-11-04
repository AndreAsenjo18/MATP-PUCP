## ADDED Requirements

### Requirement: Alta de usuario en diálogo y listado filtrable
El listado de usuarios MUST ofrecer arriba una búsqueda por nombre o correo, un filtro por rol y la opción de incluir desactivados, y el alta de un usuario SHALL hacerse en un diálogo abierto con «Nuevo usuario». Al crear, el diálogo MUST cerrarse y mostrarse la contraseña temporal una sola vez en el listado, con el aviso de que se entrega en persona y la persona deberá cambiarla al ingresar. El rol desactivado en la fase 1 MUST NOT ofrecerse para asignar. (RF-039, RNF-012)

#### Scenario: Buscar un usuario
- **WHEN** la persona escribe parte de un correo en la búsqueda
- **THEN** el listado muestra solo los usuarios cuyo nombre o correo lo contiene

#### Scenario: Crear un usuario
- **WHEN** la persona completa correo, nombre y rol en el diálogo y guarda
- **THEN** el diálogo se cierra y el listado muestra el aviso de la contraseña temporal, que no vuelve a mostrarse al recargar

#### Scenario: Correo repetido
- **WHEN** la API responde que el correo ya existe
- **THEN** el diálogo sigue abierto, conserva lo escrito y explica que debe buscarlo entre los desactivados

### Requirement: Permisos por rol en paquetes
La edición de permisos de un rol MUST agrupar los permisos en paquetes por área —Fichas, Importación, Calidad de datos, Ubicación y movimientos, Fotografías, Datos sensibles, Reportes y exportación, IA y Administración—, mostrar en cada paquete cuántos permisos del rol tiene («3 de 5») y ofrecer un interruptor para marcar o quitar todo el paquete; un permiso que no pertenezca a ningún paquete conocido SHALL mostrarse en «Otros». El rol MUST elegirse con botones que indican si está desactivado, y el motivo del cambio y «Guardar permisos» SHALL estar en una barra siempre visible mientras haya cambios, con el resumen de lo que se agrega y se retira. (RF-039, RNF-012, RNF-010)

#### Scenario: Marcar un paquete entero
- **WHEN** la persona activa el interruptor del paquete «Importación»
- **THEN** los tres permisos del paquete quedan marcados, el conteo pasa a «3 de 3» y la barra de guardado muestra lo que se agrega

#### Scenario: Paquete parcial
- **WHEN** el rol tiene 2 de los 4 permisos de un paquete
- **THEN** el paquete muestra «2 de 4» y su interruptor indica un estado parcial

#### Scenario: Guardar sin motivo
- **WHEN** hay cambios pero el motivo tiene menos de 3 caracteres
- **THEN** «Guardar permisos» está deshabilitado y la barra pide el motivo

#### Scenario: Permiso desconocido
- **WHEN** la API devuelve un permiso que el cliente no conoce
- **THEN** aparece en el paquete «Otros» y puede marcarse como los demás
