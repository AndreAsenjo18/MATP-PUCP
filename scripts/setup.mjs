#!/usr/bin/env node
// Creates a virtualenv per Python project and installs its dependencies (pip + venv, see ADR-003).
// Usage: node scripts/setup.mjs [project-dir ...]   (default: apps/api services/ai)
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projects = process.argv.slice(2).length ? process.argv.slice(2) : ["apps/api", "services/ai"];
const basePython = process.env.PYTHON ?? (process.platform === "win32" ? "python" : "python3");

function run(command, args, cwd) {
  console.log(`> ${command} ${args.join(" ")}  (${path.relative(root, cwd) || "."})`);
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`Falló: ${command} ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
}

for (const project of projects) {
  const cwd = path.resolve(root, project);
  const venvPython =
    process.platform === "win32"
      ? path.join(cwd, ".venv", "Scripts", "python.exe")
      : path.join(cwd, ".venv", "bin", "python");
  if (!existsSync(venvPython)) {
    run(basePython, ["-m", "venv", ".venv"], cwd);
  }
  run(venvPython, ["-m", "pip", "install", "--upgrade", "pip"], cwd);
  run(venvPython, ["-m", "pip", "install", "-e", ".[dev]"], cwd);
}

console.log("Entornos de Python listos. Para el frontend ejecute: npm install");
