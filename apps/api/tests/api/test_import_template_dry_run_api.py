"""Spec importacion-datos — Vista previa de normalización por columna (RF-023, RF-022, RF-011,
RNF-010; design D4).

Change plantillas-mapeo-y-normalizacion, task 3.3: ``POST /import-templates/{id}/dry-run``
maps a sample of an uploaded or mapped batch with a saved template and counts, per column,
``NORMALIZED``, ``UNPARSEABLE``, ``ABSENT`` and ``SPLIT_PROPOSED`` cells, the values without a
term and some examples with their trace. It writes nothing. Synthetic data only (RNF-014);
headers are illustrative [SUPUESTO A1].

Own module: the ``pipeline`` fixture gives it its own seeded database.
"""

import io
import uuid
from typing import Any

from fastapi.testclient import TestClient
from openpyxl import Workbook
from sqlalchemy import func, select

from app.modules.audit.models import AuditLog
from app.modules.collections.models import Term
from app.modules.imports.models import ImportBatch, ImportRow
from app.seed.fixtures import HEADERS
from tests.api.conftest import Pipeline
from tests.api.test_import_pipeline_api import (
    SABANA,
    SABANA_MAPPING,
    get_batch,
    put_mapping,
    upload,
)

TEMPLATES = "/api/v1/import-templates"
SEED_TEMPLATE = "Plantilla sábana sintética v1"
STATUSES = ("NORMALIZED", "UNPARSEABLE", "ABSENT", "SPLIT_PROPOSED")


def _sheet(headers: list[str], rows: list[list[Any]]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    assert sheet is not None
    sheet.append(headers)
    for row in rows:
        sheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def _seed_template_id(client: TestClient) -> str:
    [template] = [t for t in client.get(TEMPLATES).json() if t["name"] == SEED_TEMPLATE]
    return template["id"]


def _dry_run(client: TestClient, template_id: str, batch_id: str) -> Any:
    return client.post(f"{TEMPLATES}/{template_id}/dry-run", json={"batch_id": batch_id})


def _columns(body: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {column["mapping"]["source_column"]: column for column in body["columns"]}


def _sabana_row(material: str) -> list[Any]:
    return [1, "", "LRM", "Soga", "", material, "", "", "", "", ""]


def test_counts_by_status_with_the_synthetic_sabana_and_the_seed_template(
    pipeline: Pipeline,
) -> None:
    client = pipeline.client
    batch_id = upload(client, "sabana.xlsx", SABANA)["batch_id"]

    response = _dry_run(client, _seed_template_id(client), batch_id)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["batch_id"] == batch_id
    assert body["total_rows"] == body["sampled_rows"] == 40
    assert body["missing_columns"] == []
    columns = _columns(body)
    assert list(columns) == HEADERS
    for column in columns.values():
        assert set(column["counts"]) == set(STATUSES)
        assert sum(column["counts"].values()) + column["empty"] == 40

    codes = columns["CÓDIGOS"]
    assert codes["mapping"]["target_field"] == "identifier"
    # «I-0236 / M.M.Z. 015» and the like are split; «S/N» and «s/c» cells are absent.
    assert codes["counts"]["SPLIT_PROPOSED"] == 4
    assert codes["counts"]["ABSENT"] == 10
    assert codes["counts"]["NORMALIZED"] == 20
    split = next(e for e in codes["examples"] if e["original"] == "I-0236 / M.M.Z. 015")
    assert split["status"] == "SPLIT_PROPOSED"
    assert [(i["type_code"], i["normalized_value"]) for i in split["identifiers"]] == [
        ("I", "I-236"),
        ("COLECCION", "MMZ 15"),
    ]
    assert [step["transform"] for step in split["trace"]] == [
        "trim",
        "absence_markers",
        "split_concatenated",
    ]
    assert split["trace"][-1]["after"] == ["I-0236", "M.M.Z. 015"]
    absent = next(e for e in codes["examples"] if e["status"] == "ABSENT")
    assert absent["original"] == "S/N" and absent["identifiers"][0]["is_absent"] is True

    epoch = columns["ÉPOCA"]
    # «fines del s. XIX» and «desconocida» are not recognized by ``propose_period``.
    assert epoch["counts"]["UNPARSEABLE"] == 2
    century = next(e for e in epoch["examples"] if e["original"] == "s. XX")
    assert century["proposals"] == {
        "epoch_type": "CENTURY",
        "epoch_start_year": 1901,
        "epoch_end_year": 2000,
    }
    assert century["value"] == "s. XX"  # the proposal never replaces the text
    unrecognized = next(e for e in epoch["examples"] if e["status"] == "UNPARSEABLE")
    assert unrecognized["trace"][-1]["note"] == "not_recognized"

    material = columns["MATERIAL"]
    assert material["mapping"]["target_field"] == "terms:MATERIAL"
    assert material["counts"]["SPLIT_PROPOSED"] == 1  # «madera, pasta de papa»
    assert material["counts"]["UNPARSEABLE"] == 1
    assert material["unmatched_values"] == [{"value": "madera policromada", "count": 1}]
    matched = next(e for e in material["examples"] if e["original"] == "arcilla")
    assert matched["status"] == "NORMALIZED" and matched["matched_terms"] == {"arcilla": "ARCILLA"}

    measures = columns["MEDIDAS"]
    assert measures["counts"]["UNPARSEABLE"] == 3  # «23 x 15» has no unit, among others
    assert measures["counts"]["NORMALIZED"] == 3
    assert columns["FOTO"]["empty"] == 40


def test_code_i_column_with_problems_shows_each_status(pipeline: Pipeline) -> None:
    """Scenario «Columna de códigos con problemas» of the spec."""
    client = pipeline.client
    headers = ["DENOMINACIÓN", "N° INV"]
    created = client.post(
        TEMPLATES,
        json={
            "name": "Vista previa códigos I (sintética)",
            "source_name": "Prueba",
            "headers": headers,
            "columns": [
                {"source_column": "DENOMINACIÓN", "target_field": "denomination"},
                {
                    "source_column": "N° INV",
                    "target_field": "identifier:I",
                    "transforms": ["trim", "absence_markers", "split_concatenated"],
                },
            ],
        },
    )
    assert created.status_code == 201, created.text
    rows = [["Toro", "I-0236"], ["Manta", "S/N"], ["Quena", "???"], ["Mate", "I 12 / RA 3"]]
    batch_id = upload(client, "codigos.xlsx", _sheet(headers, rows))["batch_id"]

    response = _dry_run(client, created.json()["id"], batch_id)

    assert response.status_code == 200, response.text
    codes = _columns(response.json())["N° INV"]
    assert codes["counts"] == {
        "NORMALIZED": 1,
        "UNPARSEABLE": 1,
        "ABSENT": 1,
        "SPLIT_PROPOSED": 1,
    }
    by_value = {example["original"]: example for example in codes["examples"]}
    assert by_value["I-0236"]["status"] == "NORMALIZED"
    assert by_value["I-0236"]["identifiers"][0]["normalized_value"] == "I-236"
    assert by_value["S/N"]["status"] == "ABSENT"
    assert by_value["???"]["status"] == "UNPARSEABLE"
    assert by_value["I 12 / RA 3"]["status"] == "SPLIT_PROPOSED"
    assert by_value["I 12 / RA 3"]["value"] == ["I 12", "RA 3"]


def test_values_without_a_term_are_listed_with_their_frequency(pipeline: Pipeline) -> None:
    """Scenario «Valor sin correspondencia»: «maguey» is not in the seeded vocabulary."""
    client = pipeline.client
    rows = [
        _sabana_row("maguey"),
        _sabana_row("madera, maguey"),
        _sabana_row("maguey"),
        _sabana_row("totora"),
        _sabana_row("arcilla"),
    ]
    batch_id = upload(client, "materiales.xlsx", _sheet(HEADERS, rows))["batch_id"]
    with pipeline.session() as session:
        terms_before = session.scalar(select(func.count()).select_from(Term))

    response = _dry_run(client, _seed_template_id(client), batch_id)

    assert response.status_code == 200, response.text
    material = _columns(response.json())["MATERIAL"]
    assert material["unmatched_values"] == [
        {"value": "maguey", "count": 3},
        {"value": "totora", "count": 1},
    ]
    assert material["counts"] == {
        "NORMALIZED": 1,
        "UNPARSEABLE": 3,
        "ABSENT": 0,
        "SPLIT_PROPOSED": 1,
    }
    split = next(e for e in material["examples"] if e["original"] == "madera, maguey")
    assert split["matched_terms"] == {"madera": "MADERA"}
    assert split["unmatched_terms"] == ["maguey"]
    with pipeline.session() as session:  # no term is created (RN-010)
        assert session.scalar(select(func.count()).select_from(Term)) == terms_before


def test_values_without_a_term_are_grouped_as_terms_are_matched(pipeline: Pipeline) -> None:
    """Case, accents and repeated spaces do not split a group, as in the term matching; the
    group shows its most frequent spelling."""
    client = pipeline.client
    rows = [
        _sabana_row("Maguey"),
        _sabana_row("maguey"),
        _sabana_row("maguey"),
        _sabana_row("MAGÜEY"),
        _sabana_row("fibra  de maguey"),
        _sabana_row("Fibra de maguey"),
    ]
    batch_id = upload(client, "grupos.xlsx", _sheet(HEADERS, rows))["batch_id"]

    response = _dry_run(client, _seed_template_id(client), batch_id)

    assert response.status_code == 200, response.text
    material = _columns(response.json())["MATERIAL"]
    assert material["unmatched_values"] == [
        {"value": "maguey", "count": 4},
        {"value": "fibra  de maguey", "count": 2},  # tie: the first spelling seen
    ]
    assert material["counts"]["UNPARSEABLE"] == 6


def test_unmatched_values_are_capped_at_twenty(pipeline: Pipeline) -> None:
    client = pipeline.client
    rows = [_sabana_row("maguey") for _ in range(3)]
    rows += [_sabana_row(f"material sintético {n:02d}") for n in range(25)]
    batch_id = upload(client, "muchos.xlsx", _sheet(HEADERS, rows))["batch_id"]

    response = _dry_run(client, _seed_template_id(client), batch_id)

    unmatched = _columns(response.json())["MATERIAL"]["unmatched_values"]
    assert len(unmatched) == 20  # [SUPUESTO T4]
    assert unmatched[0] == {"value": "maguey", "count": 3}
    assert unmatched[1] == {"value": "material sintético 00", "count": 1}


def test_the_sample_is_at_most_two_hundred_rows(pipeline: Pipeline) -> None:
    client = pipeline.client
    rows = [_sabana_row("arcilla") for _ in range(250)]
    batch_id = upload(client, "grande.xlsx", _sheet(HEADERS, rows))["batch_id"]

    response = _dry_run(client, _seed_template_id(client), batch_id)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total_rows"] == 250
    assert body["sampled_rows"] == 200  # [SUPUESTO T3]
    material = _columns(body)["MATERIAL"]
    assert material["counts"]["NORMALIZED"] == 200
    assert len(material["examples"]) <= 5


def test_the_dry_run_writes_nothing(pipeline: Pipeline) -> None:
    """Scenario «La vista previa no escribe»: rows, batch and audit log stay as they were."""
    client = pipeline.client
    batch_id = upload(client, "sabana.xlsx", SABANA)["batch_id"]
    assert put_mapping(client, batch_id, SABANA_MAPPING).status_code == 200
    before_batch = get_batch(client, batch_id)

    def snapshot() -> tuple[Any, ...]:
        with pipeline.session() as session:
            batch = session.get(ImportBatch, uuid.UUID(batch_id))
            assert batch is not None
            return (
                session.scalar(select(func.count()).select_from(ImportRow)),
                session.scalar(select(func.count()).select_from(AuditLog)),
                session.scalar(select(func.count()).select_from(ImportBatch)),
                batch.status,
                batch.mapping,
                batch.template_id,
                batch.updated_at,
                [
                    (row.raw_data, row.mapped_data)
                    for row in session.scalars(
                        select(ImportRow)
                        .where(ImportRow.batch_id == batch.id)
                        .order_by(ImportRow.source_row_number)
                    )
                ],
            )

    before = snapshot()
    response = _dry_run(client, _seed_template_id(client), batch_id)

    assert response.status_code == 200, response.text
    assert snapshot() == before
    after_batch = get_batch(client, batch_id)
    assert after_batch["status"] == before_batch["status"] == "MAPPED"
    assert after_batch["mapping"] == before_batch["mapping"]


def test_a_batch_in_another_state_is_rejected(pipeline: Pipeline) -> None:
    client = pipeline.client
    batch_id = upload(client, "inventario.pdf", b"%PDF")["batch_id"]
    assert get_batch(client, batch_id)["status"] == "FAILED_INGESTION"

    response = _dry_run(client, _seed_template_id(client), batch_id)

    assert response.status_code == 409
    body = response.json()
    assert body["code"] == "batch_not_previewable"
    assert body["details"]["current_status"] == "FAILED_INGESTION"
    assert body["details"]["allowed"] == ["MAPPED", "UPLOADED"]


def test_an_unknown_template_is_404(pipeline: Pipeline) -> None:
    client = pipeline.client
    batch_id = upload(client, "sabana.xlsx", SABANA)["batch_id"]

    response = _dry_run(client, str(uuid.uuid4()), batch_id)

    assert response.status_code == 404
    assert response.json()["code"] == "template_not_found"


def test_an_unknown_batch_is_404(pipeline: Pipeline) -> None:
    response = _dry_run(pipeline.client, _seed_template_id(pipeline.client), str(uuid.uuid4()))

    assert response.status_code == 404
    assert response.json()["code"] == "batch_not_found"


def test_the_dry_run_requires_imports_prepare(pipeline: Pipeline) -> None:
    """[SUPUESTO T8]: the internal viewer cannot preview a template."""
    template_id = _seed_template_id(pipeline.client)
    batch_id = upload(pipeline.client, "sabana.xlsx", SABANA)["batch_id"]
    viewer = pipeline.app_for("INTERNAL_VIEWER")

    assert _dry_run(viewer, template_id, batch_id).status_code == 403
