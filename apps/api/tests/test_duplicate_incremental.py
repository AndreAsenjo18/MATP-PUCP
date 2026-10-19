"""Spec calidad-datos — incremental duplicate detection on create or edit (task 2.4, design D3).

The catalogue and identification services are used as they are: a session listener queues the
piece in ``quality_job_item`` and ``process_pending_items`` (the worker's drain) detects its pairs.
"""

from collections.abc import Callable, Iterator

import pytest
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.db import make_session_factory
from app.models import Collection, DuplicateCandidate, Piece, QualityJob
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece, update_piece
from app.modules.collections.service import create_collection
from app.modules.identification.normalization import TYPE_COLLECTION
from app.modules.identification.service import add_identifier
from app.modules.quality import incremental
from app.modules.quality.incremental import QUEUE, process_pending_items
from app.modules.quality.models import (
    DuplicateStatus,
    QualityJobItem,
    QualityJobItemReason,
    QualityJobItemStatus,
)
from tests.conftest import ActAs


@pytest.fixture
def factory(engine: Engine) -> sessionmaker[Session]:
    return make_session_factory(engine)


@pytest.fixture
def collection(session: Session, act_as: ActAs) -> Collection:
    with act_as("ADMIN"):
        created = create_collection(session, name="Colección RA (ficticia)", acronym="RA")
        session.commit()
    return created


@pytest.fixture
def make_piece(session: Session, act_as: ActAs, collection: Collection) -> Callable[..., Piece]:
    def make(denomination: str, **fields: object) -> Piece:
        values: dict[str, object] = {
            "collection_id": collection.id,
            "author": "Taller Urbano (ficticio)",
            "provenance": "Ayacucho",
            "epoch_start_year": 1945,
            "epoch_end_year": 1955,
        }
        values.update(fields)
        with act_as("CATALOGUER"):
            piece = create_piece(
                session, denomination=denomination, tenure_regime=TenureRegime.OWNED, **values
            )
            session.commit()
        return piece

    return make


def _pending(session: Session) -> list[QualityJobItem]:
    return list(
        session.scalars(
            select(QualityJobItem).where(QualityJobItem.status == QualityJobItemStatus.PENDING)
        ).all()
    )


def _pair(session: Session, a: Piece, b: Piece) -> DuplicateCandidate | None:
    return session.scalars(
        select(DuplicateCandidate).where(
            DuplicateCandidate.piece_a_id.in_([a.id, b.id]),
            DuplicateCandidate.piece_b_id.in_([a.id, b.id]),
        )
    ).first()


@pytest.fixture
def drained(factory: sessionmaker[Session]) -> Iterator[Callable[[], int]]:
    def drain() -> int:
        return process_pending_items(factory)

    yield drain


def test_creating_a_piece_queues_it_once(
    session: Session, act_as: ActAs, make_piece: Callable[..., Piece]
) -> None:
    piece = make_piece("Caja de imaginero")
    items = _pending(session)
    assert [(item.piece_id, item.reason) for item in items] == [
        (piece.id, QualityJobItemReason.PIECE_CREATED)
    ]
    with act_as("CATALOGUER"):  # identifiers in the same transaction do not queue it again
        other = create_piece(session, denomination="Mate", tenure_regime=TenureRegime.OWNED)
        add_identifier(session, other, TYPE_COLLECTION, "RA 12")
        session.commit()
    assert sum(item.piece_id == other.id for item in _pending(session)) == 1


def test_incremental_detection_when_editing_the_denomination(
    session: Session,
    act_as: ActAs,
    make_piece: Callable[..., Piece],
    drained: Callable[[], int],
) -> None:
    """Spec: «Detección incremental al editar» — no full scan is needed."""
    a = make_piece("Retablo ayacuchano de tres pisos")
    b = make_piece("Caja de imaginero")
    assert drained() == 2
    session.expire_all()
    assert _pair(session, a, b) is None

    with act_as("CATALOGUER"):
        update_piece(session, b, denomination="Retablo ayacuchano de 3 pisos")
        session.commit()
    assert [(i.piece_id, i.reason) for i in _pending(session)] == [
        (b.id, QualityJobItemReason.PIECE_UPDATED)
    ]
    assert drained() == 1
    session.expire_all()
    candidate = _pair(session, a, b)
    assert candidate is not None
    assert candidate.status == DuplicateStatus.PENDING
    assert {s["signal"] for s in candidate.matched_fields} >= {
        "denomination",
        "collection",
        "author_provenance",
        "epoch",
    }
    assert session.scalar(select(func.count()).select_from(QualityJob)) == 0  # no full scan
    assert _pending(session) == []


def test_a_shared_code_added_later_enters_the_queue(
    session: Session,
    act_as: ActAs,
    make_piece: Callable[..., Piece],
    drained: Callable[[], int],
) -> None:
    """Spec: «Par distinto con datos modificados» — a new identifier is a comparison change."""
    a = make_piece("Vasija ceremonial", author=None, provenance="Cusco")
    b = make_piece("Mate burilado", author=None, provenance="Puno")
    with act_as("CATALOGUER"):
        add_identifier(session, a, TYPE_COLLECTION, "RA 12")
        session.commit()
    drained()
    with act_as("CATALOGUER"):
        add_identifier(session, b, TYPE_COLLECTION, "R.A. 012")
        session.commit()
    assert [(i.piece_id, i.reason) for i in _pending(session)] == [
        (b.id, QualityJobItemReason.IDENTIFIER_CHANGED)
    ]
    drained()
    session.expire_all()
    candidate = _pair(session, a, b)
    assert candidate is not None
    assert candidate.matched_fields[0]["field"] == f"identifier:{TYPE_COLLECTION}"


def test_editing_a_field_that_is_not_compared_does_not_queue_the_piece(
    session: Session,
    act_as: ActAs,
    make_piece: Callable[..., Piece],
    drained: Callable[[], int],
) -> None:
    piece = make_piece("Caja de imaginero")
    drained()
    with act_as("CATALOGUER"):
        update_piece(session, piece, notes="Revisada en depósito")
        session.commit()
    assert _pending(session) == []


def test_a_rolled_back_edit_queues_nothing(
    session: Session, act_as: ActAs, make_piece: Callable[..., Piece], drained: Callable[[], int]
) -> None:
    piece = make_piece("Caja de imaginero")
    drained()
    with act_as("CATALOGUER"):
        update_piece(session, piece, denomination="Caja de imaginero ayacuchana")
        session.rollback()
    assert _pending(session) == []


def test_the_commit_wakes_the_worker(
    session: Session,
    act_as: ActAs,
    make_piece: Callable[..., Piece],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    woken: list[str] = []
    monkeypatch.setattr(incremental, "notify", woken.append)
    make_piece("Caja de imaginero")
    assert woken == [QUEUE]


def test_a_failing_detection_is_retried_and_then_left_as_failed(
    session: Session,
    make_piece: Callable[..., Piece],
    factory: sessionmaker[Session],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    make_piece("Caja de imaginero")

    def broken(*_args: object, **_kwargs: object) -> None:
        raise RuntimeError("índice no disponible")

    monkeypatch.setattr(incremental, "find_candidates", broken)
    for _ in range(incremental.MAX_ATTEMPTS):
        assert process_pending_items(factory) == 0
    session.expire_all()
    item = session.scalars(select(QualityJobItem)).one()
    assert item.status == QualityJobItemStatus.FAILED
    assert item.attempts == incremental.MAX_ATTEMPTS
    assert "índice no disponible" in item.last_error
