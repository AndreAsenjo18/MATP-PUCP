"""Spec identificacion-piezas — Parámetros de normalización administrables, en la importación
(RN-010, RF-023, RF-022).

Change plantillas-mapeo-y-normalizacion, task 2.2 step B (design D5): the transformations,
``RowIdentifier.from_raw`` and ``apply_mapping`` use the current parameters of the batch, read
once per session by ``MappingContext``. Synthetic data only (RNF-014); ``NO REGISTRA`` and
``REP`` are illustrative [SUPUESTO A5, A3].
"""

from sqlalchemy import event
from sqlalchemy.orm import Session

from app.core.models_base import new_uuid
from app.modules.catalog.enums import TenureRegime
from app.modules.collections.models import Collection
from app.modules.identification.models import (
    ABSENCE_MARKERS_KEY,
    CONCATENATION_SEPARATORS_KEY,
    CollectionAcronymAlias,
    NormalizationSetting,
)
from app.modules.identification.normalization import (
    ABSENCE_MARKERS,
    DEFAULT_SEPARATORS,
    NormalizationParams,
)
from app.modules.identification.params import SESSION_KEY
from app.modules.imports.mapping import (
    MappingContext,
    apply_mapping,
    read_mapping,
    validate_mapping,
)
from app.modules.imports.matching import RowIdentifier
from app.modules.imports.transforms import parse_transforms, run_transforms
from app.seed.reference import ReferenceData
from tests.conftest import ActAs

NO_REGISTRA = NormalizationParams(absence_markers=ABSENCE_MARKERS | {"NOREGISTRA"})
WITHOUT_COMMA = NormalizationParams(separators=tuple(s for s in DEFAULT_SEPARATORS if s != ","))
REP_LRM = NormalizationParams(acronym_aliases={"REP": "LRM"})

SPEC = read_mapping(
    {
        "version": 1,
        "columns": [
            {"source": "DENOMINACIÓN", "target": {"kind": "field", "name": "denomination"}},
            {
                "source": "CÓDIGOS",
                "target": {"kind": "identifiers", "default_type": None},
                "transforms": ["trim", "absence_markers", "split_concatenated"],
            },
            {"source": "N° INV", "target": {"kind": "identifier", "type": "I"}},
        ],
    }
)


def _run(raw: str, *names: str, params: NormalizationParams | None = None):  # type: ignore[no-untyped-def]
    return run_transforms(raw, parse_transforms(list(names)), params=params)


# --- transformaciones -----------------------------------------------------------------------


def test_absence_markers_uses_the_given_markers() -> None:
    assert not _run("No registra", "absence_markers").is_absent
    result = _run("No registra", "absence_markers", params=NO_REGISTRA)
    assert result.is_absent and result.value is None


def test_split_concatenated_uses_the_given_separators() -> None:
    assert _run("I-1, I-2", "split_concatenated").value == ["I-1", "I-2"]
    assert _run("I-1, I-2", "split_concatenated", params=WITHOUT_COMMA).value == ["I-1, I-2"]
    assert _run("I-1 / NO REGISTRA", "split_concatenated", params=NO_REGISTRA).value == ["I-1"]


def test_row_identifier_uses_the_given_aliases_and_markers() -> None:
    assert RowIdentifier.from_raw("COLECCION", "REP 12").normalized_value == "REP 12"
    assert (
        RowIdentifier.from_raw("COLECCION", "REP 12", params=REP_LRM).normalized_value == "LRM 12"
    )
    assert not RowIdentifier.from_raw("I", "NO REGISTRA").is_absent
    assert RowIdentifier.from_raw("I", "NO REGISTRA", params=NO_REGISTRA).is_absent


# --- apply_mapping con los parámetros vigentes del lote -------------------------------------


def _store_params(session: Session, act_as: ActAs) -> None:
    with act_as("ADMIN"):
        lrm = Collection(
            id=new_uuid(),
            name="Colección sintética",
            acronym="LRM",
            acronym_normalized="LRM",
            default_tenure_regime=TenureRegime.OWNED,
        )
        session.add(lrm)
        session.add_all(
            [
                NormalizationSetting(
                    id=new_uuid(), key=ABSENCE_MARKERS_KEY, value=[*ABSENCE_MARKERS, "NO REGISTRA"]
                ),
                NormalizationSetting(
                    id=new_uuid(),
                    key=CONCATENATION_SEPARATORS_KEY,
                    value={"separators": ["/", ";"], "unsplit_markers": ["S/N", "S/C"]},
                ),
                CollectionAcronymAlias(
                    id=new_uuid(), alias="REP", alias_normalized="REP", collection_id=lrm.id
                ),
            ]
        )
        session.flush()


def test_apply_mapping_uses_the_current_parameters(session: Session, act_as: ActAs) -> None:
    _store_params(session, act_as)
    ctx = MappingContext(session)

    absent = apply_mapping({"DENOMINACIÓN": "Soga", "N° INV": "NO REGISTRA"}, SPEC, ctx)
    [identifier] = absent.identifiers
    assert identifier.type_code == "I" and identifier.is_absent

    codes = apply_mapping({"DENOMINACIÓN": "Soga", "CÓDIGOS": "REP 12, I-3 ; I-4"}, SPEC, ctx)
    # The comma is no longer a separator; "REP 12" alone becomes the code of LRM.
    assert [i.original_value for i in codes.identifiers] == ["REP 12, I-3", "I-4"]
    alias = apply_mapping({"DENOMINACIÓN": "Soga", "CÓDIGOS": "REP 12 / I-5"}, SPEC, ctx)
    assert [(i.type_code, i.normalized_value) for i in alias.identifiers] == [
        ("COLECCION", "LRM 12"),
        ("I", "I-5"),
    ]
    marked = apply_mapping({"DENOMINACIÓN": "Soga", "CÓDIGOS": "NO REGISTRA"}, SPEC, ctx)
    assert marked.transformed["CÓDIGOS"].is_absent


def test_without_rows_apply_mapping_behaves_as_before(session: Session) -> None:
    ctx = MappingContext(session)
    row = apply_mapping({"DENOMINACIÓN": "Soga", "CÓDIGOS": "REP 12, I-3"}, SPEC, ctx)
    assert [i.normalized_value for i in row.identifiers] == ["REP 12", "I-3"]
    [identifier] = apply_mapping(
        {"DENOMINACIÓN": "Soga", "N° INV": "NO REGISTRA"}, SPEC, ctx
    ).identifiers
    assert not identifier.is_absent


def test_the_parameters_are_read_once_per_batch_not_per_row(
    session: Session, act_as: ActAs
) -> None:
    _store_params(session, act_as)
    session.info.pop(SESSION_KEY, None)
    statements: list[str] = []
    engine = session.get_bind()
    listener = lambda *args: statements.append(args[2])  # noqa: E731
    event.listen(engine, "before_cursor_execute", listener)
    try:
        ctx = MappingContext(session)
        for n in range(200):
            apply_mapping({"DENOMINACIÓN": f"Pieza {n}", "CÓDIGOS": f"I-{n} / REP {n}"}, SPEC, ctx)
    finally:
        event.remove(engine, "before_cursor_execute", listener)
    reads = [
        s for s in statements if "normalization_setting" in s or "collection_acronym_alias" in s
    ]
    assert len(reads) == 2


def test_validating_a_mapping_does_not_read_the_parameters(
    session: Session, reference: ReferenceData
) -> None:
    session.info.pop(SESSION_KEY, None)
    errors = validate_mapping(SPEC, ["DENOMINACIÓN", "CÓDIGOS", "N° INV"], MappingContext(session))
    assert errors == []
    assert SESSION_KEY not in session.info
