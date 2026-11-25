"""Carga de un lote desde fotos del libro de registros (change `digitalizacion-libro-registros`).

Con ``AI_PROVIDER=mock`` (por defecto en pruebas) cada foto devuelve la misma fila sintética fija
del `MockProvider`; estas pruebas verifican la integración con el pipeline de importación que ya
existe (plantilla fija, filas sin repetirse entre fotos, validación), no la calidad de la lectura.
"""

import uuid
from typing import Any

from sqlalchemy import select

from app.modules.imports.models import (
    ImportBatch,
    ImportBatchKind,
    ImportBatchStatus,
    ImportMappingTemplate,
    ImportRow,
)
from tests.api.conftest import Pipeline
from tests.api.test_import_photos_api import _jpeg
from tests.api.test_import_pipeline_api import BASE, get_batch, put_mapping, validate


def _upload(pipeline: Pipeline, *photos: bytes, content_type: str = "image/jpeg") -> Any:
    files = [("files", (f"pagina-{i}.jpg", photo, content_type)) for i, photo in enumerate(photos)]
    return pipeline.client.post(f"{BASE}/ledger-photo-batches", files=files)


def test_one_photo_creates_a_mapped_batch_with_one_row(pipeline: Pipeline) -> None:
    response = _upload(pipeline, _jpeg())
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["kind"] == "SPREADSHEET"
    assert body["status"] == "MAPPED"
    assert body["template_id"] is not None
    with pipeline.session() as session:
        batch = session.get(ImportBatch, uuid.UUID(body["id"]))
        assert batch is not None
        assert batch.kind == ImportBatchKind.SPREADSHEET
        assert batch.file_storage_key is None
        template = session.get(ImportMappingTemplate, batch.template_id)
        assert template is not None and template.name == "Foto del libro de registros"
        rows = list(session.scalars(select(ImportRow).where(ImportRow.batch_id == batch.id)))
        assert len(rows) == 1
        raw = rows[0].raw_data
        assert raw["Código de inventario"]
        assert raw["Procedencia"] == "Loreto"


def test_tenure_regime_can_be_set_for_all_rows_from_the_review(pipeline: Pipeline) -> None:
    """Regresión: sin `template_id` en el lote, la pantalla de revisión no ofrece ningún control
    para elegir el régimen de tenencia de las filas que no lo traen (la ficha física nunca lo
    escribe) — el botón «Ajustar columnas» llevaba a reiniciar el mapeo desde cero. El lote debe
    quedar ligado a la plantilla real para que `PUT /mapping` con `template_id` + `defaults`
    funcione igual que con cualquier lote mapeado por plantilla."""
    client = pipeline.client
    created = _upload(pipeline, _jpeg()).json()
    batch_id = created["id"]
    template_id = created["template_id"]

    assert validate(client, batch_id).status_code == 202
    first_counts = get_batch(client, batch_id)["counts"]
    assert first_counts["ERRORS"] == 1  # falta régimen de tenencia

    mapped = put_mapping(
        client, batch_id, {"template_id": template_id, "defaults": {"tenure_regime": "Propiedad"}}
    )
    assert mapped.status_code == 200, mapped.text
    assert mapped.json()["template_id"] == template_id

    assert validate(client, batch_id).status_code == 202
    second = get_batch(client, batch_id)
    assert second["counts"]["ERRORS"] == 0
    assert second["counts"]["NEW"] == 1


def test_several_photos_rows_do_not_repeat_numbers(pipeline: Pipeline) -> None:
    response = _upload(pipeline, _jpeg(), _jpeg())
    assert response.status_code == 201, response.text
    body = response.json()
    with pipeline.session() as session:
        rows = list(
            session.scalars(
                select(ImportRow)
                .where(ImportRow.batch_id == uuid.UUID(body["id"]))
                .order_by(ImportRow.source_row_number)
            )
        )
        assert [row.source_row_number for row in rows] == [1, 2]


def test_unsupported_image_type_is_rejected(pipeline: Pipeline) -> None:
    response = _upload(pipeline, b"no es una imagen", content_type="application/pdf")
    assert response.status_code == 422, response.text
    assert response.json()["code"] == "unsupported_image_type"


def test_mapped_batch_validates_without_error(pipeline: Pipeline) -> None:
    """Prueba de integración: la plantilla fija calza con `validate_mapping`/`apply_mapping` ya
    existentes, sin tocarlos (design D2 de `digitalizacion-libro-registros`)."""
    created = _upload(pipeline, _jpeg()).json()
    response = pipeline.client.post(f"{BASE}/{created['id']}/validate")
    assert response.status_code == 202, response.text
    with pipeline.session() as session:
        batch = session.get(ImportBatch, uuid.UUID(created["id"]))
        assert batch is not None
        assert batch.status == ImportBatchStatus.IN_PREVIEW
