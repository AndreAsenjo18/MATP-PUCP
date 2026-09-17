"""Collections, vocabularies and identifier types.

Spec colecciones-vocabularios; RF-010..RF-012, RN-010.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, SessionDep, require_permission, writer
from app.api.errors import COMMON_ERROR_RESPONSES, ErrorResponse
from app.api.stubs import CHANGE_COLLECTIONS_ADMIN, implemented, not_implemented, stub
from app.core.errors import NotFound
from app.modules.catalog.models import Piece
from app.modules.collections import vocabulary_service
from app.modules.collections.models import Collection, Term, Vocabulary
from app.modules.collections.schemas import (
    CollectionCreate,
    CollectionOut,
    CollectionUpdate,
    TermCreate,
    TermOut,
    TermUpdate,
    VocabularyCreate,
    VocabularyOut,
)
from app.modules.collections.service import (
    create_collection,
    delete_collection,
    update_collection,
)
from app.modules.identification.models import IdentifierType
from app.modules.identification.schemas import (
    IdentifierTypeCreate,
    IdentifierTypeOut,
    IdentifierTypeUpdate,
)
from app.modules.users.sensitive import COLLECTION_SENSITIVE_FIELDS

router = APIRouter(responses=COMMON_ERROR_RESPONSES)

Reader = Annotated[CurrentUser, Depends(require_permission("pieces.read"))]
CollectionManager = Annotated[CurrentUser, Depends(require_permission("collections.manage"))]
VocabularyManager = Annotated[CurrentUser, Depends(require_permission("vocabularies.manage"))]

CONFLICT = {409: {"model": ErrorResponse, "description": "Conflicto con el estado actual."}}
NOT_FOUND = {404: {"model": ErrorResponse, "description": "No existe o fue eliminado."}}


# -------------------------------------------------------------------- collections
def _collection_out(session: Session, collection: Collection, user: CurrentUser) -> CollectionOut:
    count = session.scalar(
        select(func.count()).select_from(Piece).where(Piece.collection_id == collection.id)
    )
    out = CollectionOut.model_validate(collection)
    out.piece_count = count or 0
    for field_name, permission in COLLECTION_SENSITIVE_FIELDS.items():
        if not user.can(permission):
            setattr(out, field_name, None)
            out.masked_fields.append(field_name)
    return out


def _get_collection(session: Session, collection_id: uuid.UUID) -> Collection:
    collection = session.get(Collection, collection_id)
    if collection is None or collection.deleted_at is not None:
        raise NotFound("La colección no existe o fue eliminada.")
    return collection


@router.get(
    "/collections",
    response_model=list[CollectionOut],
    summary="Listar colecciones y subcolecciones (plano, con parent_id)",
    tags=["Colecciones"],
    **implemented(),
)
def list_collections(
    session: SessionDep,
    user: Reader,
    include_inactive: Annotated[bool, Query(description="Incluye colecciones inactivas.")] = True,
) -> list[CollectionOut]:
    statement = select(Collection).order_by(Collection.name)
    if not include_inactive:
        statement = statement.where(Collection.is_active.is_(True))
    return [_collection_out(session, item, user) for item in session.scalars(statement)]


@router.post(
    "/collections",
    response_model=CollectionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crear una colección o subcolección (sigla normalizada única)",
    tags=["Colecciones"],
    **implemented(),
)
def create_collection_endpoint(
    body: CollectionCreate, session: SessionDep, user: CollectionManager
) -> CollectionOut:
    collection = create_collection(writer(session, user), **body.model_dump())
    session.commit()
    return _collection_out(session, collection, user)


@router.get(
    "/collections/{collection_id}",
    response_model=CollectionOut,
    responses=NOT_FOUND,
    summary="Detalle de una colección",
    tags=["Colecciones"],
    **implemented(),
)
def get_collection(collection_id: uuid.UUID, session: SessionDep, user: Reader) -> CollectionOut:
    return _collection_out(session, _get_collection(session, collection_id), user)


@router.patch(
    "/collections/{collection_id}",
    response_model=CollectionOut,
    responses={**NOT_FOUND, **CONFLICT},
    summary="Editar o mover una colección (sin ciclos)",
    tags=["Colecciones"],
    **implemented(),
)
def update_collection_endpoint(
    collection_id: uuid.UUID, body: CollectionUpdate, session: SessionDep, user: CollectionManager
) -> CollectionOut:
    collection = _get_collection(session, collection_id)
    update_collection(writer(session, user), collection, body.model_dump(exclude_unset=True))
    session.commit()
    return _collection_out(session, collection, user)


@router.delete(
    "/collections/{collection_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**NOT_FOUND, **CONFLICT},
    summary="Eliminar lógicamente una colección vacía, con motivo (RN-005)",
    tags=["Colecciones"],
    **implemented(),
)
def delete_collection_endpoint(
    collection_id: uuid.UUID,
    reason: Annotated[str, Query(min_length=3, description="Motivo obligatorio.")],
    session: SessionDep,
    user: CollectionManager,
) -> Response:
    collection = _get_collection(session, collection_id)
    delete_collection(writer(session, user, reason), collection, reason)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ------------------------------------------------------------------- vocabularies
def _term_out(term: Term, vocabulary: Vocabulary) -> TermOut:
    return TermOut(
        id=term.id,
        vocabulary_code=vocabulary.code,
        code=term.code,
        label=term.label,
        description=term.description,
        sort_order=term.sort_order,
        is_active=term.is_active,
        external_uri=term.external_uri,
    )


@router.get(
    "/vocabularies",
    response_model=list[VocabularyOut],
    summary="Listar vocabularios controlados",
    tags=["Vocabularios"],
    **implemented(),
)
def list_vocabularies(session: SessionDep, user: Reader) -> list[VocabularyOut]:
    counts = dict(
        session.execute(
            select(Term.vocabulary_id, func.count(Term.id)).group_by(Term.vocabulary_id)
        ).all()
    )
    return [
        VocabularyOut(
            id=vocabulary.id,
            code=vocabulary.code,
            name=vocabulary.name,
            description=vocabulary.description,
            term_count=counts.get(vocabulary.id, 0),
        )
        for vocabulary in session.scalars(select(Vocabulary).order_by(Vocabulary.code))
    ]


@router.post(
    "/vocabularies",
    response_model=VocabularyOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crear un vocabulario nuevo",
    tags=["Vocabularios"],
    **stub(CHANGE_COLLECTIONS_ADMIN),
)
def create_vocabulary(body: VocabularyCreate, user: VocabularyManager) -> VocabularyOut:
    raise not_implemented(CHANGE_COLLECTIONS_ADMIN, VocabularyOut)


@router.get(
    "/vocabularies/{vocabulary_code}",
    response_model=VocabularyOut,
    responses=NOT_FOUND,
    summary="Detalle de un vocabulario",
    tags=["Vocabularios"],
    **implemented(),
)
def get_vocabulary(vocabulary_code: str, session: SessionDep, user: Reader) -> VocabularyOut:
    vocabulary = vocabulary_service.get_vocabulary(session, vocabulary_code)
    count = session.scalar(
        select(func.count()).select_from(Term).where(Term.vocabulary_id == vocabulary.id)
    )
    return VocabularyOut(
        id=vocabulary.id,
        code=vocabulary.code,
        name=vocabulary.name,
        description=vocabulary.description,
        term_count=count or 0,
    )


@router.get(
    "/vocabularies/{vocabulary_code}/terms",
    response_model=list[TermOut],
    responses=NOT_FOUND,
    summary="Términos de un vocabulario (activos por defecto)",
    tags=["Vocabularios"],
    **implemented(),
)
def list_terms(
    vocabulary_code: str,
    session: SessionDep,
    user: Reader,
    include_inactive: bool = False,
) -> list[TermOut]:
    vocabulary = vocabulary_service.get_vocabulary(session, vocabulary_code)
    statement = select(Term).where(Term.vocabulary_id == vocabulary.id)
    if not include_inactive:
        statement = statement.where(Term.is_active.is_(True))
    rows = session.scalars(statement.order_by(Term.sort_order, Term.label))
    return [_term_out(term, vocabulary) for term in rows]


@router.post(
    "/vocabularies/{vocabulary_code}/terms",
    response_model=TermOut,
    status_code=status.HTTP_201_CREATED,
    responses=NOT_FOUND,
    summary="Agregar un término (sin duplicar código ni etiqueta)",
    tags=["Vocabularios"],
    **implemented(),
)
def create_term(
    vocabulary_code: str, body: TermCreate, session: SessionDep, user: VocabularyManager
) -> TermOut:
    vocabulary = vocabulary_service.get_vocabulary(session, vocabulary_code)
    term = vocabulary_service.create_term(writer(session, user), vocabulary, **body.model_dump())
    session.commit()
    return _term_out(term, vocabulary)


@router.patch(
    "/vocabularies/{vocabulary_code}/terms/{term_id}",
    response_model=TermOut,
    responses=NOT_FOUND,
    summary="Editar o desactivar un término",
    tags=["Vocabularios"],
    **implemented(),
)
def update_term(
    vocabulary_code: str,
    term_id: uuid.UUID,
    body: TermUpdate,
    session: SessionDep,
    user: VocabularyManager,
) -> TermOut:
    vocabulary = vocabulary_service.get_vocabulary(session, vocabulary_code)
    term = vocabulary_service.get_term(session, vocabulary, term_id)
    vocabulary_service.update_term(writer(session, user), term, body.model_dump(exclude_unset=True))
    session.commit()
    return _term_out(term, vocabulary)


@router.delete(
    "/vocabularies/{vocabulary_code}/terms/{term_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**NOT_FOUND, **CONFLICT},
    summary="Eliminar lógicamente un término no usado (si está en uso, desactívelo)",
    tags=["Vocabularios"],
    **implemented(),
)
def delete_term(
    vocabulary_code: str,
    term_id: uuid.UUID,
    reason: Annotated[str, Query(min_length=3, description="Motivo obligatorio.")],
    session: SessionDep,
    user: VocabularyManager,
) -> Response:
    vocabulary = vocabulary_service.get_vocabulary(session, vocabulary_code)
    term = vocabulary_service.get_term(session, vocabulary, term_id)
    vocabulary_service.delete_term(writer(session, user, reason), term, reason)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------------------- identifier types
@router.get(
    "/identifier-types",
    response_model=list[IdentifierTypeOut],
    summary="Tipos de identificador parametrizables (RN-010)",
    tags=["Identificadores"],
    **implemented(),
)
def list_identifier_types(session: SessionDep, user: Reader) -> list[IdentifierTypeOut]:
    rows = session.scalars(select(IdentifierType).order_by(IdentifierType.sort_order))
    return [IdentifierTypeOut.model_validate(row) for row in rows]


@router.post(
    "/identifier-types",
    response_model=IdentifierTypeOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crear un tipo de identificador",
    tags=["Identificadores"],
    **stub(CHANGE_COLLECTIONS_ADMIN),
)
def create_identifier_type(
    body: IdentifierTypeCreate, user: VocabularyManager
) -> IdentifierTypeOut:
    raise not_implemented(CHANGE_COLLECTIONS_ADMIN, IdentifierTypeOut)


@router.patch(
    "/identifier-types/{type_code}",
    response_model=IdentifierTypeOut,
    summary="Editar o desactivar un tipo de identificador",
    tags=["Identificadores"],
    **stub(CHANGE_COLLECTIONS_ADMIN),
)
def update_identifier_type(
    type_code: str, body: IdentifierTypeUpdate, user: VocabularyManager
) -> IdentifierTypeOut:
    raise not_implemented(CHANGE_COLLECTIONS_ADMIN, IdentifierTypeOut)
