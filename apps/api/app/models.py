"""Model registry: importing this module registers every table in ``Base.metadata``.

Alembic (``alembic/env.py``), the seed and the tests import it.
"""

from app.core.models_base import Base
from app.modules.ai_suggestions.models import AiSuggestion
from app.modules.audit.models import AuditLog
from app.modules.catalog.models import (
    ConservationAssessment,
    Piece,
    PieceMaterial,
    PieceSourceRecord,
)
from app.modules.collections.models import Collection, Term, Vocabulary
from app.modules.identification.models import IdentifierType, PieceIdentifier
from app.modules.imports.models import ImportBatch, ImportMappingTemplate, ImportRow
from app.modules.locations.models import Location, PieceMovement
from app.modules.media.models import MediaAsset
from app.modules.quality.models import DuplicateCandidate
from app.modules.users.models import AppUser, Permission, Role, RolePermission, UserRole

__all__ = [
    "AiSuggestion",
    "AppUser",
    "AuditLog",
    "Base",
    "Collection",
    "ConservationAssessment",
    "DuplicateCandidate",
    "IdentifierType",
    "ImportBatch",
    "ImportMappingTemplate",
    "ImportRow",
    "Location",
    "MediaAsset",
    "Permission",
    "Piece",
    "PieceIdentifier",
    "PieceMaterial",
    "PieceMovement",
    "PieceSourceRecord",
    "Role",
    "RolePermission",
    "Term",
    "UserRole",
    "Vocabulary",
]
