"""CSRF protection by double submit (ADR-009, decision D4; RNF-013).

A browser attaches the ``matp_session`` cookie to *any* request to this site, including one a
malicious page triggers, so on its own the cookie cannot tell a deliberate edit from a forged
one. Every write made with that cookie must therefore also carry the ``X-CSRF-Token`` header,
which a page on another origin cannot read (same-origin policy) nor set (CORS preflight).

The header must equal the ``matp_csrf`` cookie *and* the token derived from this session's
cookie (``sessions.csrf_token_for``), compared in constant time. ``SameSite=Lax`` on the cookies
is the second barrier.

It is an ASGI middleware rather than a dependency so that it rejects the request before the
body is read (an upload) and before routing, and it only looks at requests that are
authenticated by cookie: a call without ``matp_session`` carries no ambient credential to abuse.
"""

import json

from starlette.requests import Request
from starlette.types import ASGIApp, Receive, Scope, Send

from app.modules.users.sessions import CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE, csrf_matches

UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
PROTECTED_PREFIX = "/api/v1/"
# Login has no session yet; a stale cookie left in the browser must not block signing in again.
EXEMPT_PATHS = frozenset({"/api/v1/auth/login"})

CSRF_FAILED_MESSAGE = (
    "No se pudo verificar el origen de la petición. Recargue la página e inicie sesión de nuevo."
)


class CsrfMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not self._must_check(scope):
            await self.app(scope, receive, send)
            return
        request = Request(scope)
        session_token = request.cookies.get(SESSION_COOKIE)
        if not session_token or self._valid(request, session_token):
            await self.app(scope, receive, send)
            return
        await self._reject(send)

    @staticmethod
    def _must_check(scope: Scope) -> bool:
        path = scope["path"]
        return (
            scope["method"] in UNSAFE_METHODS
            and path.startswith(PROTECTED_PREFIX)
            and path not in EXEMPT_PATHS
        )

    @staticmethod
    def _valid(request: Request, session_token: str) -> bool:
        submitted = request.headers.get(CSRF_HEADER)
        cookie = request.cookies.get(CSRF_COOKIE)
        return csrf_matches(session_token, submitted) and csrf_matches(session_token, cookie)

    @staticmethod
    async def _reject(send: Send) -> None:
        body = json.dumps(
            {"code": "csrf_failed", "message": CSRF_FAILED_MESSAGE, "details": {}},
            ensure_ascii=False,
        ).encode("utf-8")
        await send(
            {
                "type": "http.response.start",
                "status": 403,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode("ascii")),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})
