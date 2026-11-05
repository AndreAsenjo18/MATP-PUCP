"""Record of unmasked sensitive data served to a user (ADR-009, decision D6; RNF-014, RF-041).

The record says *who* received *which fields* of *which entities*, never the values, so the log
cannot become a second copy of the personal data it watches. It is written after the response
has gone out, in a session of its own (``BackgroundTasks``), so it neither slows the request
nor fails it; a failure to write it is logged and swallowed on purpose.
"""

import logging
import uuid
from collections.abc import Callable, Sequence

from sqlalchemy.orm import Session

from app.api.enums import LOCATION_LEVEL_LABELS
from app.core.models_base import new_uuid
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.users.models import SensitiveAccessLog
from app.modules.users.sensitive import PUBLIC_LOCATION_LEVELS

logger = logging.getLogger("matp.api")

PUBLIC_LEVEL_LABELS = frozenset(LOCATION_LEVEL_LABELS[level] for level in PUBLIC_LOCATION_LEVELS)
MAX_ENTITY_IDS = 100  # design D6: a wider response is recorded truncated


def delivered_piece_fields(detail: object) -> list[str]:
    """Sensitive fields of a piece sheet that went out with a value (not masked, not empty)."""
    fields = [name for name in ("lender_name", "loan_agreement_ref") if getattr(detail, name, None)]
    location = getattr(detail, "location", None)
    if location is not None and any(
        node.level not in PUBLIC_LEVEL_LABELS for node in getattr(location, "path", [])
    ):
        fields.append("location.path")  # levels below space only come with the permission
    return fields


def record_sensitive_access(
    session_factory: Callable[[], Session],
    *,
    user_id: uuid.UUID,
    route: str,
    entity_type: str,
    entity_ids: Sequence[uuid.UUID],
    fields: Sequence[str],
) -> None:
    """Append one row for the request; no-op when nothing sensitive was delivered."""
    if not fields or not entity_ids:
        return
    try:
        with session_factory() as db:
            context = AuditContext(
                origin=AuditOrigin.MANUAL, user_id=user_id, reason="Acceso a datos sensibles"
            )
            with audit_context(db, context):
                db.add(
                    SensitiveAccessLog(
                        id=new_uuid(),
                        user_id=user_id,
                        route=route[:200],
                        entity_type=entity_type,
                        entity_ids=[str(i) for i in entity_ids[:MAX_ENTITY_IDS]],
                        fields=sorted(set(fields)),
                    )
                )
                db.commit()
    except Exception:
        logger.exception("No se pudo registrar el acceso a datos sensibles")
