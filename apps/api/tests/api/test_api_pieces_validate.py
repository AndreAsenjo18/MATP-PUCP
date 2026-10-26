"""POST /pieces/validate: the rules of the sheet without saving (ficha-pieza-crud 2.3; RF-043).

Spec catalogo-piezas, «Validación previa sin persistencia»; design D1. The seeded database is
shared, so every test checks that nothing was written. Synthetic data only (RNF-014).
"""

from typing import Any

from sqlalchemy import func, select

from app.modules.audit.models import AuditLog
from app.modules.catalog.models import Piece
from app.modules.identification.models import PieceIdentifier
from tests.api.conftest import SeededApi


def _counts(seeded_api: SeededApi) -> tuple[int, int]:
    with seeded_api.session() as session:
        pieces = session.scalar(select(func.count()).select_from(Piece))
        audit = session.scalar(select(func.count()).select_from(AuditLog))
    return pieces or 0, audit or 0


def _seeded_code_i(seeded_api: SeededApi) -> tuple[str, str]:
    """The current code I of a seeded piece and that piece."""
    with seeded_api.session() as session:
        identifier = session.scalars(
            select(PieceIdentifier).where(
                PieceIdentifier.identifier_type_code == "I", PieceIdentifier.is_current.is_(True)
            )
        ).first()
        assert identifier is not None
        return identifier.normalized_value, str(identifier.piece_id)


def _validate(seeded_api: SeededApi, body: dict[str, Any], **params: str) -> Any:
    client = seeded_api.login_as("CATALOGUER")  # signed in before counting: login is audited
    before = _counts(seeded_api)
    response = client.post("/api/v1/pieces/validate", json=body, params=params)
    assert _counts(seeded_api) == before  # nothing written (D1)
    return response


def test_a_valid_sheet_has_no_issues_and_nothing_is_written(seeded_api: SeededApi) -> None:
    response = _validate(
        seeded_api,
        {"denomination": "Retablo por validar (sintético)", "tenure_regime": "Propiedad"},
    )

    assert response.status_code == 200, response.text
    assert response.json() == {"is_valid": True, "issues": []}


def test_a_repeated_code_i_is_an_error_that_blocks_saving(seeded_api: SeededApi) -> None:
    code_i, _piece_id = _seeded_code_i(seeded_api)
    response = _validate(
        seeded_api,
        {
            "denomination": "Pieza con código repetido",
            "tenure_regime": "Propiedad",
            "code_i": code_i,
        },
    )

    body = response.json()
    assert body["is_valid"] is False
    issue = next(item for item in body["issues"] if item["field"] == "code_i")
    assert (issue["code"], issue["severity"]) == ("duplicate_inventory_code", "error")


def test_a_warning_does_not_make_the_sheet_invalid(seeded_api: SeededApi) -> None:
    response = _validate(
        seeded_api,
        {
            "denomination": "Pieza sin código (sintética)",
            "tenure_regime": "Propiedad",
            "code_i": "S/N",
        },
    )

    body = response.json()
    assert body["is_valid"] is True
    assert body["issues"] and {item["severity"] for item in body["issues"]} == {"warning"}


def test_editing_a_piece_its_own_code_i_is_not_a_duplicate(seeded_api: SeededApi) -> None:
    code_i, piece_id = _seeded_code_i(seeded_api)

    response = _validate(
        seeded_api,
        {"denomination": "La misma pieza", "tenure_regime": "Propiedad", "code_i": code_i},
        piece_id=piece_id,
    )

    assert response.json()["is_valid"] is True


def test_an_internal_viewer_cannot_validate(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("INTERNAL_VIEWER")

    response = client.post(
        "/api/v1/pieces/validate", json={"denomination": "x", "tenure_regime": "Propiedad"}
    )

    assert response.status_code == 403
