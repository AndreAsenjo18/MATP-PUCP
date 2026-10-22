"""Database engine and session factory (SQLAlchemy 2)."""

import unicodedata
from collections.abc import Iterator

from sqlalchemy import Engine, create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker


def sqlite_unaccent(val: str | None) -> str | None:
    """Strip accents and diacritics for SQLite unit tests (unicodedata NFKD)."""
    if val is None:
        return None
    nfkd = unicodedata.normalize("NFKD", str(val))
    return "".join(c for c in nfkd if not unicodedata.combining(c))


@event.listens_for(Engine, "connect")
def _register_sqlite_functions(dbapi_connection, _connection_record) -> None:  # type: ignore[no-untyped-def]
    if hasattr(dbapi_connection, "create_function"):
        dbapi_connection.create_function("unaccent", 1, sqlite_unaccent)
        dbapi_connection.create_function("immutable_unaccent", 1, sqlite_unaccent)


def make_engine(database_url: str, *, connect_timeout: float = 2.0, echo: bool = False) -> Engine:
    connect_args: dict[str, object] = {}
    if database_url.startswith("postgresql"):
        connect_args["connect_timeout"] = max(1, int(connect_timeout))
    return create_engine(database_url, pool_pre_ping=True, echo=echo, connect_args=connect_args)


def make_session_factory(engine: Engine) -> sessionmaker[Session]:
    from app.persistence import install

    install()
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def session_scope(factory: sessionmaker[Session]) -> Iterator[Session]:
    """Yield a session that commits on success and rolls back on error."""
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def check_database(engine: Engine) -> None:
    """Raise if the database cannot answer a trivial query."""
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
