# syntax=docker/dockerfile:1
# MATP API + IA asistiva en un solo contenedor (ADR-008). Imagen base verificada el 2026-09-17 (ADR-003).
# Contexto de construcción = raíz del repositorio (necesita apps/api y services/ai).
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN groupadd --system matp && useradd --system --gid matp --home-dir /app matp

# Dependencies first to leverage layer caching.
COPY apps/api/pyproject.toml apps/api/README.md ./
COPY services/ai/pyproject.toml services/ai/README.md /ai/
RUN mkdir app && touch app/__init__.py \
 && mkdir /ai/matp_ai && touch /ai/matp_ai/__init__.py \
 && pip install . && pip install /ai \
 && rm -rf app build *.egg-info /ai/matp_ai /ai/build /ai/*.egg-info

# The AI application is a separate package mounted by app.main (same process, same container).
COPY services/ai /ai
RUN pip install --no-deps /ai

COPY apps/api .
RUN pip install --no-deps . && chown -R matp:matp /app /ai

USER matp
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health/live', timeout=4).status == 200 else 1)"

CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
