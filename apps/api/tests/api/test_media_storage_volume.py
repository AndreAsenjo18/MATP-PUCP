"""Volume by file type, the expected collection and the photo quota (importacion-masiva 5.5).

Spec multimedia, «Conservación configurable del original en cargas masivas», scenario «Estimación
con el parámetro vigente»; design D6. The estimate runs on the seeded catalogue and the quota
warning on a real batch with photos. Synthetic data only (RNF-014).
"""

import uuid
from typing import Any

import pytest
from sqlalchemy import func, select

from app.models import AppUser
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.audit.soft_delete import soft_delete
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.catalog.service import create_piece
from app.modules.media.models import MediaAsset
from app.modules.media.volume import DISPLAY_BYTES, EXPECTED_PHOTOS, THUMB_BYTES
from tests.api.conftest import ADMIN, Pipeline, SeededApi, as_user
from tests.api.test_import_photos_apply_api import lot_with_photos, storage  # noqa: F401
from tests.api.test_import_pipeline_api import get_batch

ESTIMATE = "/api/v1/media/storage-estimate"


def _estimate(seeded_api: SeededApi) -> dict[str, Any]:
    response = seeded_api.client.get(ESTIMATE, headers=as_user(ADMIN))
    assert response.status_code == 200, response.text
    return response.json()


def test_the_estimate_tells_the_parameter_and_the_volume_by_file_type(
    seeded_api: SeededApi,
) -> None:
    with seeded_api.session() as session:
        photos, originals = session.execute(
            select(func.count(MediaAsset.id), func.sum(MediaAsset.size_bytes)).where(
                MediaAsset.deleted_at.is_(None)
            )
        ).one()

    body = _estimate(seeded_api)

    assert body["keeps_originals"] is True
    assert body["by_file_type"] == {
        "original_bytes": originals,
        "display_bytes": photos * DISPLAY_BYTES,
        "thumb_bytes": photos * THUMB_BYTES,
    }
    assert body["current_volume_bytes"] == sum(body["by_file_type"].values())
    expected = body["expected_collection"]
    assert expected["photos"] == EXPECTED_PHOTOS
    assert expected["original_bytes"] > 0
    assert expected["total_bytes"] == (
        expected["original_bytes"] + expected["display_bytes"] + expected["thumb_bytes"]
    )
    assert (body["quota_bytes"], body["exceeds_quota"]) == (None, None)


def test_without_originals_the_projections_count_only_derivatives(
    seeded_api: SeededApi, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(seeded_api.app.state.settings, "media_keep_originals", False)

    response = seeded_api.client.get(
        ESTIMATE,
        params={"pieces": 1000, "photos_per_piece": 2, "mb_per_photo": 6},
        headers=as_user(ADMIN),
    )

    body = response.json()
    assert body["keeps_originals"] is False
    assert body["expected_collection"]["original_bytes"] == 0
    assert body["expected_collection"]["display_bytes"] == EXPECTED_PHOTOS * DISPLAY_BYTES
    assert body["projection"]["projected_originals_bytes"] == 0
    assert body["projection"]["projected_derivatives_bytes"] == 2000 * (DISPLAY_BYTES + THUMB_BYTES)


def test_a_photo_kept_on_its_display_copy_counts_as_display(seeded_api: SeededApi) -> None:
    before = _estimate(seeded_api)["by_file_type"]
    with seeded_api.session() as session:
        admin = session.scalar(select(AppUser).where(AppUser.email == ADMIN))
        assert admin is not None
        with audit_context(session, AuditContext(origin=AuditOrigin.MANUAL, user_id=admin.id)):
            piece = create_piece(
                session,
                denomination="Pieza sin original (sintética)",
                tenure_regime=TenureRegime.OWNED,
            )
            photo = uuid.uuid4()
            asset = MediaAsset(
                id=uuid.uuid4(),
                piece_id=piece.id,
                storage_key=f"media/{photo}/display.webp",
                original_filename="sin-original.jpg",
                content_type="image/webp",
                size_bytes=123_456,
                content_sha256="d" * 64,
            )
            session.add(asset)
            session.commit()

    after = _estimate(seeded_api)["by_file_type"]

    assert after["original_bytes"] == before["original_bytes"]
    assert after["display_bytes"] == before["display_bytes"] + 123_456
    assert after["thumb_bytes"] == before["thumb_bytes"] + THUMB_BYTES
    with (
        seeded_api.session() as session,
        audit_context(
            session, AuditContext(origin=AuditOrigin.SYSTEM, actor_label="limpieza de prueba")
        ),
    ):
        for model, row_id in ((MediaAsset, asset.id), (Piece, piece.id)):
            stored = session.get(model, row_id)
            assert stored is not None
            soft_delete(session, stored, "Limpieza de prueba")
        session.commit()


def test_the_quota_is_reported_when_configured(
    seeded_api: SeededApi, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(seeded_api.app.state.settings, "media_quota_bytes", 1)
    assert _estimate(seeded_api)["exceeds_quota"] is True

    monkeypatch.setattr(seeded_api.app.state.settings, "media_quota_bytes", 10**15)
    assert _estimate(seeded_api)["exceeds_quota"] is False


def test_the_batch_summary_warns_when_its_photos_go_beyond_the_quota(
    pipeline: Pipeline,
    storage: Any,  # noqa: F811
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    lot = lot_with_photos(pipeline, storage)
    settings = pipeline.client.app.state.settings  # type: ignore[attr-defined]

    without_quota = get_batch(pipeline.client, lot.batch_id)["approval_summary"]
    monkeypatch.setattr(settings, "media_quota_bytes", 1)
    over = get_batch(pipeline.client, lot.batch_id)["approval_summary"]
    monkeypatch.setattr(settings, "media_quota_bytes", 10**15)
    under = get_batch(pipeline.client, lot.batch_id)["approval_summary"]

    assert without_quota["photo_quota_warning"] is None
    assert "MEDIA_QUOTA_BYTES" in over["photo_quota_warning"]
    assert under["photo_quota_warning"] is None
    assert over["summary_token"] == without_quota["summary_token"]  # it never blocks approving
