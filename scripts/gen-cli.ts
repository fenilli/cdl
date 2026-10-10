import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compile, emitDts, emitJson, formatDiagnostic } from "@compiler/index";

const source = "src/cdlc/cdlc.cdl";
const outDir = "src/cdlc/generated";

const result = compile(source, readFileSync(source, "utf-8"));
for (const d of result.diagnostics) console.error(formatDiagnostic(result.source, d) + "\n");

if (!result.schema) {
  console.error(`${source} has errors; nothing written`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "schema.json"), emitJson(result.schema));
writeFileSync(join(outDir, "schema.d.ts"), emitDts(result.schema));
console.log(`wrote ${outDir}/schema.json and ${outDir}/schema.d.ts`);
