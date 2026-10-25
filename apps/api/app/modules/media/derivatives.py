"""Derivatives generation for media assets (spec multimedia: D3)."""

import io
import sys
from typing import TYPE_CHECKING

from PIL import Image

if TYPE_CHECKING:
    from app.core.storage import ObjectStorage

# Derivative specifications
THUMB_MAX_DIM = 320
DISPLAY_MAX_DIM = 1600
WEBP_QUALITY = 80


def _resize_image(data: bytes, max_dim: int) -> bytes:
    """Resize image keeping aspect ratio, max dimension = max_dim, output as WebP."""
    image = Image.open(io.BytesIO(data))
    image.load()

    # Keep aspect ratio
    if max(image.width, image.height) > max_dim:
        if image.width >= image.height:
            new_width = max_dim
            new_height = int(image.height * max_dim / image.width)
        else:
            new_height = max_dim
            new_width = int(image.width * max_dim / image.height)
        image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)

    output = io.BytesIO()
    image.save(output, format="WEBP", quality=WEBP_QUALITY, method=6)
    return output.getvalue()


def generate_derivatives(
    storage: "ObjectStorage",
    piece_id: str,
    asset_id: str,
    source_key: str,
) -> dict[str, str]:
    """Generate thumb.webp and display.webp derivatives for an asset.

    Stores them at:
    - pieces/{piece_id}/{asset_id}/thumb.webp
    - pieces/{piece_id}/{asset_id}/display.webp

    Returns dict with keys 'thumb_key', 'display_key'.
    """
    # Download source
    source_data = storage.get_bytes(source_key)

    thumb_data = _resize_image(source_data, THUMB_MAX_DIM)
    display_data = _resize_image(source_data, DISPLAY_MAX_DIM)

    thumb_key = f"pieces/{piece_id}/{asset_id}/thumb.webp"
    display_key = f"pieces/{piece_id}/{asset_id}/display.webp"

    storage.put_bytes(thumb_key, thumb_data, "image/webp")
    storage.put_bytes(display_key, display_data, "image/webp")

    return {"thumb_key": thumb_key, "display_key": display_key}


def rebuild_derivatives_cli() -> int:
    """CLI command: python -m app.media.rebuild_derivatives

    Re-generates missing derivatives for all media assets.
    """
    import argparse
    from pathlib import Path

    from dotenv import load_dotenv

    # Load .env from project root
    project_root = Path(__file__).resolve().parents[3]
    load_dotenv(project_root / ".env")

    from sqlalchemy import select

    from app.core.config import ConfigurationError, load_settings
    from app.core.db import make_engine, make_session_factory
    from app.core.storage import ObjectStorage
    from app.modules.media.models import MediaAsset

    parser = argparse.ArgumentParser(
        prog="python -m app.media.rebuild_derivatives",
        description="Regenera derivados faltantes o fallidos de fotos",
    )
    parser.add_argument(
        "--only-failed",
        action="store_true",
        help="Solo regenera assets con extra_metadata.derivatives='failed'",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Solo lista qué se haría, sin ejecutar",
    )
    args = parser.parse_args()

    try:
        from app.core.config import ConfigurationError, load_settings

        settings = load_settings()
    except ConfigurationError as exc:
        print(exc, file=sys.stderr)
        return 2

    engine = make_engine(settings.database_url)
    factory = make_session_factory(engine)
    storage = ObjectStorage.from_settings(settings)

    with factory() as session:
        # Buscar assets que necesitan derivados
        stmt = select(MediaAsset).where(MediaAsset.deleted_at.is_(None))
        if args.only_failed:
            stmt = stmt.where(MediaAsset.extra_metadata.op("->>")("derivatives") == "failed")
        else:
            # Buscar assets sin thumb.webp ni display.webp en storage
            # (simplificación: regenerar todos si no se pasa --only-failed)
            pass

        assets = list(session.scalars(stmt))
        print(f"Encontrados {len(assets)} assets para regenerar")

        if args.dry_run:
            for asset in assets:
                print(f"  {asset.id} (piece {asset.piece_id}) -> regeneraría thumb/display")
            return 0

        success = 0
        failed = 0
        for asset in assets:
            try:
                from app.modules.media import derivatives

                derivatives.generate_derivatives(
                    storage, str(asset.piece_id), str(asset.id), asset.storage_key
                )
                # Marcar éxito
                asset.extra_metadata = {
                    **(asset.extra_metadata or {}),
                    "derivatives": "ok",
                }
                session.add(asset)
                success += 1
            except (OSError, ValueError, RuntimeError) as exc:
                print(f"  Error en {asset.id}: {exc}", file=sys.stderr)
                asset.extra_metadata = {
                    **(asset.extra_metadata or {}),
                    "derivatives": "failed",
                }
                session.add(asset)
                failed += 1
            if success + failed % 50 == 0:
                session.commit()

        session.commit()
        print(f"Completado: {success} ok, {failed} fallidos")
        return 0 if failed == 0 else 1


if __name__ == "__main__":
    import sys

    raise SystemExit(rebuild_derivatives_cli())
