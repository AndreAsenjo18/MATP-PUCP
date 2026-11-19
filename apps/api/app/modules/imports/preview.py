"""«Así quedaría la ficha» de una fila del lote (change importacion-vista-previa-ficha; RF-025).

What the person reviews before approving: the mapped data of the row as the sheet of the new piece
would show it, with names instead of codes (terms, collection) and the path of the location. Only
reads; built for the rows of one page at once.
"""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.enums import TENURE_REGIME_LABELS
from app.modules.catalog.enums import TenureRegime
from app.modules.collections.models import Collection, Term, Vocabulary
from app.modules.imports.mapping import ACQUISITION_VOCABULARY
from app.modules.imports.models import ImportRow
from app.modules.locations.models import Location

#: Fields of the sheet taken as they were mapped.
TEXT_FIELDS = (
    "denomination",
    "description",
    "author",
    "provenance",
    "epoch_original_text",
    "dimensions_text",
    "entry_date",
    "notes",
)


def build_previews(session: Session, rows: list[ImportRow]) -> dict[uuid.UUID, dict[str, Any]]:
    """The preview of each row with mapped data, by row id."""
    mapped = {row.id: row.mapped_data for row in rows if row.mapped_data}
    if not mapped:
        return {}
    vocabularies: set[str] = set()
    collection_ids: set[uuid.UUID] = set()
    for data in mapped.values():
        vocabularies.update((data.get("terms") or {}).keys())
        if data.get("acquisition_method"):
            vocabularies.add(ACQUISITION_VOCABULARY)
        if data.get("collection_id"):
            collection_ids.add(uuid.UUID(data["collection_id"]))
    labels: dict[tuple[str, str], str] = {}
    if vocabularies:
        for vocabulary, code, label in session.execute(
            select(Vocabulary.code, Term.code, Term.label)
            .join(Term, Term.vocabulary_id == Vocabulary.id)
            .where(Vocabulary.code.in_(vocabularies), Term.deleted_at.is_(None))
        ):
            labels[(vocabulary, code)] = label
    collections = (
        dict(
            session.execute(
                select(Collection.id, Collection.name).where(Collection.id.in_(collection_ids))
            ).all()
        )
        if collection_ids
        else {}
    )
    paths = _location_paths(session) if any(d.get("location_id") for d in mapped.values()) else {}
    return {row_id: _preview(data, labels, collections, paths) for row_id, data in mapped.items()}


def _location_paths(session: Session) -> dict[str, str]:
    """«Sede › Depósito 1 › Rack A» by location id."""
    nodes = {
        str(location_id): (str(parent_id) if parent_id else None, name)
        for location_id, parent_id, name in session.execute(
            select(Location.id, Location.parent_id, Location.name).where(
                Location.deleted_at.is_(None)
            )
        )
    }

    def path(location_id: str) -> str:
        names: list[str] = []
        current: str | None = location_id
        while current is not None and current in nodes and len(names) < 10:
            parent, name = nodes[current]
            names.append(name)
            current = parent
        return " › ".join(reversed(names))

    return {location_id: path(location_id) for location_id in nodes}


def _preview(
    data: dict[str, Any],
    labels: dict[tuple[str, str], str],
    collections: dict[uuid.UUID, str],
    paths: dict[str, str],
) -> dict[str, Any]:
    fields = data.get("fields") or {}
    terms = data.get("terms") or {}

    def term_labels(vocabulary: str) -> list[str]:
        return [labels.get((vocabulary, code), code) for code in terms.get(vocabulary) or []]

    def first(vocabulary: str) -> str | None:
        found = term_labels(vocabulary)
        return found[0] if found else None

    collection_id = data.get("collection_id")
    location_id = data.get("location_id")
    acquisition = data.get("acquisition_method")
    return {
        **{name: fields.get(name) for name in TEXT_FIELDS},
        "tenure_regime": _tenure_label(data.get("tenure_regime")),
        "collection": collections.get(uuid.UUID(collection_id)) if collection_id else None,
        "codes": [
            {"type": item.get("type"), "value": item.get("original_value")}
            for item in data.get("identifiers") or []
            if not item.get("is_absent") and item.get("original_value")
        ],
        "materials": term_labels("MATERIAL"),
        "object_type": first("OBJECT_TYPE"),
        "category": first("CATEGORY"),
        "conservation_status": first("CONSERVATION_STATUS"),
        "acquisition_method": labels.get((ACQUISITION_VOCABULARY, acquisition), acquisition)
        if acquisition
        else None,
        "dimensions": data.get("dimensions") or [],
        "location": paths.get(location_id) if location_id else None,
        "location_text": data.get("location_text"),
        "unmatched_terms": {
            vocabulary: list(texts)
            for vocabulary, texts in (data.get("unmatched_terms") or {}).items()
            if texts
        },
    }


def _tenure_label(value: str | None) -> str | None:
    """«Propiedad», «Comodato» or «Préstamo temporal» instead of the internal code."""
    if not value:
        return None
    try:
        return TENURE_REGIME_LABELS.get(TenureRegime(value), value)
    except ValueError:
        return value
