"""Spec importacion-datos — Detección de la misma foto en distinta resolución (RF-046, RNF-003).

Change importacion-fotos-a-catalogo, task 5.1 (design D6): the 64-bit dHash of an image and its
grouping. Synthetic images only (RNF-014).
"""

import random
import uuid

from PIL import Image

from app.modules.imports.perceptual import HashedPhoto, dhash, distance, similar_groups


def picture(seed: int, size: tuple[int, int] = (400, 300)) -> Image.Image:
    rng = random.Random(seed)
    small = Image.new("L", (9, 8))
    small.putdata([rng.randrange(256) for _ in range(72)])
    return small.resize(size, Image.Resampling.BILINEAR).convert("RGB")


def test_the_same_image_rescaled_is_within_the_threshold() -> None:
    small, large = picture(1, (400, 300)), picture(1, (2400, 1800))

    assert len(dhash(small)) == 16
    assert distance(dhash(small), dhash(large)) <= 4


def test_two_different_images_are_far_apart() -> None:
    assert distance(dhash(picture(1)), dhash(picture(2))) > 4


def hashed(name: str, value: int, pixels: int, size: int = 100) -> HashedPhoto:
    return HashedPhoto(uuid.uuid5(uuid.NAMESPACE_URL, name), f"{value:016x}", pixels, size, name)


def test_groups_keep_the_one_with_most_pixels_then_the_largest_file_then_the_path() -> None:
    photos = [
        hashed("82LF4169.jpg", 0b1111, 400 * 300),
        hashed("ALTAS/82LF4169 copy.jpg", 0b1110, 2400 * 1800),
        hashed("otra.jpg", 0xFFFF_0000_FFFF_0000, 100),
        hashed("b.jpg", 0x00FF_00FF_00FF_00FF, 50, size=10),
        hashed("a.jpg", 0x00FF_00FF_00FF_00FF, 50, size=10),
    ]

    groups = similar_groups(photos, 4)

    assert sorted([p.relative_path for p in group] for group in groups) == [
        ["ALTAS/82LF4169 copy.jpg", "82LF4169.jpg"],
        ["a.jpg", "b.jpg"],
    ]


def test_no_pair_within_the_threshold_is_missed_by_the_buckets() -> None:
    rng = random.Random(7)
    base = rng.getrandbits(64)
    # Four bits apart, one in each quarter: a filter by the first 16 bits alone would miss it.
    near = base ^ (1 << 3) ^ (1 << 20) ^ (1 << 40) ^ (1 << 60)
    others = [rng.getrandbits(64) for _ in range(200)]
    photos = [hashed("base", base, 10), hashed("near", near, 5)] + [
        hashed(f"x{i}", value, 1) for i, value in enumerate(others)
    ]

    groups = similar_groups(photos, 4)

    assert any({p.relative_path for p in group} >= {"base", "near"} for group in groups)


def test_zero_bits_groups_only_identical_hashes() -> None:
    photos = [hashed("a", 1, 1), hashed("b", 1, 2), hashed("c", 3, 3)]

    assert [[p.relative_path for p in group] for group in similar_groups(photos, 0)] == [["b", "a"]]
