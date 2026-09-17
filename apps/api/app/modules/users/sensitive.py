"""Sensitive field policy (spec usuarios-roles: RF-041, RNF-014).

[SUPUESTO] The list of sensitive fields and the permission that unlocks each one are pending
validation with the museum (docs/preguntas-contraparte.md, B7).
"""

from app.modules.locations.models import LocationLevel

PERM_VALUATION = "sensitive.valuation"
PERM_EXACT_LOCATION = "sensitive.exact_location"
PERM_LOAN_TERMS = "sensitive.loan_terms"
PERM_DONOR_DATA = "sensitive.donor_data"

# Piece fields hidden unless the user has the permission.
PIECE_SENSITIVE_FIELDS: dict[str, str] = {
    "lender_name": PERM_DONOR_DATA,
    "loan_agreement_ref": PERM_LOAN_TERMS,
}

COLLECTION_SENSITIVE_FIELDS: dict[str, str] = {
    "origin_description": PERM_DONOR_DATA,
}

# Location levels always visible; deeper levels are "exact location".
PUBLIC_LOCATION_LEVELS = frozenset({LocationLevel.SITE, LocationLevel.SPACE})
