"""A batch is not approved while its photos are processed (fix importacion-esperar-fotos).

Before, approving while the server still verified and matched the photos applied only the ones
already matched and left the rest out without a word (ACG, 2026-11-17: 20 of 71). Synthetic data.
"""

import uuid

from app.core.models_base import new_uuid
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.imports.models import ImportPhoto, ImportPhotoStatus, PhotoMatchStatus
from app.seed.demo_batch import SHEET_NAME, write_demo_batch
from tests.api.conftest import Pipeline
from tests.api.test_demo_batch import DEMO_MAPPING
from tests.api.test_import_pipeline_api import get_batch, put_mapping, upload, validate

_CONTEXT = AuditContext(origin=AuditOrigin.SYSTEM, actor_label="tests")


def _photo(pipeline: Pipeline, batch_id: str, status: ImportPhotoStatus) -> uuid.UUID:
    photo_id = new_uuid()
    with pipeline.session() as session, audit_context(session, _CONTEXT):
        session.add(
            ImportPhoto(
                id=photo_id,
                batch_id=uuid.UUID(batch_id),
                relative_path="Fotos/foto-sintetica.jpg",
                original_filename="foto-sintetica.jpg",
                content_sha256=photo_id.hex * 2,
                size_bytes=10,
                content_type="image/jpeg",
                storage_prefix=f"imports/{batch_id}/{photo_id}",
                status=status,
            )
        )
        session.commit()
    return photo_id


def test_approval_waits_until_the_photos_are_processed(pipeline: Pipeline, tmp_path) -> None:  # type: ignore[no-untyped-def]
    write_demo_batch(tmp_path)
    batch_id = upload(pipeline.client, SHEET_NAME, (tmp_path / SHEET_NAME).read_bytes())["batch_id"]
    assert put_mapping(pipeline.client, batch_id, DEMO_MAPPING).status_code == 200
    assert validate(pipeline.client, batch_id).status_code == 202
    photo_id = _photo(pipeline, batch_id, ImportPhotoStatus.UPLOADED)

    approval = get_batch(pipeline.client, batch_id)["approval_summary"]
    assert approval["photos_processing"] == 1
    approver = pipeline.login("COLLECTIONS_MANAGER")
    refused = approver.post(
        f"/api/v1/imports/{batch_id}/confirm",
        json={"summary_token": approval["summary_token"], "comment": "Revisado (sintético)"},
    )
    assert refused.status_code == 409, refused.text
    assert refused.json()["code"] == "photos_processing"
    assert get_batch(pipeline.client, batch_id)["status"] == "IN_PREVIEW"

    with pipeline.session() as session, audit_context(session, _CONTEXT):  # server finishes
        photo = session.get(ImportPhoto, photo_id)
        assert photo is not None
        photo.status = ImportPhotoStatus.VERIFIED
        photo.match_status = PhotoMatchStatus.UNMATCHED
        session.commit()

    approval = get_batch(pipeline.client, batch_id)["approval_summary"]
    assert approval["photos_processing"] == 0
    approved = approver.post(
        f"/api/v1/imports/{batch_id}/confirm",
        json={"summary_token": approval["summary_token"], "comment": "Revisado (sintético)"},
    )
    assert approved.status_code == 200, approved.text
