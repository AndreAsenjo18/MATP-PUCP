"""Spec catalogo-piezas — tarea 4.1: POST/PUT/DELETE /pieces con los esquemas y el code_i
del contrato (`docs/fuentes/endpoints-api-v1.yaml`), y el rendimiento constante de
`GET /pieces` (D6)."""

from sqlalchemy import event

from tests.api.conftest import SeededApi


def _delete(seeded_api: SeededApi, piece_id: str, reason: str = "Limpieza de prueba") -> None:
    """Soft-delete a piece created by a test, so the active total returns to the baseline."""
    response = seeded_api.login_as("ADMIN").delete(
        f"/api/v1/pieces/{piece_id}", params={"reason": reason}
    )
    assert response.status_code == 204


def test_create_piece_with_code_i_is_reflected_in_detail(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("CATALOGUER")
    created = client.post(
        "/api/v1/pieces",
        json={
            "denomination": "Pieza de prueba con código I (sintética)",
            "tenure_regime": "Propiedad",
            "code_i": "I 09999",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["denomination"] == "Pieza de prueba con código I (sintética)"
    assert body["code_i"] == "I-9999"

    detail = client.get(f"/api/v1/pieces/{body['id']}").json()
    assert detail["code_i"] == "I-9999"
    _delete(seeded_api, body["id"])


def test_create_piece_comodato_with_code_i_is_rejected(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("CATALOGUER")
    response = client.post(
        "/api/v1/pieces",
        json={
            "denomination": "Pieza en comodato (sintética)",
            "tenure_regime": "Comodato",
            "code_i": "I-8888",
        },
    )
    assert response.status_code == 409  # RN-003: comodato nunca recibe código I
    assert response.json()["code"] == "identifier_not_allowed_for_tenure"


def test_create_piece_without_category_or_conservation_state_succeeds(
    seeded_api: SeededApi,
) -> None:
    """Supuesto B1: `category_id`/`conservation_state_id` son opcionales en `PieceCreate`."""
    client = seeded_api.login_as("CATALOGUER")
    created = client.post(
        "/api/v1/pieces",
        json={"denomination": "Pieza sin categoría (sintética)", "tenure_regime": "Propiedad"},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["category"] is None
    assert body["conservation_status"] is None
    _delete(seeded_api, body["id"])


def _create_throwaway_piece(seeded_api: SeededApi, denomination: str) -> str:
    client = seeded_api.login_as("CATALOGUER")
    created = client.post(
        "/api/v1/pieces",
        json={"denomination": denomination, "tenure_regime": "Propiedad"},
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


def test_put_changes_editable_fields(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("CATALOGUER")
    piece_id = _create_throwaway_piece(seeded_api, "Pieza editable (sintética)")
    response = client.put(
        f"/api/v1/pieces/{piece_id}",
        json={"denomination": "Pieza editada (sintética)", "notes": "Revisado en prueba"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["denomination"] == "Pieza editada (sintética)"
    assert body["notes"] == "Revisado en prueba"
    _delete(seeded_api, piece_id)


def test_put_changing_an_existing_code_i_is_rejected(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("CATALOGUER")
    piece_id = _create_throwaway_piece(seeded_api, "Pieza con código I fijo (sintética)")
    created = client.put(f"/api/v1/pieces/{piece_id}", json={"code_i": "I-7777"})
    assert created.status_code == 200, created.text
    assert created.json()["code_i"] == "I-7777"

    changed = client.put(f"/api/v1/pieces/{piece_id}", json={"code_i": "I-7778"})
    assert changed.status_code == 409  # RN-002: código I inmutable fuera de la corrección auditada
    _delete(seeded_api, piece_id)


def test_put_resending_the_same_code_i_is_idempotent(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("CATALOGUER")
    piece_id = _create_throwaway_piece(seeded_api, "Pieza idempotente (sintética)")
    client.put(f"/api/v1/pieces/{piece_id}", json={"code_i": "I 06543"})

    same = client.put(f"/api/v1/pieces/{piece_id}", json={"code_i": "I-06543"})
    assert same.status_code == 200, same.text
    assert same.json()["code_i"] == "I-6543"
    _delete(seeded_api, piece_id)


def test_delete_requires_reason_then_soft_deletes(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("CATALOGUER")
    admin = seeded_api.login_as("ADMIN")
    piece_id = _create_throwaway_piece(seeded_api, "Pieza a eliminar (sintética)")

    without_reason = admin.delete(f"/api/v1/pieces/{piece_id}")
    assert without_reason.status_code == 422

    with_reason = admin.delete(
        f"/api/v1/pieces/{piece_id}", params={"reason": "Registrada por error"}
    )
    assert with_reason.status_code == 204

    after = client.get(f"/api/v1/pieces/{piece_id}")
    assert after.status_code == 404


def test_get_pieces_query_count_is_constant_for_any_limit(seeded_api: SeededApi) -> None:
    """D6: el costo de `GET /pieces` no debe crecer con `limit` (code_i se resuelve en lote)."""
    client = seeded_api.login_as("CATALOGUER")
    # Límites que garanticen varias piezas (evita el caso límite de una sola pieza sin colección,
    # donde el lote de colecciones se salta por estar vacío y no por evitar N+1).
    counts: dict[int, int] = {}
    for limit in (10, 50, 100):
        statements: list[str] = []

        def _capture(
            conn, cursor, statement, parameters, context, executemany, _out=statements
        ) -> None:
            _out.append(statement)

        event.listen(seeded_api.engine, "before_cursor_execute", _capture)
        try:
            response = client.get(f"/api/v1/pieces?limit={limit}")
        finally:
            event.remove(seeded_api.engine, "before_cursor_execute", _capture)
        assert response.status_code == 200
        counts[limit] = len(statements)
    assert len(set(counts.values())) == 1, (
        f"El número de consultas SQL de GET /pieces varía con `limit`: {counts} (D6)."
    )
