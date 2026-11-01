"""Current normalization parameters, read from the database (spec identificacion-piezas;
change plantillas-mapeo-y-normalizacion, task 2.2, design D5).

``load_params`` reads the active rows of ``normalization_setting`` and the active aliases of
``collection_acronym_alias`` in two queries. A key without a row (the databases built from the
models have none) or with a value that cannot be read keeps the constant of
``normalization.py``, so the normalizer behaves as before those values became data.

``session_params`` keeps the result in ``session.info`` for the whole session (one request, or
one stage of an import batch): the parameters are read once, never per row or per piece. A
flush that writes a parameter or an alias drops the copy, so the next call sees the change.
"""

import logging
import re
import uuid
from collections.abc import Iterable, Mapping
from typing import Any

from sqlalchemy import event, select
from sqlalchemy.orm import Session

from app.modules.collections.models import Collection
from app.modules.identification.models import (
    ABSENCE_MARKERS_KEY,
    CONCATENATION_SEPARATORS_KEY,
    PHOTO_CAMERA_PATTERNS_KEY,
    TENURE_ALIASES_KEY,
    CollectionAcronymAlias,
    NormalizationSetting,
)
from app.modules.identification.normalization import (
    DEFAULT_PARAMS,
    NormalizationParams,
    fold_label,
)

logger = logging.getLogger("matp.normalization")

SESSION_KEY = "matp.normalization_params"


def _strings(value: Any) -> list[str] | None:
    if isinstance(value, list) and all(isinstance(item, str) for item in value):
        return value
    return None


def _valid_pattern(pattern: str) -> bool:
    try:
        re.compile(pattern)
    except re.error:
        return False
    return True


def params_from_rows(
    settings: Mapping[str, Any],
    aliases: Iterable[tuple[str, uuid.UUID, str | None]] = (),
) -> NormalizationParams:
    """The parameters for these rows: ``settings`` by key and ``(alias, collection_id,
    collection acronym)``. A missing key or an unreadable value keeps its default."""
    absence_markers = DEFAULT_PARAMS.absence_markers
    separators = DEFAULT_PARAMS.separators
    unsplit_markers = DEFAULT_PARAMS.unsplit_markers
    if ABSENCE_MARKERS_KEY in settings:
        markers = _strings(settings[ABSENCE_MARKERS_KEY])
        if markers is None:
            logger.warning(
                "Valor ilegible de %s: se usan los valores de código.", ABSENCE_MARKERS_KEY
            )
        else:
            absence_markers = frozenset(
                NormalizationParams.marker_key(marker) for marker in markers
            )
    if CONCATENATION_SEPARATORS_KEY in settings:
        value = settings[CONCATENATION_SEPARATORS_KEY]
        found = _strings(value.get("separators")) if isinstance(value, dict) else None
        unsplit = _strings(value.get("unsplit_markers", [])) if isinstance(value, dict) else None
        if found is None or unsplit is None or any(not separator for separator in found):
            logger.warning(
                "Valor ilegible de %s: se usan los valores de código.", CONCATENATION_SEPARATORS_KEY
            )
        else:
            separators, unsplit_markers = tuple(found), tuple(unsplit)
    tenure_aliases = DEFAULT_PARAMS.tenure_aliases
    if TENURE_ALIASES_KEY in settings:
        value = settings[TENURE_ALIASES_KEY]
        if isinstance(value, dict) and all(
            isinstance(k, str) and k.strip() and isinstance(v, str) for k, v in value.items()
        ):
            tenure_aliases = {fold_label(k): v for k, v in value.items()}
        else:
            logger.warning(
                "Valor ilegible de %s: se usan los valores de código.", TENURE_ALIASES_KEY
            )
    camera_patterns: tuple[str, ...] = ()
    if PHOTO_CAMERA_PATTERNS_KEY in settings:
        patterns = _strings(settings[PHOTO_CAMERA_PATTERNS_KEY])
        if patterns is None or not all(_valid_pattern(pattern) for pattern in patterns):
            logger.warning(
                "Valor ilegible de %s: no se usan patrones adicionales.", PHOTO_CAMERA_PATTERNS_KEY
            )
        else:
            camera_patterns = tuple(patterns)
    acronym_aliases: dict[str, str] = {}
    alias_collection_ids: dict[str, uuid.UUID] = {}
    for alias, collection_id, acronym in aliases:
        alias_collection_ids[alias] = collection_id
        if acronym:
            acronym_aliases[alias] = acronym
    return NormalizationParams(
        absence_markers=absence_markers,
        separators=separators,
        unsplit_markers=unsplit_markers,
        acronym_aliases=acronym_aliases,
        alias_collection_ids=alias_collection_ids,
        tenure_aliases=tenure_aliases,
        photo_camera_patterns=camera_patterns,
    )


def load_params(session: Session) -> NormalizationParams:
    """Two queries: the active settings and the active aliases of active collections."""
    settings = dict(
        session.execute(
            select(NormalizationSetting.key, NormalizationSetting.value).where(
                NormalizationSetting.deleted_at.is_(None)
            )
        ).all()
    )
    aliases = session.execute(
        select(
            CollectionAcronymAlias.alias_normalized,
            CollectionAcronymAlias.collection_id,
            Collection.acronym_normalized,
        )
        .join(Collection, Collection.id == CollectionAcronymAlias.collection_id)
        .where(CollectionAcronymAlias.deleted_at.is_(None), Collection.deleted_at.is_(None))
    ).all()
    return params_from_rows(settings, [(alias, cid, acronym) for alias, cid, acronym in aliases])


def session_params(session: Session) -> NormalizationParams:
    """The current parameters, read once per session."""
    params = session.info.get(SESSION_KEY)
    if not isinstance(params, NormalizationParams):
        params = load_params(session)
        session.info[SESSION_KEY] = params
    return params


_PARAMETER_MODELS = (NormalizationSetting, CollectionAcronymAlias, Collection)


@event.listens_for(Session, "after_flush")
def _drop_cached_params(session: Session, _flush_context: object) -> None:
    """A flush that writes a parameter, an alias or a collection (its acronym is the target of
    the aliases) drops the copy of the session."""
    if SESSION_KEY not in session.info:
        return
    changed = (*session.new, *session.dirty, *session.deleted)
    if any(isinstance(obj, _PARAMETER_MODELS) for obj in changed):
        session.info.pop(SESSION_KEY, None)
