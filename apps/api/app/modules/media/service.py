"""Media service: verification, derivatives, and registration helpers (spec multimedia)."""

import hashlib
import io
import uuid
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from botocore.exceptions import BotoCoreError, ClientError
from PIL import Image, UnidentifiedImageError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.errors import ValidationFailed
from app.core.models_base import new_uuid
from app.core.storage import ObjectStorage
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.audit.tracking import INCLUDE_DELETED
from app.modules.catalog.enums import TenureRegime
from app.modules.collections.models import Term, Vocabulary, VocabularyCode
from app.modules.media.models import MediaAsset

if TYPE_CHECKING:
    from app.modules.catalog.models import Piece
    from app.modules.imports.models import ImportPhoto

#: View of the photos imported with a batch until a person sets it (importacion-masiva-fotografias,
#: D5). Outside the team's contract, like SUPERIOR.
UNSPECIFIED_VIEW_TYPE = "SIN_ESPECIFICAR"
UNSPECIFIED_VIEW_LABEL = "Sin especificar"
UNSPECIFIED_VIEW_CREATOR = "importación de fotografías"
LOAN_RESTRICTION_NOTE = "Restricción contractual del comodato (RN-008)"


@dataclass(frozen=True)
class VerifiedImage:
    """Result of image verification."""

    sha256: str
    width: int
    height: int
    content_type: str


# Allowed formats and their MIME types
ALLOWED_FORMATS = {"JPEG", "PNG", "TIFF"}
MIME_BY_FORMAT = {"JPEG": "image/jpeg", "PNG": "image/png", "TIFF": "image/tiff"}
EXTENSION_BY_FORMAT = {"JPEG": "jpg", "PNG": "png", "TIFF": "tiff"}


def verify_image(data: bytes) -> VerifiedImage:
    """Validate image with Pillow, compute SHA-256, dimensions, and detected MIME.

    Raises ValidationFailed if data is not a valid allowed image or SHA-256
    doesn't match the provided expected_sha256 (if given).
    """
    if not data:
        raise ValidationFailed("El archivo está vacío.", details={"field": "file"})

    try:
        image = Image.open(io.BytesIO(data))
        image.load()  # Force load to verify integrity
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError) as exc:
        raise ValidationFailed(
            "El archivo no es una imagen válida (JPEG, PNG o TIFF).",
            code="invalid_image",
            details={"field": "file"},
        ) from exc

    if image.format not in ALLOWED_FORMATS:
        raise ValidationFailed(
            f"Formato {image.format} no admitido. Valores admitidos: JPEG, PNG, TIFF.",
            code="unsupported_image_format",
            details={"field": "file", "format": str(image.format)},
        )

    assert image.format is not None
    width, height = image.size
    return VerifiedImage(
        sha256=hashlib.sha256(data).hexdigest(),
        width=width,
        height=height,
        content_type=MIME_BY_FORMAT[image.format],
    )


def verify_image_stream(
    storage: ObjectStorage,
    key: str,
    expected_sha256: str | None = None,
    chunk_size: int = 8192,
) -> tuple[str, int, int, str]:
    """Stream object from storage, verify with Pillow, compute SHA-256.

    Returns (sha256, width, height, content_type).
    Raises ValidationFailed if object missing, not an allowed image,
    or SHA-256 doesn't match expected_sha256.
    """
    # HEAD first to check existence
    try:
        storage.head(key)
    except FileNotFoundError as err:
        raise ValidationFailed(
            "El archivo no existe en el almacenamiento.", code="object_not_found"
        ) from err

    # Stream download and verify
    hasher = hashlib.sha256()
    data_chunks: list[bytes] = []

    for chunk in storage.stream(key):
        hasher.update(chunk)
        data_chunks.append(chunk)

    data = b"".join(data_chunks)
    sha256 = hasher.hexdigest()

    if expected_sha256 and sha256 != expected_sha256:
        raise ValidationFailed(
            "La huella SHA-256 no coincide con la declarada.",
            code="sha256_mismatch",
            details={"expected": expected_sha256, "actual": sha256},
        )

    verified = verify_image(data)
    return verified.sha256, verified.width, verified.height, verified.content_type


def comodato_restriction_term_id(session: Session) -> uuid.UUID:
    """Restricción de imágenes en comodato (RN-008): hereda `NO_PUBLICAR`."""
    term = session.scalar(
        select(Term)
        .join(Vocabulary)
        .where(
            Vocabulary.code == VocabularyCode.USAGE_RESTRICTION,
            Term.code == "NO_PUBLICAR",
        )
    )
    if term is None:
        raise ValidationFailed(
            "Falta el vocabulario de restricciones de uso.",
            code="usage_restriction_missing",
        )
    return term.id


def unspecified_view_type_id(session: Session) -> uuid.UUID | None:
    """The «sin especificar» term of ``PHOTO_VIEW_TYPE``, created once where the seed predates it.

    Environments seeded before importacion-masiva-fotografias lack the term (task 5.1). It is
    created with a system audit context and a change set of its own, so reverting the batch that
    needed it never removes it. A term deleted logically is a decision of an administrator and is
    respected: the photos then stay without a view type (``None``). Call it before the batch
    writes anything, so its flush carries only the term.
    """
    vocabulary = session.scalar(
        select(Vocabulary).where(Vocabulary.code == VocabularyCode.PHOTO_VIEW_TYPE)
    )
    if vocabulary is None:
        return None
    term = session.scalar(
        select(Term)
        .where(Term.vocabulary_id == vocabulary.id, Term.code == UNSPECIFIED_VIEW_TYPE)
        .execution_options(**{INCLUDE_DELETED: True})
    )
    if term is not None:
        return None if term.deleted_at is not None else term.id
    last = session.scalar(
        select(func.max(Term.sort_order))
        .where(Term.vocabulary_id == vocabulary.id)
        .execution_options(**{INCLUDE_DELETED: True})
    )
    # Imported here: vocabulary_service imports media.models, which loads this module.
    from app.modules.collections.vocabulary_service import create_term

    context = AuditContext(
        origin=AuditOrigin.SYSTEM, actor_label=UNSPECIFIED_VIEW_CREATOR, change_set_id=new_uuid()
    )
    with audit_context(session, context):
        term = create_term(
            session,
            vocabulary,
            code=UNSPECIFIED_VIEW_TYPE,
            label=UNSPECIFIED_VIEW_LABEL,
            sort_order=(last or 0) + 1,
        )
    return term.id


@dataclass(frozen=True)
class StoredCopy:
    """The file a photo keeps when its original is not kept (``display.webp``, D6)."""

    storage_key: str
    content_type: str
    size_bytes: int
    content_sha256: str


def register_from_import(
    session: Session,
    piece: "Piece",
    photo: "ImportPhoto",
    *,
    storage_key: str,
    view_type_term_id: uuid.UUID | None,
    display: StoredCopy | None = None,
) -> MediaAsset:
    """Register a photo of an applied import batch on ``piece`` (importacion-masiva-fotografias,
    task 5.1; design D5).

    The photo was verified when it was uploaded (task 2.2), so nothing is read or copied again:
    the asset points to the object at ``storage_key`` and its derivatives sit next to it. It
    follows the last photo of the piece and becomes the primary one when the piece has none, so
    in a new piece the photo with the lowest ``sort_key`` is the primary one when the caller
    registers them in that order. A loan for use inherits «No publicar» (RN-008), as in a manual
    upload. The caller's audit context (the batch and its change set) records the asset.

    With ``display`` (``MEDIA_KEEP_ORIGINALS=false``, design D6) the asset points to the display
    copy and describes it; the size and fingerprint of the original received stay in
    ``extra_metadata.original``.
    """
    max_order = session.scalar(
        select(func.max(MediaAsset.sort_order)).where(MediaAsset.piece_id == piece.id)
    )
    restricted = piece.tenure_regime == TenureRegime.LOAN_FOR_USE
    metadata: dict[str, Any] = {
        "import_batch_id": str(photo.batch_id),
        "import_photo_id": str(photo.id),
        "relative_path": photo.relative_path,
    }
    if display is not None:
        metadata["original"] = {
            "content_type": photo.content_type,
            "size_bytes": photo.size_bytes,
            "content_sha256": photo.content_sha256,
        }
    stored = display or StoredCopy(
        storage_key, photo.content_type, photo.size_bytes, photo.content_sha256
    )
    asset = MediaAsset(
        id=new_uuid(),
        piece_id=piece.id,
        storage_key=stored.storage_key,
        original_filename=photo.original_filename,
        content_type=stored.content_type,
        size_bytes=stored.size_bytes,
        content_sha256=stored.content_sha256,
        view_type_term_id=view_type_term_id,
        sort_order=(max_order + 1) if max_order is not None else 0,
        is_primary=max_order is None,
        usage_restriction_term_id=comodato_restriction_term_id(session) if restricted else None,
        restriction_note=LOAN_RESTRICTION_NOTE if restricted else None,
        extra_metadata=metadata,
    )
    session.add(asset)
    session.flush()
    return asset


#: Object names whose derivatives (thumb.webp, display.webp) sit in the same folder: a manual
#: upload (``original.<ext>``), an imported photo (``upload.<ext>``) or one whose original was not
#: kept (``display.webp``, task 5.4).
DERIVED_OBJECTS = frozenset({"original", "upload", "display"})


def gallery_urls(
    storage: ObjectStorage, asset: MediaAsset, ttl_seconds: int
) -> tuple[str | None, str | None]:
    """Signed thumbnail and display copy of ``asset``, to see it inside the system (task 3.2).

    An asset without derivatives (the synthetic photos of the seed, or derivatives that failed)
    is shown from its own object. Viewing inside the system is internal use: the restriction of
    a loan for use only blocks external downloads, which go through ``download-url`` (task 2.5).
    """
    folder, _, name = asset.storage_key.rpartition("/")
    derived = (
        name.split(".", 1)[0] in DERIVED_OBJECTS
        and (asset.extra_metadata or {}).get("derivatives") != "failed"
    )
    thumb, display = (
        (f"{folder}/thumb.webp", f"{folder}/display.webp")
        if derived
        else (asset.storage_key, asset.storage_key)
    )
    try:
        return storage.presign_get(thumb, ttl_seconds), storage.presign_get(display, ttl_seconds)
    except (BotoCoreError, ClientError):  # a convenience: the photo stays listed without them
        return None, None
