"""Spec identificacion-piezas — Parámetros de normalización administrables (RN-010, RF-023).

Change plantillas-mapeo-y-normalizacion, task 2.2 step A (design D5): ``NormalizationParams``
with the constants as defaults, the optional keyword-only ``params`` of the public functions,
the N7 regex built from the separators, and ``load_params``/``session_params`` reading the
active rows once per session. Synthetic data only (RNF-014); ``NO REGISTRA`` and ``REP`` are
illustrative [SUPUESTO A5, A3].
"""

import logging
import re

import pytest
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.core.models_base import new_uuid, utcnow
from app.modules.audit.soft_delete import soft_delete
from app.modules.catalog.enums import TenureRegime
from app.modules.collections.models import Collection
from app.modules.identification.models import (
    ABSENCE_MARKERS_KEY,
    CONCATENATION_SEPARATORS_KEY,
    CollectionAcronymAlias,
    NormalizationRule,
    NormalizationSetting,
)
from app.modules.identification.normalization import (
    _SPLIT_RE,
    ABSENCE_MARKERS,
    DEFAULT_PARAMS,
    DEFAULT_RULES,
    DEFAULT_SEPARATORS,
    DEFAULT_UNSPLIT_MARKERS,
    NormalizationParams,
    detect_type,
    is_absence_marker,
    normalize,
    normalize_acronym,
    normalize_collection_code,
    normalize_for_type,
    normalize_inventory_code,
    propose_identifiers,
    split_compound,
    split_regex,
)
from app.modules.identification.params import (
    SESSION_KEY,
    load_params,
    params_from_rows,
    session_params,
)
from tests.conftest import ActAs

# The expression of N7 before the separators became data (kept literally on purpose).
PREVIOUS_SPLIT_PATTERN = r"\s*(?:(?<![Ss]\s)(?<![Ss])/(?!\s?[NnCc]\b)|;|\||,|\n|\r)\s*"

SAMPLES = [
    "I-0236",
    "I 236",
    "i-0999",
    "0236",
    "S/N",
    "s/c",
    "s / n",
    "-",
    "0",
    "Sin código",
    "???",
    "M.M.Z. 015",
    "mmz 15",
    "MBB 40.1",
    "AJB 12",
    "INC 1234",
    "RN 004521",
    "I-0236 / M.M.Z. 015",
    "I 2362 / RA 28",
    "INC 1234 ; RN 004521",
    "I-1, I-2 | I-3\nI-4\rI-5",
    "I-1 / S/N",
    "I-1 / s/c / RA 3",
    "",
    "   ",
]


def with_markers(*extra: str) -> NormalizationParams:
    markers = ABSENCE_MARKERS | {NormalizationParams.marker_key(m) for m in extra}
    return NormalizationParams(absence_markers=frozenset(markers))


# --- valores por defecto = comportamiento anterior ----------------------------------------------


def test_the_default_regex_is_the_previous_expression() -> None:
    assert _SPLIT_RE.pattern == PREVIOUS_SPLIT_PATTERN
    assert DEFAULT_PARAMS.split_re.pattern == PREVIOUS_SPLIT_PATTERN
    assert split_regex(DEFAULT_SEPARATORS, DEFAULT_UNSPLIT_MARKERS) is _SPLIT_RE


def test_the_default_markers_are_the_public_constant() -> None:
    assert DEFAULT_PARAMS.absence_markers is ABSENCE_MARKERS
    assert DEFAULT_PARAMS.acronym_aliases == {}


@pytest.mark.parametrize("raw", SAMPLES)
def test_default_params_give_the_same_result_as_no_params(raw: str) -> None:
    assert is_absence_marker(raw, params=DEFAULT_PARAMS) == is_absence_marker(raw)
    assert split_compound(raw, params=DEFAULT_PARAMS) == split_compound(raw)
    assert propose_identifiers(raw, params=DEFAULT_PARAMS) == propose_identifiers(raw)
    assert propose_identifiers(raw, "I", params=DEFAULT_PARAMS) == propose_identifiers(raw, "I")
    assert detect_type(raw, params=DEFAULT_PARAMS) == detect_type(raw)
    assert normalize_acronym(raw, params=DEFAULT_PARAMS) == normalize_acronym(raw)
    for type_code in DEFAULT_RULES:
        assert normalize_for_type(type_code, raw, params=DEFAULT_PARAMS) == normalize_for_type(
            type_code, raw
        )
    for rule in NormalizationRule:
        assert normalize(rule, raw, params=DEFAULT_PARAMS) == normalize(rule, raw)


# --- parámetros distintos ----------------------------------------------------------------------


def test_a_new_absence_marker_is_compared_without_spaces_or_case() -> None:
    params = with_markers("NO REGISTRA")
    assert not is_absence_marker("No registra")
    assert is_absence_marker("No registra", params=params)
    assert is_absence_marker("NO  REGISTRA", params=params)
    assert normalize_inventory_code("NO REGISTRA", params=params).is_absent
    assert not normalize_inventory_code("NO REGISTRA").is_absent
    assert split_compound("I-1 / NO REGISTRA", params=params) == ["I-1"]


def test_removing_a_separator_stops_splitting_on_it() -> None:
    without_comma = NormalizationParams(separators=("/", ";", "|", "\n", "\r"))
    assert split_compound("I-1, I-2") == ["I-1", "I-2"]
    assert split_compound("I-1, I-2", params=without_comma) == ["I-1, I-2"]
    assert split_compound("I-1; I-2", params=without_comma) == ["I-1", "I-2"]


def test_a_new_separator_splits_and_no_separators_never_split() -> None:
    plus = NormalizationParams(separators=(*DEFAULT_SEPARATORS, "+"))
    assert split_compound("I-1 + I-2", params=plus) == ["I-1", "I-2"]
    assert split_compound("I-1 + I-2") == ["I-1 + I-2"]
    assert split_compound("I-1, I-2", params=NormalizationParams(separators=())) == ["I-1, I-2"]


def test_a_new_unsplit_marker_keeps_its_separator() -> None:
    params = NormalizationParams(unsplit_markers=(*DEFAULT_UNSPLIT_MARKERS, "N/A"))
    assert split_compound("I-1; N/A") == ["I-1", "N", "A"]
    assert split_compound("I-1; N/A", params=params) == ["I-1"]
    assert split_compound("I-1 / S/N", params=params) == ["I-1"]


def test_multi_letter_sides_of_a_marker_ignore_case() -> None:
    pattern = split_regex(("/",), ("SIN/COD",))
    assert pattern.split("sin/cod") == ["sin/cod"]
    assert pattern.split("SIN / COD") == ["SIN / COD"]
    assert pattern.split("I-1/I-2") == ["I-1", "I-2"]
    assert re.compile(pattern.pattern)  # compiles as a plain expression


def test_an_alias_becomes_the_acronym_of_its_collection() -> None:
    params = NormalizationParams(acronym_aliases={"REP": "LRM"})
    assert normalize_collection_code("R.E.P. 012", params=params).normalized == "LRM 12"
    assert normalize_for_type("COLECCION", "rep 12", params=params).normalized == "LRM 12"
    assert normalize_collection_code("REP 12").normalized == "REP 12"
    assert normalize_acronym("r.e.p.", params=params) == "LRM"
    assert normalize_acronym("r.e.p.") == "REP"
    [proposal] = propose_identifiers("REP 12", params=params)
    assert proposal.type_code == "COLECCION" and proposal.result.normalized == "LRM 12"


# --- filas -> parámetros (respaldo con las constantes) ------------------------------------------


def test_without_rows_the_defaults_apply() -> None:
    assert params_from_rows({}) == DEFAULT_PARAMS


def test_each_key_replaces_only_its_values() -> None:
    params = params_from_rows({ABSENCE_MARKERS_KEY: ["S/N", "No registra"]})
    assert params.absence_markers == {"S/N", "NOREGISTRA"}
    assert params.separators == DEFAULT_SEPARATORS
    separators = params_from_rows(
        {CONCATENATION_SEPARATORS_KEY: {"separators": [";"], "unsplit_markers": []}}
    )
    assert separators.separators == (";",) and separators.unsplit_markers == ()
    assert separators.absence_markers is ABSENCE_MARKERS


@pytest.mark.parametrize(
    ("key", "value"),
    [
        (ABSENCE_MARKERS_KEY, "S/N"),
        (ABSENCE_MARKERS_KEY, ["S/N", 3]),
        (CONCATENATION_SEPARATORS_KEY, [";"]),
        (CONCATENATION_SEPARATORS_KEY, {"unsplit_markers": []}),
        (CONCATENATION_SEPARATORS_KEY, {"separators": [";", ""]}),
    ],
)
def test_an_unreadable_value_keeps_the_default_and_warns(
    key: str, value: object, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.WARNING, logger="matp.normalization"):
        params = params_from_rows({key: value})
    assert params == DEFAULT_PARAMS
    assert f"Valor ilegible de {key}" in caplog.text


def test_aliases_map_to_the_acronym_and_to_the_collection() -> None:
    lrm, plain = new_uuid(), new_uuid()
    params = params_from_rows({}, [("REP", lrm, "LRM"), ("XYZ", plain, None)])
    assert params.acronym_aliases == {"REP": "LRM"}
    assert params.alias_collection_ids == {"REP": lrm, "XYZ": plain}


# --- base de datos: dos consultas por sesión ---------------------------------------------------


def _count_queries(session: Session) -> list[str]:
    statements: list[str] = []
    event.listen(session.get_bind(), "before_cursor_execute", lambda *a: statements.append(a[2]))
    return statements


def _collection(session: Session, acronym: str | None = "LRM") -> Collection:
    collection = Collection(
        id=new_uuid(),
        name="Colección sintética",
        acronym=acronym,
        acronym_normalized=acronym,
        default_tenure_regime=TenureRegime.OWNED,
    )
    session.add(collection)
    return collection


def test_a_database_without_rows_gives_the_defaults(session: Session) -> None:
    assert load_params(session) == DEFAULT_PARAMS


def test_load_params_reads_active_rows_in_two_queries(session: Session, act_as: ActAs) -> None:
    with act_as("ADMIN"):
        lrm = _collection(session)
        gone = _collection(session, "OLD")
        session.add_all(
            [
                NormalizationSetting(id=new_uuid(), key=ABSENCE_MARKERS_KEY, value=["NO REGISTRA"]),
                CollectionAcronymAlias(
                    id=new_uuid(), alias="R.E.P.", alias_normalized="REP", collection_id=lrm.id
                ),
                CollectionAcronymAlias(
                    id=new_uuid(), alias="ANT", alias_normalized="ANT", collection_id=gone.id
                ),
            ]
        )
        old = CollectionAcronymAlias(
            id=new_uuid(), alias="VIEJA", alias_normalized="VIEJA", collection_id=lrm.id
        )
        session.add(old)
        session.flush()
        soft_delete(session, old, "Alias de prueba (sintético)")
        gone.deleted_at = utcnow()
        session.flush()

    statements = _count_queries(session)
    params = load_params(session)

    assert len(statements) == 2
    assert params.absence_markers == {"NOREGISTRA"}
    assert params.separators == DEFAULT_SEPARATORS
    assert params.acronym_aliases == {"REP": "LRM"}  # neither the deleted alias nor collection
    assert params.alias_collection_ids == {"REP": lrm.id}


def test_session_params_reads_once_and_reloads_after_a_parameter_changes(
    session: Session, act_as: ActAs
) -> None:
    first = session_params(session)
    statements = _count_queries(session)
    assert session_params(session) is first
    assert statements == []

    with act_as("ADMIN"):
        setting = NormalizationSetting(id=new_uuid(), key=ABSENCE_MARKERS_KEY, value=["S/N"])
        session.add(setting)
        session.flush()
    assert SESSION_KEY not in session.info
    assert session_params(session).absence_markers == {"S/N"}

    with act_as("ADMIN"):
        setting.value = ["S/N", "No registra"]
        session.flush()
    assert session_params(session).absence_markers == {"S/N", "NOREGISTRA"}


def test_other_writes_keep_the_cached_params(session: Session, act_as: ActAs) -> None:
    from app.modules.identification.models import IdentifierType

    params = session_params(session)
    with act_as("ADMIN"):
        identifier_type = session.query(IdentifierType).first()
        assert identifier_type is not None
        identifier_type.label = f"{identifier_type.label} (sintético)"
        session.flush()
    assert session.info[SESSION_KEY] is params
