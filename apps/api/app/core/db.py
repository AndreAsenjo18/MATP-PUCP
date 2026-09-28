"""Database engine and session factory (SQLAlchemy 2)."""

from collections.abc import Iterator

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session, sessionmaker


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
