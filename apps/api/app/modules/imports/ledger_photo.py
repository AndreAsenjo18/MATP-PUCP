"""Carga de un lote desde fotos del libro de registros (change `digitalizacion-libro-registros`,
design D1/D2/D4).

No construye una pantalla ni una cola de revisión propias: junta las filas que la IA lee de cada
foto, las guarda como ``raw_data`` con los encabezados sintéticos de la plantilla fija «Foto del
libro de registros» y aplica esa plantilla con las mismas funciones (`store_ingested_rows`,
`set_mapping`) que ya usa cualquier lote de Excel. Desde ahí, todo lo que sigue (validar,
clasificar, previsualizar, decidir, aprobar, aplicar) es el flujo de importación que ya existe.
"""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import NotFound
from app.core.models_base import new_uuid, utcnow
from app.core.storage import ObjectStorage
from app.modules.imports import templates
from app.modules.imports.ingest import IngestedRow, IngestResult
from app.modules.imports.models import ImportBatch, ImportMappingTemplate
from app.modules.imports.models import ImportBatchStatus as S
from app.modules.imports.service import set_mapping, store_ingested_rows
from app.seed.import_templates import LIBRO_REGISTROS

#: Orden de los encabezados sintéticos (design D2); fijo, no lo elige nadie.
_HEADERS = LIBRO_REGISTROS.headers


def create_ledger_photo_batch(
    session: Session, *, uploaded_by_id: uuid.UUID, photo_count: int
) -> ImportBatch:
    """Lote sin archivo original (D1): el `kind` por defecto sigue siendo `SPREADSHEET` para que
    mapear, validar y revisar filas funcionen sin cambios; solo `source_name` dice que vino de
    fotos, no de un Excel."""
    name = (
        "Foto del libro de registros"
        if photo_count == 1
        else f"{photo_count} fotos del libro de registros"
    )
    batch = ImportBatch(
        id=new_uuid(),
        source_name=name,
        file_name=name[:300],
        status=S.UPLOADED,
        uploaded_by_id=uploaded_by_id,
        stage_timestamps={S.UPLOADED.value: utcnow().isoformat()},
        counts={},
    )
    session.add(batch)
    session.flush()
    return batch


def _ledger_template_id(session: Session) -> uuid.UUID:
    """La plantilla fija «Foto del libro de registros», ya creada por `sync_predefined_templates`
    al arrancar la API. Ligar el lote a su id (no solo copiar su mapeo) es lo que deja usar,
    durante la revisión, la misma acción «Elegir régimen de tenencia para todas» que ya tiene
    cualquier lote con plantilla — ajuste tras probar en vivo que sin `template_id` esa acción no
    aparecía (ningún `appliedSource` de sesión, ningún `template_id` en el lote)."""
    template_id = session.scalar(
        select(ImportMappingTemplate.id).where(
            ImportMappingTemplate.name == LIBRO_REGISTROS.name,
            ImportMappingTemplate.deleted_at.is_(None),
        )
    )
    if template_id is None:
        raise NotFound(
            "La plantilla «Foto del libro de registros» no existe; reinicie la API para que se "
            "cree (sync_predefined_templates)."
        )
    return template_id


def row_raw_data(extraction: dict[str, Any]) -> dict[str, Any]:
    """Una fila de ``LedgerPageExtraction.rows`` (el servicio de IA) a ``raw_data`` con los
    encabezados sintéticos de la plantilla fija, en el mismo orden que declara sus columnas."""
    (
        denomination,
        description,
        provenance,
        conservation,
        entry_date,
        inventory,
        additional,
        collection,
    ) = _HEADERS
    return {
        denomination: extraction.get("denomination"),
        description: extraction.get("description"),
        provenance: extraction.get("provenance"),
        conservation: extraction.get("conservation_state"),
        entry_date: extraction.get("entry_date"),
        inventory: extraction.get("inventory_code"),
        additional: extraction.get("additional_code"),
        # La foto nunca trae la colección: queda vacía para que el curador la elija en la
        # revisión (design D2/LR5), no algo que la IA pueda leer de la ficha física.
        collection: None,
    }


def ingest_ledger_rows(
    session: Session,
    storage: ObjectStorage,
    batch: ImportBatch,
    rows: list[dict[str, Any]],
) -> int:
    """Guarda ``rows`` (ya en ``raw_data``, una por fila leída de cualquiera de las fotos) y
    aplica la plantilla fija: el lote queda `MAPPED`, listo para `POST /imports/{id}/validate`
    igual que cualquier otro lote (D4)."""
    result = IngestResult(
        file_format="jpeg",
        sheet_names=[],
        sheet_name=None,
        header_row=1,
        headers=list(_HEADERS),
        rows=[IngestedRow(row_number=i, raw_data=row) for i, row in enumerate(rows, start=1)],
    )
    total = store_ingested_rows(session, batch, result)
    template_id = _ledger_template_id(session)
    spec = templates.batch_spec(session, template_id, {}, list(_HEADERS))
    set_mapping(session, storage, batch.id, spec)
    batch.template_id = template_id
    return total
