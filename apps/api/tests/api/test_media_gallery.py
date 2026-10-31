"""Gallery of a piece and access to its files (fotografias-multiples-por-pieza 2.3 to 2.6).

Spec multimedia: «Acceso a archivos con autorización de corta duración», «Restricción efectiva
heredada y bloqueo de descarga externa», «Gestión de galería con foto principal única» and
«Operación de estimación del volumen fotográfico». The photos go through the real registration
(`POST /pieces/{piece_id}/media`) on the in-memory storage of `test_media_register`. Every test
creates its own piece. Synthetic data only (RNF-014).
"""

import hashlib
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.media import get_media_storage_estimate
from app.core.models_base import new_uuid
from app.models import AppUser
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditAction, AuditLog, AuditOrigin
from app.modules.audit.tracking import INCLUDE_DELETED
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.catalog.service import change_tenure
from app.modules.collections.models import Collection
from app.modules.media import derivatives
from app.modules.media.models import MediaAsset
from app.modules.media.schemas import StorageEstimateRequest
from app.modules.media.service import comodato_restriction_term_id
from tests.api.conftest import ADMIN, CATALOGUER, MANAGER, SeededApi, as_user
from tests.api.test_media_register import _jpeg_bytes, fake_storage  # noqa: F401

H = as_user(CATALOGUER)


def _new_piece(seeded_api: SeededApi, **extra: Any) -> str:
    created = seeded_api.client.post(
        "/api/v1/pieces",
        json={
            "denomination": "Pieza con galería (sintética)",
            "tenure_regime": "Propiedad",
            **extra,
        },
        headers=H,
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


def _delete(seeded_api: SeededApi, piece_id: str) -> None:
    """The seeded database is shared: the active total must not move."""
    response = seeded_api.client.delete(
        f"/api/v1/pieces/{piece_id}",
        params={"reason": "Limpieza de prueba"},
        headers=as_user(ADMIN),
    )
    assert response.status_code == 204, response.text


def _register(seeded_api: SeededApi, storage: dict, piece_id: str, shade: int) -> dict[str, Any]:
    data = _jpeg_bytes((shade, 40, 90))
    key = f"pieces/{piece_id}/pending/{uuid.uuid4().hex}.jpg"
    storage["objects"][key] = data
    response = seeded_api.client.post(
        f"/api/v1/pieces/{piece_id}/media",
        json={
            "storage_key": key,
            "original_filename": f"vista-{shade}.jpg",
            "content_type": "image/jpeg",
            "size_bytes": len(data),
            "content_sha256": hashlib.sha256(data).hexdigest(),
            "view_type_term_id": None,
        },
        headers=H,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _download_url(
    client: TestClient, piece_id: str, media_id: str, purpose: str, headers: dict[str, str]
) -> Any:
    return client.get(
        f"/api/v1/pieces/{piece_id}/media/{media_id}/download-url",
        params={"purpose": purpose},
        headers=headers,
    )


def test_the_download_url_is_a_get_with_the_purpose_and_the_short_ttl(
    seeded_api: SeededApi,
    fake_storage: dict,  # noqa: F811
) -> None:
    piece_id = _new_piece(seeded_api)
    photo = _register(seeded_api, fake_storage, piece_id, 10)
    ttl = seeded_api.app.state.settings.media_url_ttl_seconds

    response = _download_url(seeded_api.client, piece_id, photo["id"], "internal", H)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["download_url"].startswith("http://test-storage/")
    assert f"ttl={ttl}" in body["download_url"]
    expires = datetime.fromisoformat(body["expires_at"])
    assert timedelta(0) < expires - datetime.now(UTC) <= timedelta(seconds=ttl)
    assert (body["effective_restriction"], body["restriction_origin"]) == (None, "ninguna")
    _delete(seeded_api, piece_id)


def _restricted_collection(seeded_api: SeededApi, *, restricted: bool = True) -> str:
    """A collection whose photos default to «No publicar» [SUPUESTO B2: illustrative], or one
    with no default restriction at all."""
    with seeded_api.session() as session:
        admin = session.scalar(select(AppUser).where(AppUser.email == ADMIN))
        assert admin is not None
        with audit_context(session, AuditContext(origin=AuditOrigin.MANUAL, user_id=admin.id)):
            acronym = f"RST{uuid.uuid4().hex[:5].upper()}"
            collection = Collection(
                id=new_uuid(),
                name=f"Colección restringida {acronym} (sintética)",
                acronym=acronym,
                acronym_normalized=acronym,
                default_tenure_regime=TenureRegime.OWNED,
                default_usage_restriction_term_id=comodato_restriction_term_id(session)
                if restricted
                else None,
            )
            session.add(collection)
            session.commit()
            return str(collection.id)


def test_an_external_download_blocked_by_the_collection_is_409_and_inside_it_is_seen(
    seeded_api: SeededApi,
    fake_storage: dict,  # noqa: F811
) -> None:
    piece_id = _new_piece(seeded_api, collection_id=_restricted_collection(seeded_api))
    photo = _register(seeded_api, fake_storage, piece_id, 20)
    manager = as_user(MANAGER)

    external = _download_url(seeded_api.client, piece_id, photo["id"], "external", manager)
    internal = _download_url(seeded_api.client, piece_id, photo["id"], "internal", H)

    assert external.status_code == 409, external.text
    error = external.json()
    assert error["code"] == "usage_restricted"
    assert (error["details"]["restriction"], error["details"]["origin"]) == (
        "NO_PUBLICAR",
        "colección",
    )
    assert internal.status_code == 200, internal.text
    assert internal.json()["effective_restriction"]["code"] == "NO_PUBLICAR"
    assert internal.json()["restriction_origin"] == "colección"
    _delete(seeded_api, piece_id)


def test_the_409_of_a_loan_for_use_names_its_agreement(
    seeded_api: SeededApi,
    fake_storage: dict,  # noqa: F811
) -> None:
    piece_id = _new_piece(
        seeded_api, tenure_regime="Comodato", loan_agreement_ref="Acuerdo sintético 07-2026"
    )
    photo = _register(seeded_api, fake_storage, piece_id, 30)

    response = _download_url(seeded_api.client, piece_id, photo["id"], "external", as_user(MANAGER))

    assert response.status_code == 409, response.text
    details = response.json()["details"]
    assert (details["origin"], details["loan_agreement_ref"]) == (
        "foto",
        "Acuerdo sintético 07-2026",
    )
    assert "Acuerdo sintético 07-2026" in response.json()["message"]
    _delete(seeded_api, piece_id)


def test_a_piece_that_becomes_a_loan_for_use_restricts_its_earlier_photos(
    seeded_api: SeededApi,
    fake_storage: dict,  # noqa: F811
) -> None:
    """The photo was registered while the piece was owned, so it has no restriction of its own,
    and its collection has no default: the loan for use of the piece restricts it (RN-008)."""
    piece_id = _new_piece(
        seeded_api, collection_id=_restricted_collection(seeded_api, restricted=False)
    )
    photo = _register(seeded_api, fake_storage, piece_id, 140)
    assert (photo["usage_restriction"], photo["restriction_origin"]) == (None, "ninguna")
    with seeded_api.session() as session:
        admin = session.scalar(select(AppUser).where(AppUser.email == ADMIN))
        assert admin is not None
        with audit_context(session, AuditContext(origin=AuditOrigin.MANUAL, user_id=admin.id)):
            piece = session.get(Piece, uuid.UUID(piece_id))
            assert piece is not None
            change_tenure(session, piece, TenureRegime.LOAN_FOR_USE, "Pasa a comodato (sintético)")
            session.commit()

    (listed,) = seeded_api.client.get(f"/api/v1/pieces/{piece_id}/media", headers=H).json()
    external = _download_url(seeded_api.client, piece_id, photo["id"], "external", as_user(MANAGER))
    internal = _download_url(seeded_api.client, piece_id, photo["id"], "internal", H)

    assert listed["usage_restriction"] is None
    assert (listed["effective_restriction"]["code"], listed["restriction_origin"]) == (
        "NO_PUBLICAR",
        "pieza",
    )
    assert external.status_code == 409, external.text
    assert external.json()["details"]["origin"] == "pieza"
    assert internal.status_code == 200, internal.text
    assert internal.json()["restriction_origin"] == "pieza"
    _delete(seeded_api, piece_id)


def test_a_new_photo_shows_the_restriction_inherited_from_its_collection(
    seeded_api: SeededApi,
    fake_storage: dict,  # noqa: F811
) -> None:
    """Scenario «Herencia desde la colección en comodato»: no restriction of its own."""
    piece_id = _new_piece(seeded_api, collection_id=_restricted_collection(seeded_api))

    registered = _register(seeded_api, fake_storage, piece_id, 40)
    (listed,) = seeded_api.client.get(f"/api/v1/pieces/{piece_id}/media", headers=H).json()

    for photo in (registered, listed):
        assert photo["usage_restriction"] is None
        assert photo["effective_restriction"]["code"] == "NO_PUBLICAR"
        assert photo["restriction_origin"] == "colección"
    _delete(seeded_api, piece_id)


# --------------------------------------------------------------- storage estimate (task 2.6)
ESTIMATE = "/api/v1/media/storage-estimate"


def test_the_projection_of_20000_pieces_with_5_photos_of_4_mb_is_about_400_gb(
    seeded_api: SeededApi,
) -> None:
    response = seeded_api.client.get(
        ESTIMATE,
        params={"pieces": 20000, "photos_per_piece": 5, "mb_per_photo": 4},
        headers=as_user(ADMIN),
    )

    assert response.status_code == 200, response.text
    projection = response.json()["projection"]
    assert projection["projected_originals_bytes"] == 20000 * 5 * 4 * 1024 * 1024  # ≈ 419 GB
    assert 380 * 10**9 < projection["projected_originals_bytes"] < 440 * 10**9


def test_the_averages_are_the_real_ones_of_the_pieces_with_photos(seeded_api: SeededApi) -> None:
    with seeded_api.session() as session:
        photos, pieces, size = session.execute(
            select(
                func.count(MediaAsset.id),
                func.count(func.distinct(MediaAsset.piece_id)),
                func.sum(MediaAsset.size_bytes),
            ).where(MediaAsset.deleted_at.is_(None))
        ).one()
    assert photos > pieces  # the seeded catalogue has pieces with several photos

    body = seeded_api.client.get(ESTIMATE, headers=as_user(ADMIN)).json()

    assert body["avg_photos_per_piece"] == pytest.approx(photos / pieces)
    assert body["avg_mb_per_photo"] == pytest.approx(size / photos / 1024 / 1024)
    assert body["current_originals_bytes"] == size
    assert body["projection"] is None


def test_without_photos_there_are_no_averages(session: Session) -> None:
    body = get_media_storage_estimate(session, None, StorageEstimateRequest())  # type: ignore[arg-type]

    assert (body.current_volume_bytes, body.avg_photos_per_piece, body.avg_mb_per_photo) == (
        0,
        None,
        None,
    )


def test_a_negative_parameter_is_422_and_the_old_path_is_gone(seeded_api: SeededApi) -> None:
    negative = seeded_api.client.get(
        ESTIMATE, params={"photos_per_piece": -1}, headers=as_user(ADMIN)
    )
    old = seeded_api.client.get("/api/v1/pieces/media/storage-estimate", headers=as_user(ADMIN))

    assert negative.status_code == 422
    assert old.status_code in (404, 422)  # it now reads as /pieces/{piece_id}/media


# ------------------------------------------------------------------- gallery (task 2.4)
def test_retiring_the_primary_photo_keeps_it_and_the_next_one_becomes_primary(
    seeded_api: SeededApi,
    fake_storage: dict,  # noqa: F811
) -> None:
    piece_id = _new_piece(seeded_api)
    first, second, third = (_register(seeded_api, fake_storage, piece_id, n) for n in (50, 60, 70))
    assert first["is_primary"] is True
    manager = as_user(MANAGER)
    url = f"/api/v1/pieces/{piece_id}/media/{first['id']}"

    without_reason = seeded_api.client.delete(url, headers=manager)
    retired = seeded_api.client.delete(
        url, params={"reason": "Foto movida (sintética)"}, headers=manager
    )

    assert without_reason.status_code == 422
    assert retired.status_code == 204, retired.text
    gallery = seeded_api.client.get(f"/api/v1/pieces/{piece_id}/media", headers=H).json()
    assert [(photo["id"], photo["is_primary"]) for photo in gallery] == [
        (second["id"], True),
        (third["id"], False),
    ]
    with seeded_api.session() as session:
        kept = session.scalar(
            select(MediaAsset)
            .where(MediaAsset.id == uuid.UUID(first["id"]))
            .execution_options(**{INCLUDE_DELETED: True})
        )
        assert kept is not None and kept.deleted_at is not None
        assert kept.deletion_reason == "Foto movida (sintética)"
        reasons = set(
            session.scalars(
                select(AuditLog.reason).where(
                    AuditLog.entity_id == kept.id, AuditLog.action == AuditAction.SOFT_DELETE
                )
            )
        )
    assert reasons == {"Foto movida (sintética)"}
    _delete(seeded_api, piece_id)


def test_marking_another_photo_as_primary_leaves_only_that_one(
    seeded_api: SeededApi,
    fake_storage: dict,  # noqa: F811
) -> None:
    piece_id = _new_piece(seeded_api)
    front, side = (_register(seeded_api, fake_storage, piece_id, n) for n in (80, 90))

    response = seeded_api.client.patch(
        f"/api/v1/pieces/{piece_id}/media/{side['id']}", json={"is_primary": True}, headers=H
    )

    assert response.status_code == 200, response.text
    gallery = seeded_api.client.get(f"/api/v1/pieces/{piece_id}/media", headers=H).json()
    assert {photo["id"] for photo in gallery if photo["is_primary"]} == {side["id"]}
    assert front["is_primary"] is True  # it was the primary one before
    _delete(seeded_api, piece_id)


def test_a_reorder_that_leaves_a_photo_out_is_422_and_changes_nothing(
    seeded_api: SeededApi,
    fake_storage: dict,  # noqa: F811
) -> None:
    piece_id = _new_piece(seeded_api)
    photos = [_register(seeded_api, fake_storage, piece_id, n) for n in (100, 110, 120)]
    url = f"/api/v1/pieces/{piece_id}/media/order"

    incomplete = seeded_api.client.put(url, json=[photos[2]["id"], photos[0]["id"]], headers=H)
    unchanged = seeded_api.client.get(f"/api/v1/pieces/{piece_id}/media", headers=H).json()
    complete = seeded_api.client.put(url, json=[p["id"] for p in reversed(photos)], headers=H)

    assert incomplete.status_code == 422
    assert [photo["id"] for photo in unchanged] == [p["id"] for p in photos]
    assert complete.status_code == 200, complete.text
    assert [photo["id"] for photo in complete.json()] == [p["id"] for p in reversed(photos)]
    _delete(seeded_api, piece_id)


def test_a_photo_whose_derivatives_fail_stays_registered_and_marked(
    seeded_api: SeededApi,
    fake_storage: dict,  # noqa: F811
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Scenario «Fallo al generar derivados» (task 2.3): the command regenerates them later."""
    piece_id = _new_piece(seeded_api)

    def broken(_data: bytes, _max_dim: int) -> bytes:
        raise OSError("TIFF demasiado grande (sintético)")

    monkeypatch.setattr(derivatives, "_resize_image", broken)
    photo = _register(seeded_api, fake_storage, piece_id, 130)

    with seeded_api.session() as session:
        asset = session.get(MediaAsset, uuid.UUID(photo["id"]))
        assert asset is not None and asset.deleted_at is None
        assert asset.extra_metadata == {"derivatives": "failed"}
    (listed,) = seeded_api.client.get(f"/api/v1/pieces/{piece_id}/media", headers=H).json()
    assert listed["id"] == photo["id"]
    _delete(seeded_api, piece_id)
