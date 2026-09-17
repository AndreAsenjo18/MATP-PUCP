# syntax=docker/dockerfile:1
# MATP AI service (FastAPI, mock provider by default). Base image checked on 2026-09-17 (ADR-003).
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN groupadd --system matp && useradd --system --gid matp --home-dir /app matp

COPY pyproject.toml README.md ./
RUN mkdir app && touch app/__init__.py && pip install . && rm -rf app build *.egg-info

COPY . .
RUN pip install --no-deps . && chown -R matp:matp /app

USER matp
EXPOSE 8100

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8100/health', timeout=4).status == 200 else 1)"

CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8100"]
