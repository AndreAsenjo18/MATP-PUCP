## Why

El formulario de registro de pieza no deja ver qué campos son obligatorios. Solo «Denominación» lleva un asterisco y no hay ninguna leyenda que lo explique; «Régimen de tenencia», que el servidor también exige (RF-006), no lleva marca. Quien registra una pieza, o la curadora que revisa el formulario en una demostración, no sabe qué debe llenar sí o sí y qué puede completar después, y se pierde.

## What Changes

- **Asterisco en cada campo obligatorio.** «Denominación» y «Régimen de tenencia» (al registrar) llevan `*` junto a su etiqueta. En la edición el régimen se muestra como dato de solo lectura y no lleva marca, porque no se edita ahí.
- **Leyenda visible.** Al inicio del formulario, un texto corto explica: «Los campos marcados con * son obligatorios; el resto puede completarse después».
- **Accesibilidad.** El asterisco no es la única señal: el control lleva `aria-required` y la leyenda está en texto.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

Deltas solo `ADDED` con nombres únicos (ADR-010).

- `catalogo-piezas`: marca visible de los campos obligatorios en el formulario de pieza.

## Impact

- **Frontend** (`apps/web`): `components/domain/PieceForm.tsx` (+ prueba).
- **Backend / API / modelo**: sin cambios; los campos obligatorios siguen siendo los que valida el servidor (denominación y régimen de tenencia). Los campos obligatorios adicionales siguen como `[SUPUESTO]` (B1 de `docs/preguntas-contraparte.md`) y se validan con el museo.
- **Dependencias nuevas**: ninguna.
- **Cubre**: RF-006, RNF-010.
- **Célula dueña**: Catálogo. **Relacionado con**: `ficha-pieza-crud`.
