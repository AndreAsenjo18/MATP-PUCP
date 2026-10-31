"""Helpers of the photo-only batch tests (change importacion-fotos-a-catalogo).

Collections, pieces and identifiers are written with the ORM under the audit context of the
synthetic administrator, into the database of the ``pipeline`` fixture of each module; the photos
are inserted already ``VERIFIED``, as the verification leaves them. The batch itself is created
and decided through the API. Synthetic data only (RNF-014).
"""

import hashlib
import io
import random
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from PIL import Image
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.models_base import new_uuid
from app.models import AppUser, Collection, Piece
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.catalog.enums import TenureRegime
from app.modules.identification.service import add_identifier
from app.modules.imports.models import ImportPhoto, ImportPhotoStatus
from app.modules.media.models import MediaAsset
from tests.api.conftest import Pipeline
from tests.api.normalization_params_support import ADMIN_EMAIL
from tests.api.test_import_pipeline_api import BASE


@contextmanager
def as_admin(pipeline: Pipeline) -> Iterator[Session]:
    with pipeline.session() as session:
        admin = session.scalar(select(AppUser).where(AppUser.email == ADMIN_EMAIL))
        assert admin is not None
        with audit_context(session, AuditContext(origin=AuditOrigin.MANUAL, user_id=admin.id)):
            yield session
            session.commit()


def collection(pipeline: Pipeline, name: str, acronym: str) -> uuid.UUID:
    with as_admin(pipeline) as session:
        item = Collection(
            id=new_uuid(),
            name=name,
            acronym=acronym,
            acronym_normalized=acronym,
            default_tenure_regime=TenureRegime.OWNED,
        )
        session.add(item)
        return item.id


def piece(pipeline: Pipeline, collection_id: uuid.UUID, *codes: tuple[str, str]) -> uuid.UUID:
    with as_admin(pipeline) as session:
        item = Piece(
            id=new_uuid(),
            denomination="Pieza sintética",
            tenure_regime=TenureRegime.OWNED,
            collection_id=collection_id,
        )
        session.add(item)
        session.flush()
        for type_code, value in codes:
            add_identifier(session, item, type_code, value, source="Prueba")
        return item.id


def sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def media(pipeline: Pipeline, piece_id: uuid.UUID, content_sha256: str) -> uuid.UUID:
    """A photo already in the gallery of the piece."""
    with as_admin(pipeline) as session:
        asset = MediaAsset(
            id=new_uuid(),
            piece_id=piece_id,
            storage_key=f"media/{new_uuid()}/original.jpeg",
            original_filename="anterior.jpg",
            content_type="image/jpeg",
            size_bytes=10,
            content_sha256=content_sha256,
            sort_order=1,
        )
        session.add(asset)
        return asset.id


def photo_batch(pipeline: Pipeline, name: str) -> str:
    response = pipeline.client.post(f"{BASE}/photo-batches", json={"name": name})
    assert response.status_code == 201, response.text
    return response.json()["id"]  # type: ignore[no-any-return]


def add_photos(pipeline: Pipeline, batch_id: str, *paths: str, **values: Any) -> dict[str, str]:
    """Verified photos of the batch, by relative path; ``content_sha256`` from the batch and path
    unless ``values`` gives one."""
    ids: dict[str, str] = {}
    with as_admin(pipeline) as session:
        for path in paths:
            photo_id = new_uuid()
            session.add(
                ImportPhoto(
                    id=photo_id,
                    batch_id=uuid.UUID(batch_id),
                    relative_path=path,
                    original_filename=path.rsplit("/", 1)[-1],
                    content_sha256=values.get("content_sha256") or sha(f"{batch_id}/{path}"),
                    size_bytes=1024,
                    content_type="image/jpeg",
                    storage_prefix=f"media/{photo_id}/",
                    status=ImportPhotoStatus.VERIFIED,
                )
            )
            ids[path] = str(photo_id)
    return ids


def rematch(pipeline: Pipeline, batch_id: str) -> None:
    """Run the matching as the verification does after each group."""
    from app.modules.imports.catalog_photos import identifier_rules
    from app.modules.imports.models import ImportBatch
    from app.modules.imports.photos import match_batch_photos

    with as_admin(pipeline) as session:
        batch = session.get(ImportBatch, uuid.UUID(batch_id))
        assert batch is not None
        match_batch_photos(session, batch, identifier_rules(session))


def photos(pipeline: Pipeline, batch_id: str, **params: Any) -> list[dict[str, Any]]:
    response = pipeline.client.get(f"{BASE}/{batch_id}/photos", params={"limit": 100, **params})
    assert response.status_code == 200, response.text
    return response.json()["items"]  # type: ignore[no-any-return]


def by_path(pipeline: Pipeline, batch_id: str) -> dict[str, dict[str, Any]]:
    return {item["relative_path"]: item for item in photos(pipeline, batch_id)}


def decide(pipeline: Pipeline, batch_id: str, op: str, photo_ids: list[str], **target: Any) -> Any:
    return pipeline.client.patch(
        f"{BASE}/{batch_id}/photos",
        json={"op": op, "photo_ids": photo_ids, **{k: str(v) for k, v in target.items()}},
    )


def pattern_jpeg(seed: int, width: int = 90, height: int = 80) -> bytes:
    """A synthetic photo of its own: random blocks from ``seed``, scaled to the size given. Two
    seeds give images with different perceptual hashes; one seed in two sizes, the same one."""
    rng = random.Random(seed)
    small = Image.new("L", (9, 8))
    small.putdata([rng.randrange(256) for _ in range(72)])
    output = io.BytesIO()
    small.resize((width, height), Image.Resampling.NEAREST).convert("RGB").save(
        output, format="JPEG", quality=95
    )
    return output.getvalue()
