"""Equivalencias entre los valores del contrato del equipo y los códigos internos.

El contrato (`docs/fuentes/endpoints-api-v1.yaml`) usa etiquetas en español (`Propiedad`,
`Comodato`, `Frontal`, …); el dominio usa códigos en inglés (ADR-002). La traducción vive solo
aquí (change `alinear-api-endpoints-v1`, design D3) para que ninguna respuesta exponga los
códigos internos y para que un valor inválido liste los admitidos.
"""

from typing import Literal

from app.core.errors import ValidationFailed
from app.modules.catalog.enums import TenureRegime
from app.modules.locations.models import LocationLevel

#: Valores del contrato para el régimen de tenencia (endpoints-api-v1.yaml).
TenureRegimeLabel = Literal["Propiedad", "Comodato", "Préstamo Temporal"]

#: Valores del contrato para el nivel de ubicación (RF-016).
LocationLevelLabel = Literal["Sede", "Depósito", "Mueble", "Nivel", "Contenedor"]

#: Régimen de tenencia (contrato: `tenure_regime`; RF-005).
TENURE_REGIME_LABELS: dict[TenureRegime, str] = {
    TenureRegime.OWNED: "Propiedad",
    TenureRegime.LOAN_FOR_USE: "Comodato",
    TenureRegime.TEMPORARY_LOAN: "Préstamo Temporal",
}

#: Nivel de la jerarquía de ubicaciones (contrato: `level_type`; RF-016).
LOCATION_LEVEL_LABELS: dict[LocationLevel, str] = {
    LocationLevel.SITE: "Sede",
    LocationLevel.SPACE: "Depósito",
    LocationLevel.FURNITURE: "Mueble",
    LocationLevel.SHELF_LEVEL: "Nivel",
    LocationLevel.CONTAINER: "Contenedor",
}

#: Tipo de vista de una fotografía (contrato: `view_type`; RF-013). Los códigos son los términos
#: sembrados del vocabulario PHOTO_VIEW_TYPE; `Superior` no está en el contrato y se expone con su
#: etiqueta del vocabulario.
PHOTO_VIEW_TYPE_LABELS: dict[str, str] = {
    "FRONTAL": "Frontal",
    "PERFIL": "Perfil",
    "POSTERIOR": "Posterior",
    "DETALLE": "Detalle",
    "ABIERTA": "Abierto",
    "CERRADA": "Cerrado",
}


def label_of[K: str](labels: dict[K, str], code: K | None) -> str | None:
    """Etiqueta del contrato para un código interno (None si no hay código)."""
    if code is None:
        return None
    return labels.get(code, str(code))


def serialize_label[K: str](labels: dict[K, str], value: K | str | None) -> str | None:
    """Etiqueta del contrato para un valor de salida (código interno o etiqueta).

    Acepta el miembro del enumerado, el código en inglés o la etiqueta en español
    (idempotente) para que la traducción en la frontera cubra la validación
    `from_attributes`, la construcción manual y los ejemplos.
    """
    if value is None:
        return None
    hit = labels.get(value)  # type: ignore[call-overload]
    if hit is not None:
        return hit
    text = value if isinstance(value, str) else str(value)
    return text


def code_of[K: str](labels: dict[K, str], label: str, field: str) -> K:
    """Código interno para una etiqueta del contrato; error de validación si no existe."""
    for code, candidate in labels.items():
        if candidate.casefold() == label.casefold():
            return code
    admitidos = ", ".join(f'"{value}"' for value in labels.values())
    raise ValidationFailed(
        f'"{label}" no es un valor válido de {field}. Valores admitidos: {admitidos}.',
        details={"field": field, "allowed": list(labels.values())},
    )
