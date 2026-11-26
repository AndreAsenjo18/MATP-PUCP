"""Carga de un lote desde fotos del libro de registros (change `digitalizacion-libro-registros`).

Con ``AI_PROVIDER=mock`` (por defecto en pruebas) cada foto devuelve la misma fila sintética fija
del `MockProvider`; estas pruebas verifican la integración con el pipeline de importación que ya
existe (plantilla fija, filas sin repetirse entre fotos, validación), no la calidad de la lectura.
"""

import uuid
from typing import Any

from sqlalchemy import select

from app.modules.ai_suggestions.client import AiServiceClient
from app.modules.collections.models import Collection
from app.modules.imports.models import (
    ImportBatch,
    ImportBatchKind,
    ImportBatchStatus,
    ImportMappingTemplate,
    ImportPhoto,
    ImportRow,
    PhotoMatchStatus,
)
from tests.api.conftest import Pipeline
from tests.api.test_import_photos_api import _file, _jpeg
from tests.api.test_import_pipeline_api import BASE, get_batch, put_mapping, upload, validate


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
        assert "Autor" in raw


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
    assert second["counts"]["ERRORS"] == 1
    assert second["counts"]["LEDGER_COLLECTIONS_MISSING"] == 1
    assert second["counts"]["NEW"] == 1

    blocked = pipeline.login("COLLECTIONS_MANAGER").post(
        f"{BASE}/{batch_id}/confirm",
        json={"summary_token": second["approval_summary"]["summary_token"], "comment": "Revisado"},
    )
    assert blocked.status_code == 422, blocked.text
    assert blocked.json()["code"] == "ledger_collection_required"

    with pipeline.session() as session:
        row = session.scalar(select(ImportRow).where(ImportRow.batch_id == uuid.UUID(batch_id)))
        collection = session.scalar(select(Collection).where(Collection.is_active.is_(True)))
        assert row is not None and collection is not None
        row_id, collection_id = row.id, collection.id
    corrected = client.patch(
        f"{BASE}/{batch_id}/rows/{row_id}/cells",
        json={"column": "Colección", "value": f"id:{collection_id}"},
    )
    assert corrected.status_code == 200, corrected.text
    assert validate(client, batch_id).status_code == 202
    final = get_batch(client, batch_id)
    assert final["counts"]["ERRORS"] == 0
    assert final["counts"]["LEDGER_COLLECTIONS_MISSING"] == 0
    with pipeline.session() as session:
        row = session.get(ImportRow, row_id)
        assert row is not None
        assert row.mapped_data["collection_id"] == str(collection_id)
        assert row.raw_data["__corrections"]["Colección"]["original"] is None


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


def test_empty_ledger_extraction_is_rejected(pipeline: Pipeline, monkeypatch: Any) -> None:
    monkeypatch.setattr(AiServiceClient, "extract_ledger_page", lambda *_: {"rows": []})
    response = _upload(pipeline, _jpeg())
    assert response.status_code == 422, response.text
    assert response.json()["code"] == "ledger_no_rows"


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


def test_multiple_ledger_collections_and_reassignment(pipeline: Pipeline) -> None:
    client = pipeline.client
    created = _upload(pipeline, _jpeg(), _jpeg()).json()
    batch_id = created["id"]
    assert validate(client, batch_id).status_code == 202
    with pipeline.session() as session:
        rows = list(
            session.scalars(
                select(ImportRow)
                .where(ImportRow.batch_id == uuid.UUID(batch_id))
                .order_by(ImportRow.source_row_number)
            )
        )
        collections = list(
            session.scalars(select(Collection).where(Collection.is_active.is_(True)).limit(2))
        )
        assert len(rows) == len(collections) == 2
        row_ids = [row.id for row in rows]
        collection_ids = [collection.id for collection in collections]

    def assign(row_id: uuid.UUID, collection_id: uuid.UUID) -> None:
        response = client.patch(
            f"{BASE}/{batch_id}/rows/{row_id}/cells",
            json={"column": "Colección", "value": f"id:{collection_id}"},
        )
        assert response.status_code == 200, response.text

    # Common selection writes all rows while the batch is MAPPED; validate once.
    for row_id in row_ids:
        assign(row_id, collection_ids[0])
    assert validate(client, batch_id).status_code == 202
    assert get_batch(client, batch_id)["counts"]["LEDGER_COLLECTIONS_MISSING"] == 0

    # Another column remains editable, and a later collection selection does not erase it.
    correction = client.patch(
        f"{BASE}/{batch_id}/rows/{row_ids[1]}/cells",
        json={"column": "Descripción", "value": "Descripción revisada"},
    )
    assert correction.status_code == 200, correction.text
    assign(row_ids[1], collection_ids[1])
    assert validate(client, batch_id).status_code == 202
    with pipeline.session() as session:
        first = session.get(ImportRow, row_ids[0])
        second = session.get(ImportRow, row_ids[1])
        assert first is not None and second is not None
        assert first.mapped_data["collection_id"] == str(collection_ids[0])
        assert second.mapped_data["collection_id"] == str(collection_ids[1])
        assert second.raw_data["Descripción"] == "Descripción revisada"
        assert second.raw_data["__corrections"]["Colección"]["original"] is None


def test_common_collection_and_extended_fields(pipeline: Pipeline) -> None:
    with pipeline.session() as session:
        collection = session.scalar(select(Collection).where(Collection.is_active.is_(True)))
        assert collection is not None
        collection_id = collection.id
    client = pipeline.client
    missing = client.post(
        f"{BASE}/ledger-photo-batches",
        files=[("files", ("pagina.jpg", _jpeg(), "image/jpeg"))],
        data={"collection_id": str(uuid.uuid4())},
    )
    assert missing.status_code == 422, missing.text
    response = client.post(
        f"{BASE}/ledger-photo-batches",
        files=[("files", ("pagina.jpg", _jpeg(), "image/jpeg"))],
        data={"collection_id": str(collection_id)},
    )
    assert response.status_code == 201, response.text
    batch_id = response.json()["id"]
    assert validate(client, batch_id).status_code == 202
    with pipeline.session() as session:
        row = session.scalar(select(ImportRow).where(ImportRow.batch_id == uuid.UUID(batch_id)))
        assert row is not None
        assert row.mapped_data["collection_id"] == str(collection_id)
        assert row.raw_data["Observaciones"] is None
        row_id = row.id
    for column, value in (
        ("Régimen de tenencia", "Propiedad"),
        ("Observaciones", "Revisado manualmente"),
        ("Medidas (texto original)", "Medidas anotadas en el libro"),
        ("Alto (cm)", "19"),
    ):
        result = client.patch(
            f"{BASE}/{batch_id}/rows/{row_id}/cells", json={"column": column, "value": value}
        )
        assert result.status_code == 200, result.text
    assert validate(client, batch_id).status_code == 202
    with pipeline.session() as session:
        row = session.get(ImportRow, row_id)
        assert row is not None
        assert row.mapped_data["fields"]["notes"] == "Revisado manualmente"
        assert row.mapped_data["fields"]["dimensions_text"] == "Medidas anotadas en el libro"
        assert row.mapped_data["dimensions"][0]["value"] == 19


def test_photo_is_registered_for_the_selected_ledger_row(pipeline: Pipeline) -> None:
    client = pipeline.client
    batch_id = _upload(pipeline, _jpeg(), _jpeg()).json()["id"]
    assert validate(client, batch_id).status_code == 202
    with pipeline.session() as session:
        rows = list(
            session.scalars(
                select(ImportRow)
                .where(ImportRow.batch_id == uuid.UUID(batch_id))
                .order_by(ImportRow.source_row_number)
            )
        )
        first, second = (row.id for row in rows)
    body = {"files": [_file("foto-sin-codigo.jpg", content=_jpeg())]}
    response = client.post(
        f"{BASE}/{batch_id}/photos/upload-urls", params={"ledger_row_id": str(second)}, json=body
    )
    assert response.status_code == 200, response.text
    photo_id = response.json()["items"][0]["photo_id"]
    with pipeline.session() as session:
        photo = session.get(ImportPhoto, uuid.UUID(photo_id))
        assert photo is not None and photo.row_id == second
        assert photo.match_status is PhotoMatchStatus.MANUAL
    # A repeated file cannot silently move the photo to another row.
    duplicate = client.post(
        f"{BASE}/{batch_id}/photos/upload-urls", params={"ledger_row_id": str(first)}, json=body
    )
    assert duplicate.status_code == 200, duplicate.text
    assert duplicate.json()["items"][0]["result"] == "rejected"
    spreadsheet = upload(client, "otra.csv", b"DENOMINACION;CODIGO I\nPrueba;I-01234\n")["batch_id"]
    denied = client.post(
        f"{BASE}/{spreadsheet}/photos/upload-urls", params={"ledger_row_id": str(second)}, json=body
    )
    assert denied.status_code == 422, denied.text
