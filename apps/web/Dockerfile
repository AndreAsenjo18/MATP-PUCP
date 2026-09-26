# syntax=docker/dockerfile:1
# MATP web (Next.js standalone). Build context: repository root (npm workspaces).
# Base image checked on 2026-09-17: Node 24 LTS (ADR-003).
FROM node:24-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace apps/web --include-workspace-root=false

FROM node:24-alpine AS build
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
# Modo de datos de la maqueta (change maqueta-ui-navegable): NEXT_PUBLIC_* se incrusta en el
# bundle del navegador en tiempo de build, por eso son build args y no variables de runtime.
# NEXT_PUBLIC_API_URL vacía = mismo origen (recomendado; design D9): el navegador llama a
# /api/v1 y las rewrites de next.config.ts (fijadas en build time con output standalone) o
# Caddy enrutan a la API. API_INTERNAL_URL es el destino de esas rewrites en este build.
ARG NEXT_PUBLIC_API_MODE=live
ARG NEXT_PUBLIC_API_URL=
ARG API_INTERNAL_URL=http://api:8000
ENV NEXT_PUBLIC_API_MODE=$NEXT_PUBLIC_API_MODE \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    API_INTERNAL_URL=$API_INTERNAL_URL
COPY --from=deps /repo/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/web ./apps/web
RUN npm run build -w apps/web

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S matp && adduser -S matp -G matp
COPY --from=build --chown=matp:matp /repo/apps/web/.next/standalone ./
COPY --from=build --chown=matp:matp /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=matp:matp /repo/apps/web/public ./apps/web/public
USER matp
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1
CMD ["node", "apps/web/server.js"]
