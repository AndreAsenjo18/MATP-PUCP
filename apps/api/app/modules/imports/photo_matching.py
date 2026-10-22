"""Proposed matching between the photos of an import batch and its rows (RF-045, RF-023).

Change importacion-masiva-fotografias, design D3:

- ``read_name`` (task 3.1) reads the name of a photo, or of a folder: it removes the extension and
  the sequence, view and copy suffixes, and extracts the code candidates, normalized with the same
  rules as the row identifiers (``normalize`` of ``identification.normalization``, one rule per
  identifier type).
- ``match_photos`` (task 3.2) proposes a row for each photo with the batch index, trying in order
  the file name, each folder of its path (closest first) and the photo file column of the mapping.
  It stops at the first path, and within a path at the first candidate level, that matches at
  least one row: one row is ``MATCHED``; more than one is ``AMBIGUOUS`` with its candidates and is
  never settled by trying the next level or path; none is ``UNMATCHED``. The photos of a row are
  ordered by their names.

Nothing here reads or writes the database, and manual assignments are not handled here (task 3.3):
a proposal reaches the catalogue only when a person approves the batch (RN-009 by analogy).

Reading rules [SUPUESTO L1, S2 and S3 of ``docs/preguntas-contraparte.md``: the museum does not
know yet how it names its photo files]:

- ``foto (2)``, a view word (``_frontal``) and ``copia`` are suffixes: they order the photos of a
  row and are never a code. A short ``_2`` or ``-a`` is removed only in a looser reading, because
  it can also belong to a code (``MBB 40-a`` is a component).
- A camera name (``IMG_20190312``, ``DSC_0001``) gives no code.
- A number a spreadsheet wrote as ``1234.0`` is read as ``1234``.
- A number alone (``245``) is compared with the I, INC/RN, PUCP, owner and other codes and also
  with the correlative number of the collection codes of the batch (``MMZ 245`` gives ``245``)
  [SUPUESTO S1]. When it matches more than one row the photo stays ambiguous: it is never assigned
  by guessing (design D3, and «Falsos positivos» in its risks).
"""

import enum
import re
import unicodedata
import uuid
from collections import defaultdict
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, replace

from app.modules.identification.models import NormalizationRule, NormalizationStatus
from app.modules.identification.normalization import (
    DEFAULT_RULES,
    TYPE_COLLECTION,
    normalize,
)
from app.modules.imports.models import PhotoMatchSource, PhotoMatchStatus

#: Key of the correlative number of a collection code, compared with a number alone [SUPUESTO S1].
COLLECTION_NUMBER = "COLECCION_NUMERO"

#: View words removed from the end of a name; they could later propose the view (question L4).
VIEW_WORDS = (
    "frontal",
    "frente",
    "anverso",
    "perfil",
    "lateral",
    "posterior",
    "reverso",
    "superior",
    "inferior",
    "detalle",
    "abierta",
    "abierto",
    "cerrada",
    "cerrado",
)

_EXTENSION_RE = re.compile(r"\.[A-Za-z][A-Za-z0-9]{1,4}$")
_SEQUENCE_RE = re.compile(r"[\s_.-]*\((\d{1,3})\)$")
_COPY_SUFFIX_RE = re.compile(r"[\s_.-]+(?:copia|copy)$", re.IGNORECASE)
_COPY_PREFIX_RE = re.compile(r"^(?:copia|copy)\s+(?:de|of)\s+", re.IGNORECASE)
_VIEW_RE = re.compile(r"[\s_.-]+(" + "|".join(VIEW_WORDS) + r")$", re.IGNORECASE)
# A trailing "_2" or "-a" after something that already has a number of its own.
_LOOSE_RE = re.compile(r"^(?P<code>.*\d.*?)[\s_-](?:\d{1,2}|[A-Za-z])$")
_SPREADSHEET_NUMBER_RE = re.compile(r"^(\d+)\.0+$")
_CAMERA_RE = re.compile(r"^(?:IMG|DSC[NF]?|PXL|CIMG|PICT|MVIMG|DJI)[\s_-]?\d", re.IGNORECASE)
# Acronym (``MMZ``, ``M.M.Z.``, ``I``, ``INC``) followed by a number: a code inside a longer name.
_FRAGMENT_RE = re.compile(
    r"(?<![A-Za-z0-9])(?:[A-Za-z]{1,6}|(?:[A-Za-z]\.){1,6})[\s._:#-]*\d+(?:[.-]\d+)*(?!\d)"
)
_NUMBER_RE = re.compile(r"(?<![A-Za-z0-9])\d+(?![A-Za-z0-9])")


class CandidateStrength(enum.IntEnum):
    """How specific a candidate is; the resolution uses the most specific level that matches."""

    WHOLE = 1  # the whole cleaned name: «I 1234», «MMZ045»
    LOOSE = 2  # the cleaned name without a short trailing «_2» or «-a»
    FRAGMENT = 3  # a code inside a longer name: «MMZ 045» in «toro MMZ 045»
    NUMBER = 4  # a number alone inside a longer name: «1234» in «toro 1234»


@dataclass(frozen=True)
class CodeCandidate:
    """A piece of a name that may be a code, with its normalized keys ``(type, value)``."""

    text: str
    strength: CandidateStrength
    keys: frozenset[tuple[str, str]]


@dataclass(frozen=True)
class NameReading:
    """What the name of a photo, or of a folder, says about its row and its order."""

    name: str
    stem: str  # without the extension
    base: str  # without the sequence, view and copy suffixes
    sequence: int  # 1 unless a «(2)» suffix says otherwise
    view: str | None
    camera_name: bool
    candidates: tuple[CodeCandidate, ...]


def natural_key(text: str) -> tuple[str | int, ...]:
    """Natural order: «foto2» before «foto10», without telling upper from lower case."""
    parts = re.split(r"(\d+)", text.casefold())
    return tuple(int(part) if part.isdigit() else part for part in parts)


def order_key(reading: NameReading) -> tuple[object, ...]:
    """Order of the photos of a row: cleaned name, then sequence, then the whole name (D3)."""
    return (natural_key(reading.base), reading.sequence, natural_key(reading.stem))


def _strip_suffixes(stem: str) -> tuple[str, int, str | None]:
    base, sequence, view = stem, 1, None
    base = _COPY_PREFIX_RE.sub("", base)
    while True:
        if match := _SEQUENCE_RE.search(base):
            sequence = max(sequence, int(match.group(1)))
            base = base[: match.start()]
        elif match := _COPY_SUFFIX_RE.search(base):
            base = base[: match.start()]
        elif match := _VIEW_RE.search(base):
            view = view or match.group(1).casefold()
            base = base[: match.start()]
        else:
            return base.strip(" _.-"), sequence, view


def code_keys(
    text: str, rules: Mapping[str, NormalizationRule] = DEFAULT_RULES
) -> frozenset[tuple[str, str]]:
    """Keys ``(type, normalized value)`` of ``text`` under the rule of every identifier type."""
    keys = set()
    for type_code, rule in rules.items():
        result = normalize(rule, text)
        if result.status is NormalizationStatus.NORMALIZED and result.normalized:
            keys.add((type_code, result.normalized))
    if text.isdigit() and int(text) > 0:  # [SUPUESTO S1]
        keys.add((COLLECTION_NUMBER, str(int(text))))
    return frozenset(keys)


def read_name(
    name: str,
    *,
    is_file: bool = True,
    rules: Mapping[str, NormalizationRule] = DEFAULT_RULES,
) -> NameReading:
    """Read a file name (``I 1234 (2).JPG``) or a folder name (``MMZ 045``)."""
    stem = unicodedata.normalize("NFKC", name).strip()
    if is_file:
        stem = _EXTENSION_RE.sub("", stem)
    base, sequence, view = _strip_suffixes(stem)
    if match := _SPREADSHEET_NUMBER_RE.match(base):
        base = match.group(1)
    camera = bool(_CAMERA_RE.match(base))
    texts: list[tuple[str, CandidateStrength]] = []
    if base and not camera:
        texts.append((base, CandidateStrength.WHOLE))
        if match := _LOOSE_RE.match(base):
            texts.append((match.group("code").rstrip(" _.-"), CandidateStrength.LOOSE))
        texts += [(m.group(0), CandidateStrength.FRAGMENT) for m in _FRAGMENT_RE.finditer(base)]
        texts += [(m.group(0), CandidateStrength.NUMBER) for m in _NUMBER_RE.finditer(base)]
    candidates: list[CodeCandidate] = []
    seen: set[str] = set()
    for text, strength in texts:
        if text in seen:
            continue  # keep the most specific reading of the same text
        seen.add(text)
        if keys := code_keys(text, rules):
            candidates.append(CodeCandidate(text, strength, keys))
    return NameReading(name, stem, base, sequence, view, camera, tuple(candidates))


# ---------------------------------------------------------------- batch index and resolution (3.2)

_COLLECTION_CORRELATIVE_RE = re.compile(r"^\S+ (\d+)")
_PATH_SEPARATOR_RE = re.compile(r"[\/]")


@dataclass(frozen=True)
class BatchRow:
    """What the matching needs of a batch row: a stand-in of ``import_row``.

    ``identifiers`` are the ``(type, normalized value)`` pairs of ``mapped_data``; a value that
    could not be normalized is ``None`` and is ignored. ``photo_filenames`` are the values of the
    photo file column of the mapping, whose ``MappingSpec`` field is task 3.4.
    """

    row_id: uuid.UUID
    identifiers: tuple[tuple[str, str | None], ...] = ()
    photo_filenames: tuple[str, ...] = ()


@dataclass(frozen=True)
class BatchPhoto:
    photo_id: uuid.UUID
    relative_path: str  # «MMZ 045/DSC_0001.jpg», as the browser sent it


@dataclass(frozen=True)
class PhotoProposal:
    """Proposed row of a photo, with the fields ``import_photo`` stores (design D1)."""

    photo_id: uuid.UUID
    status: PhotoMatchStatus
    source: PhotoMatchSource | None = None
    row_id: uuid.UUID | None = None
    candidate_row_ids: tuple[uuid.UUID, ...] = ()
    sort_key: int | None = None  # 1 for the first photo of its row


def split_path(relative_path: str) -> tuple[list[str], str]:
    """Folders (outermost first) and file name of a relative path."""
    parts = [part for part in _PATH_SEPARATOR_RE.split(relative_path) if part.strip()]
    return parts[:-1], parts[-1] if parts else ""


def file_key(name: str) -> str:
    """A photo file name compared without case, extension or folder (column path, D3)."""
    base = _PATH_SEPARATOR_RE.split(unicodedata.normalize("NFKC", name).strip())[-1]
    return _EXTENSION_RE.sub("", base).casefold()


class BatchIndex:
    """Codes and photo file names of the batch rows, pointing to their rows (D3, step 1)."""

    def __init__(self, rows: Iterable[BatchRow]) -> None:
        self._by_key: dict[tuple[str, str], set[uuid.UUID]] = defaultdict(set)
        self._by_file: dict[str, set[uuid.UUID]] = defaultdict(set)
        for row in rows:
            for type_code, value in row.identifiers:
                if not value:
                    continue
                self._by_key[(type_code, value)].add(row.row_id)
                if type_code == TYPE_COLLECTION and (
                    match := _COLLECTION_CORRELATIVE_RE.match(value)
                ):
                    number = str(int(match.group(1)))
                    self._by_key[(COLLECTION_NUMBER, number)].add(row.row_id)  # [SUPUESTO S1]
            for name in row.photo_filenames:
                if key := file_key(name):
                    self._by_file[key].add(row.row_id)

    def rows_for_keys(self, keys: Iterable[tuple[str, str]]) -> set[uuid.UUID]:
        found: set[uuid.UUID] = set()
        for key in keys:
            found |= self._by_key.get(key, set())
        return found

    def rows_for_file(self, name: str) -> set[uuid.UUID]:
        return set(self._by_file.get(file_key(name), set()))


def rows_by_level(reading: NameReading, index: BatchIndex) -> set[uuid.UUID]:
    """Rows of the most specific candidate level that matches at least one row.

    A level that matches several rows is returned as it is: it is never settled by looking at a
    less specific level.
    """
    for strength in CandidateStrength:
        keys = (key for c in reading.candidates if c.strength is strength for key in c.keys)
        if rows := index.rows_for_keys(keys):
            return rows
    return set()


def _resolve(
    reading: NameReading,
    folders: Sequence[str],
    index: BatchIndex,
    rules: Mapping[str, NormalizationRule],
) -> tuple[PhotoMatchSource, set[uuid.UUID]] | None:
    if rows := rows_by_level(reading, index):
        return PhotoMatchSource.FILENAME, rows
    for folder in reversed(folders):  # closest folder first
        if rows := rows_by_level(read_name(folder, is_file=False, rules=rules), index):
            return PhotoMatchSource.FOLDER, rows
    if rows := index.rows_for_file(reading.name):
        return PhotoMatchSource.COLUMN, rows
    return None


def match_photos(
    photos: Sequence[BatchPhoto],
    rows: Iterable[BatchRow],
    rules: Mapping[str, NormalizationRule] = DEFAULT_RULES,
) -> list[PhotoProposal]:
    """Proposed row of every photo of a batch, in the order of ``photos`` (D3)."""
    index = BatchIndex(rows)
    proposals: dict[uuid.UUID, PhotoProposal] = {}
    per_row: dict[uuid.UUID, list[tuple[tuple[object, ...], uuid.UUID]]] = defaultdict(list)
    for photo in photos:
        folders, file_name = split_path(photo.relative_path)
        reading = read_name(file_name, rules=rules)
        found = _resolve(reading, folders, index, rules)
        if found is None:
            proposals[photo.photo_id] = PhotoProposal(photo.photo_id, PhotoMatchStatus.UNMATCHED)
            continue
        source, row_ids = found
        if len(row_ids) > 1:
            proposals[photo.photo_id] = PhotoProposal(
                photo.photo_id,
                PhotoMatchStatus.AMBIGUOUS,
                source,
                candidate_row_ids=tuple(sorted(row_ids, key=str)),
            )
            continue
        (row_id,) = row_ids
        proposals[photo.photo_id] = PhotoProposal(
            photo.photo_id, PhotoMatchStatus.MATCHED, source, row_id
        )
        order = (*order_key(reading), natural_key(photo.relative_path))
        per_row[row_id].append((order, photo.photo_id))
    for items in per_row.values():
        for position, (_, photo_id) in enumerate(sorted(items), start=1):
            proposals[photo_id] = replace(proposals[photo_id], sort_key=position)
    return [proposals[photo.photo_id] for photo in photos]
