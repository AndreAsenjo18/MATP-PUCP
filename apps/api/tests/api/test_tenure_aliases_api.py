"""Spec importacion-datos — Régimen deducido de la forma de adquisición, por API (RF-005, RN-010).

Change ajustes-lectura-importacion, task 1.4 (design D1): ``GET``/``PUT
/normalization-settings/tenure_aliases`` shows and saves the correspondences with the regime
labels of the contract, rejects a regime that does not exist and audits the change; an import
validated afterwards uses the new correspondence. Synthetic data only (RNF-014); «Depósito» is
an illustrative acquisition method.

Own module: the ``pipeline`` fixture gives it its own seeded database; the tests run in order.
"""

from sqlalchemy import select

from app.models import AuditLog
from app.modules.audit.models import AuditAction
from tests.api.conftest import Pipeline
from tests.api.normalization_params_support import sheet
from tests.api.test_import_pipeline_api import diffs, put_mapping, upload, validate

URL = "/api/v1/normalization-settings/tenure_aliases"


def test_the_correspondences_are_shown_with_the_contract_labels(pipeline: Pipeline) -> None:
    response = pipeline.login("COLLECTIONS_MANAGER").get(URL)

    assert response.status_code == 200, response.text
    value = response.json()["value"]
    assert value["cesion de uso"] == "Comodato" and value["custodia"] == "Comodato"
    assert value["donacion"] == "Propiedad"


def test_a_regime_that_does_not_exist_is_rejected(pipeline: Pipeline) -> None:
    response = pipeline.login("COLLECTIONS_MANAGER").put(
        URL, json={"value": {"Depósito": "Arriendo"}}
    )

    assert response.status_code == 422, response.text
    body = response.json()
    assert body["code"] == "invalid_setting_value"
    assert "«Arriendo»" in body["message"] and "Comodato" in body["message"]


def test_a_new_correspondence_is_audited_and_used_by_the_import(pipeline: Pipeline) -> None:
    client = pipeline.login("COLLECTIONS_MANAGER")
    current = client.get(URL).json()["value"]

    saved = client.put(URL, json={"value": {**current, "Depósito": "Comodato"}})

    assert saved.status_code == 200, saved.text
    assert saved.json()["value"]["deposito"] == "Comodato"
    with pipeline.session() as session:
        entries = session.scalars(
            select(AuditLog).where(
                AuditLog.entity_type == "normalization_setting",
                AuditLog.action.in_([AuditAction.CREATE, AuditAction.UPDATE]),
            )
        ).all()
    assert entries, "el cambio de correspondencias debe quedar en la auditoría"

    batch_id = upload(
        pipeline.client,
        "deposito.xlsx",
        sheet(["DENOMINACIÓN", "FORMA"], [["Mate burilado", "Depósito"]]),
    )["batch_id"]
    mapping = {
        "columns": [
            {"source_column": "DENOMINACIÓN", "target_field": "denomination"},
            {"source_column": "FORMA", "target_field": "terms:ACQUISITION_METHOD"},
        ],
    }
    assert put_mapping(pipeline.client, batch_id, mapping).status_code == 200
    assert validate(pipeline.client, batch_id).status_code == 202
    [row] = diffs(pipeline.client, batch_id, page_size=10).json()["items"]
    assert row["mapped_data"]["tenure_regime"] == "LOAN_FOR_USE"
    assert not row["has_validation_errors"], row["validation_errors"]
