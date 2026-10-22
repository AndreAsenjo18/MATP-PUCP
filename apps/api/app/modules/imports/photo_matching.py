"""Proposed matching between the photos of an import batch and its rows (RF-045, RF-023).

Change importacion-masiva-fotografias, design D3. This part (task 3.1) reads the name of a photo,
or of a folder: it removes the extension and the sequence, view and copy suffixes, and extracts the
code candidates, normalized with the same rules as the row identifiers (``normalize`` of
``identification.normalization``, one rule per identifier type). Nothing here reads or writes the
database: a proposal reaches the catalogue only when a person approves the batch (RN-009 by
analogy).

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
from collections.abc import Mapping
from dataclasses import dataclass

from app.modules.identification.models import NormalizationRule, NormalizationStatus
from app.modules.identification.normalization import DEFAULT_RULES, normalize

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
