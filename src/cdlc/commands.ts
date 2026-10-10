import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compile, emitDts, emitJson, formatDiagnostic, type CompileResult } from "@compiler/index";
import type { Output } from "@runtime/index";

export interface FS {
  readFile(path: string): string;
  writeFile(path: string, content: string): void;
  mkdir(path: string): void;
}

export const nodeFS: FS = {
  readFile: (path) => readFileSync(path, "utf-8"),
  writeFile: (path, content) => writeFileSync(path, content),
  mkdir: (path) => void mkdirSync(path, { recursive: true }),
};

export type Env = Output & FS;

export function check(file: string, options: { readonly ast: boolean }, env: Env): number {
  const result = compileFile(file, env);
  if (!result) return 1;

  report(result, env);
  if (options.ast) env.print(JSON.stringify(result.root, null, 2));
  return finish(result, env);
}

export function build(file: string, outDir: string, env: Env): number {
  const result = compileFile(file, env);
  if (!result) return 1;

  report(result, env);
  if (!result.schema) {
    env.printError(`${summary(result)}; nothing written`);
    return 1;
  }

  const json = join(outDir, "schema.json");
  const dts = join(outDir, "schema.d.ts");

  env.mkdir(outDir);
  env.writeFile(json, emitJson(result.schema));
  env.writeFile(dts, emitDts(result.schema));
  env.print(`wrote ${json} and ${dts}`);
  return 0;
}

function compileFile(file: string, env: Env): CompileResult | undefined {
  let text: string;
  try {
    text = env.readFile(file);
  } catch (err) {
    env.printError(`error: cannot read '${file}' ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }

  return compile(file, text);
}

function report(result: CompileResult, env: Env): void {
  for (const d of result.diagnostics) env.printError(formatDiagnostic(result.source, d) + "\n");
}

function finish(result: CompileResult, env: Env): number {
  if (result.ok) {
    env.print(summary(result));
    return 0;
  }

  env.printError(summary(result));
  return 1;
}

function summary(result: CompileResult): string {
  const errors = result.diagnostics.filter(d => d.severity === "error").length;
  const warnings = result.diagnostics.length - errors;
  const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
  if (errors === 0) return warnings === 0 ? "ok" : `ok, ${count(warnings, "warning")}`;
  return warnings === 0 ? count(errors, "error") : `${count(errors, "error")}, ${count(warnings, "warning")}`;
}
