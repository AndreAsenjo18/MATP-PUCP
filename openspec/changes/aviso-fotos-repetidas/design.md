## Context

La galería (`PieceGallery.tsx`) ya carga las fotos de la pieza con su tipo de vista, y la subida (`PiecePhotoUpload.tsx`) elige un tipo de vista para todas las fotos de una pasada. La API ya avisa de una foto idéntica (`X-Warning: duplicate_content` al pedir la autorización de subida).

## Goals / Non-Goals

**Goals:** que la persona vea, antes y después de subir, si una vista se repite; sin bloquear y sin cambiar la API.

**Non-Goals:** detectar fotos parecidas (no idénticas) en la ficha; exigir vistas mínimas.

## Decisions

### D1. Avisar, no bloquear
Dos tomas del mismo ángulo pueden ser válidas, así que los avisos son de estado (`role="status"`, ámbar, icono y texto) y la subida sigue activa. **Descartado:** pedir confirmación antes de subir (un clic más en la tarea más común, para un caso que suele ser intencional).

### D2. Todo en el navegador
Las fotos de la pieza ya están cargadas en la galería; contar por tipo de vista es una función pura (`viewCounts`, `sameViewWarning`, `manyWithOneViewWarning` en `lib/data/media.ts`). **Descartado:** un endpoint nuevo de «vistas de la pieza» (mismo dato, más contrato).

### D3. Resumen de vistas en la galería
Debajo de las miniaturas, cuando hay más de una foto: «Vistas: Frontal (2, repetida) · Perfil». Las fotos sin tipo de vista se cuentan pero no se marcan como repetidas: no se sabe si lo son.

### D4. La foto muy parecida queda fuera
Comparar contra las fotos ya guardadas exige su huella perceptual, que hoy solo existe para las fotos de un lote de importación (`import_photo.perceptual_hash`). Calcularla en el navegador obligaría a descargar y leer las imágenes de la pieza (enlaces prefirmados de otro dominio, sujetos a CORS) en cada subida. Se propone, si el museo lo pide, guardarla al registrar cada foto en el servidor (change aparte, con migración).

## Risks / Trade-offs

- [El aviso se ignora] → es corto, está junto al selector y no se repite por foto.
- [Los tipos de vista se renombran] → el aviso usa la etiqueta vigente de la lista de valores.
