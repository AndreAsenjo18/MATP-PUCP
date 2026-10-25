"""Spec colecciones-vocabularios — Precarga idempotente de vocabularios desde archivo (RF-011).

Change colecciones-y-vocabularios-admin, task 4.1 (design D4): report mode by default, repeated
runs change nothing, absent terms stay active and wrong columns are rejected. Runs on the
module-scoped seeded database of ``pipeline``; every test uses its own term codes.
"""

import uuid
from pathlib import Path

import pytest
from sqlalchemy import select

from app.models import AuditLog, Term, Vocabulary
from app.modules.audit.models import AuditOrigin
from app.seed.vocabularies import VocabularyFileError, load_terms, parse_terms
from app.seed.vocabularies.__main__ import main
from tests.api.conftest import Pipeline

HEADER = "vocabulary_code,term_code,label,description,sort_order,external_uri,is_active\n"
FIXTURE = Path(__file__).resolve().parents[4] / "data" / "fixtures" / "vocabularios_sinteticos.csv"


def _code() -> str:
    return f"PRUEBA_{uuid.uuid4().hex[:6].upper()}"


def _term(pipeline: Pipeline, code: str) -> Term | None:
    with pipeline.session() as session:
        return session.scalar(select(Term).where(Term.code == code))


def test_report_mode_writes_nothing(pipeline: Pipeline) -> None:
    code = _code()
    rows = parse_terms(HEADER + f"CATEGORY,{code},Categoría {code},,40,,true\n")
    with pipeline.session() as session:
        report = load_terms(session, rows, apply=False, source="prueba.csv:abc")
        session.rollback()

    assert report.created == [f"CATEGORY/{code} «Categoría {code}»"] and not report.applied
    assert _term(pipeline, code) is None


def test_applying_twice_changes_nothing_the_second_time(pipeline: Pipeline) -> None:
    code = _code()
    rows = parse_terms(HEADER + f"CATEGORY,{code},Categoría {code},Sintética,41,,true\n")
    with pipeline.session() as session:
        first = load_terms(session, rows, apply=True, source="prueba.csv:abc")
        session.commit()
    with pipeline.session() as session:
        second = load_terms(session, rows, apply=True, source="prueba.csv:abc")
        session.commit()

    assert len(first.created) == 1
    assert second.created == [] and second.updated == [] and second.unchanged == 1
    term = _term(pipeline, code)
    assert term is not None and term.description == "Sintética" and term.sort_order == 41
    with pipeline.session() as session:
        entries = session.scalars(select(AuditLog).where(AuditLog.entity_id == term.id)).all()
    assert entries and {(e.origin, e.origin_ref) for e in entries} == {
        (AuditOrigin.SYSTEM, "prueba.csv:abc")
    }


def test_existing_terms_are_updated_and_absent_ones_stay_active(pipeline: Pipeline) -> None:
    code = _code()
    with pipeline.session() as session:
        load_terms(
            session,
            parse_terms(HEADER + f"TECHNIQUE,{code},Técnica {code},,50,,true\n"),
            apply=True,
            source="a.csv:1",
        )
        session.commit()

    with pipeline.session() as session:
        report = load_terms(
            session,
            parse_terms(HEADER + f"TECHNIQUE,{code},Técnica {code} revisada,,,,\n"),
            apply=True,
            source="b.csv:2",
        )
        session.commit()

    assert report.updated == [f"TECHNIQUE/{code} «Técnica {code} revisada»: label"]
    assert "TECHNIQUE/TALLADO «Tallado»" in report.absent
    tallado = _term(pipeline, "TALLADO")
    assert tallado is not None and tallado.is_active and tallado.deleted_at is None
    term = _term(pipeline, code)
    assert term is not None and term.sort_order == 50  # an empty cell never erases


def test_a_file_without_the_term_code_column_is_rejected() -> None:
    with pytest.raises(VocabularyFileError) as raised:
        parse_terms("vocabulary_code,label\nCATEGORY,Algo\n")

    assert "term_code" in str(raised.value) and "Columnas esperadas" in str(raised.value)


def test_an_unknown_vocabulary_is_rejected(pipeline: Pipeline) -> None:
    rows = parse_terms(HEADER + "NO_EXISTE,X,Algo,,,,\n")
    with pipeline.session() as session, pytest.raises(VocabularyFileError) as raised:
        load_terms(session, rows, apply=True, source="c.csv:3")

    assert "NO_EXISTE" in str(raised.value)


def test_the_synthetic_fixture_parses_and_the_cli_reports_without_writing(
    pipeline: Pipeline, capsys: pytest.CaptureFixture[str]
) -> None:
    rows = parse_terms(FIXTURE.read_text(encoding="utf-8"))
    assert {row.vocabulary_code for row in rows} == {"CATEGORY", "TECHNIQUE"}
    with pipeline.session() as session:
        before = session.scalar(select(Vocabulary.id).where(Vocabulary.code == "CATEGORY"))
    assert before is not None

    assert main([str(Path("no-existe.csv"))]) == 2
    assert "No se cargó nada" in capsys.readouterr().err
