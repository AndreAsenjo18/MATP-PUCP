"""Tray of the photos of a batch over HTTP (importacion-masiva-fotografias, 4.1 and 4.2 assign).

Spec importacion-datos, «Previsualización del lote con miniaturas y conteos de fotos» and
«Bandeja de revisión de fotografías del lote»; design D4. Each test builds its own batch with the
real stages (see ``test_import_photos_apply_api``) and two loose photos without a code. Synthetic
data only (RNF-014).
"""

import uuid
from typing import Any

import pytest
from sqlalchemy import select

from app.modules.imports.models import ImportBatch, ImportBatchStatus, ImportRow
from tests.api.conftest import Pipeline
from tests.api.test_import_photos_api import (
    _drain,
    _file,
    _items,
    _jpeg,
    _send,
    _set_status,
    _verifiable,
)
from tests.api.test_import_photos_apply_api import (
    Lot,
    approve,
    assets_of,
    lot_with_photos,
    photo_rows,
    pieces_of,
)
from tests.api.test_import_pipeline_api import BASE


@pytest.fixture
def storage(pipeline: Pipeline, monkeypatch: pytest.MonkeyPatch) -> Any:
    return _verifiable(pipeline.client, pipeline, monkeypatch)


def with_loose_photos(pipeline: Pipeline, storage: Any) -> Lot:
    """The batch of ``lot_with_photos`` plus two photos no row matches."""
    lot = lot_with_photos(pipeline, storage)
    for number in (1, 2):
        name = f"sueltas/IMG_000{number}.jpg"
        lot.photos[name] = _send(
            pipeline, lot.batch_id, f"{lot.tag}/{name}", _jpeg(20 + number, 20)
        )
    _drain(pipeline, storage)
    return lot


def row_ids(pipeline: Pipeline, batch_id: str) -> dict[int, uuid.UUID]:
    with pipeline.session() as session:
        return {
            row.source_row_number: row.id
            for row in session.scalars(
                select(ImportRow).where(ImportRow.batch_id == uuid.UUID(batch_id))
            )
        }


def tray(pipeline: Pipeline, batch_id: str, **params: Any) -> dict[str, Any]:
    response = pipeline.client.get(f"{BASE}/{batch_id}/photos", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def test_the_tray_filters_the_photos_and_signs_their_thumbnails(
    pipeline: Pipeline, storage: Any
) -> None:
    lot = with_loose_photos(pipeline, storage)
    rows = row_ids(pipeline, lot.batch_id)

    loose = tray(pipeline, lot.batch_id, match_status="UNMATCHED")
    assert loose["total"] == 2
    for item in loose["items"]:
        assert item["row_id"] is None and item["status"] == "VERIFIED"
        assert f"media/{item['id']}/thumb.webp" in item["thumbnail_url"]

    toro = tray(pipeline, lot.batch_id, row_id=str(rows[2]))
    assert [item["sort_key"] for item in toro["items"]] == [1, 2, 3]
    assert {item["match_status"] for item in toro["items"]} == {"MATCHED"}

    page = tray(pipeline, lot.batch_id, limit=4, page=2)
    assert (page["total"], page["page"], page["page_size"], len(page["items"])) == (6, 2, 4, 2)
    assert tray(pipeline, lot.batch_id, status="VERIFIED")["total"] == 6


def test_the_summary_counts_the_photos_by_status_and_proposal(
    pipeline: Pipeline, storage: Any
) -> None:
    lot = with_loose_photos(pipeline, storage)
    (pending,) = _items(pipeline.client, lot.batch_id, _file(f"{lot.tag}/sin_subir.jpg"))

    response = pipeline.client.get(f"{BASE}/{lot.batch_id}/photos/summary")

    assert response.status_code == 200, response.text
    counts = response.json()
    assert counts["total"] == 7
    assert counts["by_status"]["VERIFIED"] == 6
    assert counts["by_status"]["PENDING_UPLOAD"] == 1
    assert counts["by_match_status"] == {
        "MATCHED": 4,
        "AMBIGUOUS": 0,
        "UNMATCHED": 2,
        "MANUAL": 0,
        "NONE": 1,
    }
    assert counts["duplicates"] == 0
    still_uploading = tray(pipeline, lot.batch_id, status="PENDING_UPLOAD")["items"]
    assert [item["id"] for item in still_uploading] == [pending["photo_id"]]
    assert still_uploading[0]["thumbnail_url"] is None  # no thumbnail before verification


def test_an_internal_viewer_does_not_see_the_tray(pipeline: Pipeline, storage: Any) -> None:
    lot = lot_with_photos(pipeline, storage)
    viewer = pipeline.login("INTERNAL_VIEWER")

    assert viewer.get(f"{BASE}/{lot.batch_id}/photos").status_code == 403
    assert viewer.get(f"{BASE}/{lot.batch_id}/photos/summary").status_code == 403


# --- Task 4.2: assign -------------------------------------------------------------------------


def assign(
    pipeline: Pipeline, batch_id: str, photo_ids: list[str], row_id: Any, role: str | None = None
) -> Any:
    client = pipeline.login(role) if role else pipeline.client
    body = {"op": "assign", "photo_ids": photo_ids, "row_id": str(row_id)}
    return client.patch(f"{BASE}/{batch_id}/photos", json=body)


def test_several_photos_are_assigned_to_a_row_and_applied_with_it(
    pipeline: Pipeline, storage: Any
) -> None:
    lot = with_loose_photos(pipeline, storage)
    rows = row_ids(pipeline, lot.batch_id)
    loose = [lot.photos["sueltas/IMG_0002.jpg"], lot.photos["sueltas/IMG_0001.jpg"]]

    response = assign(pipeline, lot.batch_id, loose, rows[3])

    assert response.status_code == 200, response.text
    assigned = response.json()["photos"]
    assert [photo["id"] for photo in assigned] == loose  # in the order sent
    assert {(photo["match_status"], photo["match_source"]) for photo in assigned} == {
        ("MANUAL", "MANUAL")
    }
    assert {photo["row_id"] for photo in assigned} == {str(rows[3])}
    assert [photo["sort_key"] for photo in assigned] == [2, 3]  # after the photo the row had

    # A new photo runs the matching again: the manual photos keep their row and position, and the
    # automatic one of the row is numbered after them (task 3.3, design D4).
    automatic = next(photo_id for name, photo_id in lot.photos.items() if name.startswith("AJB"))
    _send(pipeline, lot.batch_id, f"{lot.tag}/sueltas/IMG_0003.jpg", _jpeg(33, 22))
    _drain(pipeline, storage)
    kept = tray(pipeline, lot.batch_id, row_id=str(rows[3]))["items"]
    assert [photo["id"] for photo in kept] == [*loose, automatic]

    assert approve(pipeline, lot.batch_id)["status"] == "APPLIED"
    manta = pieces_of(pipeline, lot.batch_id)[3]
    assert manta is not None
    assets = assets_of(pipeline, manta.id)
    assert [asset.original_filename for asset in assets][:2] == ["IMG_0002.jpg", "IMG_0001.jpg"]
    assert assets[0].is_primary  # the first photo assigned by hand comes first


def test_photos_are_assigned_only_to_rows_of_their_batch(pipeline: Pipeline, storage: Any) -> None:
    lot = with_loose_photos(pipeline, storage)
    other = lot_with_photos(pipeline, storage)
    loose = lot.photos["sueltas/IMG_0001.jpg"]
    (pending,) = _items(pipeline.client, lot.batch_id, _file(f"{lot.tag}/sin_subir.jpg"))

    foreign_row = assign(pipeline, lot.batch_id, [loose], row_ids(pipeline, other.batch_id)[2])
    foreign_photo = assign(
        pipeline,
        lot.batch_id,
        [next(iter(other.photos.values()))],
        row_ids(pipeline, lot.batch_id)[2],
    )
    unverified = assign(
        pipeline, lot.batch_id, [pending["photo_id"]], row_ids(pipeline, lot.batch_id)[2]
    )
    unknown = pipeline.client.patch(
        f"{BASE}/{lot.batch_id}/photos",
        json={"op": "discard", "photo_ids": [loose], "row_id": str(uuid.uuid4())},
    )
    viewer = assign(
        pipeline, lot.batch_id, [loose], row_ids(pipeline, lot.batch_id)[2], role="INTERNAL_VIEWER"
    )

    assert foreign_row.status_code == 422 and foreign_row.json()["code"] == "row_not_in_batch"
    assert foreign_photo.status_code == 422 and foreign_photo.json()["code"] == "photo_not_in_batch"
    assert unverified.status_code == 422 and unverified.json()["code"] == "photo_not_verified"
    assert unknown.status_code == 422  # only assign exists for now
    assert viewer.status_code == 403
    assert tray(pipeline, lot.batch_id, match_status="UNMATCHED")["total"] == 2  # nothing changed


def test_an_approved_batch_takes_no_more_assignments(pipeline: Pipeline, storage: Any) -> None:
    lot = with_loose_photos(pipeline, storage)
    _set_status(pipeline, ImportBatch, uuid.UUID(lot.batch_id), ImportBatchStatus.APPROVED)

    response = assign(
        pipeline,
        lot.batch_id,
        [lot.photos["sueltas/IMG_0001.jpg"]],
        row_ids(pipeline, lot.batch_id)[2],
    )

    assert response.status_code == 409, response.text
    assert response.json()["code"] == "batch_not_reviewable"


def test_a_photo_assigned_to_a_rejected_row_is_not_applied(
    pipeline: Pipeline, storage: Any
) -> None:
    lot = with_loose_photos(pipeline, storage)
    rows = row_ids(pipeline, lot.batch_id)
    loose = lot.photos["sueltas/IMG_0001.jpg"]
    assert assign(pipeline, lot.batch_id, [loose], rows[2]).status_code == 200
    rejected = pipeline.client.patch(
        f"{BASE}/{lot.batch_id}/rows/{rows[2]}",
        json={"decision": "REJECTED", "reason": "Fila sintética de prueba"},
    )
    assert rejected.status_code == 200, rejected.text

    assert approve(pipeline, lot.batch_id)["status"] == "APPLIED"

    assert pieces_of(pipeline, lot.batch_id)[2] is None  # the row was not applied
    photo = photo_rows(pipeline, lot)["sueltas/IMG_0001.jpg"]
    assert (photo.status.value, photo.media_asset_id) == ("VERIFIED", None)
