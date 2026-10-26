"""Volume of the photos by file type (importacion-masiva-fotografias D6; fotografias-multiples 2.6).

The derivatives are not read from the storage: each photo counts a display copy of about 300 KB
and a thumbnail of about 20 KB [SUPUESTO D6: a 1600 px WebP and a 320 px one of a camera JPEG].
A photo imported without its original (``MEDIA_KEEP_ORIGINALS=false``) is stored on its display
copy, whose real size is the one of the asset.
"""

from dataclasses import dataclass

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.modules.media.models import MediaAsset

MIB = 1024 * 1024
DISPLAY_BYTES = 300 * 1024
THUMB_BYTES = 20 * 1024
# Photos the museum expects to digitise [SUPUESTO L2: ≈ 10 000 pieces and ≈ 25 000 photos].
EXPECTED_PHOTOS = 25_000
# Weight of a photo when there is none to average yet [SUPUESTO L3: JPEG of 3 to 8 MB].
DEFAULT_MB_PER_PHOTO = 4


@dataclass(frozen=True)
class Volume:
    original_bytes: int
    display_bytes: int
    thumb_bytes: int

    @property
    def total_bytes(self) -> int:
        return self.original_bytes + self.display_bytes + self.thumb_bytes

    def as_json(self) -> dict[str, int]:
        return {
            "original_bytes": self.original_bytes,
            "display_bytes": self.display_bytes,
            "thumb_bytes": self.thumb_bytes,
        }


@dataclass(frozen=True)
class CurrentVolume:
    volume: Volume
    photos: int
    pieces_with_photos: int


def current_volume(session: Session) -> CurrentVolume:
    """Volume of the active photos, in a single aggregate query."""
    on_display = MediaAsset.storage_key.like("%/display.webp")
    photos, pieces, originals, displays, with_original = session.execute(
        select(
            func.count(MediaAsset.id),
            func.count(func.distinct(MediaAsset.piece_id)),
            func.coalesce(func.sum(case((on_display, 0), else_=MediaAsset.size_bytes)), 0),
            func.coalesce(func.sum(case((on_display, MediaAsset.size_bytes), else_=0)), 0),
            func.coalesce(func.sum(case((on_display, 0), else_=1)), 0),
        ).where(MediaAsset.deleted_at.is_(None))
    ).one()
    volume = Volume(
        original_bytes=int(originals),
        display_bytes=int(displays) + int(with_original) * DISPLAY_BYTES,
        thumb_bytes=int(photos) * THUMB_BYTES,
    )
    return CurrentVolume(volume, int(photos), int(pieces))


def projected_volume(photos: float, mb_per_photo: float, *, keep_originals: bool) -> Volume:
    """Volume of ``photos`` future photos with the current ``MEDIA_KEEP_ORIGINALS``."""
    return Volume(
        original_bytes=int(photos * mb_per_photo * MIB) if keep_originals else 0,
        display_bytes=int(photos * DISPLAY_BYTES),
        thumb_bytes=int(photos * THUMB_BYTES),
    )
