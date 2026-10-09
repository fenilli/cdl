import type { SourceFile } from "@compiler/source";
import { Diagnostics, type Diagnostic } from "@compiler/diagnostics";
import {
  KEYWORDS,
  type Token, type TokenKind,
  type Trivia, type TriviaKind
} from "./tokens";

export interface LexResult {
  readonly tokens: Token[];
  readonly diagnostics: Diagnostic[];
}

const PUNCTUATION: ReadonlySet<string> = new Set(["{", "}", "[", "]", ":", "?"]);

const isIdentStart = (ch: string) => /^[A-Za-z]$/.test(ch);
const isIdentPart = (ch: string) => /^[A-Za-z0-9_-]$/.test(ch);
const isInlineSpace = (ch: string) => ch === " " || ch === "\t" || ch === "\r";

export class Lexer {
  private readonly source: SourceFile;
  private readonly diagnostics = new Diagnostics();
  private pos = 0;

  constructor(source: SourceFile) {
    this.source = source;
  }

  lex(): LexResult {
    const tokens: Token[] = [];

    for (; ;) {
      const leading = this.readTrivia();
      const start = this.pos;

      if (this.pos >= this.text.length) {
        tokens.push({ kind: "eof", span: { start, end: start }, leading });
        break;
      }

      const kind = this.readToken();
      tokens.push({ kind, span: { start, end: this.pos }, leading });
    }

    return { tokens, diagnostics: this.diagnostics.all };
  }

  private readTrivia(): Trivia[] {
    const trivia: Trivia[] = [];

    for (; ;) {
      const start = this.pos;
      const ch = this.text.charAt(this.pos);
      let kind: TriviaKind;

      if (isInlineSpace(ch)) {
        while (isInlineSpace(this.text.charAt(this.pos))) this.pos++;
        kind = "whitespace";
      } else if (ch === "\n") {
        this.pos++;
        kind = "newline";
      } else if (ch === "#") {
        while (this.pos < this.text.length && this.text.charAt(this.pos) !== "\n") this.pos++;
        kind = "comment";
      } else {
        return trivia;
      }

      trivia.push({ kind, span: { start, end: this.pos } });
    }
  }

  private readToken(): TokenKind {
    const ch = this.text.charAt(this.pos);

    if (PUNCTUATION.has(ch)) {
      this.pos++;
      return ch as TokenKind;
    }

    if (ch === '"') return this.readString();
    if (isIdentStart(ch)) return this.readWord();

    return this.readUnknown();
  }

  private readString(): TokenKind {
    const start = this.pos;
    this.pos++;

    for (; ;) {
      const ch = this.text.charAt(this.pos);
      if (ch === "" || ch === "\n" || ch === "\r" || ch == '"') break;
      this.pos++;
    }

    if (this.text.charAt(this.pos) === '"') this.pos++;
    else {
      this.diagnostics.error("lex/unterminated-string", "unterminated string", {
        start,
        end: this.pos
      });
    }

    return "string";
  }

  private readWord(): TokenKind {
    const start = this.pos;
    while (isIdentPart(this.text.charAt(this.pos))) this.pos++;

    return KEYWORDS.get(this.text.slice(start, this.pos)) ?? "identifier";
  }

  private readUnknown(): TokenKind {
    const start = this.pos;

    do this.pos++;
    while (!this.isBoundary(this.text.charAt(this.pos)));

    const span = { start, end: this.pos };
    this.diagnostics.error(
      "lex/unexpected-character",
      `unexpected characte(s) '${this.source.slice(span)}'`,
      span,
    );

    return "unknown";
  }

  private isBoundary(ch: string): boolean {
    return (
      ch === "" ||
      isInlineSpace(ch) ||
      ch === "\n" ||
      ch === "#" ||
      ch === '"' ||
      PUNCTUATION.has(ch) ||
      isIdentStart(ch)
    );
  }

  private get text(): string {
    return this.source.text;
  }
}
