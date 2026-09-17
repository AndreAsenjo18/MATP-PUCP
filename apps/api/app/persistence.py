"""Wire models, domain guards and session hooks together (idempotent)."""


def install() -> None:
    import app.models
    import app.modules.identification.service  # noqa: F401  (register flush guards)
    from app.modules.audit.tracking import install_persistence_hooks

    install_persistence_hooks()
