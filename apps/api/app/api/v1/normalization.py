"""Normalization parameters and acronym aliases (spec identificacion-piezas: RN-010, RF-023).

Change ``plantillas-mapeo-y-normalizacion``, task 2.3 (design D5): operations added to the
contract (``docs/api/mapeo-endpoints-v1.md``). Every operation requires ``vocabularies.manage``
(Gestor de colecciones, Administrador) [SUPUESTO T8]. A change that would alter identifiers
already stored answers ``409 normalization_change_requires_preview`` with how many and some
examples, and saves nothing (the recalculation flow belongs to colecciones-y-vocabularios-admin).
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, SessionDep, require_permission, writer
from app.api.errors import COMMON_ERROR_RESPONSES, ErrorResponse
from app.api.stubs import implemented
from app.modules.collections.models import Collection
from app.modules.identification import params_admin
from app.modules.identification.models import CollectionAcronymAlias
from app.modules.identification.params_schemas import (
    AcronymAliasCreate,
    AcronymAliasOut,
    ConcatenationSeparators,
    NormalizationSettingKey,
    NormalizationSettingOut,
    NormalizationSettingUpdate,
    setting_value,
)

router = APIRouter(responses=COMMON_ERROR_RESPONSES, tags=["Identificadores"])

ParamsManager = Annotated[CurrentUser, Depends(require_permission("vocabularies.manage"))]

IMPACT = {
    409: {
        "model": ErrorResponse,
        "description": "`normalization_change_requires_preview`: el cambio alteraría "
        "identificadores ya registrados (cuántos y ejemplos en `details`); no se guardó nada.",
    }
}


def _setting_out(session: Session, key: str) -> NormalizationSettingOut:
    setting = params_admin.get_setting(session, key)
    return NormalizationSettingOut(
        key=key,  # type: ignore[arg-type]
        value=setting_value(key, setting.value if setting else params_admin.default_value(key)),
        is_default=setting is None,
        updated_at=setting.updated_at if setting else None,
    )


def _alias_out(session: Session, alias: CollectionAcronymAlias) -> AcronymAliasOut:
    collection = session.get(Collection, alias.collection_id)
    assert collection is not None
    return AcronymAliasOut(
        id=alias.id,
        alias=alias.alias,
        alias_normalized=alias.alias_normalized,
        collection_id=alias.collection_id,
        collection_name=collection.name,
        collection_acronym=collection.acronym,
        created_at=alias.created_at,
    )


@router.get(
    "/normalization-settings/{key}",
    response_model=NormalizationSettingOut,
    summary="Parámetro de normalización vigente (RN-010)",
    description="Marcadores de ausencia (`absence_markers`), separadores de códigos "
    "concatenados (`concatenation_separators`), correspondencias forma de adquisición → "
    "régimen (`tenure_aliases`) o patrones de nombres de cámara de las fotos "
    "(`photo_camera_patterns`); sin valor guardado, el del código.",
    **implemented(),
)
def get_normalization_setting(
    key: NormalizationSettingKey, session: SessionDep, user: ParamsManager
) -> NormalizationSettingOut:
    return _setting_out(session, key)


@router.put(
    "/normalization-settings/{key}",
    response_model=NormalizationSettingOut,
    responses=IMPACT,
    summary="Cambiar un parámetro de normalización (RN-010, RF-023)",
    description="Se aplica en adelante al ingreso manual, la importación y la búsqueda. Queda "
    "en la auditoría.",
    **implemented(),
)
def put_normalization_setting(
    key: NormalizationSettingKey,
    body: NormalizationSettingUpdate,
    session: SessionDep,
    user: ParamsManager,
) -> NormalizationSettingOut:
    value = (
        body.value.model_dump() if isinstance(body.value, ConcatenationSeparators) else body.value
    )
    params_admin.save_setting(writer(session, user), key, value)
    session.commit()
    return _setting_out(session, key)


@router.get(
    "/collection-acronym-aliases",
    response_model=list[AcronymAliasOut],
    summary="Siglas históricas de colección vigentes (RF-023)",
    **implemented(),
)
def list_acronym_aliases(session: SessionDep, user: ParamsManager) -> list[AcronymAliasOut]:
    return [_alias_out(session, alias) for alias in params_admin.list_aliases(session)]


@router.post(
    "/collection-acronym-aliases",
    response_model=AcronymAliasOut,
    status_code=status.HTTP_201_CREATED,
    responses={
        **IMPACT,
        404: {"model": ErrorResponse, "description": "La colección no existe."},
    },
    summary="Registrar una sigla histórica de una colección (RF-023)",
    description="El alias es único entre los activos (`acronym_alias_taken`) y no puede ser la "
    "sigla actual de una colección (`alias_is_current_acronym`).",
    **implemented(),
)
def create_acronym_alias(
    body: AcronymAliasCreate, session: SessionDep, user: ParamsManager
) -> AcronymAliasOut:
    alias = params_admin.create_alias(writer(session, user), body.alias, body.collection_id)
    session.commit()
    return _alias_out(session, alias)


@router.delete(
    "/collection-acronym-aliases/{alias_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        **IMPACT,
        404: {"model": ErrorResponse, "description": "El alias no existe o ya fue eliminado."},
    },
    summary="Eliminar lógicamente una sigla histórica con motivo (RN-005)",
    **implemented(),
)
def delete_acronym_alias(
    alias_id: uuid.UUID,
    reason: Annotated[str, Query(min_length=3, description="Motivo obligatorio.")],
    session: SessionDep,
    user: ParamsManager,
) -> Response:
    alias = params_admin.get_alias(session, alias_id)
    params_admin.delete_alias(writer(session, user, reason), alias, reason)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
