## ADDED Requirements

### Requirement: Identidad provisional de desarrollo sin exposición pública
Mientras no exista autenticación real, la API MUST exigir en toda ruta de negocio una identidad de usuario sintético activo, provista por una cabecera de desarrollo, y SHALL rechazar esa cabecera cuando el entorno es de producción, de modo que ningún dato del catálogo sea accesible de forma anónima. Las rutas implementadas MUST comprobar el permiso correspondiente de la matriz de roles sembrada y enmascarar los campos sensibles según el rol. El mecanismo es provisional [SUPUESTO] y se reemplaza en el change de autenticación sin cambiar las rutas. (RF-042, RF-041, RNF-012)

#### Scenario: Petición anónima
- **WHEN** un cliente sin identidad consulta el listado de piezas
- **THEN** recibe 401 con código `authentication_required` y ningún dato del catálogo

#### Scenario: Cabecera de desarrollo en producción
- **GIVEN** la API configurada con `APP_ENV=production`
- **WHEN** un cliente envía la cabecera de identidad de desarrollo
- **THEN** recibe 401 indicando que la autenticación de producción aún no está disponible

#### Scenario: Permiso insuficiente
- **WHEN** un usuario con rol Consulta interna intenta crear una colección
- **THEN** recibe 403 con código `permission_denied` y la colección no se crea

#### Scenario: Campos sensibles enmascarados
- **WHEN** un usuario con rol Consulta interna obtiene el detalle de una pieza en comodato
- **THEN** la respuesta no incluye el nombre del comodante, la referencia del contrato ni la ubicación exacta por debajo del espacio
