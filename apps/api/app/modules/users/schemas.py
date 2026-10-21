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
                    "auth_mode": "session",
                    "must_change_password": False,
                }
            ]
        }
    )

    id: uuid.UUID
    email: str
    full_name: str
    roles: list[str]
    permissions: list[str]
    auth_mode: str = Field(
        description="session (cookie de sesión, ADR-009) o dev-header (solo pruebas)."
    )
    must_change_password: bool = Field(
        False, description="Hay una contraseña temporal vigente: debe cambiarla antes de seguir."
    )


class LoginRequest(BaseModel):
    """Body of ``POST /auth/login``; ``username`` is the e-mail, as in the team's contract."""

    model_config = ConfigDict(
        json_schema_extra={"examples": [{"username": "admin@matp.local", "password": "********"}]}
    )

    username: str = Field(min_length=3, max_length=254, description="Correo de la cuenta.")
    password: str = Field(min_length=1, max_length=200)


class LoginResponse(Me):
    """The signed-in user plus what the web client needs to keep going (ADR-009 D1, D4).

    The session token itself never appears here: it travels only in the ``HttpOnly`` cookie.
    """

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "id": EX_USER_ID,
                    "email": "catalogador@matp.local",
                    "full_name": "Catalogador (sintético)",
                    "roles": ["CATALOGUER"],
                    "permissions": ["pieces.read", "pieces.update"],
                    "auth_mode": "session",
                    "must_change_password": False,
                    "csrf_token": "6f1c0e5e0b8e4c7aa0d3c9f2b1a45e87",
                    "session_expires_at": EX_DATETIME,
                }
            ]
        }
    )

    csrf_token: str = Field(
        description=(
            "Valor que las escrituras envían en `X-CSRF-Token`. También viaja en la cookie "
            "`matp_csrf`, pero un cliente en otro dominio no puede leerla."
        )
    )
    session_expires_at: datetime = Field(description="Fin absoluto de la sesión (UTC).")


class ChangePasswordRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "current_password": "contraseña-temporal-entregada",
                    "new_password": "una frase larga y propia",
                }
            ]
        }
    )

    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=1, max_length=200)


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


class UserRoleUpdate(BaseModel):
    """Body of ``PUT /users/{id}/role``: replaces the whole set of assigned roles (D3)."""

    model_config = ConfigDict(json_schema_extra={"examples": [{"roles": ["CATALOGUER"]}]})

    roles: list[str] = Field(min_length=1, description="Códigos de rol que quedan asignados.")


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
