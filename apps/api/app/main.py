"""FastAPI application factory.

Run with: uvicorn app.main:create_app --factory
"""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
from sqlalchemy import Engine

from app.api.errors import install_error_handlers
from app.api.v1 import api_router
from app.core.config import Settings, get_settings
from app.core.db import check_database, make_engine, make_session_factory
from app.core.health import HealthCheck
from app.core.health import router as health_router
from app.core.storage import ObjectStorage

logger = logging.getLogger("matp.api")

API_DESCRIPTION = """API del Sistema de Gestión y Digitalización de Colecciones del MATP
(uso interno).

- Rutas de negocio bajo `/api/v1`; `/health` y `/health/live` no exponen datos del catálogo.
- Operaciones con `x-status: stub` responden **501** con el change de OpenSpec que las implementará
  (`x-change`) y un ejemplo de respuesta. Las demás tienen `x-status: implemented`.
- Errores con formato uniforme `{code, message, details}` y mensajes en español.
- Identidad **provisional** de desarrollo: cabecera `X-MATP-User` con el correo de un usuario
  sintético (ADR-005); rechazada en producción.
"""

OPENAPI_TAGS = [
    {"name": "Piezas", "description": "Ficha de pieza (catalogo-piezas)."},
    {"name": "Identificadores", "description": "Códigos externos 1:N (identificacion-piezas)."},
    {"name": "Multimedia", "description": "Fotografías por pieza (multimedia)."},
    {"name": "Ubicaciones", "description": "Ubicación jerárquica y movimientos."},
    {"name": "Colecciones", "description": "Colecciones y subcolecciones."},
    {"name": "Vocabularios", "description": "Vocabularios controlados (RN-010)."},
    {"name": "Importación", "description": "Pipeline de reconciliación de Excel."},
    {"name": "Calidad", "description": "Alertas, completitud y duplicados."},
    {"name": "Búsqueda", "description": "Búsqueda por cualquier código y exportación."},
    {"name": "Reportes", "description": "Reportes de inventario y exportación completa."},
    {"name": "IA asistiva", "description": "Sugerencias con aprobación humana (RN-009)."},
    {"name": "Autenticación", "description": "Sesión e identidad."},
    {"name": "Usuarios y roles", "description": "Usuarios, roles y matriz de permisos."},
    {"name": "Auditoría", "description": "Auditoría campo a campo y reversión."},
    {"name": "health", "description": "Verificación técnica sin datos del catálogo."},
]


def operation_id(route: APIRoute) -> str:
    """Stable operationId = handler name (unique across the API; checked by tests)."""
    return route.name


def create_app(
    settings: Settings | None = None,
    health_checks: dict[str, HealthCheck] | None = None,
    engine: Engine | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    owns_engine = engine is None
    engine = engine or make_engine(
        settings.database_url, connect_timeout=settings.health_check_timeout_seconds
    )
    storage = ObjectStorage.from_settings(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        if settings.s3_auto_create_bucket:
            try:
                if storage.ensure_bucket():
                    logger.info("Bucket %s creado", settings.s3_bucket)
            except Exception:  # noqa: BLE001 - storage may start later; health reports it
                logger.warning("No se pudo verificar/crear el bucket %s", settings.s3_bucket)
        yield
        if owns_engine:
            engine.dispose()

    app = FastAPI(
        title="MATP API",
        description=API_DESCRIPTION,
        version=settings.app_version,
        lifespan=lifespan,
        openapi_tags=OPENAPI_TAGS,
        generate_unique_id_function=operation_id,
    )
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = make_session_factory(engine)
    app.state.storage = storage
    app.state.health_checks = (
        health_checks
        if health_checks is not None
        else {"database": lambda: check_database(engine), "storage": storage.check}
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    install_error_handlers(app)
    app.include_router(health_router)
    app.include_router(api_router)
    mount_ai_app(app, settings)
    return app


def mount_ai_app(app: FastAPI, settings: Settings) -> None:
    """Monta la IA asistiva en el mismo proceso y contenedor que la API (ADR-008).

    Sigue siendo una aplicación ASGI aparte, con su propio contrato
    (`docs/api/ai-openapi.json`) y su interfaz `AIProvider`, de modo que puede volver a
    desplegarse por separado sin cambiar el código de la API.
    """
    from matp_ai.config import load_settings as load_ai_settings
    from matp_ai.main import create_app as create_ai_app

    ai_settings = load_ai_settings(app_env=settings.app_env, app_version=settings.app_version)
    app.mount(settings.ai_mount_path, create_ai_app(ai_settings), name="ai")
