"""Proposed pieces of the photos of a ``PHOTOS`` batch (change importacion-fotos-a-catalogo, D3).

``match_catalog_batch`` builds the catalogue index once per run, reads the folders of the batch
(range, proposed collection and reading rule) and stores the proposal of every verified photo
that a person has not decided. Like the matching with rows (``photos.match_batch_photos``) it is
idempotent and never changes a manual assignment, a photo a person removed from its piece nor a
discarded photo (spec «Asignación manual de fotos a piezas existentes»). Nothing reaches the
catalogue until the batch is approved and applied.
"""

import uuid
from collections import defaultdict
from collections.abc import Collection as AbcCollection
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import replace
from dataclasses import replace as dc_replace
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ValidationFailed
from app.modules.catalog.models import Piece
from app.modules.collections.models import Collection
from app.modules.identification.models import (
    CollectionAcronymAlias,
    IdentifierType,
    NormalizationRule,
    PieceIdentifier,
)
from app.modules.identification.normalization import fold_label
from app.modules.identification.params import session_params
from app.modules.imports.catalog_photo_matching import (
    TEMPLATE_MISMATCH,
    CatalogIndex,
    CatalogPhoto,
    CatalogPiece,
    CatalogProposal,
    CollectionRef,
    FolderInfo,
    FolderRule,
    PhotoReading,
    TemplateError,
    analyze_folders,
    compile_template,
    folder_path,
    match_catalog_photos,
    match_one,
    read_with_template,
    suggest_template,
)
from app.modules.imports.models import ImportBatch, ImportPhoto, ImportPhotoStatus
from app.modules.imports.models import PhotoMatchStatus as M
from app.modules.imports.photo_correspondences import (
    LineResult,
    batch_preset,
    merge_lines,
    parse_correspondences,
    resolve_lines,
)
from app.modules.imports.photo_matching import (
    CandidateStrength,
    NameReading,
    compile_camera_patterns,
    split_path,
)
from app.modules.media.models import MediaAsset


def catalog_index(session: Session) -> CatalogIndex:
    """Current identifiers of the pieces that are neither retired nor merged (D3): one query."""
    rows = session.execute(
        select(
            Piece.id,
            Piece.collection_id,
            PieceIdentifier.identifier_type_code,
            PieceIdentifier.normalized_value,
        )
        .join(PieceIdentifier, PieceIdentifier.piece_id == Piece.id)
        .where(
            Piece.deleted_at.is_(None),
            Piece.merged_into_id.is_(None),
            PieceIdentifier.deleted_at.is_(None),
            PieceIdentifier.is_current.is_(True),
            PieceIdentifier.normalized_value.is_not(None),
        )
    ).all()
    collections: dict[uuid.UUID, uuid.UUID | None] = {}
    identifiers: dict[uuid.UUID, list[tuple[str, str]]] = defaultdict(list)
    for piece_id, collection_id, type_code, value in rows:
        collections[piece_id] = collection_id
        identifiers[piece_id].append((type_code, value))
    return CatalogIndex(
        CatalogPiece(piece_id, collections[piece_id], tuple(values))
        for piece_id, values in identifiers.items()
    )


def collection_refs(session: Session) -> list[CollectionRef]:
    """Active collections with their current and historical acronyms (D5)."""
    aliases: dict[uuid.UUID, list[str]] = defaultdict(list)
    for collection_id, alias in session.execute(
        select(CollectionAcronymAlias.collection_id, CollectionAcronymAlias.alias_normalized).where(
            CollectionAcronymAlias.deleted_at.is_(None)
        )
    ):
        aliases[collection_id].append(alias)
    return [
        CollectionRef(
            collection_id,
            name,
            tuple(item for item in (acronym, *aliases[collection_id]) if item),
        )
        for collection_id, name, acronym in session.execute(
            select(Collection.id, Collection.name, Collection.acronym_normalized)
            .where(Collection.deleted_at.is_(None), Collection.is_active.is_(True))
            .order_by(Collection.name)
        )
    ]


def active_types(session: Session) -> frozenset[str]:
    """Identifier types a template may name (D4)."""
    return frozenset(
        session.scalars(
            select(IdentifierType.code).where(
                IdentifierType.deleted_at.is_(None), IdentifierType.is_active.is_(True)
            )
        )
    )


def batch_folders(session: Session, batch: ImportBatch) -> dict[str, FolderInfo]:
    """Every folder of the batch with its range, proposed collection and rule (D4, D5, D11)."""
    paths = session.scalars(
        select(ImportPhoto.relative_path).where(ImportPhoto.batch_id == batch.id)
    )
    return analyze_folders(
        paths, collection_refs(session), PhotoReading.from_json(batch.photo_reading)
    )


# --- repetidas en la pieza (importacion-fotos-a-catalogo, tarea 4.2; D8) --------------------------


def mark_duplicates(session: Session, photos: Iterable[ImportPhoto]) -> None:
    """A photo proposed or assigned to a piece that already has one with the same SHA-256 is
    repeated: it is not applied unless a person confirms it. One query for all the pieces."""
    photos = list(photos)
    pieces = {photo.piece_id for photo in photos if photo.piece_id}
    existing: set[tuple[uuid.UUID, str]] = set()
    if pieces:
        existing = set(
            session.execute(
                select(MediaAsset.piece_id, MediaAsset.content_sha256).where(
                    MediaAsset.piece_id.in_(pieces), MediaAsset.deleted_at.is_(None)
                )
            ).tuples()
        )
    for photo in photos:
        if photo.row_id is not None:
            continue  # a row's piece is checked by the batch with Excel
        repeated = photo.piece_id is not None and (photo.piece_id, photo.content_sha256) in existing
        if photo.duplicate_of_existing != repeated:
            photo.duplicate_of_existing = repeated
            if not repeated:
                photo.duplicate_confirmed = False


def _candidates(piece_ids: Sequence[uuid.UUID]) -> list[str] | None:
    return [str(piece_id) for piece_id in piece_ids] or None


def match_catalog_batch(
    session: Session,
    batch: ImportBatch,
    rules: Mapping[str, NormalizationRule],
    *,
    folder: str | None = None,
    preset: Mapping[uuid.UUID, CatalogProposal] | None = None,
) -> int:
    """Store the proposed piece of every verified photo of ``batch`` a person did not decide;
    with ``folder``, only those inside it (a new reading rule, D4). Returns how many."""
    photos = list(
        session.scalars(
            select(ImportPhoto)
            .where(
                ImportPhoto.batch_id == batch.id,
                ImportPhoto.status == ImportPhotoStatus.VERIFIED,
            )
            .order_by(ImportPhoto.relative_path, ImportPhoto.id)
        )
    )
    automatic = [photo for photo in photos if photo.match_status is not M.MANUAL]
    if folder:
        automatic = [photo for photo in automatic if photo.relative_path.startswith(f"{folder}/")]
    if not automatic:
        return 0
    after_manual: dict[uuid.UUID, int] = {}
    for photo in photos:
        if photo.match_status is M.MANUAL and photo.piece_id and photo.sort_key:
            after_manual[photo.piece_id] = max(after_manual.get(photo.piece_id, 0), photo.sort_key)
    if folder:  # the photos of the piece outside the folder keep their place
        for photo in photos:
            if photo.piece_id and photo.sort_key and photo not in automatic:
                after_manual[photo.piece_id] = max(
                    after_manual.get(photo.piece_id, 0), photo.sort_key
                )
    reading = PhotoReading.from_json(batch.photo_reading)
    index = catalog_index(session)
    if preset is None:  # the correspondences list kept in the batch wins over the names (D7)
        preset, _ = batch_preset(session, batch, index, rules)
    proposals = match_catalog_photos(
        [CatalogPhoto(photo.id, photo.relative_path) for photo in automatic],
        index,
        batch_folders(session, batch),
        rules=rules,
        valid_types=active_types(session),
        camera_patterns=compile_camera_patterns(session_params(session).photo_camera_patterns),
        preset=preset,
        default_rule=reading.default,
    )
    for photo, proposal in zip(automatic, proposals, strict=True):
        values: dict[str, Any] = {
            "match_status": proposal.status,
            "match_source": proposal.source,
            "piece_id": proposal.piece_id,
            "candidate_piece_ids": _candidates(proposal.candidate_piece_ids),
            "match_reason": proposal.reason,
            "sort_key": (
                proposal.sort_key + after_manual.get(proposal.piece_id, 0)
                if proposal.sort_key and proposal.piece_id
                else None
            ),
        }
        for name, value in values.items():
            if getattr(photo, name) != value:  # an unchanged photo is not written again
                setattr(photo, name, value)
    mark_duplicates(session, automatic)
    session.flush()
    return len(automatic)


# --- lectura por carpeta: árbol, vista previa y regla (tareas 4.3 y 4.4; D4) ----------------------

PREVIEW_SIZE = 20
NO_PROPOSAL = "NONE"


def identifier_rules(session: Session) -> dict[str, NormalizationRule]:
    """Normalization rule of every identifier type that is not deleted."""
    return dict(
        session.execute(
            select(IdentifierType.code, IdentifierType.normalization_rule).where(
                IdentifierType.deleted_at.is_(None)
            )
        ).all()
    )


def _in_folder(relative_path: str, folder: str) -> bool:
    return not folder or relative_path.startswith(f"{folder}/")


def folders_overview(session: Session, batch: ImportBatch) -> list[dict[str, Any]]:
    """Every folder with its counts by proposal, range, collection, rule and suggestion (D4)."""
    infos = batch_folders(session, batch)
    names = dict(session.execute(select(Collection.id, Collection.name)).all())
    photos = session.execute(
        select(ImportPhoto.relative_path, ImportPhoto.match_status).where(
            ImportPhoto.batch_id == batch.id
        )
    ).all()
    counts: dict[str, dict[str, int]] = {path: defaultdict(int) for path in infos}
    direct: dict[str, list[str]] = defaultdict(list)
    for relative_path, match_status in photos:
        parts, file_name = split_path(relative_path)
        direct[folder_path(parts)].append(file_name)
        key = match_status.value if match_status else NO_PROPOSAL
        for depth in range(1, len(parts) + 1):
            counts[folder_path(parts[:depth])][key] += 1

    def collection(collection_id: uuid.UUID | None) -> dict[str, Any] | None:
        if collection_id is None or collection_id not in names:
            return None
        return {"id": collection_id, "name": names[collection_id]}

    result = []
    for path, info in infos.items():
        suggestion = suggest_template(direct.get(path, []))
        result.append(
            {
                "path": path,
                "name": info.name,
                "depth": path.count("/"),
                "photos": sum(counts[path].values()),
                "by_match_status": dict(counts[path]),
                "range": [info.range.start, info.range.end] if info.range else None,
                "proposed_collection": collection(info.proposed_collection_id),
                "collection": collection(info.collection_id),
                "collection_pending": info.collection_pending,
                "rule": info.rule.as_json(),
                "rule_from": info.rule_from,
                "suggestion": (
                    {
                        "shape": suggestion.shape,
                        "template": suggestion.template,
                        "matching": suggestion.matching,
                        "total": suggestion.total,
                    }
                    if suggestion
                    else None
                ),
            }
        )
    return result


def _invalid_template(error: TemplateError, valid_types: AbcCollection[str]) -> ValidationFailed:
    return ValidationFailed(
        error.message,
        code="invalid_photo_template",
        details={"reason": error.reason, "valid_types": sorted(valid_types)},
    )


def _reading_with(
    session: Session, batch: ImportBatch, folder: str, rule: FolderRule
) -> tuple[PhotoReading, dict[str, FolderInfo]]:
    """The reading of the batch with ``rule`` on ``folder``, validated (422 otherwise)."""
    current = PhotoReading.from_json(batch.photo_reading)
    if folder:
        reading = replace(current, folders={**current.folders, folder: rule})
    else:
        reading = replace(current, default=rule)
    infos = analyze_folders(
        session.scalars(select(ImportPhoto.relative_path).where(ImportPhoto.batch_id == batch.id)),
        collection_refs(session),
        reading,
    )
    if folder and folder not in infos:
        raise ValidationFailed(
            "La carpeta no está en el lote.", code="folder_not_in_batch", details={"folder": folder}
        )
    if rule.mode == "template":
        types = active_types(session)
        if not rule.template:
            raise _invalid_template(
                TemplateError("malformed", "Escriba la plantilla de la carpeta."), types
            )
        hint = infos[folder].collection_id if folder else rule.collection_id
        try:
            compile_template(rule.template, types, has_collection_hint=hint is not None)
        except TemplateError as error:
            raise _invalid_template(error, types) from error
    return reading, infos


def reading_preview(
    session: Session, batch: ImportBatch, folder: str, rule: FolderRule
) -> dict[str, Any]:
    """How up to 20 names of the folder are read with ``rule``, without saving anything (D4)."""
    folder = folder.strip("/")
    reading, infos = _reading_with(session, batch, folder, rule)
    photos = [
        photo
        for photo in session.scalars(
            select(ImportPhoto)
            .where(
                ImportPhoto.batch_id == batch.id, ImportPhoto.status == ImportPhotoStatus.VERIFIED
            )
            .order_by(ImportPhoto.relative_path, ImportPhoto.id)
        )
        if _in_folder(photo.relative_path, folder)
    ]
    rules = identifier_rules(session)
    index = catalog_index(session)
    types = active_types(session)
    patterns = compile_camera_patterns(session_params(session).photo_camera_patterns)
    items: list[dict[str, Any]] = []
    not_fitting = 0
    for photo in photos:
        proposal, name_reading = match_one(
            CatalogPhoto(photo.id, photo.relative_path),
            index,
            infos,
            rules=rules,
            valid_types=types,
            camera_patterns=patterns,
            default_rule=reading.default,
        )
        not_fitting += proposal.reason == TEMPLATE_MISMATCH
        if len(items) < PREVIEW_SIZE:
            items.append(
                {
                    "photo_id": photo.id,
                    "relative_path": photo.relative_path,
                    "codes": _codes(name_reading, infos, photo.relative_path, rules, types),
                    "match_status": proposal.status,
                    "piece_id": proposal.piece_id,
                    "candidate_piece_ids": list(proposal.candidate_piece_ids),
                    "match_reason": proposal.reason,
                }
            )
    return {"folder": folder, "total": len(photos), "not_fitting": not_fitting, "items": items}


def _codes(
    name_reading: NameReading,
    infos: Mapping[str, FolderInfo],
    relative_path: str,
    rules: Mapping[str, NormalizationRule],
    types: AbcCollection[str],
) -> list[str]:
    parts, _ = split_path(relative_path)
    info = infos.get(folder_path(parts))
    if info is not None and info.rule.mode == "camera":
        return []
    if info is not None and info.rule.mode == "template" and info.rule.template:
        try:
            template = compile_template(
                info.rule.template, types, has_collection_hint=info.collection_id is not None
            )
        except TemplateError:
            return []
        codes = read_with_template(name_reading.base, template, rules) or []
        return [f"{code.type_code}: {code.text}" for code in codes]
    return [
        candidate.text
        for candidate in name_reading.candidates
        if candidate.strength is not CandidateStrength.NUMBER
    ]


def save_reading(session: Session, batch: ImportBatch, folder: str, rule: FolderRule) -> int:
    """Store the rule of ``folder`` (or of the batch) and match its automatic photos again; the
    manual and discarded ones keep their state (D4). Returns how many photos were matched."""
    folder = folder.strip("/")
    reading, _ = _reading_with(session, batch, folder, rule)
    batch.photo_reading = reading.as_json()
    session.flush()
    return match_catalog_batch(session, batch, identifier_rules(session), folder=folder or None)


# --- lista de correspondencias (tarea 4.5; D7) ----------------------------------------------------


def upload_correspondences(
    session: Session, batch: ImportBatch, file_name: str, content: bytes
) -> list[LineResult]:
    """Keep the lines of the list in the batch and match its automatic photos again; returns the
    result of each new line. The file itself is not stored (D7)."""
    lines = parse_correspondences(file_name, content)
    reading = dict(batch.photo_reading or {})
    reading["correspondences"] = [
        line.as_json() for line in merge_lines(reading.get("correspondences", []), lines)
    ]
    batch.photo_reading = reading
    session.flush()
    rules = identifier_rules(session)
    photos = list(
        session.scalars(
            select(ImportPhoto).where(
                ImportPhoto.batch_id == batch.id,
                ImportPhoto.status == ImportPhotoStatus.VERIFIED,
            )
        )
    )
    _, results = resolve_lines(lines, photos, catalog_index(session), rules)
    last = {fold_label(line.file): line.number for line in lines}
    results = [
        result
        if last[fold_label(result.line.file)] == result.line.number
        else dc_replace(
            result,
            result="ambiguous",
            reason=f"La línea {last[fold_label(result.line.file)]} nombra la misma foto y la "
            "reemplaza.",
        )
        for result in results
    ]
    match_catalog_batch(session, batch, rules)
    return results


# --- aviso previo a aprobar (tarea 6.2; D9) -------------------------------------------------------


def photo_approval_counts(session: Session, batch: ImportBatch) -> dict[str, int]:
    """What approving a ``PHOTOS`` batch would apply now and what it would leave out (spec «Foto
    sin pieza al aprobar»): photos to apply and their pieces, verified photos without a piece,
    repeated ones a person did not confirm, photos still uploading, the folders whose collection
    nobody confirmed and the proposals with a warning (``partial_codes``, ``out_of_range``)."""
    counts = {
        "to_apply": 0,
        "pieces": 0,
        "unassigned": 0,
        "duplicates_pending": 0,
        "uploading": 0,
        "partial_codes": 0,
        "out_of_range": 0,
        "collections_pending": 0,
    }
    pieces: set[uuid.UUID] = set()
    for status, piece_id, duplicate, confirmed, reason in session.execute(
        select(
            ImportPhoto.status,
            ImportPhoto.piece_id,
            ImportPhoto.duplicate_of_existing,
            ImportPhoto.duplicate_confirmed,
            ImportPhoto.match_reason,
        ).where(ImportPhoto.batch_id == batch.id)
    ):
        if status in (ImportPhotoStatus.PENDING_UPLOAD, ImportPhotoStatus.UPLOADED):
            counts["uploading"] += 1
        if status is not ImportPhotoStatus.VERIFIED:
            continue
        if piece_id is None:
            counts["unassigned"] += 1
            continue
        if duplicate and not confirmed:
            counts["duplicates_pending"] += 1
            continue
        counts["to_apply"] += 1
        pieces.add(piece_id)
        if reason in ("partial_codes", "out_of_range"):
            counts[reason] += 1
    counts["pieces"] = len(pieces)
    infos = batch_folders(session, batch)
    for path, info in infos.items():
        parent = infos.get(path.rsplit("/", 1)[0]) if "/" in path else None
        inherited = parent is not None and parent.proposed_collection_id == (
            info.proposed_collection_id
        )
        if info.collection_pending and not inherited:
            counts["collections_pending"] += 1
    return counts
