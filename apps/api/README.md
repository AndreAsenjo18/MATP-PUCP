# apps/api — API del MATP (FastAPI)

Ver `README.md` de la raíz y `docs/adr/ADR-001-estructura-repo.md`.

- `app/core/`: configuración, base de datos, almacenamiento, salud.
- `app/modules/<capacidad>/`: un paquete por capacidad de OpenSpec.
- `alembic/`: migraciones.
- `tests/`: pruebas (pytest).

Arranque local sin Docker (requiere PostgreSQL y S3 accesibles y variables de `.env`):

```bash
npm run setup          # crea .venv e instala dependencias
npm run dev:api        # uvicorn con recarga
```
