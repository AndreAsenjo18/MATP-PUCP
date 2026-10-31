"""Proposed piece of the photos of a photo-only batch (RF-046; change importacion-fotos-a-catalogo).

The photos of a ``PHOTOS`` batch are matched with the pieces **already in the catalogue**, by their
current identifiers, instead of with the rows of a workbook. The name reader is the one of
``photo_matching`` (``read_name``); what changes is the index, the reading rules by folder and the
protections against false positives, which matter far more against ≈ 10 000 pieces than against
the 30 rows of a batch (design D3).

Nothing here reads or writes the database: ``catalog_photos`` builds the index and stores the
proposals. Order of the paths for a photo (D3): the correspondences list (D7) → the file name, read
with the rule of its folder (D4) → the name of each folder of its path, closest first, only in
automatic mode and never a range folder (D11) → unassigned.

Protections (D3):

- a number alone (``245``, or ``3554`` inside ``175-3554``) is only compared with the correlative
  of the collection codes of the folder's collection; without one the photo stays unassigned with
  ``bare_number_without_collection``;
- a folder never proposes a piece by a number alone (``CARPETA 1``) nor by a range (``ABC 001 -
  100``);
- the codes of one name that point to different pieces leave the photo ambiguous with
  ``discrepant_codes``, never assigned (D3, D4);
- with a collection as hint, a photo whose piece belongs to another collection stays unassigned
  with ``other_collection`` and that piece as candidate.

Templates (D4): ``{<identifier type>}``, ``{n}`` for the correlative (joined to a ``{COLECCION}``
right before it, or to the folder's collection) and ``{*}`` for a part that is ignored. The
literal text is escaped and every run of spaces, ``_`` or ``-`` becomes ``[\\s_-]*``.
"""

import re
import unicodedata
import uuid
from collections import defaultdict
from collections.abc import Collection, Iterable, Mapping, Sequence
from dataclasses import dataclass, field, replace
from typing import Any, Literal

from app.modules.identification.models import NormalizationRule
from app.modules.identification.normalization import DEFAULT_RULES, TYPE_COLLECTION
from app.modules.imports.models import PhotoMatchSource, PhotoMatchStatus
from app.modules.imports.photo_matching import (
    COLLECTION_NUMBER,
    CandidateStrength,
    CodeCandidate,
    CodeKey,
    KeyIndex,
    NameReading,
    collection_correlative,
    natural_key,
    normalized_code,
    order_key,
    read_name,
    split_path,
)

# --- motivos (D2) ---------------------------------------------------------------------------------

DISCREPANT_CODES = "discrepant_codes"
CAMERA_NAME = "camera_name"
TEMPLATE_MISMATCH = "template_mismatch"
BARE_NUMBER = "bare_number_without_collection"
OTHER_COLLECTION = "other_collection"
DUPLICATE_NAME = "duplicate_name"
PARTIAL_CODES = "partial_codes"
OUT_OF_RANGE = "out_of_range"

ReadingMode = Literal["auto", "camera", "template"]
READING_MODES: tuple[ReadingMode, ...] = ("auto", "camera", "template")


# --- índice del catálogo (D3) ---------------------------------------------------------------------


@dataclass(frozen=True)
class CatalogPiece:
    """What the matching needs of a piece: its collection and its current identifiers."""

    piece_id: uuid.UUID
    collection_id: uuid.UUID | None
    identifiers: tuple[CodeKey, ...] = ()


class CatalogIndex(KeyIndex[uuid.UUID]):
    """``(type, normalized value) → {piece}`` plus the correlative of the collection codes by
    collection (``(collection, 245) → {piece}``), built once per run (D3)."""

    def __init__(self, pieces: Iterable[CatalogPiece]) -> None:
        super().__init__()
        self.collection_of: dict[uuid.UUID, uuid.UUID | None] = {}
        self._correlatives: dict[tuple[uuid.UUID | None, str], set[uuid.UUID]] = defaultdict(set)
        for piece in pieces:
            self.collection_of[piece.piece_id] = piece.collection_id
            for type_code, value in piece.identifiers:
                if not value:
                    continue
                self.add((type_code, value), piece.piece_id)
                if number := collection_correlative(type_code, value):
                    self._correlatives[(piece.collection_id, number)].add(piece.piece_id)

    def correlative(self, collection_id: uuid.UUID, number: str) -> set[uuid.UUID]:
        return set(self._correlatives.get((collection_id, str(int(number))), set()))


# --- carpetas: rango y colección pista (D5, D11) --------------------------------------------------

_RANGE_RE = re.compile(r"^(?P<prefix>.*?)[\s_-]*(?P<a>\d+)\s*-\s*(?P<b>\d+)$")
_FOLDER_STOPWORDS = frozenset({"coleccion", "colecciones", "fotos", "foto", "de", "del", "la"})


@dataclass(frozen=True)
class FolderRange:
    prefix: str  # what goes before the numbers: a possible acronym (``ABC``) or ``FOTOS``
    start: int
    end: int

    def contains(self, number: int) -> bool:
        return self.start <= number <= self.end


def folder_range(name: str) -> FolderRange | None:
    """``ABC 001-100``, ``ABC 001 - 100`` or ``FOTOS 051-114``: a range when the second number
    is greater than the first (D11). ``ABC 100-12`` is not a range."""
    match = _RANGE_RE.match(unicodedata.normalize("NFKC", name).strip())
    if match is None:
        return None
    start, end = int(match.group("a")), int(match.group("b"))
    if end <= start:
        return None
    return FolderRange(match.group("prefix").strip(" _-"), start, end)


def _fold(text: str) -> str:
    folded = unicodedata.normalize("NFKD", text.casefold())
    return "".join(c for c in folded if not unicodedata.combining(c))


def _words(text: str) -> list[str]:
    return [word for word in re.findall(r"[a-z0-9]+", _fold(text)) if word]


@dataclass(frozen=True)
class CollectionRef:
    """A collection as the folder hint compares it: its name and its acronyms, current and
    historical (``collection_acronym_alias``), already normalized (``MMZ``)."""

    collection_id: uuid.UUID
    name: str
    acronyms: tuple[str, ...] = ()


def propose_collection(folder_name: str, collections: Iterable[CollectionRef]) -> uuid.UUID | None:
    """The collection whose name, or one of whose acronyms, the folder name contains (D5).

    The name is compared without accents, case, nor the words «colección» and «fotos», so
    ``Fotos Coleccion Juana Perez`` finds «Juana Pérez»; an acronym must be a whole word, also in
    front of a range (``ABC 001-100``). One collection → it; several or none → no proposal.
    """
    words = [word for word in _words(folder_name) if word not in _FOLDER_STOPWORDS]
    if not words:
        return None
    text = f" {' '.join(words)} "
    tokens = {re.sub(r"[^A-Z0-9]", "", token.upper()) for token in folder_name.split()}
    tokens |= {word.upper() for word in words}
    found: set[uuid.UUID] = set()
    for collection in collections:
        name = " ".join(w for w in _words(collection.name) if w not in _FOLDER_STOPWORDS)
        if (name and f" {name} " in text) or any(
            acronym and acronym.upper() in tokens for acronym in collection.acronyms
        ):
            found.add(collection.collection_id)
    return found.pop() if len(found) == 1 else None


# --- plantillas (D4) ------------------------------------------------------------------------------

_MARKER_RE = re.compile(r"(\{[^{}]*\})")
_SEPARATORS_RE = re.compile(r"[\s_-]+")
N_MARKER = "n"
ANY_MARKER = "*"


class TemplateError(ValueError):
    """Why a template is rejected (``422 invalid_photo_template``), in plain words."""

    def __init__(self, reason: str, message: str) -> None:
        super().__init__(message)
        self.reason = reason
        self.message = message


@dataclass(frozen=True)
class TemplateField:
    """A capture group: an identifier type, or the correlative (``{n}``) joined, or not, to the
    collection acronym captured just before it."""

    type_code: str  # identifier type, or ``n``
    joined: bool = False  # ``{COLECCION} {n}``: one value «SIGLA n»


@dataclass(frozen=True)
class PhotoTemplate:
    text: str
    pattern: re.Pattern[str]
    fields: tuple[TemplateField, ...]


def _literal(text: str) -> str:
    parts = _SEPARATORS_RE.split(text)
    return r"[\s_-]*".join(re.escape(part) for part in parts)


def compile_template(
    text: str, valid_types: Collection[str], *, has_collection_hint: bool
) -> PhotoTemplate:
    """The anchored, case-insensitive expression of a template, after validating it (D4)."""
    if text.count("{") != text.count("}") or not text.strip():
        raise TemplateError("malformed", "La plantilla tiene llaves sin cerrar o está vacía.")
    tokens = [token for token in _MARKER_RE.split(text.strip()) if token]
    markers = [token[1:-1].strip() for token in tokens if _MARKER_RE.fullmatch(token)]
    for marker in markers:
        if marker not in (N_MARKER, ANY_MARKER) and marker.upper() not in valid_types:
            raise TemplateError(
                "unknown_type",
                f"«{{{marker}}}» no es un tipo de identificador activo. Tipos válidos: "
                + ", ".join(f"{{{code}}}" for code in sorted(valid_types))
                + ", más {n} y {*}.",
            )
    if all(marker == ANY_MARKER for marker in markers):
        raise TemplateError(
            "no_identifier", "La plantilla necesita al menos un código: {n} o un tipo."
        )
    if markers.count(N_MARKER) > 1:
        raise TemplateError("repeated_n", "La plantilla no puede tener dos {n}.")
    regex: list[str] = []
    fields: list[TemplateField] = []
    for position, token in enumerate(tokens):
        if not _MARKER_RE.fullmatch(token):
            regex.append(_literal(token))
            continue
        marker = token[1:-1].strip()
        rest = tokens[position + 1 :]
        if marker == ANY_MARKER:
            regex.append(".*" if not "".join(rest).strip() else ".+?")
        elif marker == N_MARKER:
            joined = (
                bool(fields)
                and fields[-1].type_code == TYPE_COLLECTION
                and _only_separators(tokens, position)
            )
            if not joined and not has_collection_hint:
                raise TemplateError(
                    "n_without_collection",
                    "{n} necesita una colección: escriba {COLECCION} delante o elija la "
                    "colección de la carpeta.",
                )
            if joined:
                fields[-1] = replace(fields[-1], joined=True)
            regex.append(r"(\d+)")
            fields.append(TemplateField(N_MARKER, joined))
        else:
            type_code = marker.upper()
            next_marker = _next_marker(tokens, position)
            if type_code == TYPE_COLLECTION and next_marker == N_MARKER:
                regex.append(r"([A-Za-z](?:[A-Za-z.\s]*?[A-Za-z.])?)")
            else:
                regex.append("(.+?)")
            fields.append(TemplateField(type_code))
    pattern = re.compile("".join(regex), re.IGNORECASE)
    return PhotoTemplate(text, pattern, tuple(fields))


def _only_separators(tokens: Sequence[str], position: int) -> bool:
    """Only separators between the previous marker and the token at ``position``."""
    for token in reversed(tokens[:position]):
        if _MARKER_RE.fullmatch(token):
            return True
        if _SEPARATORS_RE.sub("", token):
            return False
    return False


def _next_marker(tokens: Sequence[str], position: int) -> str | None:
    for token in tokens[position + 1 :]:
        if _MARKER_RE.fullmatch(token):
            return token[1:-1].strip()
        if _SEPARATORS_RE.sub("", token):
            return None
    return None


@dataclass(frozen=True)
class TemplateCode:
    """A code a template read: its type and value, ``None`` when it could not be normalized."""

    type_code: str
    text: str
    key: CodeKey | None


def read_with_template(
    base: str, template: PhotoTemplate, rules: Mapping[str, NormalizationRule]
) -> list[TemplateCode] | None:
    """The codes a template reads in a cleaned name; ``None`` when the name does not fit."""
    match = template.pattern.fullmatch(base.strip())
    if match is None:
        return None
    values = list(match.groups())
    codes: list[TemplateCode] = []
    for position, item in enumerate(template.fields):
        raw = values[position].strip()
        if item.type_code == N_MARKER:
            if item.joined:
                continue  # read with its acronym, below
            codes.append(TemplateCode(N_MARKER, raw, (COLLECTION_NUMBER, str(int(raw)))))
        elif item.joined:
            text = f"{raw} {values[position + 1]}"
            value = (
                normalized_code(rules[TYPE_COLLECTION], text) if TYPE_COLLECTION in rules else None
            )
            codes.append(
                TemplateCode(TYPE_COLLECTION, text, (TYPE_COLLECTION, value) if value else None)
            )
        else:
            rule = rules.get(item.type_code)
            value = normalized_code(rule, raw) if rule is not None else None
            codes.append(
                TemplateCode(item.type_code, raw, (item.type_code, value) if value else None)
            )
    return codes


# --- sugerencia de plantilla (D4) -----------------------------------------------------------------

#: Known shapes of the names of a folder and the reading they suggest; ``None`` = automatic.
KNOWN_SHAPES: tuple[tuple[re.Pattern[str], str | None, str], ...] = (
    (re.compile(r"9{3}-9{4}( A)?"), "{n}-{*}", "999-9999"),
    (re.compile(r"9+"), "{n}", "9"),
    (re.compile(r"A+ ?9+ ?- ?A+ ?9+"), None, "AAA 999 - AAAA 9999"),
)
SUGGESTION_SHARE = 0.8  # [SUPUESTO] share of names of a folder that must follow the shape


def name_shape(base: str) -> str:
    """Digits → ``9``, letters → ``A``, the rest as it is (``053-3269`` → ``999-9999``)."""
    return "".join("9" if c.isdigit() else "A" if c.isalpha() else c for c in base.strip())


@dataclass(frozen=True)
class TemplateSuggestion:
    shape: str
    template: str | None  # None: the names are read alone (automatic)
    matching: int
    total: int


def suggest_template(names: Sequence[str]) -> TemplateSuggestion | None:
    """The reading suggested for a folder when ≥ 80 % of its names follow one known shape."""
    if not names:
        return None
    counts: dict[int, int] = defaultdict(int)
    for name in names:
        shape = name_shape(read_name(name).base)
        for position, (pattern, _, _) in enumerate(KNOWN_SHAPES):
            if pattern.fullmatch(shape):
                counts[position] += 1
                break
    for position, matching in sorted(counts.items(), key=lambda item: -item[1]):
        if matching / len(names) >= SUGGESTION_SHARE:
            _, template, label = KNOWN_SHAPES[position]
            return TemplateSuggestion(label, template, matching, len(names))
    return None


# --- reglas por carpeta (D4) ----------------------------------------------------------------------


@dataclass(frozen=True)
class FolderRule:
    """The reading rule of a folder as ``import_batch.photo_reading`` stores it."""

    mode: ReadingMode = "auto"
    template: str | None = None
    # Missing: the proposed collection applies; ``None`` set by a person: no collection.
    collection_id: uuid.UUID | None = None
    collection_set: bool = False

    @classmethod
    def from_json(cls, value: Mapping[str, Any] | None) -> "FolderRule":
        value = value or {}
        mode = value.get("mode", "auto")
        raw = value.get("collection_id")
        return cls(
            mode=mode if mode in READING_MODES else "auto",
            template=value.get("template") or None,
            collection_id=uuid.UUID(str(raw)) if raw else None,
            collection_set="collection_id" in value,
        )

    def as_json(self) -> dict[str, Any]:
        value: dict[str, Any] = {"mode": self.mode}
        if self.template:
            value["template"] = self.template
        if self.collection_set:
            value["collection_id"] = str(self.collection_id) if self.collection_id else None
        return value


def folder_path(folders: Sequence[str]) -> str:
    return "/".join(folders)


def rule_path(path: str, rules: Mapping[str, FolderRule]) -> str | None:
    """The folder of the rule that applies to ``path``: itself or the closest ancestor with a
    rule (the longest path wins); ``None`` when only the default rule applies."""
    best: str | None = None
    for candidate in rules:
        if (path == candidate or path.startswith(f"{candidate}/")) and (
            best is None or len(candidate) > len(best)
        ):
            best = candidate
    return best


@dataclass(frozen=True)
class FolderInfo:
    """What the matching knows of a folder (``a/b``): its range, its proposed collection
    (inherited from the closest ancestor with one) and the rule that applies to it."""

    path: str
    name: str
    range: FolderRange | None
    proposed_collection_id: uuid.UUID | None
    rule: FolderRule
    rule_from: str | None  # folder whose rule applies; None = the default rule

    @property
    def collection_id(self) -> uuid.UUID | None:
        """Collection hint: the confirmed one, or the proposed one while not confirmed (D5)."""
        if self.rule.collection_set:
            return self.rule.collection_id
        return self.proposed_collection_id

    @property
    def collection_pending(self) -> bool:
        return not self.rule.collection_set and self.proposed_collection_id is not None


@dataclass(frozen=True)
class PhotoReading:
    """``import_batch.photo_reading``: the default rule, the rules by folder and the
    correspondences list (D4, D7)."""

    default: FolderRule = field(default_factory=FolderRule)
    folders: Mapping[str, FolderRule] = field(default_factory=dict)
    correspondences: tuple[Mapping[str, Any], ...] = ()

    @classmethod
    def from_json(cls, value: Mapping[str, Any] | None) -> "PhotoReading":
        value = value or {}
        return cls(
            default=FolderRule.from_json(value.get("default")),
            folders={
                path: FolderRule.from_json(rule)
                for path, rule in (value.get("folders") or {}).items()
            },
            correspondences=tuple(value.get("correspondences") or ()),
        )

    def as_json(self) -> dict[str, Any]:
        value: dict[str, Any] = {
            "default": self.default.as_json(),
            "folders": {path: rule.as_json() for path, rule in sorted(self.folders.items())},
        }
        if self.correspondences:
            value["correspondences"] = list(self.correspondences)
        return value


def analyze_folders(
    paths: Iterable[str], collections: Sequence[CollectionRef], reading: PhotoReading
) -> dict[str, FolderInfo]:
    """Every folder of the relative paths of a batch, outermost first (D4, D5, D11)."""
    folders: set[str] = set()
    for relative_path in paths:
        parts, _ = split_path(relative_path)
        folders |= {folder_path(parts[: depth + 1]) for depth in range(len(parts))}
    infos: dict[str, FolderInfo] = {}
    for path in sorted(folders, key=lambda item: (item.count("/"), natural_key(item))):
        name = path.rsplit("/", 1)[-1]
        found = folder_range(name)
        proposal = propose_collection(found.prefix if found else name, collections)
        if found and proposal is None:
            proposal = propose_collection(name, collections)
        parent = infos.get(path.rsplit("/", 1)[0]) if "/" in path else None
        if proposal is None and parent is not None:
            proposal = parent.proposed_collection_id
        source = rule_path(path, reading.folders)
        rule = reading.folders[source] if source is not None else reading.default
        infos[path] = FolderInfo(path, name, found, proposal, rule, source)
    return infos


# --- emparejamiento con el catálogo (D3, D4) ------------------------------------------------------


@dataclass(frozen=True)
class CatalogPhoto:
    photo_id: uuid.UUID
    relative_path: str


@dataclass(frozen=True)
class CatalogProposal:
    """Proposed piece of a photo, with the fields ``import_photo`` stores (D2)."""

    photo_id: uuid.UUID
    status: PhotoMatchStatus
    source: PhotoMatchSource | None = None
    piece_id: uuid.UUID | None = None
    candidate_piece_ids: tuple[uuid.UUID, ...] = ()
    reason: str | None = None
    sort_key: int | None = None


@dataclass(frozen=True)
class _Found:
    """The pieces each code of a name found, the numbers it read and why a number was not
    compared."""

    per_code: tuple[frozenset[uuid.UUID], ...]
    numbers: tuple[int, ...] = ()
    unread: int = 0  # codes that found no piece
    bare_number: bool = False

    @property
    def pieces(self) -> set[uuid.UUID]:
        return set().union(*self.per_code) if self.per_code else set()


def _is_number(candidate: CodeCandidate) -> bool:
    return candidate.strength is CandidateStrength.NUMBER or candidate.text.strip().isdigit()


def _numbers(keys: Iterable[CodeKey]) -> list[int]:
    numbers = []
    for type_code, value in keys:
        if type_code == COLLECTION_NUMBER:
            numbers.append(int(value))
        elif number := collection_correlative(type_code, value):
            numbers.append(int(number))
    return numbers


def _by_level(
    reading: NameReading,
    index: CatalogIndex,
    hint: uuid.UUID | None,
    *,
    allow_numbers: bool,
) -> _Found | None:
    """The pieces of the most specific candidate level that finds any, code by code (D3)."""
    bare_number = False
    for strength in CandidateStrength:
        per_code: list[frozenset[uuid.UUID]] = []
        numbers: list[int] = []
        for candidate in reading.candidates:
            if candidate.strength is not strength:
                continue
            if _is_number(candidate):
                if not allow_numbers:
                    continue
                number = next((v for t, v in candidate.keys if t == COLLECTION_NUMBER), None)
                if number is None:
                    continue
                if hint is None:
                    bare_number = True
                    continue
                found = index.correlative(hint, number)
                keys: list[CodeKey] = [(COLLECTION_NUMBER, number)]
            else:
                keys = [key for key in candidate.keys if key[0] != COLLECTION_NUMBER]
                found = index.targets_for_keys(keys)
            if found:
                per_code.append(frozenset(found))
                # Only the codes that found a piece say which correlative was read.
                numbers += _numbers(key for key in keys if index.targets_for_keys([key]))
        if per_code:
            return _Found(tuple(per_code), tuple(numbers))
    return _Found((), bare_number=True) if bare_number else None


def _from_template(
    codes: Sequence[TemplateCode], index: CatalogIndex, hint: uuid.UUID | None
) -> _Found:
    per_code: list[frozenset[uuid.UUID]] = []
    numbers: list[int] = []
    unread = 0
    for code in codes:
        if code.key is None:
            unread += 1
            continue
        if code.key[0] == COLLECTION_NUMBER:
            found = index.correlative(hint, code.key[1]) if hint else set()
        else:
            found = index.targets_for_keys([code.key])
        numbers += _numbers([code.key])
        if found:
            per_code.append(frozenset(found))
        else:
            unread += 1
    return _Found(tuple(per_code), tuple(numbers), unread)


def _proposal(
    photo_id: uuid.UUID,
    found: _Found,
    source: PhotoMatchSource,
    index: CatalogIndex,
    info: FolderInfo | None,
    folder_range_: FolderRange | None,
) -> CatalogProposal:
    pieces = found.pieces
    if not pieces:
        reason = BARE_NUMBER if found.bare_number else None
        return CatalogProposal(photo_id, PhotoMatchStatus.UNMATCHED, reason=reason)
    candidates = tuple(sorted(pieces, key=str))
    if len(set(found.per_code)) > 1:  # two codes of the name point to different pieces
        return CatalogProposal(
            photo_id,
            PhotoMatchStatus.AMBIGUOUS,
            source,
            candidate_piece_ids=candidates,
            reason=DISCREPANT_CODES,
        )
    hint = info.collection_id if info is not None else None
    if hint is not None:
        inside = {piece for piece in pieces if index.collection_of.get(piece) == hint}
        if not inside:
            return CatalogProposal(
                photo_id,
                PhotoMatchStatus.UNMATCHED,
                candidate_piece_ids=candidates,
                reason=OTHER_COLLECTION,
            )
        pieces, candidates = inside, tuple(sorted(inside, key=str))
    if len(pieces) > 1:
        return CatalogProposal(
            photo_id, PhotoMatchStatus.AMBIGUOUS, source, candidate_piece_ids=candidates
        )
    (piece_id,) = pieces
    reason = PARTIAL_CODES if found.unread else None
    if folder_range_ is not None and any(not folder_range_.contains(n) for n in found.numbers):
        reason = reason or OUT_OF_RANGE
    return CatalogProposal(photo_id, PhotoMatchStatus.MATCHED, source, piece_id, reason=reason)


def pieces_for_code(
    code: str,
    index: CatalogIndex,
    *,
    type_code: str | None = None,
    rules: Mapping[str, NormalizationRule] = DEFAULT_RULES,
) -> set[uuid.UUID]:
    """Pieces of one code of the correspondences list (D7): normalized with its type when it
    has one, otherwise read as in automatic mode, with the protections of D3 (a number alone
    finds nothing: there is no collection to compare it with)."""
    if type_code is not None:
        rule = rules.get(type_code)
        value = normalized_code(rule, code) if rule is not None else None
        return index.targets_for_keys([(type_code, value)]) if value else set()
    found = _by_level(read_name(code, is_file=False, rules=rules), index, None, allow_numbers=True)
    return found.pieces if found is not None else set()


def _closest_range(folders: Sequence[str], infos: Mapping[str, FolderInfo]) -> FolderRange | None:
    for depth in range(len(folders), 0, -1):
        info = infos.get(folder_path(folders[:depth]))
        if info is not None and info.range is not None:
            return info.range
    return None


def match_one(
    photo: CatalogPhoto,
    index: CatalogIndex,
    infos: Mapping[str, FolderInfo],
    *,
    rules: Mapping[str, NormalizationRule] = DEFAULT_RULES,
    valid_types: Collection[str] | None = None,
    camera_patterns: Sequence[re.Pattern[str]] = (),
    default_rule: FolderRule | None = None,
) -> tuple[CatalogProposal, NameReading]:
    """Proposed piece of one photo by its name and its folders (D3, D4)."""
    folders, file_name = split_path(photo.relative_path)
    info = infos.get(folder_path(folders))
    rule = info.rule if info is not None else (default_rule or FolderRule())
    hint = info.collection_id if info is not None else None
    the_range = _closest_range(folders, infos)
    reading = read_name(file_name, rules=rules, camera_patterns=camera_patterns)
    if rule.mode == "camera":
        return CatalogProposal(
            photo.photo_id, PhotoMatchStatus.UNMATCHED, reason=CAMERA_NAME
        ), reading
    if rule.mode == "template" and rule.template:
        types = valid_types if valid_types is not None else rules.keys()
        try:
            template = compile_template(rule.template, types, has_collection_hint=hint is not None)
        except TemplateError:
            return CatalogProposal(
                photo.photo_id, PhotoMatchStatus.UNMATCHED, reason=TEMPLATE_MISMATCH
            ), reading
        codes = read_with_template(reading.base, template, rules)
        if codes is None:
            return CatalogProposal(
                photo.photo_id, PhotoMatchStatus.UNMATCHED, reason=TEMPLATE_MISMATCH
            ), reading
        found = _from_template(codes, index, hint)
        if not found.pieces:
            return CatalogProposal(photo.photo_id, PhotoMatchStatus.UNMATCHED), reading
        return _proposal(
            photo.photo_id, found, PhotoMatchSource.TEMPLATE, index, info, the_range
        ), reading
    # automatic
    found = _by_level(reading, index, hint, allow_numbers=True)
    if found is not None and found.pieces:
        return _proposal(
            photo.photo_id, found, PhotoMatchSource.FILENAME, index, info, the_range
        ), reading
    for depth in range(len(folders), 0, -1):  # closest folder first
        folder = infos.get(folder_path(folders[:depth]))
        if folder is None or folder.range is not None:
            continue  # a range folder is never a code (D11)
        folder_found = _by_level(
            read_name(folder.name, is_file=False, rules=rules), index, hint, allow_numbers=False
        )
        if folder_found is not None and folder_found.pieces:
            return _proposal(
                photo.photo_id, folder_found, PhotoMatchSource.FOLDER, index, info, the_range
            ), reading
    reason = CAMERA_NAME if reading.camera_name else BARE_NUMBER if found else None
    return CatalogProposal(photo.photo_id, PhotoMatchStatus.UNMATCHED, reason=reason), reading


def match_catalog_photos(
    photos: Sequence[CatalogPhoto],
    index: CatalogIndex,
    infos: Mapping[str, FolderInfo],
    *,
    rules: Mapping[str, NormalizationRule] = DEFAULT_RULES,
    valid_types: Collection[str] | None = None,
    camera_patterns: Sequence[re.Pattern[str]] = (),
    preset: Mapping[uuid.UUID, CatalogProposal] | None = None,
    default_rule: FolderRule | None = None,
) -> list[CatalogProposal]:
    """Proposed piece of every photo, in the order of ``photos``; ``preset`` proposals (the
    correspondences list, D7) win over the reading of the name. The photos of a piece are
    numbered in the natural order of their names."""
    preset = preset or {}
    proposals: dict[uuid.UUID, CatalogProposal] = {}
    per_piece: dict[uuid.UUID, list[tuple[tuple[object, ...], uuid.UUID]]] = defaultdict(list)
    for photo in photos:
        _, file_name = split_path(photo.relative_path)
        reading = read_name(file_name, rules=rules, camera_patterns=camera_patterns)
        if photo.photo_id in preset:
            proposal = preset[photo.photo_id]
        else:
            proposal, reading = match_one(
                photo,
                index,
                infos,
                rules=rules,
                valid_types=valid_types,
                camera_patterns=camera_patterns,
                default_rule=default_rule,
            )
        proposals[photo.photo_id] = proposal
        if proposal.status is PhotoMatchStatus.MATCHED and proposal.piece_id is not None:
            order = (*order_key(reading), natural_key(photo.relative_path))
            per_piece[proposal.piece_id].append((order, photo.photo_id))
    for items in per_piece.values():
        for position, (_, photo_id) in enumerate(sorted(items), start=1):
            proposals[photo_id] = replace(proposals[photo_id], sort_key=position)
    return [proposals[photo.photo_id] for photo in photos]
