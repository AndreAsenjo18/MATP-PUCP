"""Light derivatives of a photo (spec multimedia, «Derivados livianos para visualización»; D3).

Synthetic images only (RNF-014).
"""

import io

import pytest
from PIL import Image

from app.modules.media.derivatives import DISPLAY_MAX_DIM, THUMB_MAX_DIM, _resize_image


def _image(width: int, height: int) -> bytes:
    output = io.BytesIO()
    Image.new("RGB", (width, height), (120, 80, 40)).save(output, format="JPEG")
    return output.getvalue()


def _size(data: bytes) -> tuple[int, int]:
    image = Image.open(io.BytesIO(data))
    assert image.format == "WEBP"
    return image.size


@pytest.mark.parametrize(
    ("source", "max_dim", "expected"),
    [
        ((4000, 3000), DISPLAY_MAX_DIM, (1600, 1200)),  # landscape
        ((3000, 4000), DISPLAY_MAX_DIM, (1200, 1600)),  # portrait keeps its proportions too
        ((3000, 4000), THUMB_MAX_DIM, (240, 320)),
        ((800, 600), DISPLAY_MAX_DIM, (800, 600)),  # smaller than the limit: not enlarged
    ],
)
def test_a_derivative_keeps_the_aspect_ratio(
    source: tuple[int, int], max_dim: int, expected: tuple[int, int]
) -> None:
    assert _size(_resize_image(_image(*source), max_dim)) == expected
