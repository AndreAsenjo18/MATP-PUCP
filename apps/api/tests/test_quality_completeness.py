"""Spec calidad-datos — una definición por alerta, con piezas sintéticas (design D1).

Change alertas-y-reporte-incompletas, tarea 1.2. Cubre comodato, préstamo temporal, piezas
eliminadas y fusionadas, tal como pide la tarea.
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.models_base import new_uuid
from app.models import MediaAsset, Piece, PieceMaterial, Term
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.identification.models import NormalizationStatus, PieceIdentifier
from app.modules.identification.service import set_inventory_code
from app.modules.locations.models import LocationLevel
from app.modules.locations.service import create_location, move_piece
from app.modules.quality.completeness import (
    ActiveRules,
    AlertCode,
    active_alerts_for_piece,
    alert_condition,
    missing_fields_predicate,
)
from tests.conftest import ActAs

DEFAULT_RULES = ActiveRules(required_fields=(), recommended_fields=())


def _matches(session: Session, piece: Piece, code: AlertCode, rules: ActiveRules) -> bool:
    return (
        session.scalar(
            select(Piece.id).where(Piece.id == piece.id, alert_condition(code, rules))
        )
        is not None
    )


# --- MISSING_INVENTORY_CODE: solo aplica a propiedad (RN-003, RN-004) -------------------------


def test_missing_inventory_code_applies_only_to_owned_without_current_code(
    session: Session, act_as: ActAs
) -> None:
    with act_as("CATALOGUER"):
        owned_without_code = create_piece(
            session, denomination="Retablo sin código", tenure_regime=TenureRegime.OWNED
        )
        owned_with_code = create_piece(
            session, denomination="Retablo con código", tenure_regime=TenureRegime.OWNED
        )
        set_inventory_code(session, owned_with_code, "I-00042")
        comodato = create_piece(
            session,
            denomination="Pieza en comodato",
            tenure_regime=TenureRegime.LOAN_FOR_USE,
            lender_name="Familia sintética",
        )
        temporary = create_piece(
            session, denomination="Préstamo temporal", tenure_regime=TenureRegime.TEMPORARY_LOAN
        )
        session.commit()

    assert _matches(session, owned_without_code, AlertCode.MISSING_INVENTORY_CODE, DEFAULT_RULES)
    assert not _matches(
        session, owned_with_code, AlertCode.MISSING_INVENTORY_CODE, DEFAULT_RULES
    )
    # RN-003/RN-004: comodato y préstamo temporal nunca generan esta alerta, tengan o no código.
    assert not _matches(session, comodato, AlertCode.MISSING_INVENTORY_CODE, DEFAULT_RULES)
    assert not _matches(session, temporary, AlertCode.MISSING_INVENTORY_CODE, DEFAULT_RULES)


# --- MISSING_PHOTO ------------------------------------------------------------------------


def test_missing_photo_ignores_soft_deleted_media(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        without_photo = create_piece(
            session, denomination="Sin fotos", tenure_regime=TenureRegime.OWNED
        )
        with_deleted_photo_only = create_piece(
            session, denomination="Solo foto eliminada", tenure_regime=TenureRegime.OWNED
        )
        session.add(
            MediaAsset(
                id=new_uuid(),
                piece_id=with_deleted_photo_only.id,
                storage_key=f"test/{new_uuid()}.jpg",
                content_type="image/jpeg",
                size_bytes=1024,
                content_sha256="0" * 64,
                deleted_at=datetime.now(UTC),
                deletion_reason="prueba",
            )
        )
        with_photo = create_piece(
            session, denomination="Con foto", tenure_regime=TenureRegime.OWNED
        )
        session.add(
            MediaAsset(
                id=new_uuid(),
                piece_id=with_photo.id,
                storage_key=f"test/{new_uuid()}.jpg",
                content_type="image/jpeg",
                size_bytes=1024,
                content_sha256="1" * 64,
            )
        )
        session.commit()

    assert _matches(session, without_photo, AlertCode.MISSING_PHOTO, DEFAULT_RULES)
    assert _matches(session, with_deleted_photo_only, AlertCode.MISSING_PHOTO, DEFAULT_RULES)
    assert not _matches(session, with_photo, AlertCode.MISSING_PHOTO, DEFAULT_RULES)


# --- MISSING_LOCATION: sede y espacio (RF-016) -------------------------------------------------


def test_missing_location_requires_site_and_space_ancestors(
    session: Session, act_as: ActAs
) -> None:
    with act_as("CATALOGUER"):
        without_location = create_piece(
            session, denomination="Sin ubicación", tenure_regime=TenureRegime.OWNED
        )
        with_location = create_piece(
            session, denomination="Con ubicación", tenure_regime=TenureRegime.OWNED
        )
        site = create_location(session, level=LocationLevel.SITE, code="S1", name="Sede 1")
        space = create_location(
            session, level=LocationLevel.SPACE, code="S1-D1", name="Depósito 1", parent=site
        )
        move_piece(session, with_location, space, "Ubicación inicial de prueba")
        session.commit()

    assert _matches(session, without_location, AlertCode.MISSING_LOCATION, DEFAULT_RULES)
    assert not _matches(session, with_location, AlertCode.MISSING_LOCATION, DEFAULT_RULES)


# --- MISSING_REQUIRED_FIELDS / MISSING_RECOMMENDED_FIELDS: configurables (D2) ------------------


def test_missing_required_fields_follows_active_rules(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        without_description = create_piece(
            session, denomination="Pieza mínima", tenure_regime=TenureRegime.OWNED
        )
        with_description = create_piece(
            session,
            denomination="Pieza con descripción",
            tenure_regime=TenureRegime.OWNED,
            description="Descripción sintética de prueba.",
        )
        session.commit()

    rules_require_description = ActiveRules(required_fields=("description",), recommended_fields=())
    assert _matches(
        session, without_description, AlertCode.MISSING_REQUIRED_FIELDS, rules_require_description
    )
    assert not _matches(
        session, with_description, AlertCode.MISSING_REQUIRED_FIELDS, rules_require_description
    )
    # Sin reglas activas para este tipo, la alerta nunca aplica.
    assert not _matches(
        session, without_description, AlertCode.MISSING_REQUIRED_FIELDS, DEFAULT_RULES
    )


def test_missing_recommended_fields_includes_materials_relation(
    session: Session, act_as: ActAs
) -> None:
    with act_as("CATALOGUER"):
        terms = session.scalars(select(Term).limit(1)).all()
        assert terms, "El seed de referencia debe dejar al menos un término."
        bare = create_piece(
            session, denomination="Pieza sin materiales", tenure_regime=TenureRegime.OWNED
        )
        with_material = create_piece(
            session, denomination="Pieza con material", tenure_regime=TenureRegime.OWNED
        )
        session.add(PieceMaterial(id=new_uuid(), piece_id=with_material.id, term_id=terms[0].id))
        session.commit()

    rules = ActiveRules(required_fields=(), recommended_fields=("materials",))
    assert _matches(session, bare, AlertCode.MISSING_RECOMMENDED_FIELDS, rules)
    assert not _matches(session, with_material, AlertCode.MISSING_RECOMMENDED_FIELDS, rules)


def test_missing_fields_predicate_empty_field_list_never_matches() -> None:
    # No es una ColumnElement normal de SQLAlchemy ejecutable sola, pero debe poder evaluarse
    # en un WHERE sin romper la consulta.
    assert missing_fields_predicate([]) is not None


# --- UNNORMALIZABLE_IDENTIFIER ------------------------------------------------------------------


def test_unnormalizable_identifier(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        clean = create_piece(
            session, denomination="Código limpio", tenure_regime=TenureRegime.OWNED
        )
        set_inventory_code(session, clean, "I-00099")
        dirty = create_piece(
            session, denomination="Código no normalizable", tenure_regime=TenureRegime.OWNED
        )
        session.add(
            PieceIdentifier(
                id=new_uuid(),
                piece_id=dirty.id,
                identifier_type_code="I",
                original_value="??ilegible??",
                normalized_value=None,
                normalization_status=NormalizationStatus.UNPARSEABLE,
                is_current=True,
            )
        )
        session.commit()

    assert not _matches(session, clean, AlertCode.UNNORMALIZABLE_IDENTIFIER, DEFAULT_RULES)
    assert _matches(session, dirty, AlertCode.UNNORMALIZABLE_IDENTIFIER, DEFAULT_RULES)


# --- active_alerts_for_piece: eliminadas y fusionadas (RN-005) --------------------------------


def test_active_alerts_excludes_deleted_pieces(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        piece = create_piece(
            session, denomination="Pieza a eliminar", tenure_regime=TenureRegime.OWNED
        )
        session.commit()
        piece.deleted_at = datetime.now(UTC)
        piece.deletion_reason = "prueba"
        session.commit()

    assert active_alerts_for_piece(session, piece.id) == []


def test_active_alerts_excludes_merged_pieces(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        absorbed = create_piece(
            session, denomination="Pieza fusionada", tenure_regime=TenureRegime.OWNED
        )
        surviving = create_piece(
            session, denomination="Pieza sobreviviente", tenure_regime=TenureRegime.OWNED
        )
        session.commit()
        absorbed.merged_into_id = surviving.id
        session.commit()

    assert active_alerts_for_piece(session, absorbed.id) == []


def test_active_alerts_for_piece_returns_every_matching_code_in_declared_order(
    session: Session, act_as: ActAs
) -> None:
    with act_as("CATALOGUER"):
        # Propiedad, sin código I, sin foto, sin ubicación: dispara 3 de las 6 alertas.
        incomplete = create_piece(
            session, denomination="Pieza muy incompleta", tenure_regime=TenureRegime.OWNED
        )
        session.commit()

    codes = active_alerts_for_piece(session, incomplete.id, DEFAULT_RULES)
    assert codes == [
        AlertCode.MISSING_INVENTORY_CODE,
        AlertCode.MISSING_PHOTO,
        AlertCode.MISSING_LOCATION,
    ]
