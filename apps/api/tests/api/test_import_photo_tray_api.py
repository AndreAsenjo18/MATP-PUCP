"""Tray, folders, reading and correspondences of a photo-only batch over HTTP.

Change importacion-fotos-a-catalogo, tasks 4.1 to 4.5 (design D4, D7, D8); spec importacion-datos,
«Asignación manual de fotos a piezas existentes», «Forma de lectura de los nombres por carpeta»,
«Lote de solo fotografías…» (scenario «Foto que ya está en la pieza») and «Lista de
correspondencias entre archivos y códigos». Every test builds its own collection and batch.
Synthetic data only (RNF-014).
"""

import io
import uuid

from openpyxl import Workbook
from sqlalchemy import select

from app.models import AuditLog
from app.modules.audit.soft_delete import soft_delete
from app.modules.catalog.models import Piece
from app.modules.imports.log import build_log
from app.modules.imports.models import ImportBatch
from tests.api.conftest import Pipeline
from tests.api.photo_batch_support import (
    add_photos,
    as_admin,
    by_path,
    collection,
    decide,
    media,
    photo_batch,
    photos,
    piece,
    rematch,
    sha,
)
from tests.api.test_import_pipeline_api import BASE

# --- 4.1 decisiones -------------------------------------------------------------------------------


def test_several_camera_photos_are_assigned_to_one_piece_in_the_order_of_their_names(
    pipeline: Pipeline,
) -> None:
    abc = collection(pipeline, "Colección bandeja", "BDJ")
    target = piece(pipeline, abc, ("I", "I-0236"))
    batch_id = photo_batch(pipeline, "Bandeja")
    ids = add_photos(pipeline, batch_id, *(f"ALTAS/82LF41{n:02d}.jpg" for n in range(5)))
    rematch(pipeline, batch_id)

    response = decide(pipeline, batch_id, "assign", list(ids.values()), piece_id=target)

    assert response.status_code == 200, response.text
    tray = by_path(pipeline, batch_id)
    assert [tray[path]["sort_key"] for path in ids] == [1, 2, 3, 4, 5]
    assert {tray[path]["piece_id"] for path in ids} == {str(target)}
    assert {tray[path]["match_status"] for path in ids} == {"MANUAL"}
    assert [item["relative_path"] for item in photos(pipeline, batch_id, piece_id=target)] == list(
        ids
    )
    with pipeline.session() as session:
        batch = session.get(ImportBatch, uuid.UUID(batch_id))
        assert batch is not None
        log = build_log(session, batch)
    (entry,) = log["photo_decisions"]
    assert entry["operation"] == "Fotos del lote: asignar"
    assert entry["photos"] == 5 and entry["user"]


def test_a_retired_piece_cannot_receive_photos(pipeline: Pipeline) -> None:
    retired = piece(pipeline, collection(pipeline, "Colección retirada", "RTD"))
    with as_admin(pipeline) as session:
        item = session.get(Piece, retired)
        assert item is not None
        soft_delete(session, item, "Retirada sintética")
    batch_id = photo_batch(pipeline, "Retirada")
    ids = add_photos(pipeline, batch_id, "x.jpg")

    response = decide(pipeline, batch_id, "assign", list(ids.values()), piece_id=retired)

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "piece_not_available"
    assert by_path(pipeline, batch_id)["x.jpg"]["piece_id"] is None


def test_a_row_cannot_be_the_target_in_a_photo_batch(pipeline: Pipeline) -> None:
    batch_id = photo_batch(pipeline, "Sin filas")
    ids = add_photos(pipeline, batch_id, "y.jpg")

    response = decide(pipeline, batch_id, "assign", list(ids.values()), row_id=uuid.uuid4())

    assert response.status_code == 422
    assert response.json()["code"] == "row_not_in_batch"


def test_unassign_discard_restore_and_reorder(pipeline: Pipeline) -> None:
    target = piece(pipeline, collection(pipeline, "Colección orden", "ORD"))
    batch_id = photo_batch(pipeline, "Orden")
    ids = add_photos(pipeline, batch_id, "a.jpg", "b.jpg", "c.jpg")
    a, b, c = ids.values()
    decide(pipeline, batch_id, "assign", [a, b, c], piece_id=target)

    assert decide(pipeline, batch_id, "reorder", [c, a], piece_id=target).status_code == 200
    tray = by_path(pipeline, batch_id)
    assert [tray[p]["sort_key"] for p in ("c.jpg", "a.jpg", "b.jpg")] == [1, 2, 3]

    assert decide(pipeline, batch_id, "unassign", [b]).status_code == 200
    assert by_path(pipeline, batch_id)["b.jpg"]["piece_id"] is None

    assert decide(pipeline, batch_id, "discard", [c]).status_code == 200
    assert by_path(pipeline, batch_id)["c.jpg"]["status"] == "DISCARDED"

    assert decide(pipeline, batch_id, "restore", [c]).status_code == 200
    restored = by_path(pipeline, batch_id)["c.jpg"]
    assert restored["status"] == "VERIFIED" and restored["piece_id"] is None
    assert restored["match_status"] == "MANUAL"


def test_only_preparers_decide(pipeline: Pipeline) -> None:
    batch_id = photo_batch(pipeline, "Consulta")
    ids = add_photos(pipeline, batch_id, "z.jpg")

    response = pipeline.login("INTERNAL_VIEWER").patch(
        f"{BASE}/{batch_id}/photos", json={"op": "discard", "photo_ids": list(ids.values())}
    )

    assert response.status_code == 403


# --- 4.2 repetida en la pieza ---------------------------------------------------------------------


def test_a_photo_already_on_the_piece_is_marked_and_can_be_confirmed(pipeline: Pipeline) -> None:
    abc = collection(pipeline, "Colección repetidas", "RPT")
    target = piece(pipeline, abc, ("COLECCION", "RPT 1"))
    media(pipeline, target, sha("repetida"))
    batch_id = photo_batch(pipeline, "Repetidas")
    ids = add_photos(pipeline, batch_id, "RPT 1.jpg", content_sha256=sha("repetida"))
    rematch(pipeline, batch_id)

    proposed = by_path(pipeline, batch_id)["RPT 1.jpg"]
    assert proposed["piece_id"] == str(target)
    assert proposed["duplicate_of_existing"] is True and proposed["duplicate_confirmed"] is False

    assert decide(pipeline, batch_id, "confirm_duplicate", list(ids.values())).status_code == 200
    assert by_path(pipeline, batch_id)["RPT 1.jpg"]["duplicate_confirmed"] is True


# --- 4.3 carpetas ---------------------------------------------------------------------------------


def test_folders_with_counts_range_collection_and_suggestion(pipeline: Pipeline) -> None:
    cid = collection(pipeline, "Colección carpetas", "CRP")
    piece(pipeline, cid, ("COLECCION", "CRP 7"))
    batch_id = photo_batch(pipeline, "Carpetas")
    add_photos(
        pipeline,
        batch_id,
        "CRP 001 - 100/CRP 7 - PUCP 1.jpg",
        *(f"CRP 001 - 100/sub/{n:03d}-{3000 + n}.jpg" for n in range(1, 6)),
        "Nueva carpeta/portada.jpg",
    )
    rematch(pipeline, batch_id)

    response = pipeline.client.get(f"{BASE}/{batch_id}/photos/folders")

    assert response.status_code == 200, response.text
    folders = {item["path"]: item for item in response.json()["folders"]}
    root = folders["CRP 001 - 100"]
    assert root["photos"] == 6 and root["by_match_status"]["MATCHED"] == 1
    assert root["range"] == [1, 100]
    assert root["collection"]["id"] == str(cid) and root["collection_pending"] is True
    sub = folders["CRP 001 - 100/sub"]
    assert sub["collection"]["id"] == str(cid)  # inherited
    assert sub["suggestion"]["template"] == "{n}-{*}"
    assert folders["Nueva carpeta"]["collection"] is None
    in_folder = photos(pipeline, batch_id, folder="CRP 001 - 100/sub")
    assert len(in_folder) == 5
    assert {item["match_reason"] for item in in_folder} == {"camera_name"}


def test_folders_are_only_for_photo_batches(pipeline: Pipeline) -> None:
    from tests.api.test_import_pipeline_api import upload

    spreadsheet = upload(pipeline.client, "sabana_carpetas.csv", b"DENOMINACION\nToro\n")
    response = pipeline.client.get(f"{BASE}/{spreadsheet['batch_id']}/photos/folders")

    assert response.status_code == 409
    assert response.json()["code"] == "batch_kind_mismatch"


# --- 4.4 vista previa y regla ---------------------------------------------------------------------


def test_the_preview_reads_without_saving_and_the_rule_rematches_but_keeps_manual_photos(
    pipeline: Pipeline,
) -> None:
    cid = collection(pipeline, "Colección lectura", "LCT")
    p53, p59, other = (piece(pipeline, cid, ("COLECCION", f"LCT {n}")) for n in (53, 59, 60))
    batch_id = photo_batch(pipeline, "Lectura")
    ids = add_photos(
        pipeline, batch_id, "FOTOS 051-114/053-3269.jpg", "FOTOS 051-114/059-3225 x.jpg"
    )
    rematch(pipeline, batch_id)
    manual = ids["FOTOS 051-114/059-3225 x.jpg"]
    decide(pipeline, batch_id, "assign", [manual], piece_id=other)
    rule = {"mode": "template", "template": "{n}-{*}", "collection_id": str(cid)}

    preview = pipeline.client.post(
        f"{BASE}/{batch_id}/photos/reading-preview",
        json={"folder": "FOTOS 051-114", "rule": rule},
    )

    assert preview.status_code == 200, preview.text
    items = {item["relative_path"]: item for item in preview.json()["items"]}
    assert items["FOTOS 051-114/053-3269.jpg"]["piece_id"] == str(p53)
    assert items["FOTOS 051-114/059-3225 x.jpg"]["piece_id"] == str(p59)
    assert by_path(pipeline, batch_id)["FOTOS 051-114/053-3269.jpg"]["piece_id"] is None

    saved = pipeline.client.put(
        f"{BASE}/{batch_id}/photos/reading", json={"folder": "FOTOS 051-114", "rule": rule}
    )

    assert saved.status_code == 200, saved.text
    tray = by_path(pipeline, batch_id)
    assert tray["FOTOS 051-114/053-3269.jpg"]["piece_id"] == str(p53)
    assert tray["FOTOS 051-114/053-3269.jpg"]["match_source"] == "TEMPLATE"
    assert tray["FOTOS 051-114/059-3225 x.jpg"]["piece_id"] == str(other)  # manual stays
    folder = next(f for f in saved.json()["folders"] if f["path"] == "FOTOS 051-114")
    assert folder["rule"]["template"] == "{n}-{*}" and folder["collection_pending"] is False


def test_an_invalid_template_is_rejected_and_the_folder_keeps_its_rule(pipeline: Pipeline) -> None:
    batch_id = photo_batch(pipeline, "Plantilla mala")
    add_photos(pipeline, batch_id, "Nueva carpeta/1.jpg")

    for rule in (
        {"mode": "template", "template": "{COLECCION} {XYZ}"},
        {"mode": "template", "template": "{n}"},
    ):
        response = pipeline.client.put(
            f"{BASE}/{batch_id}/photos/reading", json={"folder": "Nueva carpeta", "rule": rule}
        )
        assert response.status_code == 422, response.text
        assert response.json()["code"] == "invalid_photo_template"
    folders = pipeline.client.get(f"{BASE}/{batch_id}/photos/folders").json()
    assert folders["folders"][0]["rule"]["mode"] == "auto"


# --- 4.5 lista de correspondencias ----------------------------------------------------------------


def test_a_list_assigns_camera_photos_and_reports_the_lines_it_cannot_use(
    pipeline: Pipeline,
) -> None:
    cid = collection(pipeline, "Colección lista", "LST")
    target = piece(pipeline, cid, ("I", "I-7236"))
    batch_id = photo_batch(pipeline, "Lista")
    add_photos(pipeline, batch_id, "FOTOS/ALTAS/82LF4169 copy.jpg", "A/1.JPG", "B/1.JPG")
    rematch(pipeline, batch_id)
    content = (
        b"archivo;codigo\n"
        b"FOTOS/ALTAS/82LF4169 copy.jpg;I-7236\n"
        b"no-esta.jpg;I-7236\n"
        b"FOTOS/ALTAS/82LF4169 copy.jpg;I-999999\n"
        b"1.JPG;I-7236\n"
    )

    response = pipeline.client.post(
        f"{BASE}/{batch_id}/photos/correspondences",
        files={"file": ("lista.csv", content, "text/csv")},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert [line["result"] for line in body["lines"]] == [
        "ambiguous",  # line 4 names the same photo and replaces it
        "no_photo",
        "no_piece",
        "ambiguous",
    ]
    tray = by_path(pipeline, batch_id)
    camera = tray["FOTOS/ALTAS/82LF4169 copy.jpg"]
    # The later line for the same file (no piece) replaced the first one in the batch.
    assert camera["piece_id"] is None
    assert {tray["A/1.JPG"]["match_reason"], tray["B/1.JPG"]["match_reason"]} == {"duplicate_name"}

    fixed = pipeline.client.post(
        f"{BASE}/{batch_id}/photos/correspondences",
        files={"file": ("lista.csv", b"archivo,codigo,tipo\nA/1.JPG,I-7236,I\n", "text/csv")},
    )
    assert fixed.json()["applied"] == 1
    tray = by_path(pipeline, batch_id)
    assert tray["A/1.JPG"]["piece_id"] == str(target)
    assert tray["A/1.JPG"]["match_source"] == "LIST"


def test_an_excel_list(pipeline: Pipeline) -> None:
    cid = collection(pipeline, "Colección excel", "XLS")
    target = piece(pipeline, cid, ("I", "I-8236"))
    batch_id = photo_batch(pipeline, "Lista Excel")
    add_photos(pipeline, batch_id, "ALTAS/DSC_0001.jpg")
    book = Workbook()
    book.active.append(["Archivo", "Código"])  # type: ignore[union-attr]
    book.active.append(["ALTAS/DSC_0001.jpg", "I-8236"])  # type: ignore[union-attr]
    output = io.BytesIO()
    book.save(output)

    response = pipeline.client.post(
        f"{BASE}/{batch_id}/photos/correspondences",
        files={"file": ("lista.xlsx", output.getvalue(), "application/octet-stream")},
    )

    assert response.status_code == 200, response.text
    assert by_path(pipeline, batch_id)["ALTAS/DSC_0001.jpg"]["piece_id"] == str(target)


def test_a_list_without_headers_is_rejected(pipeline: Pipeline) -> None:
    batch_id = photo_batch(pipeline, "Lista sin cabeceras")

    response = pipeline.client.post(
        f"{BASE}/{batch_id}/photos/correspondences",
        files={"file": ("lista.csv", b"foo,bar\nx,y\n", "text/csv")},
    )

    assert response.status_code == 422
    assert response.json()["code"] == "invalid_correspondences"


def test_decisions_are_audited_with_the_batch(pipeline: Pipeline) -> None:
    batch_id = photo_batch(pipeline, "Auditoría")
    ids = add_photos(pipeline, batch_id, "w.jpg")
    decide(pipeline, batch_id, "discard", list(ids.values()))

    with pipeline.session() as session:
        entries = session.scalars(
            select(AuditLog).where(
                AuditLog.entity_type == "import_photo", AuditLog.origin_ref == batch_id
            )
        ).all()
    assert entries and all(entry.user_id for entry in entries)
