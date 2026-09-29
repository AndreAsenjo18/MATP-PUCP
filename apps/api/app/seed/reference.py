"""Reference data: identifier types, vocabularies, roles and permissions.

All lists are [SUPUESTO] until the museum validates them (docs/preguntas-contraparte.md B4, B5,
B6, B7, C2). They are data, not code: they can be changed without migrations (RN-010).
"""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.models_base import new_uuid
from app.modules.collections.models import Term, Vocabulary, VocabularyCode
from app.modules.identification.models import IdentifierType, NormalizationRule
from app.modules.identification.normalization import (
    TYPE_COLLECTION,
    TYPE_INC_RN,
    TYPE_INVENTORY,
    TYPE_OTHER,
    TYPE_OWNER,
    TYPE_PUCP,
)
from app.modules.users.models import Permission, Role, RolePermission

IDENTIFIER_TYPES = [
    # code, label, rule, unique_current, locks, owned_only, allowed_for_temporary_loan
    (TYPE_INVENTORY, "Código de inventario general (I)", NormalizationRule.INVENTORY,
     True, True, True, False),
    (TYPE_COLLECTION, "Código de colección", NormalizationRule.COLLECTION,
     False, False, False, False),
    (TYPE_INC_RN, "Código INC / Registro Nacional", NormalizationRule.INC_RN,
     False, False, False, True),
    (TYPE_PUCP, "Código PUCP", NormalizationRule.GENERIC, False, False, False, True),
    (TYPE_OWNER, "Código del propietario o comodante", NormalizationRule.GENERIC,
     False, False, False, True),
    (TYPE_OTHER, "Otro código histórico", NormalizationRule.GENERIC, False, False, False, True),
]  # fmt: skip

VOCABULARIES: dict[str, tuple[str, list[tuple[str, str]]]] = {
    VocabularyCode.CATEGORY: (
        "Categorías (tipologías)",
        [
            ("RETABLO", "Retablo"),
            ("TEXTIL", "Textil"),
            ("CERAMICA", "Cerámica"),
            ("MATE_BURILADO", "Mate burilado"),
            ("MASCARA", "Máscara"),
            ("IMAGINERIA", "Imaginería"),
            ("JUGUETE", "Juguete popular"),
            ("PLATERIA", "Platería"),
            ("INSTRUMENTO_MUSICAL", "Instrumento musical"),
            ("PINTURA_POPULAR", "Pintura popular"),
        ],
    ),
    VocabularyCode.MATERIAL: (
        "Materiales",
        [
            ("MADERA", "Madera"),
            ("ARCILLA", "Arcilla"),
            ("LANA", "Lana"),
            ("ALGODON", "Algodón"),
            ("PLATA", "Plata"),
            ("CALABAZA", "Calabaza"),
            ("YESO", "Yeso"),
            ("PASTA_PAPA", "Pasta de papa"),
            ("CUERO", "Cuero"),
            ("PIGMENTO", "Pigmentos"),
        ],
    ),
    VocabularyCode.TECHNIQUE: (
        "Técnicas",
        [
            ("TALLADO", "Tallado"),
            ("MODELADO", "Modelado"),
            ("TEJIDO_TELAR", "Tejido en telar"),
            ("BURILADO", "Burilado"),
            ("POLICROMADO", "Policromado"),
            ("REPUJADO", "Repujado"),
        ],
    ),
    VocabularyCode.CONSERVATION_STATUS: (
        "Estados de conservación",
        [
            ("BUENO", "Bueno"),
            ("REGULAR", "Regular"),
            ("MALO", "Malo"),
            ("EN_RESTAURACION", "En restauración"),
        ],
    ),
    VocabularyCode.ACQUISITION_METHOD: (
        "Formas de adquisición",
        [
            ("DONACION", "Donación"),
            ("COMPRA", "Compra"),
            ("TRANSFERENCIA", "Transferencia interna"),
            ("COMODATO", "Comodato"),
            ("LEGADO", "Legado"),
            ("DESCONOCIDA", "Desconocida"),
        ],
    ),
    VocabularyCode.PHOTO_VIEW_TYPE: (
        "Tipos de vista fotográfica",
        [
            ("FRONTAL", "Frontal"),
            ("PERFIL", "Perfil"),
            ("POSTERIOR", "Posterior"),
            ("SUPERIOR", "Superior"),
            ("DETALLE", "Detalle"),
            ("ABIERTA", "Abierta"),
            ("CERRADA", "Cerrada"),
        ],
    ),
    VocabularyCode.OBJECT_TYPE: (
        "Tipos de bien",
        [
            ("BIEN_MUEBLE", "Bien mueble"),
            ("CONJUNTO", "Conjunto"),
            ("COMPONENTE", "Componente de conjunto"),
        ],
    ),
    VocabularyCode.AVAILABILITY: (
        "Disponibilidad",
        [
            ("EN_DEPOSITO", "En depósito"),
            ("EN_SALA", "En sala"),
            ("EN_PRESTAMO", "En préstamo"),
            ("EN_EXPOSICION_TEMPORAL", "En exposición temporal"),
            ("EN_RESTAURACION", "En restauración"),
            ("NO_LOCALIZADA", "No localizada"),
        ],
    ),
    VocabularyCode.USAGE_RESTRICTION: (
        "Restricciones de uso de imágenes",
        [
            ("SIN_RESTRICCION", "Sin restricción"),
            ("SOLO_USO_INTERNO", "Solo uso interno"),
            ("NO_PUBLICAR", "No publicar"),
            ("AUTORIZACION_COMODANTE", "Requiere autorización del comodante"),
        ],
    ),
}

ROLES = [
    # code, name, enabled
    ("ADMIN", "Administrador", True),
    ("COLLECTIONS_MANAGER", "Gestor de colecciones (Curadora)", True),
    ("CATALOGUER", "Catalogador / practicante", True),
    ("CONSERVATION", "Conservación", True),
    ("STORAGE_STAFF", "Personal auxiliar de depósito", True),
    ("INTERNAL_VIEWER", "Consulta interna", True),
    ("EXTERNAL_RESEARCHER", "Consulta externa / investigador (desactivado en fase 1)", False),
]

PERMISSIONS = {
    "pieces.read": "Consultar fichas de piezas",
    "pieces.create": "Registrar piezas",
    "pieces.update": "Editar fichas de piezas",
    "pieces.delete": "Eliminar piezas lógicamente",
    "pieces.restore": "Restaurar piezas eliminadas",
    "identifiers.manage": "Registrar identificadores",
    "identifiers.correct_inventory_code": "Corregir código I (procedimiento auditado)",
    "collections.manage": "Administrar colecciones",
    "vocabularies.manage": "Administrar vocabularios y tipos de identificador",
    "media.upload": "Subir fotografías y documentos",
    "media.retire": "Retirar fotografías",
    "locations.manage": "Administrar ubicaciones",
    "movements.register": "Registrar movimientos y verificaciones",
    "conservation.assess": "Registrar evaluaciones de conservación",
    "imports.prepare": "Preparar cargas masivas",
    "imports.approve": "Aprobar cargas masivas",
    "imports.revert": "Revertir cargas masivas",
    "duplicates.resolve": "Resolver candidatos a duplicado",
    "ai.request": "Solicitar sugerencias de IA",
    "ai.review": "Aprobar o rechazar sugerencias de IA",
    "reports.view": "Ver reportes",
    "exports.run": "Exportar resultados",
    "exports.full": "Exportación completa de la base",
    "audit.read": "Consultar auditoría",
    "users.manage": "Administrar usuarios y roles",
    "sensitive.valuation": "Ver valorización",
    "sensitive.exact_location": "Ver ubicación exacta",
    "sensitive.loan_terms": "Ver condiciones de comodato",
    "sensitive.donor_data": "Ver datos de donantes y comodantes",
}

_ALL = set(PERMISSIONS)
_READ = {"pieces.read", "reports.view"}
ROLE_PERMISSIONS: dict[str, set[str]] = {
    "ADMIN": _ALL,
    "COLLECTIONS_MANAGER": _ALL - {"users.manage", "exports.full", "imports.revert"},
    "CATALOGUER": _READ
    | {
        "pieces.create",
        "pieces.update",
        "identifiers.manage",
        "media.upload",
        "movements.register",
        "imports.prepare",
        "ai.request",
        "exports.run",
        "sensitive.exact_location",
    },
    "CONSERVATION": _READ
    | {"conservation.assess", "media.upload", "movements.register", "sensitive.exact_location"},
    "STORAGE_STAFF": _READ | {"movements.register", "sensitive.exact_location"},
    "INTERNAL_VIEWER": set(_READ),
    "EXTERNAL_RESEARCHER": {"pieces.read"},
}


@dataclass
class ReferenceData:
    identifier_types: dict[str, IdentifierType]
    terms: dict[str, dict[str, Term]]
    roles: dict[str, Role]


def seed_reference_data(session: Session) -> ReferenceData:
    identifier_types: dict[str, IdentifierType] = {}
    for order, (code, label, rule, unique, locks, owned, temporary) in enumerate(IDENTIFIER_TYPES):
        identifier_types[code] = IdentifierType(
            id=new_uuid(),
            code=code,
            label=label,
            normalization_rule=rule,
            is_unique_when_current=unique,
            locks_on_assignment=locks,
            owned_pieces_only=owned,
            allowed_for_temporary_loan=temporary,
            sort_order=order,
            description="[SUPUESTO] Tipo inicial; ajustar con la contraparte.",
        )
    session.add_all(identifier_types.values())

    terms: dict[str, dict[str, Term]] = {}
    for vocabulary_code, (name, items) in VOCABULARIES.items():
        vocabulary = Vocabulary(
            id=new_uuid(), code=vocabulary_code, name=name, description="[SUPUESTO]"
        )
        session.add(vocabulary)
        terms[vocabulary_code] = {}
        for order, (code, label) in enumerate(items):
            term = Term(
                id=new_uuid(),
                vocabulary_id=vocabulary.id,
                code=code,
                label=label,
                sort_order=order,
            )
            terms[vocabulary_code][code] = term
            session.add(term)

    permissions = {
        code: Permission(id=new_uuid(), code=code, description=description)
        for code, description in PERMISSIONS.items()
    }
    session.add_all(permissions.values())
    roles: dict[str, Role] = {}
    for code, name, enabled in ROLES:
        role = Role(id=new_uuid(), code=code, name=name, is_enabled=enabled)
        roles[code] = role
        session.add(role)
        for permission_code in sorted(ROLE_PERMISSIONS[code]):
            session.add(
                RolePermission(
                    id=new_uuid(), role_id=role.id, permission_id=permissions[permission_code].id
                )
            )
    session.flush()
    return ReferenceData(identifier_types=identifier_types, terms=terms, roles=roles)
