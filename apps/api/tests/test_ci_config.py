"""Spec plataforma: la integración continua y Docker Compose usan la misma versión de PostgreSQL.

Las migraciones se verifican en CI contra el servicio ``postgres`` del workflow, pero se
desarrollan y se seedizan contra el servicio ``db`` de Compose. Si las dos imágenes se separan,
una migración puede pasar en CI y fallar en el entorno local (o al revés), así que la diferencia
se comprueba aquí, en la suite habitual, sin necesidad de PostgreSQL (change
ci-migraciones-postgresql, tarea 3.2).
"""

from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[3]
COMPOSE_FILE = ROOT / "docker-compose.yml"
CI_WORKFLOW = ROOT / ".github" / "workflows" / "ci.yml"


def _load(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def test_ci_postgres_image_matches_compose() -> None:
    compose_image = _load(COMPOSE_FILE)["services"]["db"]["image"]
    ci_image = _load(CI_WORKFLOW)["jobs"]["migrations"]["services"]["postgres"]["image"]
    assert ci_image == compose_image, (
        f"La imagen de PostgreSQL del job de migraciones ({ci_image}) no es la de "
        f"docker-compose.yml ({compose_image}). Deben ser la misma versión mayor."
    )


def test_ci_migrations_job_runs_the_postgres_tests() -> None:
    """El job debe ejecutar las pruebas marcadas, no la suite completa sobre SQLite."""
    steps = _load(CI_WORKFLOW)["jobs"]["migrations"]["steps"]
    commands = [step.get("run") for step in steps if step.get("run")]
    assert "npm run test:api:postgres" in commands, f"Pasos del job: {commands}"


def test_test_api_pg_script_is_wired_in_package_json() -> None:
    """`npm run test:api:pg` es el paso de verificación local del daily (tarea 4.1)."""
    scripts = _load(ROOT / "package.json")["scripts"]
    assert scripts.get("test:api:pg") == "node scripts/test-api-pg.mjs"
    assert (ROOT / "scripts" / "test-api-pg.mjs").is_file()
