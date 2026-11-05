"""Signed thumbnails and display copies in the gallery listing (fotografias 3.2).

``GET /pieces/{piece_id}/media`` signs the derivatives of each photo for viewing it inside the
system. This module has its own database (``pipeline``); its storage signs URLs without network.
Synthetic data only (RNF-014).
"""

import uuid
from typing import Any

import pytest
from botocore.exceptions import ClientError
from sqlalchemy import select

from app.core.models_base import new_uuid
from app.models import AppUser
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.media.models import MediaAsset
from app.modules.media.service import LOAN_RESTRICTION_NOTE, comodato_restriction_term_id
from tests.api.conftest import ADMIN, Pipeline


def _with_photos(
    pipeline: Pipeline, regime: TenureRegime, keys: dict[str, str], **extra: Any
) -> tuple[uuid.UUID, dict[str, uuid.UUID]]:
    """A piece and one photo per storage key; ``{name}`` in a key is replaced by the asset id."""
    with pipeline.session() as session:
        admin = session.scalar(select(AppUser).where(AppUser.email == ADMIN))
        assert admin is not None
        with audit_context(session, AuditContext(origin=AuditOrigin.MANUAL, user_id=admin.id)):
            piece = create_piece(
                session, denomination="Pieza con galería sintética", tenure_regime=regime
            )
            restricted = regime == TenureRegime.LOAN_FOR_USE
            ids: dict[str, uuid.UUID] = {}
            for order, (label, key) in enumerate(keys.items()):
                asset_id = new_uuid()
                ids[label] = asset_id
                session.add(
                    MediaAsset(
                        id=asset_id,
                        piece_id=piece.id,
                        storage_key=key.format(piece=piece.id, asset=asset_id),
                        original_filename=f"{label}.jpg",
                        content_type="image/jpeg",
                        size_bytes=1024,
                        content_sha256=asset_id.hex * 2,
                        sort_order=order,
                        is_primary=order == 0,
                        usage_restriction_term_id=comodato_restriction_term_id(session)
                        if restricted
                        else None,
                        restriction_note=LOAN_RESTRICTION_NOTE if restricted else None,
                        extra_metadata=extra.get(label),
                    )
                )
            session.commit()
        return piece.id, ids


def _gallery(pipeline: Pipeline, piece_id: uuid.UUID) -> dict[str, dict[str, Any]]:
    response = pipeline.login("INTERNAL_VIEWER").get(f"/api/v1/pieces/{piece_id}/media")
    assert response.status_code == 200, response.text
    return {item["id"]: item for item in response.json()}


def test_the_listing_signs_the_derivatives_next_to_each_photo(pipeline: Pipeline) -> None:
    photo_id = new_uuid()
    piece_id, ids = _with_photos(
        pipeline,
        TenureRegime.OWNED,
        {
            "subida": "pieces/{piece}/{asset}/original.jpg",
            "importada": f"media/{photo_id}/upload.jpeg",
            "semilla": "pieces/{piece}/{asset}.jpg",
            "fallida": "pieces/{piece}/{asset}/original.jpg",
        },
        fallida={"derivatives": "failed"},
    )

    gallery = _gallery(pipeline, piece_id)

    uploaded = gallery[str(ids["subida"])]
    assert f"pieces/{piece_id}/{ids['subida']}/thumb.webp" in uploaded["thumbnail_url"]
    assert f"pieces/{piece_id}/{ids['subida']}/display.webp" in uploaded["download_url"]
    imported = gallery[str(ids["importada"])]
    assert f"media/{photo_id}/thumb.webp" in imported["thumbnail_url"]
    assert f"media/{photo_id}/display.webp" in imported["download_url"]
    # Without derivatives the photo is shown from its own object.
    seeded = gallery[str(ids["semilla"])]
    assert f"pieces/{piece_id}/{ids['semilla']}.jpg" in seeded["thumbnail_url"]
    assert seeded["download_url"] == seeded["thumbnail_url"]
    failed = gallery[str(ids["fallida"])]
    assert f"{ids['fallida']}/original.jpg" in failed["thumbnail_url"]


def test_a_loan_for_use_photo_keeps_its_restriction_and_is_seen_inside(pipeline: Pipeline) -> None:
    piece_id, ids = _with_photos(
        pipeline, TenureRegime.LOAN_FOR_USE, {"comodato": "pieces/{piece}/{asset}/original.jpg"}
    )

    (item,) = _gallery(pipeline, piece_id).values()

    assert item["id"] == str(ids["comodato"])
    assert item["usage_restriction"]["code"] == "NO_PUBLICAR"
    assert item["restriction_note"] == LOAN_RESTRICTION_NOTE
    assert item["thumbnail_url"] and item["download_url"]  # viewing inside is internal use


def test_the_photos_stay_listed_when_the_storage_cannot_sign(
    pipeline: Pipeline, monkeypatch: pytest.MonkeyPatch
) -> None:
    piece_id, _ids = _with_photos(
        pipeline, TenureRegime.OWNED, {"sin_firma": "pieces/{piece}/{asset}/original.jpg"}
    )

    def fail(*_args: object, **_kwargs: object) -> str:
        raise ClientError({"Error": {"Code": "500", "Message": "sin almacenamiento"}}, "GetObject")

    monkeypatch.setattr(pipeline.client.app.state.storage, "presign_get", fail)  # type: ignore[attr-defined]

    (item,) = _gallery(pipeline, piece_id).values()

    assert (item["thumbnail_url"], item["download_url"]) == (None, None)
