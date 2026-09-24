"""Catalog enumerations shared by several modules."""

import enum


class TenureRegime(enum.StrEnum):
    """Régimen de tenencia (RF-005). Only OWNED pieces may receive an inventory code I."""

    OWNED = "OWNED"  # propiedad (PUCP única propietaria legal, RN-006)
    LOAN_FOR_USE = "LOAN_FOR_USE"  # comodato / consignación (RN-003, RN-008)
    TEMPORARY_LOAN = "TEMPORARY_LOAN"  # préstamo temporal, fuera del inventario (RN-004)


class PeriodType(enum.StrEnum):
    """Structured interpretation of the free-text period (RF-007)."""

    CENTURY = "CENTURY"
    DECADE = "DECADE"
    YEAR = "YEAR"
    RANGE = "RANGE"
    APPROXIMATE = "APPROXIMATE"
    RELATIVE_AGE = "RELATIVE_AGE"
    UNKNOWN = "UNKNOWN"


LEGAL_OWNER_PUCP = "Pontificia Universidad Católica del Perú"
