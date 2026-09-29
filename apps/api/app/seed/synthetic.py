"""Synthetic, reproducible demo catalogue (spec plataforma: datos de demostración sintéticos).

Everything here is fictitious (RNF-014). Collection acronyms are the illustrative ones mentioned
in the project documents (MMZ, RA/RAB, MBB, AJB, LRM) [SUPUESTO]; names, people, codes and
numbers are generated. The data reproduces on purpose the real problems of the catalogue:
dirty codes, pieces without inventory code, loans for use, probable duplicates, free-text
periods, partial locations and several photos per piece.
"""

import difflib
import random
import uuid
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.models_base import new_uuid, utcnow
from app.core.storage import ObjectStorage
from app.modules.ai_suggestions.models import AiFunction, AiSuggestion
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.audit.soft_delete import soft_delete
from app.modules.audit.tracking import INCLUDE_DELETED
from app.modules.catalog.enums import PeriodType, TenureRegime
from app.modules.catalog.models import (
    ConservationAssessment,
    Piece,
    PieceMaterial,
    PieceSourceRecord,
)
from app.modules.catalog.service import create_piece
from app.modules.collections.models import Collection, VocabularyCode
from app.modules.collections.service import create_collection
from app.modules.identification.normalization import (
    TYPE_COLLECTION,
    TYPE_INC_RN,
    TYPE_INVENTORY,
    TYPE_OTHER,
    TYPE_PUCP,
)
from app.modules.identification.service import add_identifier, correct_locked_identifier
from app.modules.imports.models import (
    ImportBatch,
    ImportBatchStatus,
    ImportMappingTemplate,
    ImportRow,
    RowClassification,
)
from app.modules.locations.models import Location, LocationLevel
from app.modules.locations.service import create_location, move_piece
from app.modules.media.models import MediaAsset
from app.modules.quality.models import DuplicateCandidate
from app.modules.users.models import AppUser, UserRole
from app.seed.images import placeholder_photo
from app.seed.reference import ReferenceData, seed_reference_data

SOURCE_NAME = "Sábana consultoría 2024/25 (sintética)"
SEED_ACTOR = "seed"


class SeedRefused(RuntimeError):
    """The catalogue already has pieces: the seed never mixes demo data with existing data."""


@dataclass
class SeedOptions:
    random_seed: int = 20260917
    piece_count: int = 300
    upload_media: bool = True
    admin_email: str = "admin@matp.local"
    admin_password: str | None = None
    duplicate_pairs: int = 10
    sets: int = 3
    components_per_set: int = 3


@dataclass
class SeedSummary:
    pieces: int = 0
    pieces_without_inventory_code: int = 0
    loan_for_use_pieces: int = 0
    temporary_loan_pieces: int = 0
    loose_pieces: int = 0
    located_pieces: int = 0
    media_assets: int = 0
    uploaded_media: int = 0
    duplicate_candidates: int = 0
    soft_deleted_pieces: int = 0
    users: int = 0
    collections: int = 0
    details: dict[str, int] = field(default_factory=dict)


# (acronym, name, parent acronym, tenure, weight, preferred categories)
COLLECTIONS = [
    ("MMZ", "Colección MMZ (ficticia)", None, TenureRegime.OWNED, 0.18, ["CERAMICA", "MASCARA"]),
    ("RA", "Colección RA (ficticia)", None, TenureRegime.OWNED, 0.15, ["RETABLO", "JUGUETE"]),
    ("RAB", "Subcolección RAB (ficticia)", "RA", TenureRegime.OWNED, 0.07, ["RETABLO"]),
    ("MBB", "Colección MBB (ficticia)", None, TenureRegime.OWNED, 0.15, ["TEXTIL", "MATE_BURILADO"]),
    ("AJB", "Colección AJB en comodato (ficticia)", None, TenureRegime.LOAN_FOR_USE, 0.15,
     ["IMAGINERIA", "PLATERIA"]),
    ("LRM", "Colección LRM (ficticia)", None, TenureRegime.OWNED, 0.18,
     ["INSTRUMENTO_MUSICAL", "PINTURA_POPULAR", "CERAMICA"]),
]  # fmt: skip
LOOSE_WEIGHT = 0.10
TEMPORARY_WEIGHT = 0.02
INVENTORY_CODE_PROBABILITY_OWNED = 0.6  # ~50 % of all pieces end up without code I

TITLES = {
    "RETABLO": ["Retablo ayacuchano", "Cajón San Marcos", "Retablo costumbrista", "Retablo de la Candelaria"],
    "TEXTIL": ["Manta tejida", "Faja con iconografía", "Poncho de lana", "Lliclla festiva"],
    "CERAMICA": ["Toro de Pucará", "Iglesia de Quinua", "Cántaro decorado", "Olla ceremonial"],
    "MATE_BURILADO": ["Mate burilado con escenas de cosecha", "Mate burilado con fiesta patronal"],
    "MASCARA": ["Máscara de chuncho", "Máscara de saqra", "Máscara de caporal"],
    "IMAGINERIA": ["Niño Manuelito", "San Isidro Labrador", "Virgen de la Puerta"],
    "JUGUETE": ["Caballito de madera", "Muñeca de trapo", "Trompo pintado"],
    "PLATERIA": ["Tupu de plata", "Mate de plata repujada", "Sahumador de plata"],
    "INSTRUMENTO_MUSICAL": ["Charango", "Quena", "Tinya", "Arpa andina"],
    "PINTURA_POPULAR": ["Tabla pintada de Sarhua", "Pintura popular sobre tela"],
}  # fmt: skip
CATEGORY_MATERIALS = {
    "RETABLO": ["MADERA", "PASTA_PAPA", "YESO", "PIGMENTO"],
    "TEXTIL": ["LANA", "ALGODON"],
    "CERAMICA": ["ARCILLA", "PIGMENTO"],
    "MATE_BURILADO": ["CALABAZA"],
    "MASCARA": ["YESO", "MADERA", "CUERO"],
    "IMAGINERIA": ["MADERA", "YESO", "PIGMENTO"],
    "JUGUETE": ["MADERA", "ALGODON"],
    "PLATERIA": ["PLATA"],
    "INSTRUMENTO_MUSICAL": ["MADERA", "CUERO"],
    "PINTURA_POPULAR": ["MADERA", "PIGMENTO", "ALGODON"],
}
REGIONS = [
    "Ayacucho", "Cusco", "Puno", "Junín", "Lima", "Cajamarca",
    "Huancavelica", "Apurímac", "Piura", "Arequipa",
]  # fmt: skip
# (original text, type, from, to) — free-text periods with optional interpretation (RF-007).
PERIODS = [
    ("s. XX", PeriodType.CENTURY, 1901, 2000),
    ("S. XX", None, None, None),
    ("ca. 1950", PeriodType.APPROXIMATE, 1945, 1955),
    ("3000 años", PeriodType.RELATIVE_AGE, None, None),
    ("1960-1970", PeriodType.RANGE, 1960, 1970),
    ("década de 1940", PeriodType.DECADE, 1940, 1949),
    ("1985", PeriodType.YEAR, 1985, 1985),
    ("fines del s. XIX", None, None, None),
    ("desconocida", PeriodType.UNKNOWN, None, None),
    (None, None, None, None),
]
OBSERVATIONS = [
    "Pieza revisada en inventario 2024.",
    "Código de colección escrito a mano en la base.",
    "Etiqueta antigua ilegible.",
    "Verificar con libro de registro.",
    "Posible duplicado con ficha en Word.",
    "",
]


def _dirty_inventory_code(rng: random.Random, number: int) -> str:
    return rng.choice(
        [f"I-{number:04d}", f"I {number}", f"I.{number}", f"i-{number}", f"I-{number}"]
    )


def _dirty_collection_code(rng: random.Random, acronym: str, number: int) -> str:
    dotted = ".".join(acronym) + "."
    spaced = " ".join(acronym)
    return rng.choice(
        [
            f"{acronym} {number}",
            f"{dotted} {number:03d}",
            f"{spaced} {number}",
            f"{acronym.lower()} {number}",
            f"{acronym}-{number:03d}",
        ]
    )


def _similarity(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, a.lower(), b.lower()).ratio()


class SyntheticCatalogBuilder:
    def __init__(
        self,
        session: Session,
        options: SeedOptions,
        storage: ObjectStorage | None,
    ) -> None:
        self.session = session
        self.options = options
        self.storage = storage if options.upload_media else None
        self.rng = random.Random(options.random_seed)
        self.summary = SeedSummary()
        self.reference: ReferenceData
        self.collections: dict[str, Collection] = {}
        self.collection_counters: dict[str, int] = {}
        self.leaf_locations: list[Location] = []
        self.room_locations: list[Location] = []
        self.users: dict[str, AppUser] = {}
        self.piece_categories: dict[uuid.UUID, str] = {}
        self.collection_code_of: dict[uuid.UUID, str] = {}

    # ------------------------------------------------------------------ helpers
    def term_id(self, vocabulary: str, code: str) -> uuid.UUID:
        return self.reference.terms[vocabulary][code].id

    def next_collection_number(self, acronym: str) -> int:
        self.collection_counters[acronym] = self.collection_counters.get(acronym, 0) + 1
        return self.collection_counters[acronym]

    # ------------------------------------------------------------------ steps
    def build(self) -> SeedSummary:
        self.reference = seed_reference_data(self.session)
        self._create_users()
        self._create_collections()
        self._create_locations()
        base_count = (
            self.options.piece_count
            - self.options.duplicate_pairs
            - (self.options.sets * self.options.components_per_set)
        )
        inventory_numbers = self.rng.sample(range(100, 9000), base_count)
        pieces = [
            self._create_piece(index, inventory_numbers[index]) for index in range(base_count)
        ]
        self._create_sets(pieces)
        self._create_duplicates(pieces)
        self._create_import_batch_sample(pieces)
        self._create_ai_suggestions(pieces)
        self._inventory_code_correction_example(pieces)
        self._soft_delete_examples(pieces)
        self._collect_summary()
        return self.summary

    def _create_users(self) -> None:
        from pwdlib import PasswordHash

        hasher = PasswordHash.recommended()
        people = [
            ("ADMIN", self.options.admin_email, "Administrador (sintético)"),
            ("COLLECTIONS_MANAGER", "curadora@matp.local", "Gestora de colecciones (sintética)"),
            ("CATALOGUER", "catalogador@matp.local", "Catalogador (sintético)"),
            ("CONSERVATION", "conservacion@matp.local", "Conservación (sintético)"),
            ("STORAGE_STAFF", "deposito@matp.local", "Auxiliar de depósito (sintético)"),
            ("INTERNAL_VIEWER", "consulta@matp.local", "Consulta interna (sintético)"),
        ]
        for role_code, email, name in people:
            password_hash = None
            if role_code == "ADMIN" and self.options.admin_password:
                password_hash = hasher.hash(self.options.admin_password)
            user = AppUser(
                id=new_uuid(),
                email=email,
                full_name=name,
                password_hash=password_hash,
                is_synthetic=True,
            )
            self.session.add(user)
            self.session.add(
                UserRole(id=new_uuid(), user_id=user.id, role_id=self.reference.roles[role_code].id)
            )
            self.users[role_code] = user
        self.session.flush()

    def _create_collections(self) -> None:
        for acronym, name, parent, tenure, _weight, _categories in COLLECTIONS:
            written = self.rng.choice([acronym, ".".join(acronym) + "."])
            self.collections[acronym] = create_collection(
                self.session,
                name=name,
                acronym=written,
                parent_id=self.collections[parent].id if parent else None,
                default_tenure_regime=tenure,
                description="Colección ficticia para demostración [SUPUESTO].",
                origin_description=(
                    "Comodante sintético (sin datos personales reales)"
                    if tenure is TenureRegime.LOAN_FOR_USE
                    else "Origen sintético"
                ),
            )

    def _create_locations(self) -> None:
        site = create_location(
            self.session, level=LocationLevel.SITE, code="SC", name="Sede central (sintética)"
        )
        for number in (1, 2):
            deposit = create_location(
                self.session,
                level=LocationLevel.SPACE,
                code=f"SC-DEP{number}",
                name=f"Depósito {number}",
                parent=site,
            )
            for rack in ("A", "B"):
                furniture = create_location(
                    self.session,
                    level=LocationLevel.FURNITURE,
                    code=f"SC-DEP{number}-R{rack}",
                    name=f"Rack {rack}",
                    parent=deposit,
                )
                for level_number in (1, 2, 3):
                    shelf = create_location(
                        self.session,
                        level=LocationLevel.SHELF_LEVEL,
                        code=f"SC-DEP{number}-R{rack}-N{level_number}",
                        name=f"Nivel {level_number}",
                        parent=furniture,
                    )
                    self.leaf_locations.append(shelf)
                    for box in (1, 2):
                        self.leaf_locations.append(
                            create_location(
                                self.session,
                                level=LocationLevel.CONTAINER,
                                code=f"SC-DEP{number}-R{rack}-N{level_number}-C{box:02d}",
                                name=f"Caja {box:02d}",
                                parent=shelf,
                            )
                        )
            self.leaf_locations.append(deposit)  # only site + space (partial location)
        for room in (1, 2, 3):
            self.room_locations.append(
                create_location(
                    self.session,
                    level=LocationLevel.SPACE,
                    code=f"SC-SALA{room}",
                    name=f"Sala {room}",
                    parent=site,
                )
            )

    def _choose_collection(self) -> tuple[str | None, TenureRegime]:
        roll = self.rng.random()
        if roll < TEMPORARY_WEIGHT:
            return None, TenureRegime.TEMPORARY_LOAN
        if roll < TEMPORARY_WEIGHT + LOOSE_WEIGHT:
            return None, TenureRegime.OWNED
        acronyms = [item[0] for item in COLLECTIONS]
        weights = [item[4] for item in COLLECTIONS]
        acronym = self.rng.choices(acronyms, weights=weights)[0]
        return acronym, self.collections[acronym].default_tenure_regime

    def _create_piece(self, index: int, inventory_number: int) -> Piece:
        rng = self.rng
        acronym, tenure = self._choose_collection()
        categories = (
            next(item[5] for item in COLLECTIONS if item[0] == acronym) if acronym else list(TITLES)
        )
        category = rng.choice(categories)
        title = rng.choice(TITLES[category])
        region = rng.choice(REGIONS)
        period_text, period_type, period_from, period_to = rng.choice(PERIODS)
        height = rng.randint(8, 90)
        width = rng.randint(5, 60)
        structured = rng.random() < 0.6
        piece = create_piece(
            self.session,
            title=title,
            tenure_regime=tenure,
            collection_id=self.collections[acronym].id if acronym else None,
            description=f"{title} procedente de {region}. Descripción sintética de demostración.",
            provenance=region,
            author=rng.choice(["Anónimo", f"Taller ficticio {rng.randint(1, 40):02d}", None]),
            entry_date=date(rng.randint(1975, 2024), rng.randint(1, 12), rng.randint(1, 28)),
            period_text=period_text,
            period_type=period_type,
            period_from=period_from,
            period_to=period_to,
            category_term_id=self.term_id(VocabularyCode.CATEGORY, category),
            object_type_term_id=self.term_id(VocabularyCode.OBJECT_TYPE, "BIEN_MUEBLE"),
            acquisition_method_term_id=self.term_id(
                VocabularyCode.ACQUISITION_METHOD,
                "COMODATO"
                if tenure is TenureRegime.LOAN_FOR_USE
                else rng.choice(["DONACION", "COMPRA", "TRANSFERENCIA", "DESCONOCIDA"]),
            ),
            dimensions_text=f"alto {height} cm x ancho {width} cm" if rng.random() < 0.85 else None,
            dimensions=(
                [
                    {"dimension": "alto", "value": height, "unit": "cm"},
                    {"dimension": "ancho", "value": width, "unit": "cm"},
                ]
                if structured
                else None
            ),
            recorded_by=f"Registrador sintético {rng.randint(1, 6):02d}",
            notes=rng.choice(OBSERVATIONS) or None,
            lender_name="Comodante sintético AJB" if tenure is TenureRegime.LOAN_FOR_USE else None,
            loan_agreement_ref=(
                f"ACUERDO-SINT-{rng.randint(1, 3):02d}"
                if tenure is TenureRegime.LOAN_FOR_USE
                else None
            ),
            temporary_inventory_number=(
                f"PT-2026-{index:03d}" if tenure is TenureRegime.TEMPORARY_LOAN else None
            ),
        )
        self.piece_categories[piece.id] = category
        codes: list[str] = []

        if tenure is TenureRegime.OWNED and rng.random() < INVENTORY_CODE_PROBABILITY_OWNED:
            original = _dirty_inventory_code(rng, inventory_number)
            add_identifier(self.session, piece, TYPE_INVENTORY, original, source=SOURCE_NAME)
            codes.append(original)
        if acronym and tenure is not TenureRegime.TEMPORARY_LOAN:
            number = self.next_collection_number(acronym)
            original = _dirty_collection_code(rng, acronym, number)
            add_identifier(self.session, piece, TYPE_COLLECTION, original, source=SOURCE_NAME)
            self.collection_code_of[piece.id] = f"{acronym} {number}"
            codes.append(original)
        if tenure is TenureRegime.OWNED and rng.random() < 0.25:
            old = add_identifier(
                self.session, piece, TYPE_INC_RN, f"{rng.randint(1000, 9999)}", source="Libro INC"
            )
            codes.append(old.original_value)
            if rng.random() < 0.4:  # format changed from 4 to 6 digits: keep history
                add_identifier(
                    self.session,
                    piece,
                    TYPE_INC_RN,
                    f"RN {rng.randint(100000, 999999)}",
                    source="Registro Nacional",
                    replaces=old,
                )
        if rng.random() < 0.03:
            add_identifier(self.session, piece, TYPE_INC_RN, "???", source="Ficha Word")
        if tenure is TenureRegime.OWNED and rng.random() < 0.1:
            add_identifier(
                self.session, piece, TYPE_PUCP, f"PUCP-{rng.randint(1, 999):03d}", source="Access"
            )
        if rng.random() < 0.05:
            add_identifier(
                self.session, piece, TYPE_OTHER, f"Nº antiguo {rng.randint(1, 500)}", source="Libro"
            )

        for material in rng.sample(
            CATEGORY_MATERIALS[category], k=min(2, len(CATEGORY_MATERIALS[category]))
        ):
            self.session.add(
                PieceMaterial(
                    id=new_uuid(),
                    piece_id=piece.id,
                    term_id=self.term_id(VocabularyCode.MATERIAL, material),
                )
            )

        if rng.random() < 0.4:
            cell = " / ".join(codes) if codes else rng.choice(["S/N", "s/c", "-", ""])
            self.session.add(
                PieceSourceRecord(
                    id=new_uuid(),
                    piece_id=piece.id,
                    source_name=SOURCE_NAME,
                    source_file_name="sabana_sintetica_v1.xlsx",
                    source_row_number=index + 2,
                    payload={
                        "CÓDIGOS": cell,
                        "ÉPOCA": period_text or "",
                        "OBS. CONSULTORÍA": rng.choice(OBSERVATIONS),
                    },
                )
            )

        if rng.random() < 0.7:
            status = rng.choices(["BUENO", "REGULAR", "MALO", "EN_RESTAURACION"], [5, 3, 1, 1])[0]
            status_id = self.term_id(VocabularyCode.CONSERVATION_STATUS, status)
            self.session.add(
                ConservationAssessment(
                    id=new_uuid(),
                    piece_id=piece.id,
                    status_term_id=status_id,
                    assessed_by_user_id=self.users["CONSERVATION"].id,
                    notes="Evaluación sintética",
                )
            )
            piece.conservation_status_term_id = status_id

        self._assign_location(piece)
        self._attach_photos(piece, acronym)
        self.session.flush()
        return piece

    def _assign_location(self, piece: Piece) -> None:
        roll = self.rng.random()
        if roll < 0.55:
            destination = self.rng.choice(self.leaf_locations)
            availability = "EN_DEPOSITO"
        elif roll < 0.7:
            destination = self.rng.choice(self.room_locations)
            availability = "EN_SALA"
        else:
            piece.availability_term_id = self.term_id(VocabularyCode.AVAILABILITY, "NO_LOCALIZADA")
            return  # "sin ubicación" (RF-019)
        move_piece(
            self.session, piece, destination, "Registro inicial de ubicación (datos sintéticos)"
        )
        piece.availability_term_id = self.term_id(VocabularyCode.AVAILABILITY, availability)

    def _attach_photos(self, piece: Piece, acronym: str | None) -> None:
        if self.rng.random() >= 0.6:
            return
        views = self.rng.sample(
            list(self.reference.terms[VocabularyCode.PHOTO_VIEW_TYPE]), k=self.rng.randint(1, 4)
        )
        restriction = "NO_PUBLICAR" if acronym == "AJB" else "SIN_RESTRICCION"
        for order, view in enumerate(views):
            image = placeholder_photo(f"{piece.title} ({str(piece.id)[:8]})", view)
            asset_id = new_uuid()
            key = f"pieces/{piece.id}/{asset_id}.jpg"
            if self.storage is not None:
                self.storage.put_bytes(key, image.data, image.content_type)
                self.summary.uploaded_media += 1
            self.session.add(
                MediaAsset(
                    id=asset_id,
                    piece_id=piece.id,
                    storage_key=key,
                    original_filename=f"foto_sintetica_{view.lower()}.jpg",
                    content_type=image.content_type,
                    size_bytes=len(image.data),
                    content_sha256=image.sha256,
                    width_px=image.width,
                    height_px=image.height,
                    view_type_term_id=self.term_id(VocabularyCode.PHOTO_VIEW_TYPE, view),
                    sort_order=order,
                    is_primary=order == 0,
                    photographer="Fotógrafo sintético",
                    usage_restriction_term_id=self.term_id(
                        VocabularyCode.USAGE_RESTRICTION, restriction
                    ),
                    restriction_note=(
                        "Restricción contractual del comodato (sintética)"
                        if acronym == "AJB"
                        else None
                    ),
                )
            )

    def _create_sets(self, pieces: list[Piece]) -> None:
        candidates = [p for p in pieces if p.collection_id == self.collections["MBB"].id]
        parents = (
            candidates[: self.options.sets]
            if len(candidates) >= self.options.sets
            else pieces[: self.options.sets]
        )
        for parent in parents:
            parent.object_type_term_id = self.term_id(VocabularyCode.OBJECT_TYPE, "CONJUNTO")
            parent_code = self.collection_code_of.get(parent.id)
            for component in range(1, self.options.components_per_set + 1):
                child = create_piece(
                    self.session,
                    title=f"{parent.title} - componente {component}",
                    tenure_regime=parent.tenure_regime,
                    collection_id=parent.collection_id,
                    parent_piece_id=parent.id,
                    object_type_term_id=self.term_id(VocabularyCode.OBJECT_TYPE, "COMPONENTE"),
                    category_term_id=parent.category_term_id,
                    description="Componente sintético de un conjunto.",
                )
                if parent_code:
                    add_identifier(
                        self.session,
                        child,
                        TYPE_COLLECTION,
                        f"{parent_code}.{component}",
                        source=SOURCE_NAME,
                        notes="[SUPUESTO] Código derivado del conjunto con sufijo.",
                    )

    def _create_duplicates(self, pieces: list[Piece]) -> None:
        with_code = [p for p in pieces if p.id in self.collection_code_of]
        for original in self.rng.sample(
            with_code, k=min(self.options.duplicate_pairs, len(with_code))
        ):
            code = self.collection_code_of[original.id]
            acronym, number = code.split(" ")
            variant_title = self.rng.choice(
                [
                    f"{original.title} (duplicado probable)",
                    original.title.upper(),
                    f"{original.title} s/n",
                ]
            )
            duplicate = create_piece(
                self.session,
                title=variant_title,
                tenure_regime=original.tenure_regime,
                collection_id=original.collection_id,
                provenance=original.provenance,
                category_term_id=original.category_term_id,
                description="Ficha duplicada sintética (reproduce registros de Word/Excel).",
                notes="Registrada desde otra fuente histórica.",
            )
            dirty = f"{'.'.join(acronym)}. {int(number):03d}"
            add_identifier(self.session, duplicate, TYPE_COLLECTION, dirty, source="Ficha Word")
            title_similarity = _similarity(original.title, variant_title)
            score = Decimal(str(round(0.5 * title_similarity + 0.5, 4)))
            self.session.add(
                DuplicateCandidate(
                    id=new_uuid(),
                    piece_a_id=original.id,
                    piece_b_id=duplicate.id,
                    score=score,
                    matched_fields=[
                        {"field": "identifier:COLECCION", "similarity": 1.0},
                        {"field": "title", "similarity": round(title_similarity, 4)},
                        {"field": "collection_id", "similarity": 1.0},
                    ],
                )
            )
        self.session.flush()

    def _create_import_batch_sample(self, pieces: list[Piece]) -> None:
        catalogue_user = self.users["CATALOGUER"]
        template = ImportMappingTemplate(
            id=new_uuid(),
            name="Plantilla sábana sintética v1",
            source_name=SOURCE_NAME,
            header_signature="sintetica-v1",
            mapping={
                "DENOMINACIÓN": {"target": "title"},
                "CÓDIGOS": {"target": "identifiers:auto"},
                "ÉPOCA": {"target": "period_text"},
                "PROCEDENCIA": {"target": "provenance"},
                "OBS. CONSULTORÍA": {"target": "payload"},
            },
            description="[SUPUESTO] Columnas ilustrativas hasta recibir el Excel real.",
        )
        self.session.add(template)
        self.session.flush()
        batch = ImportBatch(
            id=new_uuid(),
            source_name=SOURCE_NAME,
            file_name="sabana_sintetica_v1.xlsx",
            template_id=template.id,
            status=ImportBatchStatus.IN_PREVIEW,
            uploaded_by_id=catalogue_user.id,
            stage_timestamps={"UPLOADED": utcnow().isoformat()},
            counts={"NEW": 2, "UPDATE": 1, "POSSIBLE_DUPLICATE": 1, "CONFLICT": 1, "ERRORS": 1},
        )
        self.session.add(batch)
        self.session.flush()
        target = pieces[0]
        rows = [
            (RowClassification.NEW, {"DENOMINACIÓN": "Retablo de pastores", "CÓDIGOS": "RA 900"}, None, None),
            (RowClassification.NEW, {"DENOMINACIÓN": "Máscara de negrito", "CÓDIGOS": "S/N"}, None, None),
            (RowClassification.UPDATE, {"DENOMINACIÓN": target.title, "PROCEDENCIA": "Huancavelica"},
             target.id, {"provenance": {"current": target.provenance, "incoming": "Huancavelica"}}),
            (RowClassification.POSSIBLE_DUPLICATE, {"DENOMINACIÓN": f"{target.title} (3 pisos)"}, target.id, None),
            (RowClassification.CONFLICT, {"DENOMINACIÓN": "Pieza con códigos contradictorios",
                                          "CÓDIGOS": "I 2362 / RA 28"}, None, None),
            (None, {"DENOMINACIÓN": "Imagen en comodato con código I", "CÓDIGOS": "I-0999 / AJB 12"}, None, None),
        ]  # fmt: skip
        for number, (classification, raw, piece_id, diff) in enumerate(rows, start=2):
            self.session.add(
                ImportRow(
                    id=new_uuid(),
                    batch_id=batch.id,
                    source_row_number=number,
                    raw_data=raw,
                    mapped_data=raw,
                    classification=classification,
                    has_validation_errors=classification is None,
                    validation_errors=(
                        [{"code": "RN-003", "message": "Una pieza en comodato no recibe código I."}]
                        if classification is None
                        else None
                    ),
                    target_piece_id=piece_id,
                    diff=diff,
                )
            )

    def _create_ai_suggestions(self, pieces: list[Piece]) -> None:
        requester = self.users["CATALOGUER"]
        for piece in pieces[1:4]:
            self.session.add(
                AiSuggestion(
                    id=new_uuid(),
                    function_code=AiFunction.RIA_03_SUGGEST_TERMS,
                    provider="mock",
                    model="mock-deterministic",
                    piece_id=piece.id,
                    input_data={"title": piece.title, "description": piece.description},
                    output_data={
                        "category": self.piece_categories.get(piece.id),
                        "confidence": 0.8,
                    },
                    requested_by_id=requester.id,
                )
            )

    def _inventory_code_correction_example(self, pieces: list[Piece]) -> None:
        """One audited correction by the synthetic administrator (RF-003)."""
        admin_context = AuditContext(origin=AuditOrigin.MANUAL, user_id=self.users["ADMIN"].id)
        with audit_context(self.session, admin_context):
            for piece in pieces:
                identifiers = [
                    i
                    for i in piece.identifiers
                    if i.identifier_type_code == TYPE_INVENTORY and i.is_current
                ]
                if identifiers:
                    correct_locked_identifier(
                        self.session,
                        piece,
                        TYPE_INVENTORY,
                        "I-9990",
                        "Código I asignado por error de transcripción (ejemplo sintético)",
                    )
                    return

    def _soft_delete_examples(self, pieces: list[Piece]) -> None:
        manager_context = AuditContext(
            origin=AuditOrigin.MANUAL, user_id=self.users["COLLECTIONS_MANAGER"].id
        )
        with audit_context(self.session, manager_context):
            for piece in pieces[-2:]:
                soft_delete(self.session, piece, "Registrada por error (ejemplo sintético)")

    def _collect_summary(self) -> None:
        session = self.session
        summary = self.summary
        include = {INCLUDE_DELETED: True}
        summary.pieces = (
            session.scalar(select(func.count()).select_from(Piece).execution_options(**include))
            or 0
        )
        summary.soft_deleted_pieces = (
            session.scalar(
                select(func.count())
                .select_from(Piece)
                .where(Piece.deleted_at.is_not(None))
                .execution_options(**include)
            )
            or 0
        )
        from app.modules.identification.models import PieceIdentifier

        with_i = select(PieceIdentifier.piece_id).where(
            PieceIdentifier.identifier_type_code == TYPE_INVENTORY, PieceIdentifier.is_current
        )
        summary.pieces_without_inventory_code = (
            session.scalar(
                select(func.count())
                .select_from(Piece)
                .where(Piece.id.not_in(with_i))
                .execution_options(**include)
            )
            or 0
        )
        for regime, attribute in (
            (TenureRegime.LOAN_FOR_USE, "loan_for_use_pieces"),
            (TenureRegime.TEMPORARY_LOAN, "temporary_loan_pieces"),
        ):
            setattr(
                summary,
                attribute,
                session.scalar(
                    select(func.count())
                    .select_from(Piece)
                    .where(Piece.tenure_regime == regime)
                    .execution_options(**include)
                )
                or 0,
            )
        summary.loose_pieces = (
            session.scalar(
                select(func.count())
                .select_from(Piece)
                .where(Piece.collection_id.is_(None))
                .execution_options(**include)
            )
            or 0
        )
        summary.located_pieces = (
            session.scalar(
                select(func.count())
                .select_from(Piece)
                .where(Piece.current_location_id.is_not(None))
                .execution_options(**include)
            )
            or 0
        )
        summary.media_assets = session.scalar(select(func.count()).select_from(MediaAsset)) or 0
        summary.duplicate_candidates = (
            session.scalar(select(func.count()).select_from(DuplicateCandidate)) or 0
        )
        summary.users = len(self.users)
        summary.collections = len(self.collections)


def run_seed(
    session: Session, options: SeedOptions, storage: ObjectStorage | None = None
) -> SeedSummary:
    existing = session.scalar(
        select(func.count()).select_from(Piece).execution_options(**{INCLUDE_DELETED: True})
    )
    if existing:
        raise SeedRefused(
            f"El catálogo ya contiene {existing} piezas; el seed no mezcla datos de demostración "
            "con datos existentes. Para recrear un entorno vacío: npm run down -- -v && npm run dev "
            "&& npm run migrate && npm run seed"
        )
    if storage is not None and options.upload_media:
        storage.ensure_bucket()
    context = AuditContext(origin=AuditOrigin.SYSTEM, actor_label=SEED_ACTOR)
    with audit_context(session, context):
        summary = SyntheticCatalogBuilder(session, options, storage).build()
        session.flush()
    return summary
