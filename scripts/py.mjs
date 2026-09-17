#!/usr/bin/env node
// Runs a Python module inside a project's virtualenv, on Windows, Linux and macOS alike.
// Usage: node scripts/py.mjs <project-dir> <python args...>
// Example: node scripts/py.mjs apps/api -m pytest
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [projectDir, ...args] = process.argv.slice(2);

if (!projectDir) {
  console.error("Uso: node scripts/py.mjs <directorio-del-proyecto> <argumentos de python>");
  process.exit(2);
}

const cwd = path.resolve(root, projectDir);
const candidates =
  process.platform === "win32"
    ? [path.join(cwd, ".venv", "Scripts", "python.exe")]
    : [path.join(cwd, ".venv", "bin", "python")];
const python = candidates.find((candidate) => existsSync(candidate));

if (!python) {
  console.error(`No existe el entorno virtual de ${projectDir}. Ejecute primero: npm run setup`);
  process.exit(2);
}

const result = spawnSync(python, args, { cwd, stdio: "inherit" });
process.exit(result.status ?? 1);
