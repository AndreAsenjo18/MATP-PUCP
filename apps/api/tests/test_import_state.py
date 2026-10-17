"""Spec importacion-datos — Estados del lote con etapas reanudables (RF-021).

Change importacion-pipeline-reconciliacion, task 1.1.
"""

from datetime import UTC, datetime
from itertools import product

import pytest
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFound
from app.core.models_base import new_uuid
from app.modules.imports.models import ImportBatch
from app.modules.imports.models import ImportBatchStatus as S
from app.modules.imports.state import TRANSITIONS, allowed_transitions, transition
from tests.conftest import ActAs

ALLOWED = [(source, target) for source, targets in TRANSITIONS.items() for target in targets]
FORBIDDEN = [
    (source, target) for source, target in product(S, S) if target not in TRANSITIONS[source]
]


@pytest.fixture
def new_batch(session: Session, act_as: ActAs):  # type: ignore[no-untyped-def]
    def factory(status: S) -> ImportBatch:
        with act_as("CATALOGUER"):
            batch = ImportBatch(
                id=new_uuid(), source_name="Prueba", file_name="sabana.xlsx", status=status
            )
            session.add(batch)
            session.commit()
        return batch

    return factory


def test_every_state_has_an_entry() -> None:
    assert set(TRANSITIONS) == set(S)


@pytest.mark.parametrize(("source", "target"), ALLOWED)
def test_allowed_transitions(
    session: Session, act_as: ActAs, new_batch, source: S, target: S
) -> None:  # type: ignore[no-untyped-def]
    batch = new_batch(source)
    moment = datetime(2026, 10, 19, 9, 30, tzinfo=UTC)

    with act_as("COLLECTIONS_MANAGER"):
        moved = transition(session, batch.id, target, reason="motivo", now=moment)
        session.commit()

    assert moved.status == target
    assert moved.status_reason == "motivo"
    assert moved.stage_timestamps == {target.value: moment.isoformat()}


@pytest.mark.parametrize(("source", "target"), FORBIDDEN)
def test_forbidden_transitions(
    session: Session, act_as: ActAs, new_batch, source: S, target: S
) -> None:  # type: ignore[no-untyped-def]
    batch = new_batch(source)

    with act_as("COLLECTIONS_MANAGER"), pytest.raises(ConflictError) as error:
        transition(session, batch.id, target)

    assert error.value.code == "invalid_batch_transition"
    assert error.value.details == {
        "current_status": source.value,
        "requested_status": target.value,
        "allowed": [status.value for status in allowed_transitions(source)],
    }
    session.rollback()
    assert session.get(ImportBatch, batch.id).status == source  # type: ignore[union-attr]


def test_approving_a_mapped_batch_explains_current_state_and_actions(
    session: Session, act_as: ActAs, new_batch
) -> None:  # type: ignore[no-untyped-def]
    batch = new_batch(S.MAPPED)

    with act_as("COLLECTIONS_MANAGER"), pytest.raises(ConflictError) as error:
        transition(session, batch.id, S.APPROVED)

    assert error.value.message == (
        "No se puede aprobar un lote en estado «mapeado». "
        "Acciones posibles: mapear columnas, validar, abandonar."
    )


def test_abandoned_batch_keeps_its_file_and_log(session: Session, act_as: ActAs, new_batch) -> None:  # type: ignore[no-untyped-def]
    batch = new_batch(S.IN_PREVIEW)
    batch.file_storage_key = f"imports/{batch.id}/original.xlsx"

    with act_as("CATALOGUER"):
        transition(session, batch.id, S.ABANDONED, reason="Archivo equivocado")
        session.commit()

    stored = session.get(ImportBatch, batch.id)
    assert stored is not None and stored.deleted_at is None
    assert stored.file_storage_key == f"imports/{batch.id}/original.xlsx"
    assert stored.status_reason == "Archivo equivocado"


def test_stage_timestamps_accumulate(session: Session, act_as: ActAs, new_batch) -> None:  # type: ignore[no-untyped-def]
    batch = new_batch(S.UPLOADED)

    with act_as("CATALOGUER"):
        for target in (S.MAPPED, S.VALIDATED, S.IN_PREVIEW):
            transition(session, batch.id, target)
        session.commit()

    assert set(batch.stage_timestamps or {}) == {"MAPPED", "VALIDATED", "IN_PREVIEW"}


def test_unknown_batch(session: Session) -> None:
    with pytest.raises(NotFound):
        transition(session, new_uuid(), S.MAPPED)
