import type { NextConfig } from "next";
import path from "node:path";

/**
 * El navegador llama a la API por ruta relativa (`/api/v1/...`, mismo origen; design D9 del
 * change `despliegue-vm-y-respaldos`). En local, estas `rewrites` reenvían `/api/*` y `/health`
 * a `API_INTERNAL_URL`; en staging y producción ese enrutamiento lo hace Caddy antes de llegar
 * a este servidor.
 *
 * Con `output: "standalone"` Next.js serializa las rutas (incluidas las rewrites) al compilar,
 * por lo que el valor efectivo de `API_INTERNAL_URL` queda fijado en **build time**: el
 * `Dockerfile` lo declara como `ARG`/`ENV` y en compose se pasa como build arg
 * (`http://api:8000`). En `npm run dev:web` (sin contenedor) la variable se lee del `.env` en
 * cada arranque y por defecto es `http://localhost:8000`.
 */
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  // Self-contained server for the Docker image (see apps/web/Dockerfile).
  output: "standalone",
  // npm workspaces hoist dependencies to the repository root.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_INTERNAL_URL}/api/:path*` },
      { source: "/health", destination: `${API_INTERNAL_URL}/health` },
    ];
  },
};

export default nextConfig;
