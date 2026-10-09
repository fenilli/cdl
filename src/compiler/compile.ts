import { hasErrors, mergeDiagnostics, type Diagnostic } from "./diagnostics";
import { SourceFile } from "./source";
import type { Root } from "./syntax/ast";
import { Lexer } from "./syntax/lexer";
import { Parser } from "./syntax/parser";

export interface CompileResult {
  readonly source: SourceFile;
  readonly root: Root;
  readonly diagnostics: Diagnostic[];
  readonly ok: boolean;
}

export function compile(name: string, text: string): CompileResult {
  const source = new SourceFile(name, text);
  const lexed = new Lexer(source).lex();
  const parsed = new Parser(source, lexed.tokens).parse();
  const diagnostics = mergeDiagnostics(lexed.diagnostics, parsed.diagnostics);
  return { source, root: parsed.root, diagnostics, ok: !hasErrors(diagnostics) };
}
