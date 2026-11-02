## ADDED Requirements

### Requirement: Código INC / RN de 5 dígitos
La regla de normalización INC/RN MUST aceptar, además de 4 y 6 dígitos, números de 5 dígitos con los mismos prefijos y separadores, y SHALL registrar el formato detectado `INC_5_DIGITOS`. El valor normalizado de 5 dígitos MUST NOT rellenarse con ceros, para no confundirlo con un código de 6 dígitos distinto. [SUPUESTO A4: los RN de 5 dígitos vistos en las bases del museo son un formato válido y no un error de digitación] (RF-023, RN-010)

#### Scenario: RN de 5 dígitos
- **WHEN** se registra el código INC/RN `RN 12345`
- **THEN** obtiene el valor normalizado `12345`, el formato `INC_5_DIGITOS` y queda normalizado

#### Scenario: Cinco dígitos no se confunden con seis
- **WHEN** se registran `RN 12345` y `RN 012345` en piezas distintas
- **THEN** obtienen los valores normalizados `12345` y `012345`, distintos, y no se proponen como el mismo código

#### Scenario: Otra cantidad de dígitos
- **WHEN** se registra el código INC/RN `RN 123`
- **THEN** el valor original se conserva y el identificador queda «no normalizable», como hoy
