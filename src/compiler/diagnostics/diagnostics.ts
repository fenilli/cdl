import type { Span } from "@compiler/source";

export type Severity = "error" | "warning";

export type DiagnosticCode =
  | "lex/unterminated-string"
  | "lex/unexpected-character"
  | "parse/expected"
  | "parse/unexpected-token"
  | "parse/unexpected-type"
  | "parse/unclosed-block";

export interface Diagnostic {
  readonly severity: Severity;
  readonly code: DiagnosticCode;
  readonly message: string;
  readonly span: Span;
  readonly related?: readonly { readonly message: string; readonly span: Span }[];
}

export class Diagnostics {
  private readonly items: Diagnostic[] = [];

  error(
    code: DiagnosticCode,
    message: string,
    span: Span,
    related?: Diagnostic["related"],
  ): void {
    this.items.push({ severity: "error", code, message, span, related });
  }

  warning(
    code: DiagnosticCode,
    message: string,
    span: Span,
    related?: Diagnostic["related"],
  ): void {
    this.items.push({ severity: "warning", code, message, span, related });
  }

  get all(): Diagnostic[] {
    return [...this.items];
  }
}

export function mergeDiagnostics(...lists: readonly (readonly Diagnostic[])[]): Diagnostic[] {
  return lists.flat().sort((a, b) => a.span.start - b.span.start);
}

export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some(d => d.severity === "error");
}

export function hasWarnings(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some(d => d.severity === "warning");
}
