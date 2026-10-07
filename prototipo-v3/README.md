# Prototipo MATP v3 — maqueta de interacción (frontend)

Prototipo visual del sistema MATP, construido como demo para mostrar flujos al museo. Es una
app **vanilla JS/HTML/CSS** (sin build step, sin backend): todos los datos viven en `js/data.js`
como mock, simulando la capa de servicios en `js/api.js` (lista para conectarse a la API real de
`apps/api` cuando corresponda — cada función revisa `API_BASE_URL` y usa `fetch` si está definida).

Las piezas, colecciones y ejemplos de calidad de datos del catálogo están tomados de las bases de
datos estandarizadas reales del museo (BD ESTANDARIZADAS AL 2025, fichas de catalogación AJB),
no son inventados — ver `js/data.js` para las fuentes citadas en comentarios.

## Estructura

- `index.html` — carga `js/data.js` → `js/api.js` → `js/components.js` → `js/app.js` en orden.
- `js/app.js` — router por hash y las ~12 pantallas del prototipo.
- `js/data.js` — datos mock (incluye ejemplos reales de piezas/colecciones del museo).
- `js/api.js` — capa de servicios desacoplada, con los `TODO(backend)` marcados para la futura conexión real.
- `js/components.js` — componentes UI reutilizables (sidebar, chips, modales, toasts).
- `css/styles.css` — sistema de diseño MATP (colores terracota/tinta/crema, tipografía Poppins/Inter).

> Nota: `src/`, `package.json`'s dependencias de React/Vite y `metadata.json` son remanentes del
> scaffold inicial de Google AI Studio y no los usa la app real (ver `index.html`).

## Correr localmente

No requiere backend ni build. Dos opciones:

```bash
npm run dev
```

Esto levanta un servidor estático vía `npx http-server` en `http://localhost:3000` (no usa Vite/React,
evita el conflicto de peer-dependencies de ese scaffold).

O simplemente sirve la carpeta con cualquier servidor estático, por ejemplo:

```bash
python -m http.server 4173
```
