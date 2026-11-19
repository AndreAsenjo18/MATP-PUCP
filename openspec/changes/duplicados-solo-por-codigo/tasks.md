## 1. API

- [x] 1.1 `PairScore.enters_queue` solo con código compartido; bloques de denominación y autor/procedencia retirados (D1, D2)
- [x] 1.2 `retire_undetected` en la detección completa, con revisor y motivo (D3)
- [x] 1.3 La validación de importación sin evaluador de similitud; regla 4 explicada (D4)
- [x] 1.4 Pruebas: pares solo por código, piezas parecidas sin código, cierre de pares viejos, clasificación del lote de demostración

## 2. Web

- [x] 2.1 «Pedir a Gemini que revise estas filas» solo con posibles duplicados en el lote

## 3. Cierre

- [x] 3.1 Manual de usuario (`calidad-datos.md`, `importacion.md`)
- [ ] 3.2 Tras desplegar: lanzar **Detectar duplicados** una vez para cerrar los pares propuestos por parecido
- [ ] 3.3 `openspec archive duplicados-solo-por-codigo -y` tras aprobar el PR
