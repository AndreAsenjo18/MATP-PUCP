"""Spec calidad-datos — reporte de piezas incompletas (RF-019, RF-035, design D4).

Change alertas-y-reporte-incompletas, tarea 2.3. Cubre el escenario "Misma cifra en todos los
lugares" (el conteo del reporte coincide con el numerador del KPI para la misma alerta), el
filtro por colección con subcolecciones, la semántica AND de `alert_codes` y que una pieza sin
ninguna alerta activa no aparece en el reporte por defecto.
"""

from sqlalchemy.orm import Session

from app.core.models_base import new_uuid
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.collections.service import create_collection
from app.modules.identification.service import set_inventory_code
from app.modules.locations.models import LocationLevel
from app.modules.locations.service import create_location, move_piece
from app.modules.media.models import MediaAsset
from app.modules.quality.completeness import ActiveRules, AlertCode, load_active_rules
from app.modules.quality.incomplete_report import build_incomplete_query, rows_for_pieces
from app.modules.quality.kpis import compute_dashboard_kpis
from tests.conftest import ActAs

DEFAULT_RULES = ActiveRules(required_fields=(), recommended_fields=())


def _ids(session: Session, statement) -> set:
    return {piece.id for piece in session.scalars(statement)}


def test_report_count_matches_kpi_numerator_for_the_same_alert(
    session: Session, act_as: ActAs
) -> None:
    with act_as("CATALOGUER"):
        for i in range(5):
            create_piece(
                session, denomination=f"Sin código ni foto {i}", tenure_regime=TenureRegime.OWNED
            )
        for i in range(3):
            piece = create_piece(
                session,
                denomination=f"Con código, sin foto {i}",
                tenure_regime=TenureRegime.OWNED,
            )
            set_inventory_code(session, piece, f"I-{20_000 + i}")
        session.commit()

    rules = load_active_rules(session)
    kpis = compute_dashboard_kpis(session)
    photo_kpi = next(a for a in kpis.alerts if a.alert == AlertCode.MISSING_PHOTO)

    statement = build_incomplete_query(session, rules, alert_codes=[AlertCode.MISSING_PHOTO])
    assert len(_ids(session, statement)) == photo_kpi.numerator == 8


def test_default_filter_excludes_pieces_without_any_active_alert(
    session: Session, act_as: ActAs
) -> None:
    with act_as("CATALOGUER"):
        incomplete = create_piece(
            session, denomination="Incompleta (2.3)", tenure_regime=TenureRegime.OWNED
        )
        complete = create_piece(
            session, denomination="Completa (2.3)", tenure_regime=TenureRegime.OWNED
        )
        set_inventory_code(session, complete, "I-30001")
        session.add(
            MediaAsset(
                id=new_uuid(),
                piece_id=complete.id,
                storage_key=f"test/{new_uuid()}.jpg",
                content_type="image/jpeg",
                size_bytes=1024,
                content_sha256="2" * 64,
            )
        )
        site = create_location(session, level=LocationLevel.SITE, code="S-2.3b", name="Sede 2.3b")
        space = create_location(
            session, level=LocationLevel.SPACE, code="D-2.3b", name="Depósito 2.3b", parent=site
        )
        move_piece(session, complete, space, "Ubicación de prueba 2.3b")
        session.commit()

    ids = _ids(session, build_incomplete_query(session, DEFAULT_RULES))
    assert incomplete.id in ids
    # Con reglas de campos obligatorios/recomendados vacías, "Completa" no dispara ninguna de
    # las 6 alertas y por eso no aparece en el reporte por defecto.
    assert complete.id not in ids


def test_multiple_alert_codes_use_and_semantics(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        only_missing_photo = create_piece(
            session, denomination="Solo sin foto (2.3)", tenure_regime=TenureRegime.OWNED
        )
        set_inventory_code(session, only_missing_photo, "I-30002")
        site = create_location(session, level=LocationLevel.SITE, code="S-2.3", name="Sede 2.3")
        space = create_location(
            session, level=LocationLevel.SPACE, code="D-2.3", name="Depósito 2.3", parent=site
        )
        move_piece(session, only_missing_photo, space, "Ubicación de prueba 2.3")
        missing_both = create_piece(
            session, denomination="Sin foto ni código (2.3)", tenure_regime=TenureRegime.OWNED
        )
        move_piece(session, missing_both, space, "Ubicación de prueba 2.3")
        session.commit()

    statement = build_incomplete_query(
        session,
        DEFAULT_RULES,
        alert_codes=[AlertCode.MISSING_PHOTO, AlertCode.MISSING_INVENTORY_CODE],
    )
    assert _ids(session, statement) == {missing_both.id}


def test_collection_filter_includes_subcollections(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        root = create_collection(session, name="Raíz (2.3)")
        sub = create_collection(session, name="Sub (2.3)", parent_id=root.id)
        in_sub = create_piece(
            session,
            denomination="Pieza en subcolección (2.3)",
            tenure_regime=TenureRegime.OWNED,
            collection_id=sub.id,
        )
        loose = create_piece(
            session, denomination="Pieza suelta (2.3)", tenure_regime=TenureRegime.OWNED
        )
        session.commit()

    with_sub = _ids(session, build_incomplete_query(session, DEFAULT_RULES, collection_id=root.id))
    without_sub = _ids(
        session,
        build_incomplete_query(
            session, DEFAULT_RULES, collection_id=root.id, include_subcollections=False
        ),
    )
    assert in_sub.id in with_sub
    assert loose.id not in with_sub
    assert in_sub.id not in without_sub


def test_rows_for_pieces_includes_collection_name_and_active_alerts(
    session: Session, act_as: ActAs
) -> None:
    with act_as("CATALOGUER"):
        collection = create_collection(session, name="Colección del reporte (2.3)")
        piece = create_piece(
            session,
            denomination="Pieza del reporte (2.3)",
            tenure_regime=TenureRegime.OWNED,
            collection_id=collection.id,
        )
        session.commit()

    rows = rows_for_pieces(session, [piece], DEFAULT_RULES)
    assert len(rows) == 1
    assert rows[0].collection_name == "Colección del reporte (2.3)"
    assert AlertCode.MISSING_PHOTO in rows[0].alerts
