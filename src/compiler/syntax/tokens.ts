import type { Span } from "@compiler/source";

export type TokenKind =
  | "identifier"
  | "string"
  | "command"
  | "option"
  | "argument"
  | "{" | "}"
  | "[" | "]"
  | ":" | "?"
  | "unknown" | "eof";

export type KeywordKind = "command" | "option" | "argument";

export const KEYWORDS: ReadonlyMap<string, KeywordKind> = new Map([
  ["command", "command"],
  ["option", "option"],
  ["argument", "argument"],
]);

export type TriviaKind = "whitespace" | "newline" | "comment";

export interface Trivia {
  readonly kind: TriviaKind;
  readonly span: Span;
}

export interface Token {
  readonly kind: TokenKind;
  readonly span: Span;
  readonly leading: readonly Trivia[];
}
