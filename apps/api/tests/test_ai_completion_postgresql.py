"""«Completar ficha» con IA on a real PostgreSQL (change ia-completar-ficha, task 2.4).

There is no migration in this change; what is new are the queries: the fields the AI may ask
for (``missing_fields_for_pieces``), the main photo (``ORDER BY is_primary DESC``), the pending
proposal reused by JSON content and applying what was approved with an AI audit origin. Synthetic
data only (RNF-014).
"""

import io
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.db import make_session_factory
from app.core.models_base import new_uuid, utcnow
from app.modules.ai_suggestions import completion
from app.modules.ai_suggestions.apply import apply_approved
from app.modules.ai_suggestions.models import AiFunction, AiSuggestion, SuggestionStatus
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditLog, AuditOrigin
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.catalog.service import create_piece
from app.modules.collections.models import Term, Vocabulary, VocabularyCode
from app.modules.media.models import MediaAsset
from app.modules.users.models import AppUser

pytestmark = pytest.mark.postgres

API_DIR = Path(__file__).resolve().parents[1]
DESCRIPTION = "Caja de madera de cedro, elaborada en Ayacucho (sintético)."


@pytest.fixture(scope="module")
def factory(postgres_url: str) -> Iterator[sessionmaker[Session]]:
    config = Config(str(API_DIR / "alembic.ini"), stdout=io.StringIO())
    config.set_main_option("script_location", str(API_DIR / "alembic"))
    config.attributes["configure_logger"] = False
    config.set_section_option("alembic", "sqlalchemy.url", postgres_url)
    with pytest.MonkeyPatch.context() as patch:
        patch.setenv("DATABASE_URL", postgres_url)  # read by alembic/env.py
        command.upgrade(config, "head")
    engine = create_engine(postgres_url, poolclass=NullPool)
    yield make_session_factory(engine)
    engine.dispose()


def _system(session: Session) -> AuditContext:
    return AuditContext(origin=AuditOrigin.SYSTEM, actor_label="prueba sintética de IA")


def _material_term(session: Session) -> Term:
    vocabulary = session.scalar(
        select(Vocabulary).where(Vocabulary.code == VocabularyCode.MATERIAL)
    )
    if vocabulary is None:
        vocabulary = Vocabulary(id=new_uuid(), code=VocabularyCode.MATERIAL, name="Materiales")
        session.add(vocabulary)
        session.flush()
    term = session.scalar(
        select(Term).where(Term.vocabulary_id == vocabulary.id, Term.code == "MADERA")
    )
    if term is None:
        term = Term(id=new_uuid(), vocabulary_id=vocabulary.id, code="MADERA", label="Madera")
        session.add(term)
        session.flush()
    return term


def test_completion_queries_and_approval_on_postgresql(factory: sessionmaker[Session]) -> None:
    with factory() as session, audit_context(session, _system(session)):
        _material_term(session)
        piece = create_piece(
            session,
            denomination=f"Caja sintética {new_uuid()}",
            tenure_regime=TenureRegime.OWNED,
            description=DESCRIPTION,
        )
        session.flush()
        for primary, order in ((False, 0), (True, 5)):
            asset_id = new_uuid()
            session.add(
                MediaAsset(
                    id=asset_id,
                    piece_id=piece.id,
                    storage_key=f"pieces/{piece.id}/{asset_id}/original.jpg",
                    content_type="image/jpeg",
                    size_bytes=10,
                    content_sha256="0" * 64,
                    is_primary=primary,
                    sort_order=order,
                )
            )
        session.commit()
        piece_id = piece.id

    with factory() as session:
        piece = session.get(Piece, piece_id)
        assert piece is not None
        fields = completion.completable_fields(session, piece)
        assert "materials" in fields and "provenance" in fields
        assert "category" in fields
        photo = completion.main_photo(session, piece)
        assert photo is not None and photo.is_primary  # la principal, aunque no sea la primera

        body, _asset = completion.build_request(session, None, piece, fields)
        proposals, not_found = completion.verified_fields(
            session,
            body,
            [
                {
                    "field": "materials",
                    "value": "MADERA",
                    "confidence": 0.8,
                    "evidence": {"source": "text", "quote": "madera de cedro"},
                },
                {
                    "field": "provenance",
                    "value": "Ayacucho",
                    "confidence": 0.7,
                    "evidence": {"source": "text", "quote": "elaborada en Ayacucho"},
                },
            ],
        )
        assert [p["field"] for p in proposals] == ["materials", "provenance"]
        assert "epoch" in not_found

        suggestion = AiSuggestion(
            id=new_uuid(),
            function_code=AiFunction.RIA_01_EXTRACT_STRUCTURED,
            status=SuggestionStatus.PENDING,
            provider="mock",
            model="mock-deterministic-v1",
            piece_id=piece.id,
            input_data=completion.input_data(piece, body, None, "completar-ficha-v1"),
            output_data={"fields": proposals, "not_found": not_found},
        )
        with audit_context(session, _system(session)):
            session.add(suggestion)
            session.commit()
        suggestion_id = suggestion.id

    with factory() as session:
        piece = session.get(Piece, piece_id)
        assert piece is not None
        # The JSON stored on PostgreSQL comes back equal: the same proposal is reused.
        reused = completion.reusable_suggestion(session, piece, fields)
        assert reused is not None and reused.id == suggestion_id


def test_applying_an_approved_completion_writes_with_ai_origin(
    factory: sessionmaker[Session],
) -> None:
    with factory() as session, audit_context(session, _system(session)):
        term = _material_term(session)
        piece = create_piece(
            session,
            denomination=f"Mate sintético {new_uuid()}",
            tenure_regime=TenureRegime.OWNED,
            description=DESCRIPTION,
        )
        session.commit()
        piece_id, term_id = piece.id, term.id

    with factory() as session:
        piece = session.get(Piece, piece_id)
        assert piece is not None
        suggestion = AiSuggestion(
            id=new_uuid(),
            function_code=AiFunction.RIA_01_EXTRACT_STRUCTURED,
            status=SuggestionStatus.PENDING,
            provider="mock",
            model="mock-deterministic-v1",
            piece_id=piece.id,
            input_data={"kind": completion.COMPLETION_KIND},
            output_data={"fields": [{"field": "materials"}, {"field": "provenance"}]},
        )
        with audit_context(session, _system(session)):
            session.add(suggestion)
            session.commit()
        # The approval as the endpoint leaves it: a decision with a reviewer on record.
        reviewer = AppUser(
            id=new_uuid(),
            email=f"revisora-{new_uuid()}@matp.local",
            full_name="Revisora sintética",
            is_synthetic=True,
        )
        with audit_context(session, _system(session)):
            session.add(reviewer)
            session.commit()
        suggestion.status = SuggestionStatus.APPROVED
        suggestion.approved_data = {
            "fields": [
                {"field": "materials", "value": "MADERA"},
                {"field": "provenance", "value": "Huamanga, Ayacucho"},
            ]
        }
        suggestion.reviewed_by_id = reviewer.id
        suggestion.reviewed_at = utcnow()
        context = AuditContext(
            origin=AuditOrigin.AI, user_id=reviewer.id, origin_ref=str(suggestion.id)
        )
        with audit_context(session, context):
            apply_approved(session, suggestion, piece)
            session.commit()

    with factory() as session:
        piece = session.get(Piece, piece_id)
        assert piece is not None and piece.provenance == "Huamanga, Ayacucho"
        entries = session.scalars(
            select(AuditLog).where(AuditLog.entity_id == piece_id, AuditLog.field == "provenance")
        ).all()
        assert entries and all(e.origin == AuditOrigin.AI for e in entries)
        materials = session.scalars(
            select(AuditLog.new_value).where(
                AuditLog.origin == AuditOrigin.AI, AuditLog.origin_ref.is_not(None)
            )
        ).all()
        assert materials
        assert term_id is not None
