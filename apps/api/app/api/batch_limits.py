"""Configurable size of the bulk operations (descargas-masivas-y-enriquecimiento-lote, task 1.2).

The limits live in the settings (``MEDIA_BULK_DOWNLOAD_MAX_PIECES``, ``AI_BATCH_ENRICH_MAX_PIECES``)
[SUPUESTO AA1], so the request schemas only require at least one piece and the route checks the
maximum. Same error as the batch of movements: ``batch_too_large`` with the limit and the count.
"""

from app.core.errors import ValidationFailed


def ensure_batch_size(received: int, limit: int, what: str) -> None:
    """Raise 422 ``batch_too_large`` when ``received`` pieces go beyond ``limit``."""
    if received > limit:
        raise ValidationFailed(
            f"{what} admite hasta {limit} piezas; se pidieron {received}.",
            code="batch_too_large",
            details={"limit": limit, "received": received},
        )
