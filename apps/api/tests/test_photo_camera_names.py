"""Spec importacion-datos — Protección contra falsos positivos con el catálogo (RF-046).

Change importacion-fotos-a-catalogo, task 3.1 (design D3): the counter ``NNN-NNNN`` and the
camera name ``NNLLNNNN`` give no code, and the administrator may add patterns in
``photo_camera_patterns``, validated when saved. Also the type prefix (``PUCP 1234``) that gives
the value the catalogue stores. Synthetic names only (RNF-014).
"""

import pytest

from app.core.errors import ValidationFailed
from app.modules.identification.normalization import TYPE_INC_RN, TYPE_PUCP
from app.modules.identification.params import params_from_rows
from app.modules.identification.params_admin import MAX_CAMERA_PATTERN_LENGTH, clean_value
from app.modules.imports.photo_matching import (
    CandidateStrength,
    compile_camera_patterns,
    read_name,
)

KEY = "photo_camera_patterns"


@pytest.mark.parametrize("name", ["175-3554.jpg", "82LF4169 copy.jpg", "82lf4169.JPG"])
def test_camera_names_give_no_code(name: str) -> None:
    reading = read_name(name)

    assert reading.camera_name
    assert reading.candidates == ()


@pytest.mark.parametrize("name", ["059-3225 x.jpg", "ABC 175-3554.jpg", "1750-3554.jpg"])
def test_names_that_only_resemble_a_camera_name_are_read(name: str) -> None:
    assert not read_name(name).camera_name


def test_a_folder_is_never_a_camera_name_by_the_new_patterns() -> None:
    assert not read_name("175-3554", is_file=False).camera_name


def test_a_pattern_added_by_the_administrator() -> None:
    patterns = compile_camera_patterns(clean_value(KEY, [r"FOTO\d{5}"]))

    assert read_name("FOTO00123.jpg", camera_patterns=patterns).camera_name
    assert not read_name("FOTO00123.jpg").camera_name  # only with the pattern
    assert not read_name("MI FOTO00123.jpg", camera_patterns=patterns).camera_name


@pytest.mark.parametrize("value", [[r"FOTO(\d{5}"], ["x" * (MAX_CAMERA_PATTERN_LENGTH + 1)], "IMG"])
def test_an_invalid_pattern_is_rejected_with_a_clear_message(value: object) -> None:
    with pytest.raises(ValidationFailed) as error:
        clean_value(KEY, value)

    assert error.value.code == "invalid_setting_value"


def test_patterns_are_stored_once_and_read_back() -> None:
    assert clean_value(KEY, [r"FOTO\d{5}", r" FOTO\d{5} ", ""]) == [r"FOTO\d{5}"]
    assert params_from_rows({KEY: [r"FOTO\d{5}"]}).photo_camera_patterns == (r"FOTO\d{5}",)
    # An unreadable stored value keeps the built-in patterns only.
    assert params_from_rows({KEY: ["FOTO(\\d"]}).photo_camera_patterns == ()


@pytest.mark.parametrize(
    ("name", "key"),
    [
        ("ABC 001 - PUCP 1234 (2).JPG", (TYPE_PUCP, "1234")),
        ("ABC 1 - INC 6100.jpg", (TYPE_INC_RN, "6100")),
    ],
)
def test_a_type_prefix_gives_the_value_the_catalogue_stores(
    name: str, key: tuple[str, str]
) -> None:
    fragments = {
        key
        for candidate in read_name(name).candidates
        if candidate.strength is CandidateStrength.FRAGMENT
        for key in candidate.keys
    }

    assert key in fragments
