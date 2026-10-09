import { hasErrors, mergeDiagnostics, type Diagnostic } from "./diagnostics";
import { SourceFile } from "./source";
import type { Root } from "./syntax/ast";
import { Lexer } from "./syntax/lexer";
import { Parser } from "./syntax/parser";
import { Analyzer, CommandSymbol } from "./analysis";

export interface CompileResult {
  readonly source: SourceFile;
  readonly root: Root;
  readonly symbols: CommandSymbol;
  readonly diagnostics: Diagnostic[];
  readonly ok: boolean;
}

export function compile(name: string, text: string): CompileResult {
  const source = new SourceFile(name, text);
  const lexed = new Lexer(source).lex();
  const parsed = new Parser(source, lexed.tokens).parse();
  const analyzed = new Analyzer().analyze(parsed.root);
  const diagnostics = mergeDiagnostics(lexed.diagnostics, parsed.diagnostics, analyzed.diagnostics);
  return { source, root: parsed.root, symbols: analyzed.symbols, diagnostics, ok: !hasErrors(diagnostics) };
}
