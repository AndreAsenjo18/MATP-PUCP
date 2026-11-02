"""The performance test works with what the application really stores and accepts (RF-038).

The codes of the synthetic catalog are the ones the normalizer of the application gives, so the
load test finds them, and the load test signs in the way the reference environment requires.
Synthetic data only (RNF-014).
"""

from __future__ import annotations

import sys
import uuid
from pathlib import Path

import pytest
from sqlalchemy import select

try:
    import httpx
except ImportError:
    import httpx2 as httpx

from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.catalog.models import Piece
from app.modules.identification.models import NormalizationStatus, PieceIdentifier
from app.modules.identification.normalization import (
    TYPE_COLLECTION,
    TYPE_INVENTORY,
    normalize_for_type,
)
from app.modules.identification.params import session_params
from tests.api.conftest import Pipeline, create_user

repo_root = Path(__file__).resolve()
while not (repo_root / "scripts").is_dir() and repo_root.parent != repo_root:
    repo_root = repo_root.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from scripts.perf.generate_catalog import generate_catalog  # noqa: E402
from scripts.perf.search_load import run_load_test  # noqa: E402

COUNT = 60
CODE_IN_USE = "I-3"
PASSWORD = "contrasena-de-prueba-2026"


@pytest.fixture(scope="module")
def catalog(pipeline: Pipeline) -> dict[str, list[uuid.UUID] | uuid.UUID]:
    """The generated pieces, on a catalog where one of their numbers is already taken."""
    context = AuditContext(origin=AuditOrigin.SYSTEM, actor_label="tests")
    with pipeline.session() as session, audit_context(session, context):
        before = set(session.scalars(select(Piece.id)))
        owner = session.scalar(select(Piece).order_by(Piece.id).limit(1))
        assert owner is not None
        owner_id = owner.id
        session.add(
            PieceIdentifier(
                piece_id=owner_id,
                identifier_type_code=TYPE_INVENTORY,
                original_value=CODE_IN_USE,
                normalized_value=CODE_IN_USE,
                normalization_status=NormalizationStatus.NORMALIZED,
                is_current=True,
            )
        )
        session.commit()
    with pipeline.session() as session:
        assert generate_catalog(session, count=COUNT, batch_size=25) == COUNT
        created = set(session.scalars(select(Piece.id))) - before
    return {"created": sorted(created), "owner": owner_id}


def _identifiers(pipeline: Pipeline, created: list[uuid.UUID]) -> list[PieceIdentifier]:
    with pipeline.session() as session:
        rows = session.scalars(select(PieceIdentifier).where(PieceIdentifier.piece_id.in_(created)))
        return list(rows)


def test_every_generated_code_is_what_the_application_normalizes(
    pipeline: Pipeline, catalog: dict
) -> None:
    identifiers = _identifiers(pipeline, catalog["created"])
    types = {row.identifier_type_code for row in identifiers}
    assert types == {TYPE_INVENTORY, TYPE_COLLECTION}

    with pipeline.session() as session:
        params = session_params(session)
    for row in identifiers:
        expected = normalize_for_type(row.identifier_type_code, row.original_value, params=params)
        assert row.normalized_value == expected.normalized, row.original_value
        assert row.normalization_status == expected.status, row.original_value
        assert row.detected_format == expected.detected_format, row.original_value
        assert row.normalization_status == NormalizationStatus.NORMALIZED, row.original_value


def test_the_zeros_stay_in_the_original_value_and_not_in_the_normalized_one(
    pipeline: Pipeline, catalog: dict
) -> None:
    by_original = {row.original_value: row for row in _identifiers(pipeline, catalog["created"])}

    assert by_original["I-000007"].normalized_value == "I-7"
    assert by_original[f"I-{COUNT:06d}"].normalized_value == f"I-{COUNT}"


@pytest.mark.parametrize("query", ["I-000007", "I-7"])
def test_the_queries_of_the_load_test_find_the_generated_piece(
    pipeline: Pipeline, catalog: dict, query: str
) -> None:
    response = pipeline.login("ADMIN").get("/api/v1/search", params={"q": query, "limit": 100})

    assert response.status_code == 200, response.text
    found = {uuid.UUID(hit["piece"]["id"]) for hit in response.json()["items"]}
    assert found & set(catalog["created"]), query


def test_a_code_already_in_use_stays_with_its_piece(pipeline: Pipeline, catalog: dict) -> None:
    with pipeline.session() as session:
        holders = session.scalars(
            select(PieceIdentifier.piece_id).where(
                PieceIdentifier.identifier_type_code == TYPE_INVENTORY,
                PieceIdentifier.normalized_value == CODE_IN_USE,
                PieceIdentifier.is_current.is_(True),
            )
        ).all()

    assert holders == [catalog["owner"]]
    inventory = [
        row
        for row in _identifiers(pipeline, catalog["created"])
        if row.identifier_type_code == TYPE_INVENTORY
    ]
    assert len(inventory) == COUNT - 1


@pytest.mark.anyio
async def test_the_load_test_signs_in_with_a_real_session(pipeline: Pipeline) -> None:
    """The identity header only exists under APP_ENV=test, so it must not be what authorizes."""
    email = f"carga-{uuid.uuid4().hex[:8]}@matp.local"
    create_user(pipeline.engine, email, role="CATALOGUER", password=PASSWORD)
    base_url = "https://testserver"
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=pipeline.client.app), base_url=base_url
    ) as client:
        results = await run_load_test(
            base_url=base_url,
            concurrency=1,
            duration_seconds=0.5,
            auth_header=email,
            client=client,
            password=PASSWORD,
        )
        sent_header = "X-MATP-User" in client.headers

    assert not sent_header
    assert results["successful_requests"] > 0
    assert results["error_requests"] == 0


@pytest.mark.anyio
async def test_the_load_test_stops_if_it_cannot_sign_in(pipeline: Pipeline) -> None:
    base_url = "https://testserver"
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=pipeline.client.app), base_url=base_url
    ) as client:
        with pytest.raises(RuntimeError, match="No se pudo iniciar sesión"):
            await run_load_test(
                base_url=base_url,
                concurrency=1,
                duration_seconds=0.5,
                auth_header="nadie@matp.local",
                client=client,
                password="no-es-esta",
            )
