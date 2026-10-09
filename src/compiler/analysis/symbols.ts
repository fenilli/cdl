import type { Span } from "@compiler/source";
import type { Root, CommandDeclaration, TypedDeclaration, Property } from "@compiler/syntax/ast";

export interface TypedSymbol {
  readonly name: string;
  readonly declaration: TypedDeclaration;
  readonly properties: Map<string, Property>;
}

export type OptionSymbol = TypedSymbol;
export type ArgumentSymbol = TypedSymbol;

export class CommandSymbol {
  readonly name: string;
  readonly declaration: Root | CommandDeclaration;
  readonly parent: CommandSymbol | undefined;
  readonly path: readonly string[];

  readonly properties = new Map<string, Property>();
  readonly options = new Map<string, OptionSymbol>();
  readonly shorts = new Map<string, OptionSymbol>();
  readonly arguments: ArgumentSymbol[] = [];
  readonly commands = new Map<string, CommandSymbol>();

  constructor(
    name: string,
    declaration: Root | CommandDeclaration,
    parent: CommandSymbol | undefined
  ) {
    this.name = name;
    this.declaration = declaration;
    this.parent = parent;
    this.path = parent ? [...parent.path, name] : [];
  }

  get isRoot(): boolean {
    return this.parent === undefined;
  }

  get nameSpan(): Span {
    return this.declaration.kind === "CommandDeclaration"
      ? this.declaration.name.span
      : this.declaration.span;
  }
}
