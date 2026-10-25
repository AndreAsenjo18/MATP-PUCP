"""Rule change and conservation history against a real PostgreSQL (colecciones-y-vocabularios-admin).

Task 6.1 repeats 2.4 and 3.1 on PostgreSQL: the recalculation of a locked type goes through the
flush guard of RN-002 and the partial unique index of current inventory codes, and the current
conservation state compares timezone-aware dates in SQL, none of which SQLite exercises the same
way (Req: Cambio controlado de la regla de normalización; Req: Historial de evaluaciones de
conservación por API; RF-012, RF-023, RN-002). Synthetic data only (RNF-014).
"""

import io
import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.db import make_session_factory
from app.core.errors import ConflictError
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditLog, AuditOrigin
from app.modules.catalog.conservation import record_assessment
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.catalog.service import create_piece
from app.modules.collections.models import Term, Vocabulary
from app.modules.identification import types_admin
from app.modules.identification.models import NormalizationRule, PieceIdentifier
from app.modules.identification.service import add_identifier
from app.modules.users.models import AppUser
from app.seed.synthetic import SeedOptions, run_seed

pytestmark = pytest.mark.postgres

API_DIR = Path(__file__).resolve().parents[1]


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
    sessions = make_session_factory(engine)
    with sessions() as session:
        run_seed(session, SeedOptions(upload_media=False))
        session.commit()
    yield sessions
    engine.dispose()


def _admin(session: Session) -> AuditContext:
    admin_id = session.scalar(select(AppUser.id).where(AppUser.email == "admin@matp.local"))
    assert admin_id is not None
    return AuditContext(origin=AuditOrigin.MANUAL, user_id=admin_id)


def _type_with_pieces(
    sessions: sessionmaker[Session], *values: str, **flags: bool
) -> tuple[str, list[uuid.UUID]]:
    code = f"PG_{uuid.uuid4().hex[:6].upper()}"
    with sessions() as session, audit_context(session, _admin(session)):
        identifier_type = types_admin.create_identifier_type(
            session,
            code=code,
            label=f"Tipo {code} (sintético)",
            description=None,
            normalization_rule=NormalizationRule.GENERIC,
            sort_order=90,
        )
        for name, value in flags.items():
            setattr(identifier_type, name, value)
        session.flush()
        pieces = []
        for value in values:
            piece = create_piece(
                session, denomination=f"Pieza {code} {value}", tenure_regime=TenureRegime.OWNED
            )
            add_identifier(session, piece, code, value)
            pieces.append(piece.id)
        session.commit()
    return code, pieces


def _change_rule(sessions: sessionmaker[Session], code: str, token: str | None) -> int:
    with sessions() as session, audit_context(session, _admin(session)):
        identifier_type = types_admin.get_type(session, code)
        changed = types_admin.update_identifier_type(
            session,
            identifier_type,
            {"normalization_rule": NormalizationRule.INVENTORY},
            confirm_token=token,
        )
        session.commit()
    return changed


def _token(sessions: sessionmaker[Session], code: str) -> str:
    with sessions() as session:
        identifier_type = types_admin.get_type(session, code)
        return types_admin.preview_rule_change(
            session, identifier_type, NormalizationRule.INVENTORY
        ).confirm_token


def test_a_locked_type_is_recalculated_as_an_audited_correction(
    factory: sessionmaker[Session],
) -> None:
    code, _pieces = _type_with_pieces(factory, "I-0041", "I 0042", locks_on_assignment=True)

    changed = _change_rule(factory, code, _token(factory, code))

    assert changed == 2
    with factory() as session:
        identifiers = session.scalars(
            select(PieceIdentifier).where(PieceIdentifier.identifier_type_code == code)
        ).all()
        assert sorted(i.normalized_value or "" for i in identifiers) == ["I-41", "I-42"]
        assert all(i.is_locked for i in identifiers)
        entries = session.scalars(
            select(AuditLog).where(
                AuditLog.entity_id.in_([i.id for i in identifiers]),
                AuditLog.origin == AuditOrigin.SYSTEM,
            )
        ).all()
    assert {entry.field for entry in entries} >= {"normalized_value"}


def test_collisions_and_stale_previews_are_rejected(factory: sessionmaker[Session]) -> None:
    code, _pieces = _type_with_pieces(factory, "I-0051", "I 51", is_unique_when_current=True)
    with pytest.raises(ConflictError) as collision:
        _change_rule(factory, code, _token(factory, code))
    assert collision.value.code == "normalization_collision"

    other, _ = _type_with_pieces(factory, "I-0061")
    token = _token(factory, other)
    with factory() as session, audit_context(session, _admin(session)):
        piece = create_piece(session, denomination="Pieza tardía", tenure_regime=TenureRegime.OWNED)
        add_identifier(session, piece, other, "I-0062")
        session.commit()
    with pytest.raises(ConflictError) as stale:
        _change_rule(factory, other, token)
    assert stale.value.code == "normalization_change_requires_preview"


def test_an_old_assessment_keeps_the_current_state(factory: sessionmaker[Session]) -> None:
    with factory() as session, audit_context(session, _admin(session)):
        terms = {
            term.code: term.id
            for term in session.scalars(
                select(Term)
                .join(Vocabulary, Vocabulary.id == Term.vocabulary_id)
                .where(Vocabulary.code == "CONSERVATION_STATUS")
            )
        }
        piece = create_piece(
            session, denomination="Pieza evaluada pg", tenure_regime=TenureRegime.OWNED
        )
        record_assessment(session, piece, status_term_id=terms["BUENO"])
        record_assessment(
            session,
            piece,
            status_term_id=terms["MALO"],
            assessed_at=datetime.now(UTC) - timedelta(days=730),
        )
        session.commit()
        piece_id = piece.id

    with factory() as session:
        stored = session.get(Piece, piece_id)
        assert stored is not None and stored.conservation_state_id == terms["BUENO"]
