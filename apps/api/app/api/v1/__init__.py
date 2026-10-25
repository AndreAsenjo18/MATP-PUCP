"""Version 1 of the MATP REST API (contract: docs/api/openapi.json)."""

from fastapi import APIRouter

from app.api.v1 import (
    admin,
    audit_revert,
    collections,
    imports,
    loans,
    locations,
    media,
    normalization,
    pieces,
    quality_reports,
    trash,
)
from app.modules.exports.router import router as exports_router

API_PREFIX = "/api/v1"

api_router = APIRouter(prefix=API_PREFIX)
for module in (
    pieces,
    collections,
    locations,
    loans,
    media,
    imports,
    normalization,
    quality_reports,
    admin,
    audit_revert,
    trash,
):
    api_router.include_router(module.router)
api_router.include_router(exports_router)
