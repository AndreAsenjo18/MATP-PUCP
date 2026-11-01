"""POST and GET /media/bulk-download (descargas-masivas-y-enriquecimiento-lote, task 2.3).

Spec multimedia, «Descarga masiva de fotografías por paquete»; design D1. The package is built in
the background task that TestClient runs right after the response, on the in-memory storage of
`test_media_register`; photos go through the real registration. Synthetic data only (RNF-014).
"""

import io
import uuid
import zipfile
from datetime import timedelta

from sqlalchemy import update

from app.core.models_base import utcnow
from app.modules.media.models import MediaBulkDownload
from tests.api.conftest import ADMIN, CATALOGUER, MANAGER, SeededApi, as_user
from tests.api.test_media_gallery import _delete, _new_piece, _register
from tests.api.test_media_register import fake_storage  # noqa: F401

BULK = "/api/v1/media/bulk-download"
H_MANAGER, H_CATALOGUER = as_user(MANAGER), as_user(CATALOGUER)


def test_a_package_answers_its_job_and_then_its_link(
    seeded_api: SeededApi,
    fake_storage: dict,  # noqa: F811
) -> None:
    piece_id = _new_piece(seeded_api)
    photo = _register(seeded_api, fake_storage, piece_id, 150)

    created = seeded_api.client.post(BULK, json={"piece_ids": [piece_id]}, headers=H_MANAGER)

    assert created.status_code == 202, created.text
    job = created.json()
    assert (job["status"], job["piece_count"], job["download_url"]) == ("PENDING", 1, None)
    state = seeded_api.client.get(f"{BULK}/{job['id']}", headers=H_MANAGER)
    assert state.status_code == 200, state.text
    ready = state.json()
    assert (ready["status"], ready["included_photos"], ready["omitted"]) == ("READY", 1, [])
    ttl = seeded_api.app.state.settings.media_url_ttl_seconds
    assert (
        ready["download_url"].startswith("http://test-storage/")
        and f"ttl={ttl}" in ready["download_url"]
    )
    key = f"exports/bulk-download/{job['id']}.zip"
    with zipfile.ZipFile(io.BytesIO(fake_storage["objects"][key])) as archive:
        (entry,) = archive.namelist()
    assert entry.endswith(f"01 {photo['original_filename'].rsplit('.', 1)[0]}.jpg")
    _delete(seeded_api, piece_id)


def test_another_person_cannot_see_the_package_but_an_administrator_can(
    seeded_api: SeededApi,
    fake_storage: dict,  # noqa: F811
) -> None:
    job = seeded_api.client.post(
        BULK, json={"piece_ids": [str(uuid.uuid4())]}, headers=H_MANAGER
    ).json()

    other = seeded_api.client.get(f"{BULK}/{job['id']}", headers=H_CATALOGUER)
    admin = seeded_api.client.get(f"{BULK}/{job['id']}", headers=as_user(ADMIN))
    missing = seeded_api.client.get(f"{BULK}/{uuid.uuid4()}", headers=H_MANAGER)

    assert (other.status_code, admin.status_code, missing.status_code) == (403, 200, 404)
    assert admin.json()["id"] == job["id"]


def test_an_expired_package_is_410_and_keeps_its_record(
    seeded_api: SeededApi,
    fake_storage: dict,  # noqa: F811
) -> None:
    piece_id = _new_piece(seeded_api)
    _register(seeded_api, fake_storage, piece_id, 160)
    job = seeded_api.client.post(BULK, json={"piece_ids": [piece_id]}, headers=H_MANAGER).json()
    with seeded_api.session() as session:
        session.execute(
            update(MediaBulkDownload)
            .where(MediaBulkDownload.id == uuid.UUID(job["id"]))
            .values(expires_at=utcnow() - timedelta(minutes=1))
        )
        session.commit()

    expired = seeded_api.client.get(f"{BULK}/{job['id']}", headers=H_MANAGER)

    assert expired.status_code == 410, expired.text
    assert "ya no está disponible" in expired.json()["message"]
    with seeded_api.session() as session:
        kept = session.get(MediaBulkDownload, uuid.UUID(job["id"]))
        assert kept is not None and kept.included_photos == 1
    _delete(seeded_api, piece_id)


def test_a_second_package_while_one_is_in_preparation_is_409(
    seeded_api: SeededApi,
    fake_storage: dict,  # noqa: F811
    monkeypatch,  # type: ignore[no-untyped-def]
) -> None:
    from app.api.v1 import media as media_router

    monkeypatch.setattr(media_router, "run_in_background", lambda *args, **kwargs: None)
    first = seeded_api.client.post(
        BULK, json={"piece_ids": [str(uuid.uuid4())]}, headers=H_CATALOGUER
    )

    second = seeded_api.client.post(
        BULK, json={"piece_ids": [str(uuid.uuid4())]}, headers=H_CATALOGUER
    )

    assert first.status_code == 202
    assert second.status_code == 409, second.text
    assert second.json()["details"] == {"job_id": first.json()["id"]}
    with seeded_api.session() as session:  # leave nothing in preparation for other tests
        session.execute(
            update(MediaBulkDownload)
            .where(MediaBulkDownload.id == uuid.UUID(first.json()["id"]))
            .values(status="FAILED")
        )
        session.commit()
