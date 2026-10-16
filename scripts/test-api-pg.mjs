#!/usr/bin/env node
// Runs the migration tests against a real PostgreSQL (change ci-migraciones-postgresql, D5).
//
// It starts the Compose `db` service, creates the `matp_test` database if it does not exist and
// runs `pytest -m postgres` with TEST_POSTGRES_URL pointing at that database. It never points at
// `matp`, which holds the seed data. Written in Node so it behaves the same on Windows, Linux
// and macOS (ADR-000).
//
// Usage: npm run test:api:pg
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DATABASE = "matp_test";
// On Windows `docker` is docker.exe: naming the extension lets spawn resolve it through
// PATH + PATHEXT without a shell, which would otherwise strip the quotes out of the SQL below.
const dockerBin = process.platform === "win32" ? "docker.exe" : "docker";

/** Reads the same variables Compose reads, so the credentials cannot drift from the .env. */
function dotEnv() {
  const file = path.join(root, ".env");
  const values = {};
  if (!existsSync(file)) return values;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

const fromFile = dotEnv();
const user = process.env.POSTGRES_USER ?? fromFile.POSTGRES_USER ?? "matp";
const password = process.env.POSTGRES_PASSWORD ?? fromFile.POSTGRES_PASSWORD ?? "matp";
const port = process.env.DB_PORT ?? fromFile.DB_PORT ?? "5432";

function docker(args, options = {}) {
  const result = spawnSync(dockerBin, args, { cwd: root, stdio: "inherit", ...options });
  if (result.error) {
    console.error("No se pudo ejecutar docker. ¿Está Docker Desktop arrancado?");
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result;
}

docker(["compose", "up", "-d", "--wait", "db"]);

const exists = spawnSync(
  dockerBin,
  [
    "compose",
    "exec",
    "-T",
    "db",
    "psql",
    "-U",
    user,
    "-d",
    "postgres",
    "-tAc",
    `SELECT 1 FROM pg_database WHERE datname = '${TEST_DATABASE}'`,
  ],
  { cwd: root, encoding: "utf8" },
);
if (exists.status !== 0) {
  console.error("No se pudo consultar las bases del servicio db.");
  process.exit(exists.status ?? 1);
}
if (exists.stdout.trim() === "") {
  console.log(`Creando la base ${TEST_DATABASE}...`);
  docker(["compose", "exec", "-T", "db", "createdb", "-U", user, TEST_DATABASE]);
}

// A password with URL-special characters (as in the .env template) has to be escaped.
const url =
  `postgresql+psycopg://${encodeURIComponent(user)}:${encodeURIComponent(password)}` +
  `@localhost:${port}/${TEST_DATABASE}`;

console.log(`Ejecutando las pruebas de migraciones en ${TEST_DATABASE} (localhost:${port})...`);
const result = spawnSync(
  process.execPath,
  ["scripts/py.mjs", "apps/api", "-m", "pytest", "-m", "postgres"],
  { cwd: root, stdio: "inherit", env: { ...process.env, TEST_POSTGRES_URL: url } },
);
process.exit(result.status ?? 1);
