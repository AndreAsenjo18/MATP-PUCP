"""Change alinear-api-endpoints-v1 (tarea 4.6) — `POST /media/upload` (RF-013, RF-014, RN-008)."""

import hashlib
import io
import uuid

import pytest
from PIL import Image
from sqlalchemy import select

from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from tests.api.conftest import SeededApi


def _jpeg_bytes(color: tuple[int, int, int] = (200, 30, 30)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (120, 90), color).save(buffer, format="JPEG")
    return buffer.getvalue()


def _piece_id(seeded_api: SeededApi, tenure: TenureRegime | None = None) -> uuid.UUID:
    with seeded_api.session() as session:
        statement = select(Piece.id).where(Piece.deleted_at.is_(None))
        if tenure is not None:
            statement = statement.where(Piece.tenure_regime == tenure)
        piece_id = session.scalar(statement.order_by(Piece.denomination))
        assert piece_id is not None
        return piece_id


@pytest.fixture
def fake_storage(seeded_api: SeededApi, monkeypatch: pytest.MonkeyPatch) -> dict[str, bytes]:
    """Almacenamiento en memoria: la app de pruebas apunta a MinIO local (sin red)."""
    objects: dict[str, bytes] = {}

    def put_bytes(key: str, data: bytes, content_type: str) -> None:
        objects[key] = data

    monkeypatch.setattr(seeded_api.app.state.storage, "put_bytes", put_bytes)
    return objects


def test_upload_registers_photo_with_verified_hash(
    seeded_api: SeededApi, fake_storage: dict[str, bytes]
) -> None:
    client = seeded_api.login_as("CATALOGUER")
    piece_id = _piece_id(seeded_api, TenureRegime.OWNED)
    data = _jpeg_bytes()
    response = client.post(
        "/api/v1/media/upload",
        data={"piece_id": str(piece_id), "view_type": "Frontal"},
        files={"file": ("foto_frontal.jpg", data, "image/jpeg")},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["piece_id"] == str(piece_id)
    assert body["view_type"]["code"] == "Frontal"
    assert body["content_type"] == "image/jpeg"
    assert body["size_bytes"] == len(data)
    assert body["content_sha256"] == hashlib.sha256(data).hexdigest()
    assert (body["width_px"], body["height_px"]) == (120, 90)
    assert body["usage_restriction"] is None
    assert list(fake_storage.values()) == [data]


def test_disguised_pdf_is_rejected_without_storing(
    seeded_api: SeededApi, fake_storage: dict[str, bytes]
) -> None:
    client = seeded_api.login_as("CATALOGUER")
    piece_id = _piece_id(seeded_api)
    response = client.post(
        "/api/v1/media/upload",
        data={"piece_id": str(piece_id), "view_type": "Frontal"},
        files={"file": ("foto.jpg", b"%PDF-1.4 falso", "image/jpeg")},
    )
    assert response.status_code == 422
    assert response.json()["code"] == "invalid_image"
    assert fake_storage == {}


def test_viewer_without_upload_permission_is_rejected(
    seeded_api: SeededApi, fake_storage: dict[str, bytes]
) -> None:
    client = seeded_api.login_as("INTERNAL_VIEWER")
    piece_id = _piece_id(seeded_api)
    response = client.post(
        "/api/v1/media/upload",
        data={"piece_id": str(piece_id), "view_type": "Frontal"},
        files={"file": ("foto.jpg", _jpeg_bytes(), "image/jpeg")},
    )
    assert response.status_code == 403
    assert response.json()["code"] == "permission_denied"
    assert fake_storage == {}


def test_comodato_photo_inherits_no_publicar_restriction(
    seeded_api: SeededApi, fake_storage: dict[str, bytes]
) -> None:
    client = seeded_api.login_as("CATALOGUER")
    piece_id = _piece_id(seeded_api, TenureRegime.LOAN_FOR_USE)
    response = client.post(
        "/api/v1/media/upload",
        data={"piece_id": str(piece_id), "view_type": "Perfil"},
        files={"file": ("foto_perfil.jpg", _jpeg_bytes((30, 120, 30)), "image/jpeg")},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["usage_restriction"]["code"] == "NO_PUBLICAR"
    assert body["restriction_note"] is not None
    assert len(fake_storage) == 1
