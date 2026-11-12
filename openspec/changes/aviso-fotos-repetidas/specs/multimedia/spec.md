## ADDED Requirements

### Requirement: Aviso de vista repetida al subir fotografías
Al subir fotografías desde la ficha, la interfaz MUST avisar, sin bloquear la subida, cuando el tipo de vista elegido ya tiene fotos en la pieza y cuando se suben varias fotos con un solo tipo de vista. La galería SHALL mostrar, si la pieza tiene más de una foto, cuántas fotos hay de cada tipo de vista y marcar con icono y texto las vistas con más de una foto; las fotos sin tipo de vista MUST NOT marcarse como repetidas. El aviso de foto idéntica existente no cambia. (RF-013, RNF-010)

#### Scenario: Vista ya presente
- **GIVEN** una pieza con una foto de vista Frontal
- **WHEN** el Catalogador elige «Frontal» como tipo de vista para subir otra foto
- **THEN** ve «La pieza ya tiene 1 foto de vista Frontal. Súbala solo si es otra toma.» y puede elegir y subir la foto igual

#### Scenario: Varias fotos con una sola vista
- **WHEN** el Catalogador sube 3 fotos con el tipo de vista «Perfil»
- **THEN** ve que las 3 quedarán como Perfil y que puede cambiar en la galería las de otro ángulo

#### Scenario: Resumen de vistas
- **GIVEN** una pieza con dos fotos Frontal, una Perfil y una sin tipo de vista
- **WHEN** se abre su galería
- **THEN** se lee «Vistas: Frontal (2, repetida) · Perfil · Vista sin especificar», con Frontal marcada con icono

#### Scenario: Sin vista elegida
- **WHEN** el Catalogador deja el tipo de vista en «Elegir después»
- **THEN** no aparece el aviso de vista repetida
