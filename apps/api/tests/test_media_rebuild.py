"""Regeneration of photo derivatives (fotografias-multiples-por-pieza 2.3).

Spec multimedia, «Derivados livianos para visualización», scenario «Fallo al generar
derivados»: the photo stays registered and a command regenerates its derivatives. The command is
``python -m app.media.rebuild_derivatives``; here its function runs on an in-memory storage.
Synthetic data only (RNF-014).
"""

import io
from typing import Any

import pytest
from PIL import Image
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.models_base import new_uuid
from app.media import rebuild_derivatives as command
from app.modules.audit.models import AuditAction, AuditLog, AuditOrigin
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.media.derivatives import REBUILD_ACTOR, rebuild_derivatives
from app.modules.media.models import MediaAsset
from tests.conftest import ActAs


class Storage:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def put_bytes(self, key: str, data: bytes, _type: str) -> None:
        self.objects[key] = data

    def get_bytes(self, key: str) -> bytes:
        return self.objects[key]

    def head(self, key: str) -> dict[str, Any]:
        if key not in self.objects:
            raise FileNotFoundError(key)
        return {"content_length": len(self.objects[key])}


def _jpeg() -> bytes:
    output = io.BytesIO()
    Image.new("RGB", (64, 48), (120, 80, 40)).save(output, format="JPEG")
    return output.getvalue()


@pytest.fixture
def storage() -> Storage:
    return Storage()


@pytest.fixture
def photos(session: Session, act_as: ActAs, storage: Storage) -> dict[str, MediaAsset]:
    """Failed, complete, without thumbnail and broken: the four cases of the command."""
    with act_as("CATALOGUER"):
        piece = create_piece(
            session, denomination="Mate burilado", tenure_regime=TenureRegime.OWNED
        )
        made: dict[str, MediaAsset] = {}
        for order, name in enumerate(("failed", "complete", "missing", "broken")):
            asset_id = new_uuid()
            key = f"pieces/{piece.id}/{asset_id}/original.jpg"
            storage.objects[key] = b"no es una imagen" if name == "broken" else _jpeg()
            if name == "complete":
                storage.objects[f"pieces/{piece.id}/{asset_id}/thumb.webp"] = b"miniatura"
            marked = name in ("failed", "broken")
            made[name] = MediaAsset(
                id=asset_id,
                piece_id=piece.id,
                storage_key=key,
                original_filename=f"{name}.jpg",
                content_type="image/jpeg",
                size_bytes=len(storage.objects[key]),
                content_sha256=f"{order}" * 64,
                sort_order=order,
                is_primary=order == 0,
                extra_metadata={"derivatives": "failed"} if marked else None,
            )
            session.add(made[name])
        session.commit()
    return made


def test_the_failed_and_missing_derivatives_are_regenerated_and_audited(
    session: Session, storage: Storage, photos: dict[str, MediaAsset]
) -> None:
    result = rebuild_derivatives(session, storage)  # type: ignore[arg-type]
    session.commit()

    assert set(result.rebuilt) == {photos["failed"].id, photos["missing"].id}
    assert result.failed == [photos["broken"].id]
    for name in ("failed", "missing"):
        prefix = photos[name].storage_key.rpartition("/")[0]
        assert {f"{prefix}/thumb.webp", f"{prefix}/display.webp"} <= set(storage.objects)
        assert photos[name].extra_metadata == {"derivatives": "ok"}
    broken = session.get(MediaAsset, photos["broken"].id)
    assert broken is not None and broken.deleted_at is None  # still registered
    assert broken.extra_metadata == {"derivatives": "failed"}
    entries = session.scalars(
        select(AuditLog).where(
            AuditLog.entity_id == photos["failed"].id,
            AuditLog.field == "extra_metadata",
            AuditLog.action == AuditAction.UPDATE,
        )
    ).all()
    assert {(entry.origin, entry.actor_label) for entry in entries} == {
        (AuditOrigin.SYSTEM, REBUILD_ACTOR)
    }


def test_only_failed_does_not_look_at_the_storage_and_dry_run_writes_nothing(
    session: Session, storage: Storage, photos: dict[str, MediaAsset]
) -> None:
    before = dict(storage.objects)

    counted = rebuild_derivatives(session, storage, only_failed=True, dry_run=True)  # type: ignore[arg-type]

    assert set(counted.rebuilt) == {photos["failed"].id, photos["broken"].id}
    assert storage.objects == before


def test_photos_saved_directly_in_their_piece_do_not_share_their_derivatives(
    session: Session, act_as: ActAs, storage: Storage
) -> None:
    """The synthetic photos of the seed: ``pieces/{piece}/{asset}.jpg``, several per piece."""
    with act_as("CATALOGUER"):
        piece = create_piece(session, denomination="Olla", tenure_regime=TenureRegime.OWNED)
        assets = []
        for order in range(2):
            asset_id = new_uuid()
            key = f"pieces/{piece.id}/{asset_id}.jpg"
            storage.objects[key] = _jpeg()
            assets.append(
                MediaAsset(
                    id=asset_id,
                    piece_id=piece.id,
                    storage_key=key,
                    original_filename=f"semilla-{order}.jpg",
                    content_type="image/jpeg",
                    size_bytes=len(storage.objects[key]),
                    content_sha256=f"{order}" * 64,
                    sort_order=order,
                    is_primary=order == 0,
                )
            )
        session.add_all(assets)
        session.commit()

    result = rebuild_derivatives(session, storage)  # type: ignore[arg-type]
    session.commit()

    assert set(result.rebuilt) == {asset.id for asset in assets}
    for asset in assets:
        folder = f"pieces/{piece.id}/{asset.id}"
        assert {f"{folder}/thumb.webp", f"{folder}/display.webp"} <= set(storage.objects)
        assert asset.extra_metadata == {"derivatives": "ok"}
    assert f"pieces/{piece.id}/thumb.webp" not in storage.objects
    # They are not regenerated each time.
    assert rebuild_derivatives(session, storage).rebuilt == []  # type: ignore[arg-type]


def test_a_photo_of_a_batch_keeps_its_derivatives_next_to_it(
    session: Session, act_as: ActAs, storage: Storage
) -> None:
    with act_as("CATALOGUER"):
        piece = create_piece(session, denomination="Mate", tenure_regime=TenureRegime.OWNED)
        photo_id = new_uuid()
        key = f"media/{photo_id}/upload.jpeg"
        storage.objects[key] = _jpeg()
        session.add(
            MediaAsset(
                id=new_uuid(),
                piece_id=piece.id,
                storage_key=key,
                original_filename="lote.jpg",
                content_type="image/jpeg",
                size_bytes=len(storage.objects[key]),
                content_sha256="9" * 64,
                sort_order=0,
                is_primary=True,
            )
        )
        session.commit()

    rebuild_derivatives(session, storage)  # type: ignore[arg-type]

    assert f"media/{photo_id}/thumb.webp" in storage.objects


def test_the_documented_command_exists() -> None:
    with pytest.raises(SystemExit) as exit_info:
        command.main(["--help"])
    assert exit_info.value.code == 0
