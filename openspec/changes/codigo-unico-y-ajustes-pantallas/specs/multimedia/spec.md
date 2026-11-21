## ADDED Requirements

### Requirement: Foto principal en la ficha y zoom
La ficha SHALL mostrar la foto principal de la pieza en «Datos generales», con un acceso a todas sus fotos; sin fotos, SHALL decirlo y llevar a «Fotografías». Toda foto de la ficha SHALL poder ampliarse en un visor que acerca y aleja (de la foto entera a seis veces) con botones de 44 px, la rueda del ratón, doble clic y el teclado, y que permite recorrer la foto acercada. El visor MUST NOT ofrecer descargas (uso interno, RN-008). (RF-013, RF-014, RNF-010)

#### Scenario: Ver la pieza al abrir su ficha
- **WHEN** se abre la ficha de una pieza con fotos
- **THEN** «Datos generales» muestra su foto principal junto a los datos y «Ver las N fotos» lleva a «Fotografías»

#### Scenario: Ampliar una firma
- **WHEN** una persona pulsa la foto y luego «Acercar» dos veces
- **THEN** la foto se ve al 225 % y puede recorrerla arrastrándola; «Ajustar a la pantalla» o la tecla «0» vuelven a la foto entera y «Esc» cierra el visor
