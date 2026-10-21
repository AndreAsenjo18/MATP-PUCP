"""Media service: verification, derivatives, and registration helpers (spec multimedia)."""

import hashlib
import io
import uuid
from dataclasses import dataclass

from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.errors import ValidationFailed
from app.core.storage import ObjectStorage
from app.modules.collections.models import Term, Vocabulary, VocabularyCode


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
