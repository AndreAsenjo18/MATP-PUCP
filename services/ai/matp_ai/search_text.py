"""Texto que sobra de una búsqueda con IA (RIA-06; change busqueda-ia-sin-palabras-genericas).

«piezas de madera procedentes de Ayacucho» ya se traduce a los filtros material «Madera» y
procedencia «Ayacucho»; lo que sobra («piezas de … procedentes de») no es algo que buscar como texto
libre: con «pieza» en ``q`` la búsqueda exige esa palabra en la ficha y casi no devuelve nada. Se
limpia aquí, igual para cualquier proveedor y sin gastar tokens del modelo:

- se quitan las palabras genéricas para «pieza» («pieza», «objeto», «obra»…) en cualquier lugar;
- se quitan los valores que ya se volvieron filtros (si el modelo los repite en ``q``);
- se recortan al inicio y al final los conectores y verbos de pedido («muéstrame las … de»);
- si no queda nada con sentido, ``q`` es ``None``.

El texto del medio se conserva tal cual: «toro de Pucará» sigue siendo una frase.
"""

import re
import unicodedata

from matp_ai.schemas import SearchInterpretation

#: Palabras que en una búsqueda del museo significan «pieza», sin aportar nada que buscar.
GENERIC_NOUNS = frozenset(
    {
        "pieza", "piezas", "objeto", "objetos", "obra", "obras", "bien", "bienes",
        "articulo", "articulos", "item", "items", "cosa", "cosas", "registro", "registros",
    }
)  # fmt: skip

#: Conectores y verbos de pedido que sobran al inicio o al final del texto.
FILLER = GENERIC_NOUNS | frozenset(
    {
        "muestrame", "muestra", "mostrar", "busca", "buscar", "buscame", "busco", "quiero",
        "ver", "dame", "encuentra", "encontrar", "lista", "listar", "todas", "todos", "toda",
        "todo", "las", "los", "la", "el", "lo", "un", "una", "unos", "unas", "de", "del", "con",
        "en", "que", "y", "e", "o", "u", "a", "al", "por", "para", "su", "sus", "hay", "tenga",
        "tengan", "tiene", "tienen", "son", "sean", "esten", "estan", "procedentes",
        "procedente", "provenientes", "proveniente", "procedencia", "hechas", "hechos", "hecha",
        "hecho", "elaboradas", "elaborados", "elaborada", "elaborado", "material", "materiales",
        "museo", "me", "mi", "se", "sobre",
    }
)  # fmt: skip


def _fold(text: str) -> str:
    folded = unicodedata.normalize("NFKD", text.casefold())
    return "".join(c for c in folded if not unicodedata.combining(c))


def _key(token: str) -> str:
    return re.sub(r"[^\w]", "", _fold(token))


def clean_query(q: str | None, used_values: list[str | None] | None = None) -> str | None:
    """``q`` sin palabras genéricas, sin los valores ya usados como filtros y sin conectores en
    los bordes; ``None`` si no queda nada que buscar."""
    if not q:
        return None
    tokens = q.split()
    keys = [_key(token) for token in tokens]
    # Values already turned into filters: drop each run of tokens that spells one of them.
    for value in used_values or []:
        if not value:
            continue
        value_keys = [_key(part) for part in value.split() if _key(part)]
        if not value_keys:
            continue
        index = 0
        while index + len(value_keys) <= len(keys):
            if keys[index : index + len(value_keys)] == value_keys:
                del tokens[index : index + len(value_keys)]
                del keys[index : index + len(value_keys)]
            else:
                index += 1
    kept = [(token, key) for token, key in zip(tokens, keys, strict=True)]
    kept = [(token, key) for token, key in kept if key and key not in GENERIC_NOUNS]
    while kept and kept[0][1] in FILLER:
        kept.pop(0)
    while kept and kept[-1][1] in FILLER:
        kept.pop()
    text = " ".join(token for token, _key_ in kept).strip(" ,.;:")
    return text or None


def clean_interpretation(result: SearchInterpretation) -> SearchInterpretation:
    """La interpretación con ``q`` limpio (los filtros no cambian)."""
    used = [
        result.category,
        result.material,
        result.conservation_state,
        result.location,
        result.tenure_regime,
        result.provenance,
        result.author,
    ]
    return result.model_copy(update={"q": clean_query(result.q, used)})
