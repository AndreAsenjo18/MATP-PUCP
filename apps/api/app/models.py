"""Model registry: importing this module registers every table in ``Base.metadata``.

Alembic (``alembic/env.py``), the seed and the tests import it.
"""

from app.core.models_base import Base
from app.modules.ai_suggestions.models import AiSuggestion
from app.modules.audit.models import AuditDigest, AuditLog
from app.modules.catalog.models import (
    ConservationAssessment,
    Piece,
    PieceMaterial,
    PieceSourceRecord,
)
from app.modules.collections.models import Collection, Term, Vocabulary
from app.modules.identification.models import (
    CollectionAcronymAlias,
    IdentifierType,
    NormalizationSetting,
    PieceIdentifier,
)
from app.modules.imports.models import ImportBatch, ImportImage, ImportMappingTemplate, ImportRow
from app.modules.locations.models import Loan, LoanItem, Location, PieceMovement
from app.modules.media.models import MediaAsset
from app.modules.quality.models import (
    DuplicateCandidate,
    QualityJob,
    QualityJobItem,
    QualitySetting,
)
from app.modules.reports.models import PieceValuation
from app.modules.search.models import ExportJobModel
from app.modules.users.models import (
    AppUser,
    AuthEvent,
    Permission,
    Role,
    RolePermission,
    SensitiveAccessLog,
    UserRole,
    UserSession,
)

__all__ = [
    "AiSuggestion",
    "AppUser",
    "AuditDigest",
    "AuditLog",
    "AuthEvent",
    "Base",
    "Collection",
    "CollectionAcronymAlias",
    "ConservationAssessment",
    "DuplicateCandidate",
    "ExportJobModel",
    "IdentifierType",
    "ImportBatch",
    "ImportImage",
    "ImportMappingTemplate",
    "ImportRow",
    "Loan",
    "LoanItem",
    "Location",
    "MediaAsset",
    "NormalizationSetting",
    "Permission",
    "Piece",
    "PieceIdentifier",
    "PieceMaterial",
    "PieceMovement",
    "PieceSourceRecord",
    "PieceValuation",
    "QualityJob",
    "QualityJobItem",
    "QualitySetting",
    "Role",
    "RolePermission",
    "SensitiveAccessLog",
    "Term",
    "UserRole",
    "UserSession",
    "Vocabulary",
]
