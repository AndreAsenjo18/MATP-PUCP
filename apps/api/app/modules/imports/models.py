"""Import reconciliation pipeline tables (spec importacion-datos; RF-021, RF-022, RF-025..028)."""

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models_base import (
    Base,
    JsonType,
    SoftDeleteMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
    str_enum,
)


class ImportBatchStatus(enum.StrEnum):
    UPLOADED = "UPLOADED"
    FAILED_INGESTION = "FAILED_INGESTION"
    MAPPED = "MAPPED"
    VALIDATED = "VALIDATED"
    IN_PREVIEW = "IN_PREVIEW"
    APPROVED = "APPROVED"
    APPLIED = "APPLIED"
    FAILED_APPLY = "FAILED_APPLY"
    ABANDONED = "ABANDONED"
    REVERTED = "REVERTED"


class ImportBatchKind(enum.StrEnum):
    """What a batch loads (change importacion-fotos-a-catalogo, D1).

    ``SPREADSHEET``: an Excel with its rows and, optionally, photos for them. ``PHOTOS``: only
    photos, matched with pieces already in the catalogue; it has no mapping, rows nor validation.
    """

    SPREADSHEET = "SPREADSHEET"
    PHOTOS = "PHOTOS"


class RowClassification(enum.StrEnum):
    NEW = "NEW"
    UPDATE = "UPDATE"
    POSSIBLE_DUPLICATE = "POSSIBLE_DUPLICATE"
    CONFLICT = "CONFLICT"


class RowDecision(enum.StrEnum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    EXCLUDED = "EXCLUDED"
    REJECTED = "REJECTED"


class ImportMappingTemplate(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "import_mapping_template"

    name: Mapped[str] = mapped_column(String(200))
    source_name: Mapped[str] = mapped_column(String(200))
    # Normalized, sorted header list used to suggest the template for a new file.
    header_signature: Mapped[str] = mapped_column(String(64), index=True)
    # {source column: {"target": field | "identifier:<TYPE>" | "payload", "transform": ...}}
    mapping: Mapped[dict[str, Any]] = mapped_column(JsonType)
    description: Mapped[str | None] = mapped_column(Text)


class ImportBatch(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "import_batch"

    source_name: Mapped[str] = mapped_column(String(200))
    kind: Mapped[ImportBatchKind] = mapped_column(
        str_enum(ImportBatchKind, "import_batch_kind"),
        default=ImportBatchKind.SPREADSHEET,
        server_default=ImportBatchKind.SPREADSHEET.value,
    )
    # Workbook name, or the name the user gives to a ``PHOTOS`` batch.
    file_name: Mapped[str] = mapped_column(String(300))
    file_storage_key: Mapped[str | None] = mapped_column(String(500))
    file_sha256: Mapped[str | None] = mapped_column(String(64))
    template_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("import_mapping_template.id"))
    status: Mapped[ImportBatchStatus] = mapped_column(
        str_enum(ImportBatchStatus, "import_batch_status"), default=ImportBatchStatus.UPLOADED
    )
    status_reason: Mapped[str | None] = mapped_column(Text)
    uploaded_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    approved_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    approved_at: Mapped[datetime | None] = mapped_column()
    # {stage: ISO timestamp} and {classification: count} for the load log (RF-028).
    stage_timestamps: Mapped[dict[str, Any] | None] = mapped_column(JsonType)
    counts: Mapped[dict[str, Any] | None] = mapped_column(JsonType)
    # Sheet and header row chosen at ingestion (RF-021).
    sheet_name: Mapped[str | None] = mapped_column(String(200))
    header_row: Mapped[int | None] = mapped_column()
    # Background stage in progress and its heartbeat: a stale heartbeat means the process died.
    processing_started_at: Mapped[datetime | None] = mapped_column()
    heartbeat_at: Mapped[datetime | None] = mapped_column()
    # Column mapping confirmed with ``PUT /imports/{batch_id}/mapping`` (design D3).
    mapping: Mapped[dict[str, Any] | None] = mapped_column(JsonType)
    # Change set of the application: every catalog change of the batch shares it (design D6, D7).
    change_set_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    # How the file names of a ``PHOTOS`` batch are read (importacion-fotos-a-catalogo, D4, D7):
    # ``{"default": rule, "folders": {path: rule}, "correspondences": [...]}``.
    photo_reading: Mapped[dict[str, Any] | None] = mapped_column(JsonType)


class ImportRow(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "import_row"

    batch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("import_batch.id"), index=True)
    source_row_number: Mapped[int] = mapped_column()
    raw_data: Mapped[dict[str, Any]] = mapped_column(JsonType)
    mapped_data: Mapped[dict[str, Any] | None] = mapped_column(JsonType)
    classification: Mapped[RowClassification | None] = mapped_column(
        str_enum(RowClassification, "row_classification")
    )
    has_validation_errors: Mapped[bool] = mapped_column(Boolean, default=False)
    validation_errors: Mapped[list[Any] | None] = mapped_column(JsonType)
    # Matches per identifier and contradictions (RF-024).
    matches: Mapped[list[Any] | None] = mapped_column(JsonType)
    # Field-level diff for updates, including excluded fields (RF-026).
    diff: Mapped[dict[str, Any] | None] = mapped_column(JsonType)
    decision: Mapped[RowDecision] = mapped_column(
        str_enum(RowDecision, "row_decision"), default=RowDecision.PENDING
    )
    decision_reason: Mapped[str | None] = mapped_column(Text)
    target_piece_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("piece.id"))
    # Human resolution of the row (design D5): ``{target_piece_id | as_new, field_decisions,
    # decided_by_id, decided_at}``. Kept apart from the classification, which stays as computed.
    resolution: Mapped[dict[str, Any] | None] = mapped_column(JsonType)

    __table_args__ = (
        UniqueConstraint("batch_id", "source_row_number"),
        Index("ix_import_row_batch_classification", "batch_id", "classification"),
    )


class ImportImageStatus(enum.StrEnum):
    PENDING = "PENDING"
    ASSOCIATED = "ASSOCIATED"


class ImportImage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Image embedded in an imported workbook, waiting for explicit association (RF-029; D8)."""

    __tablename__ = "import_image"

    batch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("import_batch.id"), index=True)
    image_number: Mapped[int] = mapped_column()
    storage_key: Mapped[str] = mapped_column(String(500))
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column()
    content_sha256: Mapped[str] = mapped_column(String(64))
    # Spreadsheet row (1-based) where the image is anchored, and the batch row with that number.
    anchor_row_number: Mapped[int | None] = mapped_column()
    import_row_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("import_row.id"))
    status: Mapped[ImportImageStatus] = mapped_column(
        str_enum(ImportImageStatus, "import_image_status"), default=ImportImageStatus.PENDING
    )
    media_asset_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("media_asset.id"))

    __table_args__ = (UniqueConstraint("batch_id", "image_number"),)


class ImportPhotoStatus(enum.StrEnum):
    """Lifecycle of a photo added to a batch (change importacion-masiva-fotografias, D1, D2)."""

    PENDING_UPLOAD = "PENDING_UPLOAD"
    UPLOADED = "UPLOADED"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"
    DISCARDED = "DISCARDED"
    APPLIED = "APPLIED"


class PhotoMatchStatus(enum.StrEnum):
    """Proposed row of a photo (D3): never applied to the catalogue without batch approval."""

    MATCHED = "MATCHED"
    AMBIGUOUS = "AMBIGUOUS"
    UNMATCHED = "UNMATCHED"
    MANUAL = "MANUAL"


class PhotoMatchSource(enum.StrEnum):
    """Path that proposed the row (D3): file name, folder, mapped column, person or workbook."""

    FILENAME = "FILENAME"
    FOLDER = "FOLDER"
    COLUMN = "COLUMN"
    MANUAL = "MANUAL"
    EMBEDDED = "EMBEDDED"
    # ``PHOTOS`` batches (importacion-fotos-a-catalogo, D3, D4, D7): a folder template or a list.
    TEMPLATE = "TEMPLATE"
    LIST = "LIST"


class ImportPhoto(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Photo of an import batch (RF-045; change importacion-masiva-fotografias, D1).

    Intermediate data of the batch, like ``import_row``: it is not catalogue information until the
    batch is applied, when it becomes a ``media_asset``. The unique ``(batch_id, content_sha256)``
    lets an interrupted upload resume without registering the same photo twice.
    """

    __tablename__ = "import_photo"

    batch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("import_batch.id"))
    # Folder and file name as the browser sent them (``MMZ 045/DSC_0001.jpg``).
    relative_path: Mapped[str] = mapped_column(String(1000))
    original_filename: Mapped[str] = mapped_column(String(300))
    content_sha256: Mapped[str] = mapped_column(String(64))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    content_type: Mapped[str] = mapped_column(String(100))
    # Final object prefix from the start (``media/<photo_id>/``): applying copies no object (D2).
    storage_prefix: Mapped[str] = mapped_column(String(500))
    status: Mapped[ImportPhotoStatus] = mapped_column(
        str_enum(ImportPhotoStatus, "import_photo_status"),
        default=ImportPhotoStatus.PENDING_UPLOAD,
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    # Proposed (or manually assigned) row of the batch and how it was found (D3, D4).
    row_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("import_row.id"))
    match_status: Mapped[PhotoMatchStatus | None] = mapped_column(
        str_enum(PhotoMatchStatus, "photo_match_status")
    )
    match_source: Mapped[PhotoMatchSource | None] = mapped_column(
        str_enum(PhotoMatchSource, "photo_match_source")
    )
    # Rows a photo matched when it is ambiguous; it is never assigned to any of them by guessing.
    candidate_row_ids: Mapped[list[Any] | None] = mapped_column(JsonType)
    # Order of the photos of a row: natural order of their names (D3).
    sort_key: Mapped[int | None] = mapped_column()
    # Same fingerprint already registered on the piece that an update row targets (D4).
    duplicate_of_existing: Mapped[bool] = mapped_column(Boolean, default=False)
    duplicate_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    media_asset_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("media_asset.id"))
    # ``PHOTOS`` batches (importacion-fotos-a-catalogo, D2): proposed or assigned piece, the
    # candidates of an ambiguous photo and why the match is not plain (``discrepant_codes``…).
    piece_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("piece.id"))
    candidate_piece_ids: Mapped[list[Any] | None] = mapped_column(JsonType)
    match_reason: Mapped[str | None] = mapped_column(String(60))
    # Size and 64-bit dHash (hex) to find the same photo in another resolution (D6).
    width_px: Mapped[int | None] = mapped_column()
    height_px: Mapped[int | None] = mapped_column()
    perceptual_hash: Mapped[str | None] = mapped_column(String(16))
    # Photo kept when this one was discarded as a lower resolution version of it (D6).
    same_as_photo_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("import_photo.id"))

    __table_args__ = (
        UniqueConstraint("batch_id", "content_sha256"),
        # A photo goes to a row of its batch or to a piece of the catalogue, never both (D2).
        CheckConstraint("row_id IS NULL OR piece_id IS NULL", name="row_or_piece"),
    )
