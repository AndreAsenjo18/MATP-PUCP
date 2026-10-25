"""Synthetic demo batch (importacion-masiva-fotografias 7.1; demo of the import process).

The spreadsheet must keep producing the classification the demo script tells (new rows, two
updates of seeded pieces, possible duplicates, a conflict between two rows that share a code I
and one loan for use with a code I), and the committed folder must keep the 80 photos of the
three matching paths. The photo matching itself is tested by its change; here only the files.
Runs on the module-scoped seeded database of ``pipeline`` (RNF-014: synthetic data only).
"""

from collections import Counter
from pathlib import Path

from app.seed.demo_batch import HEADERS, PHOTO_FOLDER, PHOTOS, ROWS, SHEET_NAME, write_demo_batch
from tests.api.conftest import Pipeline
from tests.api.test_import_pipeline_api import diffs, get_batch, put_mapping, upload, validate

COMMITTED = Path(__file__).resolve().parents[4] / "data" / "fixtures" / "lote_demo"
DEMO_MAPPING = {
    "columns": [
        {"source_column": "DENOMINACIÓN", "target_field": "denomination"},
        {"source_column": "CÓDIGOS", "target_field": "identifier", "split_compound": True},
        {"source_column": "COLECCIÓN", "target_field": "collection"},
        {"source_column": "RÉGIMEN", "target_field": "tenure_regime"},
        {"source_column": "PROCEDENCIA", "target_field": "provenance"},
        {"source_column": "ÉPOCA", "target_field": "epoch_original_text"},
    ]
}


def test_the_batch_has_30_rows_and_80_photos_of_every_kind(tmp_path: Path) -> None:
    files = write_demo_batch(tmp_path)

    assert len(ROWS) == 30 and len(files) == 81
    assert Counter(photo.expected for photo in PHOTOS) == {
        "nombre": 32,
        "carpeta": 32,
        "sin código": 11,
        "ambigua": 3,
        "repetida": 2,
    }
    for photo in PHOTOS:
        if photo.same_as:
            original = (tmp_path / PHOTO_FOLDER / photo.same_as).read_bytes()
            assert (tmp_path / PHOTO_FOLDER / photo.path).read_bytes() == original


def test_the_committed_folder_matches_the_generator() -> None:
    committed = {
        path.relative_to(COMMITTED / PHOTO_FOLDER).as_posix()
        for path in (COMMITTED / PHOTO_FOLDER).rglob("*")
        if path.is_file()
    }

    assert committed == {photo.path for photo in PHOTOS}
    assert (COMMITTED / SHEET_NAME).is_file()


def test_the_spreadsheet_produces_the_classification_of_the_demo(pipeline: Pipeline) -> None:
    content = (COMMITTED / SHEET_NAME).read_bytes()
    batch_id = upload(pipeline.client, SHEET_NAME, content)["batch_id"]
    batch = get_batch(pipeline.client, batch_id)
    assert batch["headers"] == HEADERS
    assert put_mapping(pipeline.client, batch_id, DEMO_MAPPING).status_code == 200
    assert validate(pipeline.client, batch_id).status_code == 202

    counts = get_batch(pipeline.client, batch_id)["counts"]
    rows = {
        row["source_row_number"]: row
        for row in diffs(pipeline.client, batch_id, page_size=50).json()["items"]
    }

    assert {key: counts[key] for key in ("NEW", "UPDATE", "POSSIBLE_DUPLICATE", "CONFLICT")} == {
        "NEW": 21,
        "UPDATE": 2,
        "POSSIBLE_DUPLICATE": 5,
        "CONFLICT": 2,
    }
    assert counts["ERRORS"] == 1 and rows[15]["has_validation_errors"]
    assert "RN-003" in rows[15]["validation_errors"][0]["message"]
    assert rows[17]["classification"] == rows[18]["classification"] == "CONFLICT"
    assert rows[19]["classification"] == rows[20]["classification"] == "UPDATE"
