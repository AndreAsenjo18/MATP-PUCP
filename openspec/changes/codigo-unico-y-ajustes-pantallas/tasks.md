## 1. API

- [x] 1.1 `ensure_code_is_free` en `POST /pieces/{id}/identifiers`: 409 `code_in_use` con la pieza que tiene el código (D1), con pruebas
- [x] 1.2 `_batch_conflicts` con todos los tipos de código; `_check_as_new` con `code_in_use` y `code_in_use_in_batch` (D2), con pruebas
- [x] 1.3 La API crea al arrancar las plantillas que falten (D5), con prueba

## 2. Web

- [x] 2.1 «Revisar pendientes» solo con «Piezas incompletas»; `/pendientes/duplicados` y `/duplicados` a la bandeja; Inicio cuenta las incompletas
- [x] 2.2 Inicio sin frases de ejemplo
- [x] 2.3 Visor con zoom en la galería (D4) y foto principal en «Datos generales» (D3), con pruebas
- [x] 2.4 Texto del conflicto entre filas: cualquier código, no solo el I

## 3. Mantenimiento

- [x] 3.1 `scripts/mantenimiento/vaciar-catalogo.py`, probado sobre una copia de la base local (ensayo, base equivocada, vaciado, protecciones reactivadas)
- [ ] 3.2 Vaciar el ambiente de pruebas tras el respaldo (lo corre el equipo)

## 4. Cierre

- [x] 4.1 Manual de usuario: `calidad-datos.md`, `catalogo.md`, `fotografias.md`, `importacion.md`, `carga-historico.md`, `ia.md`
- [x] 4.2 Supuesto LC6 en `docs/preguntas-contraparte.md`
- [ ] 4.3 Revisar con el equipo el fallo de reportes del ambiente de pruebas (con el código actual los cinco tipos funcionan)
- [ ] 4.4 Retirar la cola de duplicados (API y componentes sin pantalla) en un change posterior, si el equipo lo confirma
- [ ] 4.5 Ajustar el delta de `revisar-pendientes-unificado` a una pestaña antes de archivarlo
- [ ] 4.6 `openspec archive codigo-unico-y-ajustes-pantallas -y` tras aprobar el PR
