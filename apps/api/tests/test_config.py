"""Spec plataforma — Operación en free tier y portabilidad: variable obligatoria ausente."""

from typing import Any

import pytest

from app.core.config import ConfigurationError, load_settings
from app.core.storage import ObjectStorage

REQUIRED = ["DATABASE_URL", "S3_BUCKET"]


@pytest.fixture
def clean_env(monkeypatch: pytest.MonkeyPatch) -> pytest.MonkeyPatch:
    for name in [*REQUIRED, "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]:
        monkeypatch.delenv(name, raising=False)
    return monkeypatch


def test_missing_required_variables_are_named(clean_env: pytest.MonkeyPatch) -> None:
    with pytest.raises(ConfigurationError) as excinfo:
        load_settings()
    message = str(excinfo.value)
    assert "Faltan variables de entorno obligatorias" in message
    for name in REQUIRED:
        assert name in message


def test_single_missing_variable(clean_env: pytest.MonkeyPatch) -> None:
    clean_env.setenv("DATABASE_URL", "postgresql+psycopg://u:p@db:5432/matp")
    clean_env.setenv("S3_ACCESS_KEY_ID", "key")
    clean_env.setenv("S3_SECRET_ACCESS_KEY", "secret")
    with pytest.raises(ConfigurationError) as excinfo:
        load_settings()
    assert "S3_BUCKET" in str(excinfo.value)
    assert "DATABASE_URL" not in str(excinfo.value)


def test_out_of_range_session_lifetime_is_rejected(clean_env: pytest.MonkeyPatch) -> None:
    """ADR-009 reemplaza JWT_* por los tiempos de sesión; un valor fuera de rango se nombra."""
    for name in REQUIRED:
        clean_env.setenv(name, "value")
    clean_env.setenv("SESSION_IDLE_MINUTES", "0")
    with pytest.raises(ConfigurationError) as excinfo:
        load_settings()
    assert "SESSION_IDLE_MINUTES" in str(excinfo.value)
    assert "no válido" in str(excinfo.value)


def test_insecure_cookies_are_rejected_in_production(clean_env: pytest.MonkeyPatch) -> None:
    """La cookie de sesión solo viaja por HTTPS en producción (RNF-013, ADR-009)."""
    for name in REQUIRED:
        clean_env.setenv(name, "a-sufficiently-long-value")
    clean_env.setenv("APP_ENV", "production")
    clean_env.setenv("COOKIE_SECURE", "false")
    with pytest.raises(ConfigurationError) as excinfo:
        load_settings()
    assert "COOKIE_SECURE" in str(excinfo.value)


def test_valid_environment_loads(clean_env: pytest.MonkeyPatch) -> None:
    for name in REQUIRED:
        clean_env.setenv(name, "a-sufficiently-long-value")
    clean_env.setenv("CORS_ORIGINS", "http://localhost:3000, http://127.0.0.1:3000")
    settings = load_settings()
    assert settings.s3_bucket == "a-sufficiently-long-value"
    assert settings.cors_origin_list == ["http://localhost:3000", "http://127.0.0.1:3000"]


PHOTO_IMPORT_VARIABLES = [
    "IMPORT_MAX_PHOTOS",
    "MEDIA_KEEP_ORIGINALS",
    "IMPORT_PHOTO_RETENTION_DAYS",
    "MEDIA_QUOTA_BYTES",
]


def test_photo_import_settings_defaults_and_overrides(clean_env: pytest.MonkeyPatch) -> None:
    """importacion-masiva-fotografias (D2, D6, D7): tope por lote, originales y cuota."""
    for name in REQUIRED:
        clean_env.setenv(name, "a-sufficiently-long-value")
    for name in PHOTO_IMPORT_VARIABLES:
        clean_env.delenv(name, raising=False)
    defaults = load_settings()
    assert defaults.import_max_photos == 5_000
    assert defaults.media_keep_originals is True
    assert defaults.import_photo_retention_days == 30
    assert defaults.media_quota_bytes is None

    clean_env.setenv("MEDIA_QUOTA_BYTES", "")  # as written in .env.example: no quota warning
    assert load_settings().media_quota_bytes is None
    clean_env.setenv("MEDIA_KEEP_ORIGINALS", "false")
    clean_env.setenv("MEDIA_QUOTA_BYTES", "8000000000")
    clean_env.setenv("IMPORT_MAX_PHOTOS", "2000")
    overridden = load_settings()
    assert overridden.media_keep_originals is False
    assert overridden.media_quota_bytes == 8_000_000_000
    assert overridden.import_max_photos == 2_000


def test_photo_quota_must_be_positive(clean_env: pytest.MonkeyPatch) -> None:
    for name in REQUIRED:
        clean_env.setenv(name, "a-sufficiently-long-value")
    clean_env.setenv("MEDIA_QUOTA_BYTES", "0")
    with pytest.raises(ConfigurationError) as excinfo:
        load_settings()
    assert "MEDIA_QUOTA_BYTES" in str(excinfo.value)


def test_s3_credentials_both_empty_is_valid(clean_env: pytest.MonkeyPatch) -> None:
    for name in REQUIRED:
        clean_env.setenv(name, "a-sufficiently-long-value")
    clean_env.setenv("S3_ACCESS_KEY_ID", "")
    clean_env.setenv("S3_SECRET_ACCESS_KEY", "")
    settings = load_settings()
    assert settings.s3_access_key_id is None
    assert settings.s3_secret_access_key is None


def test_s3_credentials_only_one_defined_is_invalid(clean_env: pytest.MonkeyPatch) -> None:
    for name in REQUIRED:
        clean_env.setenv(name, "a-sufficiently-long-value")
    clean_env.setenv("S3_ACCESS_KEY_ID", "only-access-key")
    with pytest.raises(ConfigurationError) as excinfo:
        load_settings()
    message = str(excinfo.value)
    assert "S3_ACCESS_KEY_ID y S3_SECRET_ACCESS_KEY deben definirse ambas o ninguna" in message


def test_from_settings_omits_keys_when_none(
    clean_env: pytest.MonkeyPatch, monkeypatch: pytest.MonkeyPatch
) -> None:
    for name in REQUIRED:
        clean_env.setenv(name, "a-sufficiently-long-value")
    clean_env.setenv("S3_ACCESS_KEY_ID", "")
    clean_env.setenv("S3_SECRET_ACCESS_KEY", "")
    settings = load_settings()

    captured: dict[str, Any] = {}

    def fake_client(service: str, **kwargs: Any) -> object:
        captured["service"] = service
        captured.update(kwargs)
        return object()

    import app.core.storage as storage_module

    monkeypatch.setattr(storage_module.boto3, "client", fake_client)
    ObjectStorage.from_settings(settings)
    assert "aws_access_key_id" not in captured
    assert "aws_secret_access_key" not in captured
