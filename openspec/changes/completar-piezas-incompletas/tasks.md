## 1. API

- [x] 1.1 `missing_fields_for_pieces` (misma condición que las alertas) y `IncompletePiece.missing_fields`; declarado en el mapeo y en `CAMPOS_ANADIDOS` (D1, RF-019)
- [x] 1.2 Prueba `test_each_row_says_which_fields_are_missing`
- [x] 1.3 OpenAPI y cliente tipado regenerados

## 2. Web

- [x] 2.1 `IncompleteTriage`: tarjetas «¿Qué les falta?» que filtran, con su número (D2)
- [x] 2.2 Barra compacta: colección en píldora y «Descargar» (Excel/CSV) discreto
- [x] 2.3 Filas con «Le falta:» en concreto (alertas físicas y campos por su nombre)
- [x] 2.4 Panel «Completar ficha»: ubicación (movimiento), fotos y campos simples; código I, códigos no entendidos y obligatorios remiten a la ficha; «Guardar y siguiente» y «Saltar» (D3, D4, D5)
- [x] 2.5 Datos de demostración con `missing_fields` y la alerta de recomendados con las reglas de la API
- [x] 2.6 Pruebas `IncompleteTriage.test.tsx`

## 3. Cierre

- [x] 3.1 `npm run lint:web`, `npm run test:web`, pruebas de la API y `openspec validate --strict` en verde
- [x] 3.2 Manual de usuario (`docs/manual-usuario/calidad-datos.md`)
- [ ] 3.3 Verificación en PostgreSQL con Docker y prueba del panel contra la API real (movimiento y fotos)
- [ ] 3.4 `openspec archive completar-piezas-incompletas -y` tras aprobar el PR
