## Why

La JP preguntó (J6, corrección C6 de `docs/lista-maestra-funcionalidades.md`): **¿se corrobora que las fotos de una pieza no se repitan y que sean de ángulos distintos? Explicar por qué sí o por qué no.**

**Por qué sí.** Una pieza 3D se documenta con ángulos distintos (frente, reverso, detalle, firma). Repetir la misma imagen no aporta información, ocupa almacenamiento y desordena la galería.

**Por qué no se bloquea.** Puede haber dos tomas válidas del mismo ángulo (otra luz, otra escala, antes y después de una restauración). El sistema avisa y la persona decide; no impide subir.

Qué hay hoy:

- **Misma imagen exacta** (misma huella SHA-256): ya se detecta al subir desde la ficha. La foto se detiene con «Esta foto ya está en la pieza» y la persona puede «Subir de todos modos».
- **Misma imagen en otra resolución o recortada**: se detecta con una huella perceptual (dHash) solo en la importación masiva de fotos, entre las fotos de un mismo lote.
- **Misma vista**: cada foto tiene tipo de vista, pero nada avisa si ya hay una foto de esa vista ni muestra qué vistas tiene la pieza.

## What Changes

- Al elegir el tipo de vista para subir fotos desde la ficha, un aviso no bloqueante si la pieza ya tiene fotos de esa vista («La pieza ya tiene 1 foto de vista Frontal. Súbala solo si es otra toma.»).
- Al subir varias fotos con un solo tipo de vista, un aviso que recuerda cambiar en la galería las que sean de otro ángulo.
- En la galería, un resumen «Vistas: Frontal (2, repetida) · Perfil · Vista sin especificar», con la vista repetida marcada con icono y texto.
- Manual `docs/manual-usuario/fotografias.md` con la explicación de qué se comprueba y qué no.

## Capabilities

### New Capabilities

### Modified Capabilities

- `multimedia`: se añade el requisito de avisos no bloqueantes de vista repetida y el resumen de vistas.

## Impact

- Solo frontend (`apps/web`: `lib/data/media.ts`, `PiecePhotoUpload.tsx`, `PieceGallery.tsx`) y manual. Sin cambios de API, contrato ni migraciones.
- El aviso de foto idéntica que ya existía no cambia.

## Fuera del change

- **Foto muy parecida (otra resolución o recorte) al subir desde la ficha.** Requiere guardar la huella perceptual de cada foto de la pieza (columna nueva en `media_asset`, migración y cálculo al registrar) y devolver el aviso en el contrato. Se deja como change aparte si el museo lo pide; hoy la importación masiva ya lo cubre dentro de cada lote.
- Exigir un conjunto mínimo de vistas por tipo de pieza: no hay una regla del museo (ver Z2 en `docs/preguntas-contraparte.md`).
