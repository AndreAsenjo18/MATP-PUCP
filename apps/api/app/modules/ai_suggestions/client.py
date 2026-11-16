"""Internal client for the AI service mounted at AI_MOUNT_PATH (ADR-008; RNF-008).

The AI service runs inside this same process (``mount_ai_app`` in ``app/main.py``), so the
call is an in-process ASGI request, not a real network hop — no extra latency, no credentials
to manage here. It still goes through HTTP semantics (timeout, status codes) so the service can
be split out to run separately later without changing this client's contract.
"""

from typing import Any

import httpx2 as httpx
from fastapi import FastAPI
from starlette.routing import Mount
from starlette.testclient import TestClient

from app.core.errors import ServiceUnavailable


def _mounted_app(app: FastAPI, mount_path: str) -> Any:
    for route in app.routes:
        if isinstance(route, Mount) and route.path == mount_path:
            return route.app
    raise RuntimeError(f"El servicio de IA no está montado en {mount_path!r}.")


class AiServiceClient:
    def __init__(self, app: FastAPI, mount_path: str) -> None:
        # TestClient (not a plain ASGITransport) because this is a *sync* call into an async
        # ASGI app from inside a sync route handler — it bridges that, including the threadpool
        # FastAPI already runs sync handlers in. There is no real network hop to time out
        # (design D1's 20 s timeout applies once the service runs as a separate deployment).
        self._client = TestClient(_mounted_app(app, mount_path), base_url="http://ai.internal")

    def extract_structured(self, text: str, *, source_field: str | None = None) -> dict[str, Any]:
        """RIA-01. Raises ``ServiceUnavailable`` (503) on any failure; the catalog stays intact."""
        try:
            response = self._client.post(
                "/v1/extract-structured", json={"text": text, "source_field": source_field}
            )
        except httpx.HTTPError as exc:
            raise ServiceUnavailable(
                "El servicio de IA no respondió a tiempo. El catálogo no cambió.",
                code="ai_unavailable",
            ) from exc
        if response.status_code >= 400:
            raise ServiceUnavailable(
                "El servicio de IA no está disponible en este momento. El catálogo no cambió.",
                code="ai_unavailable",
                details={"upstream_status": response.status_code},
            )
        return response.json()

    def interpret_search(self, text: str, valid_values: dict[str, Any]) -> dict[str, Any]:
        """Change `busqueda-lenguaje-natural` (RIA-06). Degrada igual que las demás operaciones:
        ``ServiceUnavailable`` (503) nunca bloquea la búsqueda, la caja sigue sirviendo como texto
        libre normal."""
        try:
            response = self._client.post(
                "/v1/interpret-search", json={"text": text, "valid_values": valid_values}
            )
        except httpx.HTTPError as exc:
            raise ServiceUnavailable(
                "El servicio de IA no respondió a tiempo.", code="ai_unavailable"
            ) from exc
        if response.status_code >= 400:
            raise ServiceUnavailable(
                "El servicio de IA no está disponible en este momento.",
                code="ai_unavailable",
                details={"upstream_status": response.status_code},
            )
        return response.json()

    def suggest_column_mapping(
        self,
        headers: list[str],
        sample_rows: list[dict[str, Any]],
        target_fields: dict[str, str],
    ) -> dict[str, Any]:
        """Carga masiva con IA (change carga-masiva-con-ia). Degrada igual que
        ``extract_structured``: ``ServiceUnavailable`` (503) nunca bloquea la importación, el
        editor de columnas simplemente se muestra sin sugerencia."""
        try:
            response = self._client.post(
                "/v1/suggest-column-mapping",
                json={
                    "headers": headers,
                    "sample_rows": sample_rows,
                    "target_fields": target_fields,
                },
            )
        except httpx.HTTPError as exc:
            raise ServiceUnavailable(
                "El servicio de IA no respondió a tiempo. El catálogo no cambió.",
                code="ai_unavailable",
            ) from exc
        if response.status_code >= 400:
            raise ServiceUnavailable(
                "El servicio de IA no está disponible en este momento. El catálogo no cambió.",
                code="ai_unavailable",
                details={"upstream_status": response.status_code},
            )
        return response.json()

    def complete_piece(self, body: dict[str, Any]) -> dict[str, Any]:
        """«Completar ficha» (change ia-completar-ficha). Degrada igual que las demás: sin
        respuesta, ``ServiceUnavailable`` (503) y el panel sigue sin propuestas (D5)."""
        try:
            response = self._client.post("/v1/complete-piece", json=body)
        except httpx.HTTPError as exc:
            raise ServiceUnavailable(
                "El servicio de IA no respondió a tiempo. La ficha no cambió.",
                code="ai_unavailable",
            ) from exc
        if response.status_code >= 400:
            raise ServiceUnavailable(
                "El servicio de IA no está disponible en este momento. La ficha no cambió.",
                code="ai_unavailable",
                details={"upstream_status": response.status_code},
            )
        return response.json()

    def judge_duplicates(self, body: dict[str, Any]) -> dict[str, Any]:
        """RIA-02 (change ia-juicio-duplicados). Raises ``ServiceUnavailable`` (503) on any
        failure or timeout; the run records the batch as failed and goes on (D7)."""
        try:
            response = self._client.post("/v1/judge-duplicates", json=body)
        except httpx.HTTPError as exc:
            raise ServiceUnavailable(
                "El servicio de IA no respondió a tiempo. La cola no cambió.",
                code="ai_unavailable",
            ) from exc
        if response.status_code >= 400:
            raise ServiceUnavailable(
                "El servicio de IA no está disponible en este momento. La cola no cambió.",
                code="ai_unavailable",
                details={"upstream_status": response.status_code},
            )
        return response.json()
