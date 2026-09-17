#!/usr/bin/env node
// Generates src/lib/api/schema.d.ts from docs/api/openapi.json (change contratos-api-borrador, D7).
// The header stores the SHA-256 of the contract so a unit test detects a stale client.
// Usage: npm run openapi:client   (from the repository root)
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import openapiTS, { astToString } from "openapi-typescript";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = path.resolve(webRoot, "..", "..", "docs", "api", "openapi.json");
const outputPath = path.join(webRoot, "src", "lib", "api", "schema.d.ts");

const contract = readFileSync(contractPath, "utf8");
const sha256 = createHash("sha256").update(contract.replace(/\r\n/g, "\n")).digest("hex");

const ast = await openapiTS(JSON.parse(contract), { alphabetize: true });
const header = [
  "/**",
  " * Tipos generados desde docs/api/openapi.json. NO EDITAR A MANO.",
  " * Regenerar con: npm run openapi && npm run openapi:client",
  ` * openapi-sha256: ${sha256}`,
  " */",
  "",
].join("\n");

writeFileSync(outputPath, header + astToString(ast), { encoding: "utf8" });
console.log(`Cliente tipado generado en ${path.relative(process.cwd(), outputPath)}`);
