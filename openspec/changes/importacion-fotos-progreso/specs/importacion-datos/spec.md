## ADDED Requirements

### Requirement: Avance en tiempo real al importar fotografías al catálogo
En el paso «Revisar y aprobar» de un lote de solo fotografías, el sistema SHALL mostrar, sin recargar la página, cuántas fotos están listas mientras el servidor las verifica y empareja, y SHALL impedir aprobar hasta que terminen. Después de aprobar SHALL mostrar el avance de la aplicación e indicar que la persona puede salir de la pantalla. Al terminar SHALL decir cuántas fotos quedaron en cuántas piezas y ofrecer un enlace a la búsqueda filtrada por las piezas que recibieron fotos del lote; si falla, SHALL mostrar el motivo. (RF-025, RF-031, RF-046)

#### Scenario: Fotos todavía en verificación
- **GIVEN** un lote con 120 fotos, de las que el servidor todavía verifica 80
- **WHEN** la persona está en «Revisar y aprobar»
- **THEN** ve «Preparando las fotos: 40 de 120 listas» con su barra, el número avanza solo y «Aprobar» está deshabilitado

#### Scenario: Aplicación terminada
- **GIVEN** un lote aprobado que aplica 3 fotos a 2 piezas
- **WHEN** el servidor termina de aplicarlas
- **THEN** la pantalla dice «Listo: 3 fotos quedaron en 2 piezas» y ofrece «Ver las piezas en Búsqueda»

#### Scenario: Comprobar en la búsqueda
- **WHEN** la persona pulsa «Ver las piezas en Búsqueda»
- **THEN** la búsqueda lista solo las 2 piezas que recibieron fotos del lote, con el chip «Fotos importadas» que se puede quitar
