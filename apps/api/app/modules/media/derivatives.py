"""Derivatives generation for media assets (spec multimedia: D3)."""

import io
import uuid
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from PIL import Image

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.core.storage import ObjectStorage
    from app.modules.media.models import MediaAsset

# Derivative specifications
THUMB_MAX_DIM = 320
DISPLAY_MAX_DIM = 1600
WEBP_QUALITY = 80
REBUILD_ACTOR = "rebuild_derivatives"
#: Object names whose derivatives (thumb.webp, display.webp) sit in the same folder: a manual
#: upload (``original.<ext>``), an imported photo (``upload.<ext>``) or one whose original was not
#: kept (``display.webp``, task 5.4).
DERIVED_OBJECTS = frozenset({"original", "upload", "display"})


def _resize_image(data: bytes, max_dim: int) -> bytes:
    """Resize image keeping aspect ratio, max dimension = max_dim, output as WebP."""
    image = Image.open(io.BytesIO(data))
    image.load()

    # Keep aspect ratio
    if max(image.width, image.height) > max_dim:
        if image.width >= image.height:
            new_width = max_dim
            new_height = int(image.height * max_dim / image.width)
        else:
            new_height = max_dim
            new_width = int(image.width * max_dim / image.height)
        image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)

    output = io.BytesIO()
    image.save(output, format="WEBP", quality=WEBP_QUALITY, method=6)
    return output.getvalue()


def generate_derivatives(
    storage: "ObjectStorage",
    piece_id: str,
    asset_id: str,
    source_key: str,
) -> dict[str, str]:
    """Generate thumb.webp and display.webp derivatives for an asset.

    Stores them at:
    - pieces/{piece_id}/{asset_id}/thumb.webp
    - pieces/{piece_id}/{asset_id}/display.webp

    Returns dict with keys 'thumb_key', 'display_key'.
    """
    # Download source
    source_data = storage.get_bytes(source_key)
    return store_derivatives(storage, f"pieces/{piece_id}/{asset_id}/", source_data)


def store_derivatives(storage: "ObjectStorage", prefix: str, data: bytes) -> dict[str, str]:
    """Write thumb.webp and display.webp of the image ``data`` under ``prefix``.

    Shared by the photos of a piece (``pieces/{piece_id}/{asset_id}/``) and the photos of an
    import batch (``media/{photo_id}/``, change importacion-masiva-fotografias). Both images are
    computed before anything is written.
    """
    thumb_data = _resize_image(data, THUMB_MAX_DIM)
    display_data = _resize_image(data, DISPLAY_MAX_DIM)

    thumb_key = f"{prefix}thumb.webp"
    display_key = f"{prefix}display.webp"

    storage.put_bytes(thumb_key, thumb_data, "image/webp")
    storage.put_bytes(display_key, display_data, "image/webp")

    return {"thumb_key": thumb_key, "display_key": display_key}


@dataclass
class RebuildResult:
    rebuilt: list[uuid.UUID] = field(default_factory=list)
    failed: list[uuid.UUID] = field(default_factory=list)


def _has_own_folder(asset: "MediaAsset") -> bool:
    return asset.storage_key.rpartition("/")[2].split(".", 1)[0] in DERIVED_OBJECTS


def derivatives_prefix(asset: "MediaAsset") -> str:
    """The derivatives sit next to the file of the asset when it has a folder of its own:
    ``pieces/{piece}/{asset}/`` for an upload to the sheet and ``media/{photo}/`` for a photo of
    an import batch. A photo saved directly in the folder of its piece (the synthetic photos of
    the seed, ``pieces/{piece}/{asset}.jpg``) gets a folder named after it, because its piece may
    have more photos."""
    folder, _, name = asset.storage_key.rpartition("/")
    return f"{folder}/" if _has_own_folder(asset) else f"{folder}/{name.split('.', 1)[0]}/"


def derivative_keys(asset: "MediaAsset") -> tuple[str, str]:
    """Keys of the thumbnail and the display copy that show ``asset``.

    A photo with a folder of its own gets its derivatives when it is registered; one saved directly
    only from ``rebuild_derivatives``, which marks it ``ok``. Without them (never generated, or
    marked ``failed``) the photo is shown from its own object.
    """
    mark = (asset.extra_metadata or {}).get("derivatives")
    if mark == "ok" or (mark != "failed" and _has_own_folder(asset)):
        prefix = derivatives_prefix(asset)
        return f"{prefix}thumb.webp", f"{prefix}display.webp"
    return asset.storage_key, asset.storage_key


def _needs_rebuild(storage: "ObjectStorage", asset: "MediaAsset", only_failed: bool) -> bool:
    if (asset.extra_metadata or {}).get("derivatives") == "failed":
        return True
    if only_failed:
        return False
    try:
        storage.head(f"{derivatives_prefix(asset)}thumb.webp")
    except FileNotFoundError:
        return True
    return False


def rebuild_derivatives(
    session: "Session",
    storage: "ObjectStorage",
    *,
    only_failed: bool = False,
    dry_run: bool = False,
) -> RebuildResult:
    """Regenerate the derivatives that failed or are missing (fotografias-multiples 2.3).

    The mark of each asset (``extra_metadata.derivatives``) is audited with origin system, like
    any other change of the catalogue. A photo whose derivatives fail again stays registered and
    keeps the ``failed`` mark, so the sheet goes on warning that it has no preview.
    """
    from sqlalchemy import select

    from app.modules.audit.context import AuditContext, audit_context
    from app.modules.audit.models import AuditOrigin
    from app.modules.media.models import MediaAsset

    result = RebuildResult()
    assets = session.scalars(select(MediaAsset).order_by(MediaAsset.created_at)).all()
    pending = [asset for asset in assets if _needs_rebuild(storage, asset, only_failed)]
    if dry_run:
        result.rebuilt = [asset.id for asset in pending]
        return result
    context = AuditContext(origin=AuditOrigin.SYSTEM, actor_label=REBUILD_ACTOR)
    with audit_context(session, context):
        for asset in pending:
            try:
                store_derivatives(
                    storage, derivatives_prefix(asset), storage.get_bytes(asset.storage_key)
                )
            except (OSError, ValueError, Image.DecompressionBombError):
                mark = "failed"
                result.failed.append(asset.id)
            else:
                mark = "ok"
                result.rebuilt.append(asset.id)
            asset.extra_metadata = {**(asset.extra_metadata or {}), "derivatives": mark}
        session.flush()
    return result
