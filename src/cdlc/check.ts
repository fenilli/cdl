import { readFileSync } from "node:fs";
import { compile, formatDiagnostic } from "@compiler/index";

const [file, flag] = process.argv.slice(2);
if (!file) {
  console.error("usage: npm run cdlc:check <file.dsl> [--ast]");
  process.exit(2);
}

const result = compile(file, readFileSync(file, "utf-8"));
for (const d of result.diagnostics) console.log(formatDiagnostic(result.source, d) + "\n");

if (flag === "--ast") console.log(JSON.stringify(result.root, null, 2));
console.log(result.ok ? "ok" : `${result.diagnostics.length} problem(s)`);
process.exitCode = result.ok ? 0 : 1;
