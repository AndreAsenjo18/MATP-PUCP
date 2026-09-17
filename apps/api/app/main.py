"""FastAPI application factory.

Run with: uvicorn app.main:create_app --factory
"""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import Settings, get_settings
from app.core.db import check_database, make_engine, make_session_factory
from app.core.health import HealthCheck
from app.core.health import router as health_router
from app.core.storage import ObjectStorage

logger = logging.getLogger("matp.api")


def create_app(
    settings: Settings | None = None,
    health_checks: dict[str, HealthCheck] | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    engine = make_engine(
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
        engine.dispose()

    app = FastAPI(
        title="MATP API",
        description=(
            "API del Sistema de Gestión y Digitalización de Colecciones del MATP (uso interno)."
        ),
        version=settings.app_version,
        lifespan=lifespan,
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
    app.include_router(health_router)
    return app
