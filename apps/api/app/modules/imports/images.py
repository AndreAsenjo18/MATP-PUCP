"""Images embedded in an imported workbook (spec importacion-datos: RF-029, RF-013; design D8).

Extraction reads the drawing of the chosen sheet straight from the ``.xlsx`` package
(``xl/drawings/*.xml`` and their relationships) instead of the private ``ws._images`` of
openpyxl, which ``read_only`` worksheets do not load. Each picture keeps the spreadsheet row
where its top-left corner is anchored; the image is proposed for the batch row with that number
or left in the unassigned tray.

Nothing is associated automatically: after the batch is applied, a person confirms each image
and it is registered as a photo of the piece with a reference to the batch.
"""

import hashlib
import io
import posixpath
import uuid
import zipfile
from dataclasses import dataclass
from typing import Any
from xml.etree import ElementTree

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFound, ValidationFailed
from app.core.models_base import new_uuid
from app.core.storage import ObjectStorage
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.imports.ingest import _NS_PKG_REL, _NS_REL, _sheet_path
from app.modules.imports.models import (
    ImportBatch,
    ImportImage,
    ImportImageStatus,
    ImportRow,
)
from app.modules.imports.models import ImportBatchStatus as S
from app.modules.imports.state import STATUS_LABELS
from app.modules.media.models import MediaAsset
from app.modules.media.service import (
    EXTENSION_BY_FORMAT,
    comodato_restriction_term_id,
    verify_image,
)

_NS_XDR = "{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}"
_NS_A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
_ANCHORS = (f"{_NS_XDR}oneCellAnchor", f"{_NS_XDR}twoCellAnchor", f"{_NS_XDR}absoluteAnchor")
CONTENT_TYPES = {
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".bmp": "image/bmp",
    ".emf": "image/emf",
    ".wmf": "image/wmf",
}


@dataclass(frozen=True)
class ExtractedImage:
    number: int  # 1-based order in the drawing
    anchor_row: int | None  # spreadsheet row (1-based); ``None`` for absolute anchors
    extension: str
    content: bytes

    @property
    def content_type(self) -> str:
        return CONTENT_TYPES.get(self.extension, "application/octet-stream")


def _resolve(base: str, target: str) -> str:
    if target.startswith("/"):
        return target.lstrip("/")
    return posixpath.normpath(posixpath.join(posixpath.dirname(base), target))


def _rels_path(part: str) -> str:
    return posixpath.join(posixpath.dirname(part), "_rels", f"{posixpath.basename(part)}.rels")


def _relationships(package: zipfile.ZipFile, part: str) -> dict[str, str]:
    path = _rels_path(part)
    if path not in package.namelist():
        return {}
    rels = ElementTree.fromstring(package.read(path))
    return {
        rel.get("Id", ""): _resolve(part, rel.get("Target", ""))
        for rel in rels.iter(f"{_NS_PKG_REL}Relationship")
    }


def extract_images(content: bytes, sheet_name: str) -> list[ExtractedImage]:
    """Pictures of ``sheet_name`` in drawing order; an unreadable package yields none."""
    try:
        package = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile:
        return []
    with package:
        sheet = _sheet_path(package, sheet_name)
        if sheet is None:
            return []
        images: list[ExtractedImage] = []
        for drawing in _relationships(package, sheet).values():
            if "/drawings/" not in f"/{drawing}" or drawing not in package.namelist():
                continue
            media = _relationships(package, drawing)
            root = ElementTree.fromstring(package.read(drawing))
            for anchor in root:
                if anchor.tag not in _ANCHORS:
                    continue
                blip = anchor.find(f".//{_NS_A}blip")
                target = media.get(blip.get(f"{_NS_REL}embed", "")) if blip is not None else None
                if target is None or target not in package.namelist():
                    continue
                row = anchor.find(f"{_NS_XDR}from/{_NS_XDR}row")
                images.append(
                    ExtractedImage(
                        number=len(images) + 1,
                        anchor_row=int(row.text) + 1 if row is not None and row.text else None,
                        extension=posixpath.splitext(target)[1].lower(),
                        content=package.read(target),
                    )
                )
        return images


def image_key(batch_id: uuid.UUID, image: ExtractedImage) -> str:
    return f"imports/{batch_id}/images/{image.number}{image.extension}"


def store_images(
    session: Session, storage: ObjectStorage, batch: ImportBatch, content: bytes
) -> int:
    """Replace the extracted images of the batch (idempotent, like every stage)."""
    session.execute(delete(ImportImage).where(ImportImage.batch_id == batch.id))
    if batch.sheet_name is None or not batch.file_name.lower().endswith(".xlsx"):
        return 0
    rows = dict(
        session.execute(
            select(ImportRow.source_row_number, ImportRow.id).where(ImportRow.batch_id == batch.id)
        ).all()
    )
    extracted = extract_images(content, batch.sheet_name)
    for image in extracted:
        key = image_key(batch.id, image)
        storage.put_bytes(key, image.content, image.content_type)
        session.add(
            ImportImage(
                id=new_uuid(),
                batch_id=batch.id,
                image_number=image.number,
                storage_key=key,
                content_type=image.content_type,
                size_bytes=len(image.content),
                content_sha256=hashlib.sha256(image.content).hexdigest(),
                anchor_row_number=image.anchor_row,
                import_row_id=rows.get(image.anchor_row) if image.anchor_row else None,
                status=ImportImageStatus.PENDING,
            )
        )
    batch.counts = {**(batch.counts or {}), "images": len(extracted)}
    session.flush()
    return len(extracted)


def batch_images(session: Session, batch_id: uuid.UUID) -> list[ImportImage]:
    return list(
        session.scalars(
            select(ImportImage)
            .where(ImportImage.batch_id == batch_id)
            .order_by(ImportImage.image_number)
        )
    )


def associate_image(
    session: Session,
    storage: ObjectStorage,
    batch: ImportBatch,
    image_id: uuid.UUID,
    *,
    user_id: uuid.UUID,
    piece_id: uuid.UUID | None = None,
    view_type_term_id: uuid.UUID | None = None,
) -> MediaAsset:
    """Register an extracted image as a photo of a piece, by explicit decision of a person.

    ``piece_id`` defaults to the piece of the row where the image is anchored; images of the
    unassigned tray need it. The file type and its SHA-256 are checked again before registering.
    """
    image = session.get(ImportImage, image_id)
    if image is None or image.batch_id != batch.id:
        raise NotFound("La imagen no pertenece a este lote.", code="image_not_found")
    if batch.status != S.APPLIED:
        raise ConflictError(
            f"El lote está en estado «{STATUS_LABELS[batch.status]}»: las imágenes se asocian "
            "después de aplicarlo, cuando la pieza ya existe en el catálogo.",
            code="batch_not_applied",
            details={"current_status": batch.status.value},
        )
    if image.status == ImportImageStatus.ASSOCIATED:
        raise ConflictError(
            "La imagen ya está asociada a una pieza.",
            code="image_already_associated",
            details={"media_asset_id": str(image.media_asset_id)},
        )
    row = session.get(ImportRow, image.import_row_id) if image.import_row_id else None
    target = piece_id or (row.target_piece_id if row is not None else None)
    if target is None:
        raise ValidationFailed(
            "Indique la pieza: la imagen no está anclada en una fila aplicada.",
            code="piece_required",
        )
    piece = session.get(Piece, target)
    if piece is None:
        raise NotFound("La pieza indicada no existe o está eliminada.", code="piece_not_found")

    data = storage.get_bytes(image.storage_key)
    verified = verify_image(data)
    if verified.sha256 != image.content_sha256:
        raise ValidationFailed(
            "La huella SHA-256 de la imagen no coincide con la extraída del archivo.",
            code="sha256_mismatch",
        )
    asset_id = new_uuid()
    extension = EXTENSION_BY_FORMAT.get(verified.content_type.split("/")[-1].upper(), "jpg")
    final_key = f"pieces/{piece.id}/{asset_id}/original.{extension}"
    storage.put_bytes(final_key, data, verified.content_type)
    max_order = session.scalar(
        select(func.max(MediaAsset.sort_order)).where(MediaAsset.piece_id == piece.id)
    )
    restricted = piece.tenure_regime == TenureRegime.LOAN_FOR_USE
    extra: dict[str, Any] = {
        "import_batch_id": str(batch.id),
        "import_image_number": image.image_number,
        "source_row_number": image.anchor_row_number,
    }
    context = AuditContext(origin=AuditOrigin.IMPORT, user_id=user_id, origin_ref=str(batch.id))
    with audit_context(session, context):
        asset = MediaAsset(
            id=asset_id,
            piece_id=piece.id,
            storage_key=final_key,
            original_filename=f"{batch.file_name} · imagen {image.image_number}"[:300],
            content_type=verified.content_type,
            size_bytes=len(data),
            content_sha256=verified.sha256,
            width_px=verified.width,
            height_px=verified.height,
            view_type_term_id=view_type_term_id,
            sort_order=(max_order + 1) if max_order is not None else 0,
            is_primary=max_order is None,
            usage_restriction_term_id=comodato_restriction_term_id(session) if restricted else None,
            restriction_note="Restricción contractual del comodato (RN-008)"
            if restricted
            else None,
            extra_metadata=extra,
        )
        session.add(asset)
        session.flush()
        image.status = ImportImageStatus.ASSOCIATED
        image.media_asset_id = asset.id
        session.flush()
    return asset
