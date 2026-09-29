"""Spec plataforma — Operación en free tier y portabilidad: variable obligatoria ausente."""

from typing import Any

import pytest

from app.core.config import ConfigurationError, load_settings
from app.core.storage import ObjectStorage

REQUIRED = ["DATABASE_URL", "S3_BUCKET", "JWT_SECRET"]


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
    clean_env.setenv("JWT_SECRET", "x" * 32)
    with pytest.raises(ConfigurationError) as excinfo:
        load_settings()
    assert "S3_BUCKET" in str(excinfo.value)
    assert "DATABASE_URL" not in str(excinfo.value)


def test_short_jwt_secret_is_rejected(clean_env: pytest.MonkeyPatch) -> None:
    for name in REQUIRED:
        clean_env.setenv(name, "value")
    with pytest.raises(ConfigurationError) as excinfo:
        load_settings()
    assert "JWT_SECRET" in str(excinfo.value)
    assert "no válido" in str(excinfo.value)


def test_valid_environment_loads(clean_env: pytest.MonkeyPatch) -> None:
    for name in REQUIRED:
        clean_env.setenv(name, "a-sufficiently-long-value")
    clean_env.setenv("CORS_ORIGINS", "http://localhost:3000, http://127.0.0.1:3000")
    settings = load_settings()
    assert settings.s3_bucket == "a-sufficiently-long-value"
    assert settings.cors_origin_list == ["http://localhost:3000", "http://127.0.0.1:3000"]


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
