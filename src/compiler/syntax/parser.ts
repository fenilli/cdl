import { Diagnostics, type Diagnostic } from "@compiler/diagnostics";
import type { SourceFile, Span } from "@compiler/source";
import type { Token, TokenKind } from "./tokens";
import type {
  Block,
  Declaration,
  Identifier,
  Member,
  Property,
  Root,
  StringLiteral,
  TypeRef
} from "./ast";

export interface ParseResult {
  readonly root: Root;
  readonly diagnostics: Diagnostic[];
}

/**
 * Grammar (newlines are trivia, entries delimit themselves):
 *
 *   root        ::= member* EOF
 *   member      ::= property | declaration
 *   property    ::= IDENT STRING
 *   declaration ::= 'command' IDENT block?
 *                 | ('option' | 'argument') IDENT ':' type block?
 *   block       ::= '{' member* '}'
 *   type        ::= IDENT ('[' ']')? '?'?
 *
 * Recursive descent, one method per rule. It never throws and always returns a
 * tree. Recovery uses exactly two tools:
 *
 *   1. MISSING TOKEN  -> `expect`/`parseIdentifier`/`parseString` report the
 *      problem at the end of the previous token, invent a zero-width
 *      placeholder and carry on WITHOUT consuming anything.
 *   2. UNEXPECTED TOKEN -> `skipUnexpected` discards tokens up to the next
 *      "synchronisation point" (a token that can start a member, the `}`
 *      closing the current block, or EOF) and reports the whole run once.
 *
 * Termination: every loop iteration consumes at least one token or exits.
 */
export class Parser {
  private readonly source: SourceFile;
  private readonly tokens: readonly Token[];
  private readonly diagnostics = new Diagnostics();
  private index = 0;

  constructor(source: SourceFile, tokens: readonly Token[]) {
    this.source = source;
    this.tokens = tokens.filter(t => t.kind !== "unknown");
  }

  parse(): ParseResult {
    const members = this.parseMembers(false);

    const root: Root = {
      kind: "Root",
      span: { start: 0, end: this.text.length },
      members,
    };

    return { root, diagnostics: this.diagnostics.all }
  }

  private parseMembers(inBlock: boolean): Member[] {
    const members: Member[] = [];

    while (!this.at("eof") && !(inBlock && this.at("}"))) {
      const member = this.parseMember();
      if (member) members.push(member);
      else this.skipUnexpected(inBlock);
    }

    return members;
  }

  private parseMember(): Member | undefined {
    switch (this.current.kind) {
      case "command":
      case "option":
      case "argument":
        return this.parseDeclaration();
      case "identifier":
        return this.parseProperty();
      default: return undefined;
    }
  }

  private parseDeclaration(): Declaration {
    const keyword = this.advance();
    const name = this.parseIdentifier(`a ${keyword.kind} name`);

    if (keyword.kind === "command") {
      this.skipStrayType();
      const body = this.at("{") ? this.parseBlock() : undefined;

      return {
        kind: "CommandDeclaration",
        span: this.spanFrom(keyword.span.start),
        keyword: "command",
        name,
        body,
      };
    }

    const type = this.parseTypeRef();
    const body = this.at("{") ? this.parseBlock() : undefined;
    return {
      kind: "TypedDeclaration",
      span: this.spanFrom(keyword.span.start),
      keyword: keyword.kind as "option" | "argument",
      name,
      type,
      body,
    };
  }

  private parseTypeRef(): TypeRef {
    if (this.eat(":")) return this.parseType();
    if (this.at('identifier') && this.peek(1).kind !== "string") {
      this.reportExpected("':' before the type");
      return this.parseType();
    }

    this.reportExpected("':' and a type");
    const name: Identifier = { kind: "Identifier", span: this.missingSpan(), text: "" };
    return { kind: "Type", span: name.span, name, list: false, optional: false };
  }

  private parseType(): TypeRef {
    const name = this.parseIdentifier("a type name");
    let list = false;
    if (this.eat("[")) {
      list = true;
      this.expect("]");
    }

    const optional = this.eat("?") !== undefined;
    return { kind: "Type", span: this.spanFrom(name.span.start), name, list, optional };
  }

  private parseBlock(): Block {
    const open = this.advance();
    const members = this.parseMembers(true);

    if (!this.eat("}")) {
      this.diagnostics.error(
        "parse/unclosed-block",
        "expected '}' but found end of file",
        this.missingSpan(),
        [{ message: "block opened here", span: open.span }],
      )
    }

    return { kind: "Block", span: this.spanFrom(open.span.start), members };
  }

  private parseProperty(): Property {
    const key = this.parseIdentifier("a property name");
    const value = this.parseString(`a string value for '${key.text}'`);
    return { kind: "Property", span: this.spanFrom(key.span.start), key, value };
  }

  private parseIdentifier(what: string): Identifier {
    if (this.at("identifier")) {
      const token = this.advance();
      return { kind: "Identifier", span: token.span, text: this.source.slice(token.span) };
    }

    this.reportExpected(what);
    return { kind: "Identifier", span: this.missingSpan(), text: "" };
  }

  private parseString(what: string): StringLiteral {
    if (this.at("string")) {
      const token = this.advance();
      const raw = this.source.slice(token.span);
      const value = raw.length >= 2 && raw.endsWith('"') ? raw.slice(1, -1) : raw.slice(1);
      return { kind: "String", span: token.span, value };
    }

    this.reportExpected(what);
    return { kind: "String", span: this.missingSpan(), value: "" };
  }

  private skipStrayType(): void {
    const colon = this.eat(":");
    if (!colon) return;
    if (this.at("identifier")) this.parseType();
    this.diagnostics.error(
      "parse/unexpected-type",
      "a command does not take a type",
      this.spanFrom(colon.span.start),
    );
  }

  private skipUnexpected(inBlock: boolean): void {
    const first = this.current;
    let end = first.span.end;
    let count = 0;

    while (!this.isSyncPoint(inBlock)) {
      end = this.advance().span.end;
      count++;
    }

    const what = this.describeToken(first);
    this.diagnostics.error(
      "parse/unexpected-token",
      count > 1 ? `unexpected ${what} (skipped ${count} tokens)` : `unexpected ${what}`,
      { start: first.span.start, end }
    );
  }

  private isSyncPoint(inBlock: boolean): boolean {
    switch (this.current.kind) {
      case "eof":
      case "command":
      case "option":
      case "argument":
      case "identifier":
        return true;
      case "}": return inBlock;
      default: return false;
    }
  }

  private get text(): string {
    return this.source.text;
  }

  private get current(): Token {
    return this.tokens[this.index] ?? this.tokens[this.tokens.length - 1];
  }

  private peek(offset: number): Token {
    return this.tokens[this.index + offset] ?? this.tokens[this.tokens.length - 1];
  }

  private at(kind: TokenKind): boolean {
    return this.current.kind === kind;
  }

  private advance(): Token {
    const token = this.current;
    if (token.kind !== "eof") this.index++;
    return token;
  }

  private eat(kind: TokenKind): Token | undefined {
    return this.at(kind) ? this.advance() : undefined;
  }

  private expect(kind: TokenKind): Token | undefined {
    const token = this.eat(kind);
    if (!token) this.reportExpected(`'${kind}'`);
    return token;
  }

  private get previousEnd(): number {
    return this.index === 0 ? 0 : this.tokens[this.index - 1].span.end;
  }

  private spanFrom(start: number): Span {
    return { start, end: this.previousEnd };
  }

  private missingSpan(): Span {
    return { start: this.previousEnd, end: this.previousEnd };
  }

  private reportExpected(what: string): void {
    this.diagnostics.error(
      "parse/expected",
      `expected ${what}, found ${this.describeToken(this.current)}`,
      this.missingSpan(),
    )
  }

  private describeToken(token: Token): string {
    return this.current.kind === "eof" ? "end of file" : `'${this.source.slice(token.span)}'`;
  }
}
