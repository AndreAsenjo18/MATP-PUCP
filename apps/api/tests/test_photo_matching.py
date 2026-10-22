"""Photo matching of an import batch (tasks 3.1 and 3.2 of importacion-masiva-fotografias).

Spec importacion-datos, «Emparejamiento automático propuesto entre fotos y filas»; design D3.
Task 3.1 reads the names; task 3.2 resolves them against the batch rows, with one test per
scenario of the requirement plus the rules of precedence and ambiguity. Synthetic names only
(RNF-014): those of tasks.md and of the spec, and a few more for the edge cases.
"""

import uuid

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
from app.modules.imports.models import PhotoMatchSource, PhotoMatchStatus
from app.modules.imports.photo_matching import (
    COLLECTION_NUMBER,
    BatchPhoto,
    BatchRow,
    CandidateStrength,
    NameReading,
    PhotoProposal,
    match_photos,
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


# ------------------------------------------------- batch index and three-way resolution (3.2)


def row(*identifiers: tuple[str, str | None], files: tuple[str, ...] = ()) -> BatchRow:
    """Stand-in of an import row: its normalized identifiers and its photo file column."""
    return BatchRow(uuid.uuid4(), tuple(identifiers), files)


def photos(*paths: str) -> list[BatchPhoto]:
    return [BatchPhoto(uuid.uuid4(), path) for path in paths]


def proposals_by_path(batch: list[BatchPhoto], rows: list[BatchRow]) -> dict[str, PhotoProposal]:
    result = match_photos(batch, rows)
    assert [p.photo_id for p in result] == [p.photo_id for p in batch]
    return {photo.relative_path: proposal for photo, proposal in zip(batch, result, strict=True)}


def code_i(raw: str) -> tuple[str, str | None]:
    return TYPE_INVENTORY, normalize_inventory_code(raw).normalized


def collection(raw: str) -> tuple[str, str | None]:
    return TYPE_COLLECTION, normalize_collection_code(raw).normalized


def test_scenario_code_in_the_file_name_with_another_format() -> None:
    """«Código en el nombre del archivo con formato distinto»: `I 1234 (2).JPG` → `I-01234`."""
    target, other = row(code_i("I-01234")), row(code_i("I-0999"))
    batch = photos("fotos/I 1234 (2).JPG", "fotos/I 1234.JPG")
    result = proposals_by_path(batch, [target, other])
    second = result["fotos/I 1234 (2).JPG"]
    assert second.status is PhotoMatchStatus.MATCHED
    assert second.source is PhotoMatchSource.FILENAME
    assert second.row_id == target.row_id
    assert second.sort_key == 2
    assert result["fotos/I 1234.JPG"].sort_key == 1


def test_scenario_code_in_the_folder_name() -> None:
    """«Código en el nombre de la carpeta»: `MMZ 045/DSC_0001.jpg` → `MMZ 45`."""
    target = row(collection("MMZ 45"))
    batch = photos("MMZ 045/DSC_0002.jpg", "MMZ 045/DSC_0001.jpg")
    result = proposals_by_path(batch, [target, row(collection("MMZ 46"))])
    for path, sort_key in [("MMZ 045/DSC_0001.jpg", 1), ("MMZ 045/DSC_0002.jpg", 2)]:
        assert result[path].status is PhotoMatchStatus.MATCHED
        assert result[path].source is PhotoMatchSource.FOLDER
        assert result[path].row_id == target.row_id
        assert result[path].sort_key == sort_key


def test_scenario_photo_file_column_in_the_mapping() -> None:
    """«Columna de archivo definida en el mapeo»: the «Foto» column says `ajb_0102_a.jpg`."""
    target = row(code_i("I-0555"), files=("ajb_0102_a.jpg",))
    result = proposals_by_path(photos("fotos/ajb_0102_a.jpg"), [target, row(code_i("I-0556"))])
    proposal = result["fotos/ajb_0102_a.jpg"]
    assert proposal.status is PhotoMatchStatus.MATCHED
    assert proposal.source is PhotoMatchSource.COLUMN
    assert proposal.row_id == target.row_id


def test_scenario_photo_matching_two_rows() -> None:
    """«Foto que coincide con dos filas»: `245.jpg` with a collection code and a PUCP code."""
    by_collection, by_pucp = row(collection("MMZ 245")), row((TYPE_PUCP, "245"))
    result = proposals_by_path(photos("245.jpg"), [by_collection, by_pucp, row(code_i("I-77"))])
    proposal = result["245.jpg"]
    assert proposal.status is PhotoMatchStatus.AMBIGUOUS
    assert proposal.source is PhotoMatchSource.FILENAME
    assert proposal.row_id is None
    assert set(proposal.candidate_row_ids) == {by_collection.row_id, by_pucp.row_id}
    assert proposal.sort_key is None


def test_scenario_photo_without_matches() -> None:
    """«Foto sin coincidencias»: `IMG_20190312_101500.jpg` in a folder without a code."""
    result = proposals_by_path(
        photos("Fotos sueltas/IMG_20190312_101500.jpg"),
        [row(code_i("I-1234")), row(collection("MMZ 45"), files=("otra.jpg",))],
    )
    proposal = result["Fotos sueltas/IMG_20190312_101500.jpg"]
    assert proposal == PhotoProposal(proposal.photo_id, PhotoMatchStatus.UNMATCHED)


def test_an_ambiguous_level_is_never_settled_by_a_less_specific_one() -> None:
    """The whole name matches two rows: the looser `MBB 40` reading is not tried."""
    component_a, component_b = row(collection("MBB 40-a")), row(collection("MBB 40.A"))
    proposal = proposals_by_path(
        photos("MBB 40-a.jpg"), [component_a, component_b, row(collection("MBB 40"))]
    )["MBB 40-a.jpg"]
    assert proposal.status is PhotoMatchStatus.AMBIGUOUS
    assert set(proposal.candidate_row_ids) == {component_a.row_id, component_b.row_id}


def test_an_ambiguous_file_name_is_never_settled_by_its_folder() -> None:
    folder_row = row(collection("MMZ 45"))
    proposal = proposals_by_path(
        photos("MMZ 045/245.jpg"), [row(collection("RA 245")), row((TYPE_PUCP, "245")), folder_row]
    )["MMZ 045/245.jpg"]
    assert proposal.status is PhotoMatchStatus.AMBIGUOUS
    assert proposal.source is PhotoMatchSource.FILENAME
    assert folder_row.row_id not in proposal.candidate_row_ids


def test_the_next_level_is_tried_only_when_the_current_one_matches_no_row() -> None:
    """`MBB 40-a` with no component row: the looser reading proposes the set `MBB 40`."""
    set_row = row(collection("MBB 40"))
    proposal = proposals_by_path(photos("MBB 40-a.jpg"), [set_row])["MBB 40-a.jpg"]
    assert proposal.status is PhotoMatchStatus.MATCHED
    assert proposal.row_id == set_row.row_id
    # With the component in the batch, the whole name wins and picks it.
    component = row(collection("MBB 40-a"))
    proposal = proposals_by_path(photos("MBB 40-a.jpg"), [set_row, component])["MBB 40-a.jpg"]
    assert proposal.row_id == component.row_id


def test_the_file_name_comes_before_the_folder_and_the_closest_folder_first() -> None:
    by_code, by_folder, by_inner = (
        row(code_i("I-1234")),
        row(collection("MMZ 45")),
        row(collection("RA 12")),
    )
    result = proposals_by_path(
        photos("MMZ 045/I 1234.jpg", "MMZ 045/RA 12/DSC_0001.jpg"), [by_code, by_folder, by_inner]
    )
    assert result["MMZ 045/I 1234.jpg"].row_id == by_code.row_id
    assert result["MMZ 045/RA 12/DSC_0001.jpg"].row_id == by_inner.row_id
    assert result["MMZ 045/RA 12/DSC_0001.jpg"].source is PhotoMatchSource.FOLDER


def test_the_photo_column_ignores_case_extension_and_folder() -> None:
    target = row(files=("Fotos/AJB_0102_A.JPG",))
    proposal = proposals_by_path(photos("otra/ajb_0102_a.jpeg"), [target])["otra/ajb_0102_a.jpeg"]
    assert proposal.source is PhotoMatchSource.COLUMN
    assert proposal.row_id == target.row_id


def test_identifiers_that_could_not_be_normalized_are_ignored() -> None:
    proposal = proposals_by_path(photos("1234.jpg"), [row((TYPE_INVENTORY, None))])["1234.jpg"]
    assert proposal.status is PhotoMatchStatus.UNMATCHED


def test_photos_of_a_row_keep_the_natural_order_of_their_names() -> None:
    target = row(collection("MMZ 45"))
    batch = photos("MMZ 045/DSC_10.jpg", "MMZ 045/DSC_2.jpg", "MMZ 045/DSC_1.jpg")
    result = proposals_by_path(batch, [target])
    assert [result[p].sort_key for p in ("MMZ 045/DSC_1.jpg", "MMZ 045/DSC_2.jpg")] == [1, 2]
    assert result["MMZ 045/DSC_10.jpg"].sort_key == 3
