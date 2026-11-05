"""The «sin especificar» view where the seed predates it (importacion-masiva-fotografias 5.1).

Design D5. This module has its own database (``pipeline`` is per module): it starts by renaming
the seeded term, as in a quality or production database seeded before the term existed. One
test walks the life of the term in order, because each step depends on the previous one.
Synthetic data only (RNF-014).
"""

from typing import Any

import pytest
from sqlalchemy import func, update

from app.modules.collections.models import Term
from app.modules.media.models import MediaAsset
from tests.api.conftest import Pipeline
from tests.api.test_import_photos_api import _verifiable
from tests.api.test_import_photos_apply_api import (
    approve,
    assets_of,
    lot_with_photos,
    pieces_of,
    unspecified_terms,
)
from tests.api.test_import_pipeline_api import BASE


@pytest.fixture
def storage(pipeline: Pipeline, monkeypatch: pytest.MonkeyPatch) -> Any:
    return _verifiable(pipeline.client, pipeline, monkeypatch)


def _photos_of(pipeline: Pipeline, batch_id: str) -> list[MediaAsset]:
    toro = pieces_of(pipeline, batch_id)[2]
    assert toro is not None
    return assets_of(pipeline, toro.id)


def test_the_unspecified_view_is_created_once_survives_rollbacks_and_respects_deletion(
    pipeline: Pipeline, storage: Any
) -> None:
    (seeded,) = unspecified_terms(pipeline)
    with pipeline.session() as session:  # an environment seeded before the term existed
        session.execute(
            update(Term)
            .where(Term.id == seeded.id)
            .values(code="VISTA_ANTIGUA", label="Vista antigua")
        )
        session.commit()
    assert unspecified_terms(pipeline) == []

    # 1. Missing: applying a batch with four photos creates it once.
    first = lot_with_photos(pipeline, storage)
    assert approve(pipeline, first.batch_id)["status"] == "APPLIED"
    (created,) = unspecified_terms(pipeline)
    assert {asset.view_type_term_id for asset in _photos_of(pipeline, first.batch_id)} == {
        created.id
    }

    # 2. Reverting the batch that needed it keeps the term: it has a change set of its own.
    response = pipeline.login("ADMIN").post(
        f"{BASE}/{first.batch_id}/rollback", json={"reason": "Reversión de prueba"}
    )
    assert response.status_code == 200, response.text
    (kept,) = unspecified_terms(pipeline)
    assert (kept.id, kept.deleted_at, kept.is_active) == (created.id, None, True)

    # 3. Deleted logically by an administrator: respected, and not created again.
    with pipeline.session() as session:
        session.execute(update(Term).where(Term.id == created.id).values(deleted_at=func.now()))
        session.commit()
    second = lot_with_photos(pipeline, storage)
    assert approve(pipeline, second.batch_id)["status"] == "APPLIED"
    assert {asset.view_type_term_id for asset in _photos_of(pipeline, second.batch_id)} == {None}
    assert len(unspecified_terms(pipeline)) == 1  # the deleted one, not a new one
