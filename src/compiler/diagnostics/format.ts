import type { SourceFile } from "@compiler/source";
import type { Diagnostic } from "./diagnostics";

export function formatDiagnostic(source: SourceFile, d: Diagnostic): string {
  const { line, column } = source.position(d.span.start);

  const text = source.lineText(line);
  const width = Math.max(1, Math.min(d.span.end - d.span.start, text.length - (column - 1)));
  const out = [
    `${source.name}:${line}:${column} ${d.severity}[${d.code}]: ${d.message}`,
    `${String(line).padStart(4)} | ${text}`,
    `     | ${" ".repeat(column - 1)}${"^".repeat(width)}`
  ];

  for (const r of d.related ?? []) {
    const p = source.position(r.span.start);
    out.push(`     = ${r.message} (${source.name}:${p.line}:${p.column})`);
  }

  return out.join("\n");
}
