import type { Span } from "@compiler/source";

export interface Identifier {
  readonly kind: "Identifier";
  readonly span: Span;
  readonly text: string;
}

/** `string`, `string?`, `string[]`, `string[]?` */
export interface TypeRef {
  readonly kind: "Type";
  readonly span: Span;
  readonly name: Identifier;
  readonly list: boolean;
  readonly optional: boolean;
}

export interface StringLiteral {
  readonly kind: "String";
  readonly span: Span;
  readonly value: string;
}

/** `key "value"` */
export interface Property {
  readonly kind: "Property";
  readonly span: Span;
  readonly key: Identifier;
  readonly value: StringLiteral;
}

/** `command name block?` */
export interface CommandDeclaration {
  readonly kind: "CommandDeclaration";
  readonly span: Span;
  readonly keyword: "command";
  readonly name: Identifier;
  readonly body?: Block;
}

/** `option|argument name : type block?` */
export interface TypedDeclaration {
  readonly kind: "TypedDeclaration";
  readonly span: Span;
  readonly keyword: "option" | "argument";
  readonly name: Identifier;
  readonly type: TypeRef;
  readonly body?: Block;
}

export type Declaration = CommandDeclaration | TypedDeclaration;

export interface Block {
  readonly kind: "Block";
  readonly span: Span;
  readonly members: readonly Member[];
}

export type Member = Property | Declaration;

/** The file itself is an implicit block. */
export interface Root {
  readonly kind: "Root";
  readonly span: Span;
  readonly members: readonly Member[];
}

export type Node = Root | Block | Member | Identifier | StringLiteral | TypeRef;

export function isMissing(node: Node): boolean {
  return node.span.start === node.span.end;
}

export function children(node: Node): readonly Node[] {
  switch (node.kind) {
    case "Root":
    case "Block":
      return node.members;
    case "Property":
      return [node.key, node.value];
    case "CommandDeclaration":
    case "TypedDeclaration":
      return [
        node.name,
        ...(node.keyword === "command" ? [] : [node.type]),
        ...(node.body ? [node.body] : []),
      ];
    case "Type":
      return [node.name];
    case "Identifier":
    case "String":
      return [];
  }
}

export function walk(
  node: Node,
  visit: (node: Node, parent: Node | undefined) => void,
  parent?: Node,
): void {
  visit(node, parent);
  for (const child of children(node)) walk(child, visit, node);
}
