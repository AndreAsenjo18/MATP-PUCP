"""Spec importacion-datos — photos matched with the pieces of the catalogue (RF-046).

Change importacion-fotos-a-catalogo, tasks 3.3 to 3.9 (design D3, D4, D5, D11): the catalogue
index and its protections, templates, discrepant codes, template suggestion, rules by folder,
the folder's collection and range folders. Pure functions: no database. Synthetic names, codes and
collections only (RNF-014).
"""

import uuid
from collections.abc import Mapping

import pytest

from app.modules.identification.normalization import (
    DEFAULT_RULES,
    TYPE_COLLECTION,
    TYPE_INC_RN,
    TYPE_INVENTORY,
    TYPE_PUCP,
)
from app.modules.imports.catalog_photo_matching import (
    BARE_NUMBER,
    CAMERA_NAME,
    DISCREPANT_CODES,
    OTHER_COLLECTION,
    OUT_OF_RANGE,
    PARTIAL_CODES,
    TEMPLATE_MISMATCH,
    CatalogIndex,
    CatalogPhoto,
    CatalogPiece,
    CatalogProposal,
    CollectionRef,
    FolderRule,
    PhotoReading,
    TemplateError,
    analyze_folders,
    compile_template,
    folder_range,
    match_catalog_photos,
    propose_collection,
    suggest_template,
)
from app.modules.imports.models import PhotoMatchSource as Source
from app.modules.imports.models import PhotoMatchStatus as Status

TYPES = tuple(DEFAULT_RULES)
ABC, XYZ, JPZ = (uuid.uuid5(uuid.NAMESPACE_URL, name) for name in ("ABC", "XYZ", "JPZ"))
COLLECTIONS = (
    CollectionRef(ABC, "Colección ABC sintética", ("ABC",)),
    CollectionRef(XYZ, "Colección XYZ sintética", ("XYZ",)),
    CollectionRef(JPZ, "Juana Pérez", ("JPZ",)),
)


def piece(name: str, collection: uuid.UUID | None, *identifiers: tuple[str, str]) -> CatalogPiece:
    return CatalogPiece(uuid.uuid5(uuid.NAMESPACE_DNS, name), collection, identifiers)


PIECES = {
    "abc1": piece("abc1", ABC, (TYPE_COLLECTION, "ABC 1"), (TYPE_PUCP, "1234")),
    "abc2": piece("abc2", ABC, (TYPE_COLLECTION, "ABC 2"), (TYPE_INC_RN, "6100")),
    "abc7": piece("abc7", ABC, (TYPE_COLLECTION, "ABC 7"), (TYPE_PUCP, "1240")),
    "abc53": piece("abc53", ABC, (TYPE_COLLECTION, "ABC 53")),
    "abc59": piece("abc59", ABC, (TYPE_COLLECTION, "ABC 59")),
    "abc150": piece("abc150", ABC, (TYPE_COLLECTION, "ABC 150")),
    "abc245": piece("abc245", ABC, (TYPE_COLLECTION, "ABC 245")),
    "ab407": piece("ab407", ABC, (TYPE_INVENTORY, "I-3966"), (TYPE_COLLECTION, "AB 407")),
    "i3554": piece("i3554", XYZ, (TYPE_INVENTORY, "I-3554")),
    "i245": piece("i245", XYZ, (TYPE_INVENTORY, "I-245")),
    "xyz_pucp1299": piece("xyz_pucp1299", XYZ, (TYPE_PUCP, "1299")),
    "jpz12": piece("jpz12", JPZ, (TYPE_COLLECTION, "JPZ 12")),
}
INDEX = CatalogIndex(PIECES.values())


def pid(name: str) -> uuid.UUID:
    return PIECES[name].piece_id


def match(
    *paths: str,
    folders: Mapping[str, FolderRule] | None = None,
    default: FolderRule | None = None,
    collections: tuple[CollectionRef, ...] = COLLECTIONS,
) -> dict[str, CatalogProposal]:
    reading = PhotoReading(default=default or FolderRule(), folders=folders or {})
    photos = [CatalogPhoto(uuid.uuid5(uuid.NAMESPACE_OID, path), path) for path in paths]
    infos = analyze_folders(paths, collections, reading)
    proposals = match_catalog_photos(
        photos, INDEX, infos, valid_types=TYPES, default_rule=reading.default
    )
    return dict(zip(paths, proposals, strict=True))


def confirmed(collection: uuid.UUID | None, **values: object) -> FolderRule:
    return FolderRule(collection_id=collection, collection_set=True, **values)  # type: ignore[arg-type]


# --- 3.3 índice del catálogo y protecciones -------------------------------------------------------


def test_a_camera_counter_is_not_proposed_for_the_piece_with_that_code_i() -> None:
    (proposal,) = match("175-3554.jpg").values()

    assert proposal.status is Status.UNMATCHED
    assert proposal.piece_id is None
    assert proposal.reason == CAMERA_NAME


def test_a_number_alone_without_a_collection_is_not_compared_with_the_catalogue() -> None:
    (proposal,) = match("245.jpg").values()

    assert proposal.status is Status.UNMATCHED
    assert proposal.reason == BARE_NUMBER


def test_a_number_alone_with_a_collection_is_its_correlative() -> None:
    proposal = match("Coleccion ABC/245.jpg")["Coleccion ABC/245.jpg"]

    assert proposal.status is Status.MATCHED
    assert proposal.piece_id == pid("abc245")


def test_a_code_of_a_piece_of_another_collection_is_left_as_candidate() -> None:
    proposal = match("Coleccion ABC/PUCP 1299.jpg")["Coleccion ABC/PUCP 1299.jpg"]

    assert proposal.status is Status.UNMATCHED
    assert proposal.reason == OTHER_COLLECTION
    assert proposal.candidate_piece_ids == (pid("xyz_pucp1299"),)


def test_the_correlative_is_looked_up_within_its_collection() -> None:
    index = CatalogIndex([piece("solo", ABC, (TYPE_COLLECTION, "ABC 9"))])

    assert index.correlative(ABC, "009") == {pid_of("solo")}
    assert index.correlative(XYZ, "9") == set()


def pid_of(name: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_DNS, name)


# --- 3.4 plantillas -------------------------------------------------------------------------------


def test_template_for_correlative_and_camera_counter() -> None:
    rule = confirmed(ABC, mode="template", template="{n}-{*}")
    found = match(
        "FOTOS 051-114/053-3269.jpg",
        "FOTOS 051-114/059-3225 x.jpg",
        folders={"FOTOS 051-114": rule},
    )

    assert [p.piece_id for p in found.values()] == [pid("abc53"), pid("abc59")]
    assert {p.source for p in found.values()} == {Source.TEMPLATE}
    assert {p.reason for p in found.values()} == {None}


def test_template_with_two_codes_of_the_same_piece() -> None:
    rule = FolderRule(mode="template", template="{COLECCION} {n} - PUCP {PUCP}")
    (proposal,) = match("ABC 001 - PUCP 1234 (2).JPG", default=rule).values()

    assert proposal.status is Status.MATCHED and proposal.piece_id == pid("abc1")


def test_template_with_codes_of_different_pieces_is_ambiguous() -> None:
    rule = FolderRule(mode="template", template="{COLECCION} {n} - PUCP {PUCP}")
    (proposal,) = match("ABC 002 - PUCP 1299.JPG", default=rule).values()

    assert proposal.status is Status.AMBIGUOUS
    assert proposal.reason == DISCREPANT_CODES
    assert set(proposal.candidate_piece_ids) == {pid("abc2"), pid("xyz_pucp1299")}


def test_template_with_one_code_that_does_not_exist_is_partial() -> None:
    rule = FolderRule(mode="template", template="{COLECCION} {n} - PUCP {PUCP}")
    (proposal,) = match("ABC 7 - PUCP 9999.jpg", default=rule).values()

    assert proposal.status is Status.MATCHED and proposal.piece_id == pid("abc7")
    assert proposal.reason == PARTIAL_CODES


def test_a_name_that_does_not_fit_the_template() -> None:
    rule = confirmed(ABC, mode="template", template="{n}-{*}")
    found = match("Coleccion ABC/portada.jpg", folders={"Coleccion ABC": rule})

    assert found["Coleccion ABC/portada.jpg"].reason == TEMPLATE_MISMATCH


def test_a_template_with_an_unknown_type_is_rejected() -> None:
    with pytest.raises(TemplateError) as error:
        compile_template("{COLECCION} {XYZ}", TYPES, has_collection_hint=True)

    assert error.value.reason == "unknown_type"
    assert "{PUCP}" in error.value.message


@pytest.mark.parametrize(
    ("text", "reason"),
    [("{n}-{*}", "n_without_collection"), ("{*}", "no_identifier"), ("{n} {n}", "repeated_n")],
)
def test_other_invalid_templates(text: str, reason: str) -> None:
    with pytest.raises(TemplateError) as error:
        compile_template(text, TYPES, has_collection_hint=False)

    assert error.value.reason == reason


# --- 3.5 dos códigos en modo automático -----------------------------------------------------------


def test_two_codes_of_the_same_piece_in_automatic_mode() -> None:
    (proposal,) = match("I-3966 AB-407(2).jpg").values()

    assert proposal.status is Status.MATCHED and proposal.piece_id == pid("ab407")


@pytest.mark.parametrize(
    ("name", "expected"),
    [("ABC 001 - PUCP 1234 (2).JPG", "abc1"), ("ABC 2 - INC 6100.jpg", "abc2")],
)
def test_forms_f1_and_f2_are_read_alone(name: str, expected: str) -> None:
    (proposal,) = match(name).values()

    assert proposal.status is Status.MATCHED and proposal.piece_id == pid(expected)


def test_codes_that_agree_on_one_piece_are_not_discrepant() -> None:
    index = CatalogIndex(
        [
            piece("one", ABC, (TYPE_COLLECTION, "ABC 31"), (TYPE_PUCP, "4444")),
            piece("two", XYZ, (TYPE_PUCP, "4444")),  # the same PUCP code on another piece
        ]
    )
    photo = CatalogPhoto(uuid.uuid4(), "ABC 031 - PUCP 4444.jpg")

    (proposal,) = match_catalog_photos([photo], index, {}, valid_types=TYPES)

    assert proposal.status is Status.MATCHED and proposal.piece_id == pid_of("one")


def test_discrepant_codes_in_automatic_mode() -> None:
    (proposal,) = match("ABC 002 - PUCP 1299.JPG").values()

    assert proposal.status is Status.AMBIGUOUS
    assert proposal.reason == DISCREPANT_CODES
    assert set(proposal.candidate_piece_ids) == {pid("abc2"), pid("xyz_pucp1299")}


def test_discrepant_codes_are_ambiguous_even_with_a_collection_hint() -> None:
    proposal = match("Coleccion ABC/ABC 002 - PUCP 1299.JPG")[
        "Coleccion ABC/ABC 002 - PUCP 1299.JPG"
    ]

    assert proposal.reason == DISCREPANT_CODES


# --- 3.6 sugerencia de plantilla ------------------------------------------------------------------


def test_a_folder_of_camera_counters_suggests_the_template() -> None:
    names = [f"{n:03d}-{3000 + n}.jpg" for n in range(60)] + ["a.jpg", "b.jpg", "c.jpg", "d.jpg"]

    suggestion = suggest_template(names)

    assert suggestion is not None
    assert (suggestion.template, suggestion.matching, suggestion.total) == ("{n}-{*}", 60, 64)


def test_a_folder_of_numbers_suggests_the_correlative() -> None:
    suggestion = suggest_template(["1.JPG", "2.JPG", "12.JPG", "120.jpg"])

    assert suggestion is not None and suggestion.template == "{n}"


def test_a_mixed_folder_has_no_suggestion() -> None:
    assert suggest_template(["1.JPG", "053-3269.jpg", "portada.jpg", "IMG_0001.jpg"]) is None


# --- 3.7 reglas por carpeta -----------------------------------------------------------------------


def test_the_rule_of_a_folder_applies_to_its_subfolders_unless_they_have_one() -> None:
    folders = {
        "FOTOS": FolderRule(mode="camera"),
        "FOTOS/ABC": confirmed(ABC, mode="template", template="{n}-{*}"),
    }
    found = match("FOTOS/ALTAS/I-3966 AB-407.jpg", "FOTOS/ABC/sub/053-3269.jpg", folders=folders)

    assert found["FOTOS/ALTAS/I-3966 AB-407.jpg"].reason == CAMERA_NAME
    assert found["FOTOS/ABC/sub/053-3269.jpg"].piece_id == pid("abc53")


# --- 3.8 colección de la carpeta ------------------------------------------------------------------


def test_the_collection_is_proposed_by_the_collectors_name() -> None:
    assert propose_collection("Fotos Coleccion Juana Perez", COLLECTIONS) == JPZ


@pytest.mark.parametrize(
    ("folder", "expected"),
    [("Fotos ABC", ABC), ("ABC 001-100", ABC), ("ABC XYZ", None), ("Nueva carpeta", None)],
)
def test_the_collection_is_proposed_by_one_acronym_only(
    folder: str, expected: uuid.UUID | None
) -> None:
    assert propose_collection(folder, COLLECTIONS) == expected


def test_a_historical_acronym_proposes_its_collection() -> None:
    collections = (*COLLECTIONS[1:], CollectionRef(ABC, "Colección ABC sintética", ("ABC", "OLD")))

    assert propose_collection("Fotos OLD", collections) == ABC


def test_a_number_alone_in_the_collectors_folder_and_its_subfolders() -> None:
    found = match("Fotos Coleccion Juana Perez/12.JPG", "Fotos Coleccion Juana Perez/altas/12.JPG")

    assert {p.piece_id for p in found.values()} == {pid("jpz12")}


def test_a_person_can_remove_the_proposed_collection() -> None:
    folders = {"Fotos Coleccion Juana Perez": confirmed(None)}
    (proposal,) = match("Fotos Coleccion Juana Perez/12.JPG", folders=folders).values()

    assert proposal.reason == BARE_NUMBER


def test_pending_and_confirmed_collections() -> None:
    infos = analyze_folders(["Fotos ABC/1.jpg"], COLLECTIONS, PhotoReading())
    assert infos["Fotos ABC"].collection_pending and infos["Fotos ABC"].collection_id == ABC

    reading = PhotoReading(folders={"Fotos ABC": confirmed(ABC)})
    infos = analyze_folders(["Fotos ABC/1.jpg"], COLLECTIONS, reading)
    assert not infos["Fotos ABC"].collection_pending


# --- 3.9 carpetas de rango ------------------------------------------------------------------------


def test_range_folder_with_acronym() -> None:
    found = match("ABC 001 - 100/ABC 7 - PUCP 1240.jpg", "ABC 001 - 100/IMG_0001.jpg")

    assert found["ABC 001 - 100/ABC 7 - PUCP 1240.jpg"].piece_id == pid("abc7")
    assert found["ABC 001 - 100/ABC 7 - PUCP 1240.jpg"].reason is None
    camera = found["ABC 001 - 100/IMG_0001.jpg"]
    assert camera.piece_id is None and camera.status is Status.UNMATCHED  # never ABC 1


def test_correlative_out_of_the_range_of_the_folder() -> None:
    (proposal,) = match("ABC 001-100/ABC 150.jpg").values()

    assert proposal.piece_id == pid("abc150")
    assert proposal.reason == OUT_OF_RANGE


def test_a_name_that_looks_like_a_range_but_is_not() -> None:
    assert folder_range("ABC 100-12") is None
    assert folder_range("ABC 001 - 100") is not None
    assert folder_range("FOTOS 051-114").start == 51  # type: ignore[union-attr]
    infos = analyze_folders(["ABC 100-12/x.jpg"], COLLECTIONS, PhotoReading())
    assert infos["ABC 100-12"].range is None


def test_a_generic_folder_never_proposes_by_its_number() -> None:
    (proposal,) = match("Fotos ABC/CARPETA 1/IMG_0002.jpg").values()

    assert proposal.piece_id is None
