"""API schemas for authentication, users and roles (spec usuarios-roles; RF-039, RNF-012)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.api.refs import EX_DATETIME, EX_USER_ID


class Me(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "id": EX_USER_ID,
                    "email": "catalogador@matp.local",
                    "full_name": "Catalogador (sintético)",
                    "roles": ["CATALOGUER"],
                    "permissions": ["pieces.read", "pieces.update"],
                    "auth_mode": "dev-header",
                }
            ]
        }
    )

    id: uuid.UUID
    email: str
    full_name: str
    roles: list[str]
    permissions: list[str]
    auth_mode: str = Field(description="dev-header (provisional, ADR-005) o jwt.")


class LoginRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={"examples": [{"email": "admin@matp.local", "password": "********"}]}
    )

    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=200)


class TokenResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [{"access_token": "eyJ...", "token_type": "bearer", "expires_in": 3600}]
        }
    )

    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserOut(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "id": EX_USER_ID,
                    "email": "catalogador@matp.local",
                    "full_name": "Catalogador (sintético)",
                    "is_active": True,
                    "roles": ["CATALOGUER"],
                    "last_login_at": None,
                    "locked_until": None,
                    "created_at": EX_DATETIME,
                }
            ]
        }
    )

    id: uuid.UUID
    email: str
    full_name: str
    is_active: bool
    roles: list[str]
    last_login_at: datetime | None
    locked_until: datetime | None
    created_at: datetime


class UserCreate(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    full_name: str = Field(min_length=1, max_length=200)
    roles: list[str] = Field(min_length=1)
    initial_password: str | None = Field(None, min_length=12)


class UserUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=200)
    is_active: bool | None = None
    roles: list[str] | None = None


class RoleOut(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "code": "INTERNAL_VIEWER",
                    "name": "Consulta interna",
                    "description": None,
                    "is_enabled": True,
                    "permissions": ["pieces.read", "reports.view"],
                }
            ]
        }
    )

    code: str
    name: str
    description: str | None
    is_enabled: bool
    permissions: list[str]


class PermissionOut(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "examples": [{"code": "pieces.read", "description": "Consultar fichas de piezas"}]
        },
    )

    code: str
    description: str


class RolePermissionsUpdate(BaseModel):
    permissions: list[str]
    reason: str = Field(min_length=3)
