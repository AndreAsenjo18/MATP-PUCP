"""Derivatives generation for media assets (spec multimedia: D3)."""

import io
from typing import TYPE_CHECKING

from PIL import Image

if TYPE_CHECKING:
    from app.core.storage import ObjectStorage

# Derivative specifications
THUMB_MAX_DIM = 320
DISPLAY_MAX_DIM = 1600
WEBP_QUALITY = 80


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
            new_width = int(image.width * max_dim / image.width)
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

    thumb_data = _resize_image(source_data, THUMB_MAX_DIM)
    display_data = _resize_image(source_data, DISPLAY_MAX_DIM)

    thumb_key = f"pieces/{piece_id}/{asset_id}/thumb.webp"
    display_key = f"pieces/{piece_id}/{asset_id}/display.webp"

    storage.put_bytes(thumb_key, thumb_data, "image/webp")
    storage.put_bytes(display_key, display_data, "image/webp")

    return {"thumb_key": thumb_key, "display_key": display_key}


def rebuild_derivatives_cli() -> None:
    """CLI command: python -m app.media.rebuild_derivatives

    Re-generates missing derivatives for all media assets.
    """
    # This will be implemented as a CLI entry point
    pass
