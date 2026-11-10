> Corrección C6 (observación J6 de la JP), paquete P5. Solo frontend y manual; sin cambios de API.

## 1. Avisos

- [x] 1.1 `viewCounts`, `sameViewWarning` y `manyWithOneViewWarning` en `lib/data/media.ts`; pruebas de singular, plural, sin vista y vista sin fotos (Req: Aviso de vista repetida al subir fotografías)
- [x] 1.2 `PiecePhotoUploadView` recibe las fotos de la pieza (`existing`) y muestra los dos avisos con icono y texto, sin desactivar la subida; pruebas de render (Req: Aviso de vista repetida… — escenarios «Vista ya presente», «Varias fotos con una sola vista» y «Sin vista elegida»)
- [x] 1.3 `ViewSummary` en la galería, solo con más de una foto; prueba de render (Req: Aviso de vista repetida… — escenario «Resumen de vistas»)

## 2. Cierre

- [x] 2.1 Manual `docs/manual-usuario/fotografias.md`: qué se comprueba (foto idéntica, vista repetida), qué no (foto parecida en la ficha) y por qué no se bloquea; supuesto Z2 en `docs/preguntas-contraparte.md`
- [ ] 2.2 Verificación en el navegador con el seed (ficha con fotos) a 1280 y 375 px
  - Pendiente (2026-11-10): Docker Desktop estaba apagado. Cubierto solo con pruebas de render y de funciones puras.
- [ ] 2.3 `npm run lint:web`, `npx vitest run` y `openspec validate --all --strict` en verde; tras aprobar el PR, `openspec archive aviso-fotos-repetidas -y`
  - Parcial (2026-11-10): lint y tipos en verde, 1301 pruebas en 99 archivos, 23 de 23 specs válidas. Falta el archivo tras aprobar el PR.
