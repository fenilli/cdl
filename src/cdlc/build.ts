import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compile, emitDts, emitJson, formatDiagnostic } from "@compiler/index";

const [file, outDir = "."] = process.argv.slice(2);
if (!file) {
  console.error("usage: npm run cdlc:build <file.dsl> [outDir]");
  process.exit(2);
}

const result = compile(file, readFileSync(file, "utf-8"));
for (const d of result.diagnostics) console.error(formatDiagnostic(result.source, d) + "\n");

if (!result.schema) {
  console.error(`${result.diagnostics.length} problem(s), nothing written`);
  process.exitCode = 1;
} else {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "schema.json"), emitJson(result.schema));
  writeFileSync(join(outDir, "schema.d.ts"), emitDts(result.schema));
  console.log(`wrote ${join(outDir, "schema.json")} and ${join(outDir, "schema.d.ts")}`);
}
