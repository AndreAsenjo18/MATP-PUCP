"""Reading photo names for the batch matching (task 3.1 of importacion-masiva-fotografias).

Spec importacion-datos, «Emparejamiento automático propuesto entre fotos y filas»; design D3.
Synthetic names only (RNF-014): the four of tasks.md and a few more for the edge cases.
"""

import pytest

from app.modules.identification.models import NormalizationRule
from app.modules.identification.normalization import (
    TYPE_COLLECTION,
    TYPE_INC_RN,
    TYPE_INVENTORY,
    TYPE_PUCP,
    normalize_collection_code,
    normalize_inventory_code,
)
from app.modules.imports.photo_matching import (
    COLLECTION_NUMBER,
    CandidateStrength,
    NameReading,
    order_key,
    read_name,
)


def keys_at(reading: NameReading, strength: CandidateStrength) -> set[tuple[str, str]]:
    return {key for c in reading.candidates if c.strength is strength for key in c.keys}


def test_sequence_suffix_orders_the_photo_and_keeps_the_code() -> None:
    """`I 1234 (2).JPG`: second photo of the row whose code I is `I-01234`."""
    reading = read_name("I 1234 (2).JPG")
    assert reading.stem == "I 1234 (2)"
    assert reading.base == "I 1234"
    assert reading.sequence == 2
    row_code = normalize_inventory_code("I-01234").normalized
    assert row_code == "I-1234"
    assert (TYPE_INVENTORY, row_code) in keys_at(reading, CandidateStrength.WHOLE)


def test_photos_of_a_row_follow_the_sequence_and_the_natural_order() -> None:
    names = ["I 1234 (2).JPG", "I 1234 (10).JPG", "I 1234.JPG"]
    assert sorted(names, key=lambda n: order_key(read_name(n))) == [
        "I 1234.JPG",
        "I 1234 (2).JPG",
        "I 1234 (10).JPG",
    ]
    names = ["foto10.jpg", "Foto2.jpg", "foto1.jpg"]
    assert sorted(names, key=lambda n: order_key(read_name(n))) == [
        "foto1.jpg",
        "Foto2.jpg",
        "foto10.jpg",
    ]


def test_view_suffix_is_removed_and_kept_apart() -> None:
    """`MMZ045_frontal.jpg`: the view is not part of the code `MMZ 45`."""
    reading = read_name("MMZ045_frontal.jpg")
    assert reading.base == "MMZ045"
    assert reading.view == "frontal"
    row_code = normalize_collection_code("MMZ 45").normalized
    assert (TYPE_COLLECTION, row_code) in keys_at(reading, CandidateStrength.WHOLE)


def test_spreadsheet_number_is_read_without_its_decimal() -> None:
    """`1234.0.jpg`: a number a spreadsheet wrote as `1234.0` is `1234` [SUPUESTO S3]."""
    reading = read_name("1234.0.jpg")
    assert reading.stem == "1234.0"
    assert reading.base == "1234"
    keys = keys_at(reading, CandidateStrength.WHOLE)
    assert {
        (TYPE_INVENTORY, "I-1234"),
        (TYPE_INC_RN, "1234"),
        (TYPE_PUCP, "1234"),
        (COLLECTION_NUMBER, "1234"),
    } <= keys


@pytest.mark.parametrize(
    "name", ["IMG_20190312.jpg", "IMG_20190312_101500.jpg", "DSC_0001.jpg", "dscn0042.JPG"]
)
def test_camera_names_give_no_code(name: str) -> None:
    """`IMG_20190312.jpg`: a camera name gives no candidate [SUPUESTO S2]."""
    reading = read_name(name)
    assert reading.camera_name is True
    assert reading.candidates == ()


def test_a_number_alone_is_also_a_collection_correlative() -> None:
    """`245.jpg` is compared with the correlative of the collection codes too [SUPUESTO S1]."""
    keys = keys_at(read_name("245.jpg"), CandidateStrength.WHOLE)
    assert (COLLECTION_NUMBER, "245") in keys
    assert (TYPE_PUCP, "245") in keys
    assert (TYPE_INVENTORY, "I-245") in keys
    # A collection code is never read from a number without its acronym.
    assert not any(type_code == TYPE_COLLECTION for type_code, _ in keys)


def test_folder_names_keep_their_dots_and_spaces() -> None:
    """A folder has no extension: `MMZ 045` and `M.M.Z. 015` are codes as written."""
    assert (TYPE_COLLECTION, "MMZ 45") in keys_at(
        read_name("MMZ 045", is_file=False), CandidateStrength.WHOLE
    )
    assert (TYPE_COLLECTION, "MMZ 15") in keys_at(
        read_name("M.M.Z. 015", is_file=False), CandidateStrength.WHOLE
    )


def test_copy_suffixes_and_prefixes_are_not_codes() -> None:
    reading = read_name("MMZ 045 - copia (2).jpg")
    assert reading.base == "MMZ 045"
    assert reading.sequence == 2
    assert read_name("Copia de MMZ 045.jpg").base == "MMZ 045"
    assert read_name("fotocopia.jpg").base == "fotocopia"


def test_a_short_trailing_suffix_is_only_a_looser_reading() -> None:
    """`MBB 40-a` may be the component `MBB 40.A` or the second photo of `MBB 40`."""
    reading = read_name("MBB 40-a.jpg")
    assert (TYPE_COLLECTION, "MBB 40.A") in keys_at(reading, CandidateStrength.WHOLE)
    assert (TYPE_COLLECTION, "MBB 40") in keys_at(reading, CandidateStrength.LOOSE)
    # A code whose only number is the suffix keeps it: `RA-12` is never read as `RA`.
    ra = read_name("RA-12.jpg")
    assert (TYPE_COLLECTION, "RA 12") in keys_at(ra, CandidateStrength.WHOLE)
    assert keys_at(ra, CandidateStrength.LOOSE) == set()


def test_codes_inside_a_longer_name_are_less_specific() -> None:
    reading = read_name("Toro de Pucara MMZ 045.jpg")
    assert (TYPE_COLLECTION, "MMZ 45") in keys_at(reading, CandidateStrength.FRAGMENT)
    numbers = keys_at(read_name("toro_1234.jpg"), CandidateStrength.NUMBER)
    assert (TYPE_INVENTORY, "I-1234") in numbers
    # The number of an acronym is not read alone: `MMZ045` gives no `045`.
    assert keys_at(read_name("MMZ045.jpg"), CandidateStrength.NUMBER) == set()


def test_the_rules_come_from_the_identifier_types_of_the_batch() -> None:
    """Identifier types are parameters (RN-010): only the given rules produce keys."""
    reading = read_name("1234.jpg", rules={TYPE_INVENTORY: NormalizationRule.INVENTORY})
    assert keys_at(reading, CandidateStrength.WHOLE) == {
        (TYPE_INVENTORY, "I-1234"),
        (COLLECTION_NUMBER, "1234"),
    }


def test_names_without_anything_left_give_no_candidate() -> None:
    assert read_name("(2).jpg").candidates == ()
    assert read_name("0.jpg").candidates == ()
