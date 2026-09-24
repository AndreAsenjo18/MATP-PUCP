"""Version 1 of the MATP REST API (contract: docs/api/openapi.json)."""

from fastapi import APIRouter

from app.api.v1 import (
    admin,
    collections,
    imports,
    locations,
    media,
    pieces,
    quality_reports,
)

API_PREFIX = "/api/v1"

api_router = APIRouter(prefix=API_PREFIX)
for module in (pieces, collections, locations, media, imports, quality_reports, admin):
    api_router.include_router(module.router)
