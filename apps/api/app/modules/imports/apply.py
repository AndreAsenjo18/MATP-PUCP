"""Atomic application of an approved import batch (spec importacion-datos: RF-027, RF-008;
design D6).

Every row whose action is create or update goes through the catalog and identification
services, never direct SQL, so the same rules as manual entry apply (RN-002, RN-003, RN-004,
RN-006) together with their flush guards. All changes share one audit context with origin
``IMPORT``, the batch as reference and a single change set, kept in ``import_batch`` so the
batch can be reverted (D7). Each applied row leaves a ``piece_source_record`` with its unmapped
columns, the row number and the batch (RF-008).

The verified photos of each applied row become ``media_asset`` of its piece in the same
transaction and change set (change importacion-masiva-fotografias, task 5.2; design D5). Before
anything is written every one of them is checked in the storage with ``HEAD``: a missing object
fails the batch naming the photo and its row, with the catalogue untouched. Without the originals
(``MEDIA_KEEP_ORIGINALS=false``, task 5.4; design D6) the photo is registered on its display copy,
which must exist, and ``upload.<ext>`` is deleted only once the transaction has committed.

The stage runs in one transaction (``worker.run_stage``): the first domain error rolls back
every row and the batch goes to ``FAILED_APPLY`` with the row and the rule that failed.

A ``PHOTOS`` batch has no rows (change importacion-fotos-a-catalogo, task 6.1; design D9): its
verified photos with a piece, and not repeated on it unless a person confirmed them, are
registered on their pieces in their order, after the photos each piece already had, with the same
``HEAD`` check, transaction and change set, so the same rollback reverts them. Photos without a
piece stay in the batch, not applied; no piece is created.
"""

import hashlib
import logging
import uuid
from collections.abc import Callable, Sequence
from typing import Any

from sqlalchemy import event, select, update
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleViolation, DomainError, ValidationFailed
from app.core.models_base import new_uuid
from app.core.storage import ObjectStorage
from app.modules.audit.context import refined_context
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece, PieceSourceRecord
from app.modules.catalog.service import change_tenure, create_piece, update_piece
from app.modules.collections.models import Term, Vocabulary
from app.modules.identification.service import add_identifier
from app.modules.imports.decisions import RowAction, field_actions, row_action
from app.modules.imports.mapping import (
    ACQUISITION_VOCABULARY,
    IDENTIFIER_TARGET,
    PIECE_FIELDS,
    MappedRow,
)
from app.modules.imports.models import ImportBatch, ImportBatchKind, ImportPhoto, ImportRow
from app.modules.imports.models import ImportBatchStatus as S
from app.modules.imports.models import ImportPhotoStatus as P
from app.modules.imports.photo_upload import upload_key
from app.modules.imports.state import batch_kind, transition
from app.modules.imports.worker import Progress, StageWork
from app.modules.media.service import StoredCopy, register_from_import, unspecified_view_type_id

logger = logging.getLogger(__name__)

# Fields a new piece takes from the row besides the denomination and the tenure regime.
CREATE_FIELDS = tuple(
    name for name in PIECE_FIELDS if name not in {"denomination", "tenure_regime"}
)
APPLIED_COUNTS = ("APPLIED_CREATED", "APPLIED_UPDATED", "APPLIED_SKIPPED")
#: Photos checked in the storage between two heartbeats of the stage, before any write.
HEAD_HEARTBEAT_EVERY = 500


class ApplyFailed(BusinessRuleViolation):
    code = "apply_failed"


def _source_label(batch: ImportBatch) -> str:
    return f"Importación: {batch.file_name}"[:200]


def _add_identifiers(
    session: Session, piece: Piece, identifiers: list[tuple[str, str]], source: str
) -> None:
    for type_code, original in dict.fromkeys(identifiers):
        add_identifier(session, piece, type_code, original, source=source)


def _new_identifiers(mapped: MappedRow) -> list[tuple[str, str]]:
    return [
        (identifier.type_code, identifier.original_value)
        for identifier in mapped.identifiers
        if not identifier.is_absent
    ]


def _acquisition_term_id(session: Session, code: str | None) -> uuid.UUID | None:
    """Id of the ``ACQUISITION_METHOD`` term with ``code`` (matched when the row was mapped)."""
    if not code:
        return None
    return session.scalar(
        select(Term.id)
        .join(Vocabulary, Term.vocabulary_id == Vocabulary.id)
        .where(
            Vocabulary.code == ACQUISITION_VOCABULARY,
            Term.code == code,
            Term.deleted_at.is_(None),
        )
    )


def _create(session: Session, batch: ImportBatch, mapped: MappedRow) -> Piece:
    fields: dict[str, Any] = {
        name: mapped.fields[name] for name in CREATE_FIELDS if mapped.fields.get(name) is not None
    }
    if mapped.collection_id is not None:
        fields["collection_id"] = mapped.collection_id
    if (term_id := _acquisition_term_id(session, mapped.acquisition_method)) is not None:
        fields["acquisition_method_term_id"] = term_id
    piece = create_piece(
        session,
        denomination=mapped.fields.get("denomination"),
        tenure_regime=mapped.tenure_regime,
        **fields,
    )
    _add_identifiers(session, piece, _new_identifiers(mapped), _source_label(batch))
    return piece


def _update(session: Session, batch: ImportBatch, row: ImportRow, mapped: MappedRow) -> Piece:
    assert row.target_piece_id is not None
    piece = session.get(Piece, row.target_piece_id)
    if piece is None:
        raise ValidationFailed(
            "La pieza destino fue eliminada después de la validación.", code="piece_not_found"
        )
    diff = row.diff or {}
    changes: dict[str, Any] = {}
    identifiers: list[tuple[str, str]] = []
    tenure: TenureRegime | None = None
    for name, action in field_actions(row).items():
        if action != "accept":
            continue
        incoming = diff[name].get("incoming")
        if name.startswith(f"{IDENTIFIER_TARGET}:"):
            type_code = name.split(":", 1)[1]
            identifiers += [(type_code, value) for value in incoming or []]
        elif name == "tenure_regime":
            tenure = TenureRegime(incoming) if incoming else None
        elif name == "collection_id":
            changes[name] = uuid.UUID(incoming) if incoming else None
        elif name == "acquisition_method":
            changes["acquisition_method_term_id"] = _acquisition_term_id(session, incoming)
        else:
            changes[name] = incoming
    if tenure is not None:
        change_tenure(
            session,
            piece,
            tenure,
            _source_label(batch),
            supporting_document_ref=f"lote de importación {batch.id}",
        )
    if changes:
        update_piece(session, piece, **changes)
    _add_identifiers(session, piece, identifiers, _source_label(batch))
    return piece


def _photos_to_apply(
    session: Session, batch: ImportBatch, rows: Sequence[ImportRow]
) -> dict[uuid.UUID, list[ImportPhoto]]:
    """The verified photos of each row that is applied, in their order within the row (D3).

    Ambiguous and unmatched photos have no row, so they stay in the batch. A photo already on the
    target piece waits for a person to confirm it (task 4.3).
    """
    applied = {row.id for row in rows if row_action(row)[0] != RowAction.SKIP}
    by_row: dict[uuid.UUID, list[ImportPhoto]] = {}
    for photo in session.scalars(
        select(ImportPhoto).where(
            ImportPhoto.batch_id == batch.id,
            ImportPhoto.status == P.VERIFIED,
            ImportPhoto.row_id.is_not(None),
        )
    ):
        if photo.row_id not in applied or (
            photo.duplicate_of_existing and not photo.duplicate_confirmed
        ):
            continue
        by_row.setdefault(photo.row_id, []).append(photo)  # type: ignore[arg-type]
    for photos in by_row.values():
        photos.sort(key=lambda photo: (photo.sort_key is None, photo.sort_key or 0, photo.id))
    return by_row


def display_key(photo: ImportPhoto) -> str:
    return f"{photo.storage_prefix}display.webp"


#: Where a photo goes, for the message of a missing object: ``("Fila 12", {details})``.
Placement = Callable[[ImportPhoto], tuple[str, dict[str, Any]]]


def _missing(
    where: str, extra: dict[str, Any], photo: ImportPhoto, what: str, rule: str
) -> ApplyFailed:
    return ApplyFailed(
        f"{where}: {what} «{photo.relative_path}» no está en el "
        "almacenamiento. No se aplicó nada del lote.",
        details={
            **extra,
            "photo_id": str(photo.id),
            "relative_path": photo.relative_path,
            "rule": rule,
        },
    )


def _row_placement(rows: Sequence[ImportRow]) -> Placement:
    numbers = {row.id: row.source_row_number for row in rows}

    def placement(photo: ImportPhoto) -> tuple[str, dict[str, Any]]:
        number = numbers[photo.row_id]  # type: ignore[index]
        return f"Fila {number}", {"source_row_number": number}

    return placement


def _piece_placement(photo: ImportPhoto) -> tuple[str, dict[str, Any]]:
    return "Foto del lote", {"piece_id": str(photo.piece_id)}


def _check_photo_objects(
    storage: ObjectStorage | None,
    placement: Placement,
    photos: dict[uuid.UUID, list[ImportPhoto]],
    progress: Progress | None,
    *,
    keep_originals: bool = True,
    total: int = 0,
) -> dict[uuid.UUID, StoredCopy]:
    """``HEAD`` of every photo to apply, before anything is written (D5).

    Without the originals (D6) the display copy becomes the only file of the photo, so it must be
    there: it is read once to describe the asset. Returns that copy for each photo.
    """
    if storage is None:  # every caller with photos passes the storage of the app
        raise RuntimeError("Applying photos needs the object storage.")
    pending = [photo for row_photos in photos.values() for photo in row_photos]
    displays: dict[uuid.UUID, StoredCopy] = {}
    for checked, photo in enumerate(pending, start=1):
        where, extra = placement(photo)
        try:
            storage.head(upload_key(photo))
        except FileNotFoundError:
            raise _missing(where, extra, photo, "la foto", "photo_object_missing") from None
        if not keep_originals:
            key = display_key(photo)
            try:
                storage.head(key)
            except FileNotFoundError:
                raise _missing(
                    where,
                    extra,
                    photo,
                    "la versión de visualización de la foto",
                    "photo_derivative_missing",
                ) from None
            data = b"".join(storage.stream(key))
            displays[photo.id] = StoredCopy(
                key, "image/webp", len(data), hashlib.sha256(data).hexdigest()
            )
        if progress is not None and checked % HEAD_HEARTBEAT_EVERY == 0:
            progress.advance(0, total=total, force=True)
    return displays


def _delete_uploads_after_commit(
    session: Session, storage: ObjectStorage, keys: Sequence[str]
) -> None:
    """Delete the uploads once the batch is committed; a rollback keeps them (D6).

    A file that cannot be deleted is only logged: it is a temporary file of the upload area, and
    the purge or a later run can remove it.
    """
    state = {"rolled_back": False}

    def on_rollback(_session: Session) -> None:
        state["rolled_back"] = True

    def on_commit(_session: Session) -> None:
        if state["rolled_back"]:
            return
        for key in keys:
            try:
                storage.delete_pending(key)
            except Exception:
                logger.exception("No se pudo eliminar el original temporal %s", key)

    event.listen(session, "after_rollback", on_rollback, once=True)
    event.listen(session, "after_commit", on_commit, once=True)


def _register_photos(
    session: Session,
    piece: Piece,
    photos: Sequence[ImportPhoto],
    view_type: uuid.UUID | None,
    displays: dict[uuid.UUID, StoredCopy],
) -> None:
    for photo in photos:
        asset = register_from_import(
            session,
            piece,
            photo,
            storage_key=upload_key(photo),
            view_type_term_id=view_type,
            display=displays.get(photo.id),
        )
        photo.status = P.APPLIED
        photo.media_asset_id = asset.id
    if photos:
        session.flush()


def apply_batch(
    session: Session,
    batch: ImportBatch,
    progress: Progress | None = None,
    storage: ObjectStorage | None = None,
    *,
    keep_originals: bool = True,
) -> None:
    """Apply every row of an approved batch and leave it ``APPLIED``; raises on the first error.

    ``storage`` is needed only when the batch has photos to apply; ``keep_originals`` is
    ``MEDIA_KEEP_ORIGINALS`` (D6).
    """
    if batch_kind(batch) is ImportBatchKind.PHOTOS:
        _apply_photo_batch(session, batch, progress, storage, keep_originals=keep_originals)
        return
    rows = session.scalars(
        select(ImportRow)
        .where(ImportRow.batch_id == batch.id)
        .order_by(ImportRow.source_row_number)
    ).all()
    photos = _photos_to_apply(session, batch, rows)
    view_type: uuid.UUID | None = None
    displays: dict[uuid.UUID, StoredCopy] = {}
    if photos:
        displays = _check_photo_objects(
            storage,
            _row_placement(rows),
            photos,
            progress,
            keep_originals=keep_originals,
            total=len(rows),
        )
        # Before any write of the batch: the term, if created, keeps a change set of its own.
        view_type = unspecified_view_type_id(session)
    # The batch row is written only after the loop: on PostgreSQL the heartbeat updates it from
    # another connection, which would wait forever for this transaction's row lock.
    change_set_id = batch.change_set_id or new_uuid()
    counts = dict.fromkeys(APPLIED_COUNTS, 0)
    created: list[dict[str, Any]] = []
    total = len(rows)
    with refined_context(session, change_set_id=change_set_id):
        for done, row in enumerate(rows, start=1):
            action, _reason = row_action(row)
            if action == RowAction.SKIP:
                counts["APPLIED_SKIPPED"] += 1
                continue
            mapped = MappedRow.from_json(row.mapped_data or {})
            try:
                if action == RowAction.CREATE:
                    piece = _create(session, batch, mapped)
                    created.append({"id": row.id, "target_piece_id": piece.id})
                    counts["APPLIED_CREATED"] += 1
                else:
                    piece = _update(session, batch, row, mapped)
                    counts["APPLIED_UPDATED"] += 1
                session.add(
                    PieceSourceRecord(
                        id=new_uuid(),
                        piece_id=piece.id,
                        import_batch_id=batch.id,
                        source_name=batch.source_name,
                        source_file_name=batch.file_name,
                        source_row_number=row.source_row_number,
                        payload=mapped.source_payload,
                    )
                )
                session.flush()
                _register_photos(session, piece, photos.get(row.id, ()), view_type, displays)
            except DomainError as exc:
                raise ApplyFailed(
                    f"Fila {row.source_row_number}: {exc.message} No se aplicó ninguna fila.",
                    details={"source_row_number": row.source_row_number, "rule": exc.code},
                ) from exc
            if progress is not None:
                progress.advance(done, total=total)
    # Outside the import change set: reverting the batch (D7) must not undo its own link to it.
    batch.change_set_id = change_set_id
    session.flush()
    # Staging data: the new piece of each created row, for the log and the images (D8).
    for start in range(0, len(created), 500):
        session.execute(update(ImportRow), created[start : start + 500])
    batch.counts = {**(batch.counts or {}), **counts}
    session.flush()
    transition(session, batch.id, S.APPLIED)
    if displays and storage is not None:
        uploads = [upload_key(photo) for row_photos in photos.values() for photo in row_photos]
        _delete_uploads_after_commit(session, storage, uploads)


def photos_by_piece(session: Session, batch: ImportBatch) -> dict[uuid.UUID, list[ImportPhoto]]:
    """The photos a ``PHOTOS`` batch applies, by piece and in their order (D9): verified, with a
    piece, and not repeated on it unless a person confirmed them."""
    by_piece: dict[uuid.UUID, list[ImportPhoto]] = {}
    for photo in session.scalars(
        select(ImportPhoto).where(
            ImportPhoto.batch_id == batch.id,
            ImportPhoto.status == P.VERIFIED,
            ImportPhoto.piece_id.is_not(None),
        )
    ):
        if photo.duplicate_of_existing and not photo.duplicate_confirmed:
            continue
        by_piece.setdefault(photo.piece_id, []).append(photo)  # type: ignore[arg-type]
    for photos in by_piece.values():
        photos.sort(key=lambda photo: (photo.sort_key is None, photo.sort_key or 0, photo.id))
    return by_piece


def _apply_photo_batch(
    session: Session,
    batch: ImportBatch,
    progress: Progress | None,
    storage: ObjectStorage | None,
    *,
    keep_originals: bool,
) -> None:
    """Register the photos of a ``PHOTOS`` batch on their pieces (D9); raises on the first
    error, with nothing written."""
    by_piece = photos_by_piece(session, batch)
    if not by_piece:
        raise ApplyFailed(
            "El lote no tiene fotos asignadas a una pieza: no hay nada que aplicar.",
            details={"rule": "nothing_to_apply"},
        )
    total = len(by_piece)
    displays = _check_photo_objects(
        storage, _piece_placement, by_piece, progress, keep_originals=keep_originals, total=total
    )
    view_type = unspecified_view_type_id(session)
    change_set_id = batch.change_set_id or new_uuid()
    applied = 0
    with refined_context(session, change_set_id=change_set_id):
        for done, (piece_id, photos) in enumerate(by_piece.items(), start=1):
            piece = session.get(Piece, piece_id)
            if piece is None or piece.deleted_at is not None or piece.merged_into_id is not None:
                raise ApplyFailed(
                    f"La pieza de «{photos[0].relative_path}» fue retirada después de "
                    "asignarle la foto: asígnela a otra pieza. No se aplicó nada del lote.",
                    details={"piece_id": str(piece_id), "rule": "piece_not_available"},
                )
            try:
                _register_photos(session, piece, photos, view_type, displays)
            except DomainError as exc:
                raise ApplyFailed(
                    f"Foto «{photos[0].relative_path}»: {exc.message} No se aplicó nada del lote.",
                    details={"piece_id": str(piece_id), "rule": exc.code},
                ) from exc
            applied += len(photos)
            if progress is not None:
                progress.advance(done, total=total)
    batch.change_set_id = change_set_id
    batch.counts = {
        **(batch.counts or {}),
        "APPLIED_PHOTOS": applied,
        "APPLIED_PIECES": len(by_piece),
    }
    session.flush()
    transition(session, batch.id, S.APPLIED)
    if displays and storage is not None:
        uploads = [upload_key(photo) for photos in by_piece.values() for photo in photos]
        _delete_uploads_after_commit(session, storage, uploads)


def apply_stage(storage: ObjectStorage | None = None, *, keep_originals: bool = True) -> StageWork:
    def work(session: Session, batch: ImportBatch, progress: Progress) -> None:
        apply_batch(session, batch, progress, storage, keep_originals=keep_originals)

    return work
