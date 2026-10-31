"""The same photo in another resolution (change importacion-fotos-a-catalogo, tasks 5.1 and 5.2;
design D6).

The museum archive keeps a camera photo twice: a small copy and, in ``ALTAS/``, a large one. They
are different files, so their SHA-256 differ; a perceptual fingerprint recognizes them. ``dhash``
is the 64-bit difference hash: the image in grayscale, reduced to 9 × 8, each pixel compared with
its right neighbour. Two photos whose hashes differ in at most ``IMPORT_PHOTO_SIMILARITY_BITS``
bits are proposed as the same photo [SUPUESTO: 4 bits].

``similar_groups`` groups the photos of a batch without comparing every pair: the hash is cut in
``bits + 1`` parts and only photos that share one part are compared. Two hashes at distance ``d``
differ in at most ``d`` parts, so with ``bits + 1`` parts at least one is equal: no pair within the
threshold is missed. No dependency is added: Pillow is already used for the derivatives.
"""

import io
import uuid
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass

from PIL import Image

HASH_BITS = 64


def dhash(image: Image.Image) -> str:
    """64-bit difference hash, as 16 hexadecimal digits."""
    small = image.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    pixels = list(small.getdata())
    value = 0
    for row in range(8):
        for col in range(8):
            left, right = pixels[row * 9 + col], pixels[row * 9 + col + 1]
            value = (value << 1) | (1 if left > right else 0)
    return f"{value:016x}"


def dhash_bytes(data: bytes) -> tuple[str, int, int]:
    """Hash, width and height of an image file."""
    with Image.open(io.BytesIO(data)) as image:
        image.load()
        return dhash(image), image.width, image.height


def distance(first: str, second: str) -> int:
    return (int(first, 16) ^ int(second, 16)).bit_count()


@dataclass(frozen=True)
class HashedPhoto:
    photo_id: uuid.UUID
    perceptual_hash: str
    pixels: int  # width × height, 0 when unknown
    size_bytes: int
    relative_path: str


def _parts(value: int, count: int) -> list[tuple[int, int]]:
    """``count`` slices of the 64 bits, as ``(position, bits)``."""
    bounds = [round(i * HASH_BITS / count) for i in range(count + 1)]
    return [
        (i, (value >> bounds[i]) & ((1 << (bounds[i + 1] - bounds[i])) - 1)) for i in range(count)
    ]


def similar_groups(photos: Sequence[HashedPhoto], bits: int) -> list[list[HashedPhoto]]:
    """Groups of two or more photos whose hashes are within ``bits`` of each other (joined
    transitively), each ordered from the one to keep: most pixels, then largest file, then
    path (D6)."""
    if bits < 0 or len(photos) < 2:
        return []
    buckets: dict[tuple[int, int], list[int]] = defaultdict(list)
    values = [int(photo.perceptual_hash, 16) for photo in photos]
    for index, value in enumerate(values):
        for part in _parts(value, min(bits + 1, HASH_BITS)):
            buckets[part].append(index)
    parent = list(range(len(photos)))

    def root(index: int) -> int:
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    for members in buckets.values():
        for position, first in enumerate(members):
            for second in members[position + 1 :]:
                near = (values[first] ^ values[second]).bit_count() <= bits
                if near and root(first) != root(second):
                    parent[root(first)] = root(second)
    groups: dict[int, list[HashedPhoto]] = defaultdict(list)
    for index, photo in enumerate(photos):
        groups[root(index)].append(photo)
    return [
        sorted(group, key=lambda p: (-p.pixels, -p.size_bytes, p.relative_path))
        for group in groups.values()
        if len(group) > 1
    ]
