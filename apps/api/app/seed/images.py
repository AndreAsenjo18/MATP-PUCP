"""Placeholder photographs for synthetic pieces (no real images of the collection)."""

import hashlib
import io
from dataclasses import dataclass

from PIL import Image, ImageDraw


@dataclass(frozen=True)
class GeneratedImage:
    data: bytes
    width: int
    height: int
    sha256: str
    content_type: str = "image/jpeg"


def placeholder_photo(
    label: str, view: str, *, width: int = 480, height: int = 360
) -> GeneratedImage:
    """Deterministic JPEG with a colour derived from the label and a visible synthetic notice."""
    digest = hashlib.sha256(f"{label}|{view}".encode()).digest()
    background = (80 + digest[0] % 150, 80 + digest[1] % 150, 80 + digest[2] % 150)
    image = Image.new("RGB", (width, height), background)
    draw = ImageDraw.Draw(image)
    margin = 16
    draw.rectangle(
        (margin, margin, width - margin, height - margin), outline=(255, 255, 255), width=3
    )
    # Simple silhouette so different views look different in the mock-up.
    shape = digest[3] % 3
    box = (width * 0.3, height * 0.25, width * 0.7, height * 0.75)
    if shape == 0:
        draw.ellipse(box, fill=(240, 235, 220))
    elif shape == 1:
        draw.rectangle(box, fill=(240, 235, 220))
    else:
        draw.polygon(
            [
                (width * 0.5, height * 0.2),
                (width * 0.72, height * 0.78),
                (width * 0.28, height * 0.78),
            ],
            fill=(240, 235, 220),
        )
    draw.text((margin + 10, margin + 8), "MATP - FOTO SINTETICA", fill=(255, 255, 255))
    draw.text((margin + 10, height - margin - 34), label[:48], fill=(255, 255, 255))
    draw.text((margin + 10, height - margin - 20), f"Vista: {view}", fill=(255, 255, 255))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=80)
    data = buffer.getvalue()
    return GeneratedImage(data, width, height, hashlib.sha256(data).hexdigest())
