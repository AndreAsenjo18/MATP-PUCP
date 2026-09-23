# apps/web — Interfaz web del MATP (Next.js)

Next.js (App Router) + TypeScript + Tailwind CSS. Generado con `create-next-app` y adaptado al monorepo
(npm workspaces; las dependencias se instalan desde la raíz con `npm install`).

- `npm run dev -w apps/web` — servidor de desarrollo en http://localhost:3000
- `npm run lint -w apps/web` · `npm run test -w apps/web` · `npm run build -w apps/web`

Variables: `API_INTERNAL_URL` (URL de la API vista desde el servidor Next) y `AI_MOUNT_PATH` (ruta donde la API monta la IA, `/ai` por defecto).
Antes de escribir código lee `AGENTS.md`: la versión instalada de Next.js puede diferir de lo que conoces.
