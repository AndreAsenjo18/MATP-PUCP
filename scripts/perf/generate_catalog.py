"""Synthetic catalog generator for performance benchmarking (RF-038).

Reuses vocabulary and collection definitions from `app.seed.synthetic` to generate
up to 20 000+ pieces and identifiers deterministically and efficiently in batches.
"""

from __future__ import annotations

import argparse
import random

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.db import make_engine, make_session_factory
from app.core.models_base import new_uuid
from app.modules.audit.context import AuditContext, set_audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.collections.models import Collection, Term
from app.modules.identification.models import NormalizationStatus, PieceIdentifier
from app.seed.synthetic import PERIODS, REGIONS, TITLES

# Sentences of the synthetic descriptions: the description is the longest text of a piece and the
# free text searches it (fusion-busqueda-deposito D1). Invented, with words the load queries use.
DESCRIPTION_SENTENCES = [
    "Pieza de factura artesanal con acabado pulido y huellas de uso en la base",
    "Decoración incisa en la superficie y asa lateral en forma de cinta",
    "Tejido en paja toquilla con ala ancha y cinta de lana teñida",
    "Escenas de la vida rural talladas al burilado sobre la corteza",
    "Policromía en tonos ocre, rojo y negro sobre engobe crema",
    "Restauración antigua en el borde con relleno de yeso",
    "Motivos geométricos repetidos en bandas horizontales",
    "Figura modelada a mano con aplicaciones de pastillaje",
    "Marca del taller en la parte inferior, parcialmente borrada",
    "Uso ceremonial según el registro de ingreso del museo",
]
# Share of pieces without description, as in the historical records.
WITHOUT_DESCRIPTION = 0.15


def generate_catalog(
    session: Session,
    count: int = 20000,
    seed: int = 20260917,
    batch_size: int = 1000,
    clean: bool = False,
) -> int:
    """Generate synthetic pieces and identifiers in batches."""
    rng = random.Random(seed)
    # Its own generator, so the other fields stay the same for a given seed.
    description_rng = random.Random(seed + 1)

    # Set system audit context
    ctx = AuditContext(
        origin=AuditOrigin.SYSTEM,
        actor_label="generate_catalog",
        reason=f"Generación sintética de {count} piezas para pruebas de carga",
    )
    set_audit_context(session, ctx)

    if clean:
        print("Limpiando piezas e identificadores previos...")
        session.execute(delete(PieceIdentifier))
        session.execute(delete(Piece))
        session.commit()

    # Load available collections and terms
    collections = session.scalars(select(Collection)).all()
    coll_ids = [c.id for c in collections] if collections else [None]

    terms = session.scalars(select(Term)).all()
    term_ids = [t.id for t in terms] if terms else [None]

    all_titles: list[str] = []
    for cat_titles in TITLES.values():
        all_titles.extend(cat_titles)
    if not all_titles:
        all_titles = ["Pieza Arqueológica", "Objeto Cerámico", "Textil Ceremonial", "Tumi de Oro"]

    total_created = 0
    print(f"Iniciando generación de {count} piezas en lotes de {batch_size}...")

    current_idx = 0
    while current_idx < count:
        current_batch_size = min(batch_size, count - current_idx)
        pieces: list[Piece] = []
        identifiers: list[PieceIdentifier] = []

        for b in range(current_batch_size):
            num = current_idx + b + 1
            title = rng.choice(all_titles)
            region = rng.choice(REGIONS)
            period_text, period_type, period_from, period_to = rng.choice(PERIODS)
            coll_id = rng.choice(coll_ids)
            cat_id = rng.choice(term_ids)
            state_id = rng.choice(term_ids)

            description = None
            if description_rng.random() >= WITHOUT_DESCRIPTION:
                sentences = description_rng.sample(
                    DESCRIPTION_SENTENCES, k=description_rng.randint(3, 6)
                )
                description = ". ".join(sentences) + f". Registro sintético #{num}."

            p_id = new_uuid()
            piece = Piece(
                id=p_id,
                denomination=f"{title} ({region}) #{num}",
                tenure_regime=TenureRegime.OWNED,
                collection_id=coll_id,
                category_id=cat_id,
                conservation_state_id=state_id,
                author=f"Maestro {region}" if rng.random() > 0.4 else None,
                provenance=region,
                description=description,
                epoch_original_text=period_text,
                epoch_type=period_type,
                epoch_start_year=period_from,
                epoch_end_year=period_to,
                lender_name=f"Comodante Ficticio #{num}" if rng.random() > 0.8 else None,
                loan_agreement_ref=f"CONV-2026-{num:04d}" if rng.random() > 0.8 else None,
            )
            pieces.append(piece)

            # Standard inventory identifier
            code = f"I-{num:06d}"
            ident = PieceIdentifier(
                id=new_uuid(),
                piece_id=p_id,
                identifier_type_code="I",
                original_value=code,
                normalized_value=code,
                normalization_status=NormalizationStatus.NORMALIZED,
                is_current=True,
            )
            identifiers.append(ident)

            # Historical / collection code for 40% of pieces
            if rng.random() < 0.4:
                alt_code = f"COL-{region[:3].upper()}-{num:04d}"
                alt_ident = PieceIdentifier(
                    id=new_uuid(),
                    piece_id=p_id,
                    identifier_type_code="COLECCION",
                    original_value=alt_code,
                    normalized_value=alt_code,
                    normalization_status=NormalizationStatus.NORMALIZED,
                    is_current=False,
                )
                identifiers.append(alt_ident)

        session.add_all(pieces)
        session.add_all(identifiers)
        session.commit()

        total_created += current_batch_size
        current_idx += current_batch_size
        if total_created % 5000 == 0 or total_created == count:
            print(f"Progreso: {total_created} / {count} piezas creadas.")

    print(f"Finalizado: {total_created} piezas generadas exitosamente.")
    return total_created


def main() -> None:
    parser = argparse.ArgumentParser(description="Generador sintético de catálogo para benchmark")
    parser.add_argument(
        "--count", type=int, default=20000, help="Número de piezas a generar (def: 20000)"
    )
    parser.add_argument(
        "--seed", type=int, default=20260917, help="Semilla pseudoaleatoria determinista"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=1000,
        help="Tamaño de lote por transacción (def: 1000)",
    )
    parser.add_argument(
        "--clean", action="store_true", help="Limpiar catálogo previo antes de generar"
    )
    parser.add_argument(
        "--database-url", type=str, default=None, help="URL de conexión a la base de datos"
    )

    args = parser.parse_args()

    settings = Settings()
    db_url = args.database_url or settings.database_url
    engine = make_engine(db_url)
    factory = make_session_factory(engine)

    with factory() as session:
        generate_catalog(
            session=session,
            count=args.count,
            seed=args.seed,
            batch_size=args.batch_size,
            clean=args.clean,
        )


if __name__ == "__main__":
    main()
