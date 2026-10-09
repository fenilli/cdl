import { Diagnostics, type Diagnostic } from "@compiler/diagnostics";
import {
  isMissing,
  type Root,
  type CommandDeclaration,
  type TypedDeclaration,
  type Member,
  type Property,
} from "@compiler/syntax/ast";
import {
  checkArguments,
  checkReservedCommandName,
  checkReservedFlag,
  checkShortValue,
  checkType,
  checkVersionMetadata,
  isValidShort,
} from "./rules";
import {
  KEYWORD_LABELS,
  SCOPE_LABELS,
  SCOPES,
  scopesAllowingProperty,
  type ScopeKind,
} from "./scopes";
import { CommandSymbol, type TypedSymbol } from "./symbols";

export interface AnalysisResult {
  readonly symbols: CommandSymbol;
  readonly diagnostics: Diagnostic[];
}

const where = (command: CommandSymbol) =>
  command.isRoot ? "at the top level" : `in command '${command.path.join(" ")}'`;

export class Analyzer {
  private readonly diagnostics = new Diagnostics();

  analyze(root: Root): AnalysisResult {
    const symbols = new CommandSymbol("", root, undefined);
    this.analyzeScope("root", root.members, symbols.properties, symbols);
    return { symbols, diagnostics: this.diagnostics.all };
  }

  private analyzeScope(
    scope: ScopeKind,
    members: readonly Member[],
    properties: Map<string, Property>,
    command: CommandSymbol | undefined,
  ): void {
    const allowed = SCOPES[scope].members;

    for (const member of members) {
      if (member.kind === "Property") {
        this.analyzeProperty(scope, member, properties);
        continue;
      }

      if (!command || !allowed.includes(member.keyword)) {
        this.diagnostics.error(
          "analysis/misplaced-declaration",
          `cannot declare ${KEYWORD_LABELS[member.keyword]} inside ${SCOPE_LABELS[scope]}`,
          { start: member.span.start, end: member.span.start + member.keyword.length },
        );
        continue;
      }

      if (member.keyword === "command") this.analyzeCommand(member, command);
      else this.analyzeTyped(member, command);
    }

    if (command) {
      checkArguments(command.arguments, this.diagnostics);
      if (command.isRoot) checkVersionMetadata(command, this.diagnostics);
    }
  }

  private analyzeProperty(
    scope: ScopeKind,
    property: Property,
    properties: Map<string, Property>,
  ): void {
    const key = property.key.text;

    if (!SCOPES[scope].properties.includes(key)) {
      const validIn = scopesAllowingProperty(key);
      if (validIn.length > 0) {
        const labels = validIn.map(k => SCOPE_LABELS[k]).join(" or ");
        this.diagnostics.error(
          "analysis/misplaced-property",
          `property '${key}' is not valid in ${SCOPE_LABELS[scope]}; it is valid in ${labels}`,
          property.key.span,
        );
      } else {
        const known = SCOPES[scope].properties.map(k => `'${k}'`).join(", ");
        this.diagnostics.error(
          "analysis/unknown-property",
          `unknown property '${key}' in ${SCOPE_LABELS[scope]}; expected ${known}`,
          property.key.span
        );
      }
      return;

    }

    const existing = properties.get(key);
    if (existing) {
      this.diagnostics.error(
        "analysis/duplicate-property",
        `property '${key}' is already set in ${SCOPE_LABELS[scope]}`,
        property.key.span,
        [{ message: "first set here", span: existing.key.span }],
      );
      return;
    }

    properties.set(key, property);
    checkShortValue(property, this.diagnostics);
  }

  private analyzeCommand(decl: CommandDeclaration, parent: CommandSymbol): void {
    checkReservedCommandName(decl, parent.isRoot, this.diagnostics);

    const symbol = new CommandSymbol(decl.name.text, decl, parent);
    if (!isMissing(decl.name)) {
      const existing = parent.commands.get(symbol.name);
      if (existing) {
        this.diagnostics.error(
          "analysis/duplicate-name",
          `command '${symbol.name}' is already declared ${where(parent)}`,
          decl.name.span,
          [{ message: "first declared here", span: existing.nameSpan }],
        );
      } else {
        parent.commands.set(symbol.name, symbol);
      }
    }

    this.analyzeScope("command", decl.body?.members ?? [], symbol.properties, symbol);
  }

  private analyzeTyped(decl: TypedDeclaration, command: CommandSymbol): void {
    checkType(decl, this.diagnostics);
    checkReservedFlag(decl, command.isRoot, this.diagnostics);

    const symbol: TypedSymbol = {
      name: decl.name.text,
      declaration: decl,
      properties: new Map(),
    };

    const registered =
      decl.keyword === "option"
        ? this.declareOption(command, symbol)
        : this.declareArgument(command, symbol);

    this.analyzeScope(decl.keyword, decl.body?.members ?? [], symbol.properties, undefined);

    if (decl.keyword === "option" && registered) this.declareShort(command, symbol);
  }

  private declareOption(command: CommandSymbol, option: TypedSymbol): boolean {
    if (isMissing(option.declaration.name)) return false;
    const existing = command.options.get(option.name);
    if (existing) {
      this.duplicateName("option", option, existing, command);
      return false;
    }

    command.options.set(option.name, option);
    return true;
  }

  private declareArgument(command: CommandSymbol, argument: TypedSymbol): boolean {
    if (isMissing(argument.declaration.name)) return false;
    const existing = command.arguments.find(a => a.name === argument.name);
    if (existing) {
      this.duplicateName("argument", argument, existing, command);
      return false;
    }

    command.arguments.push(argument);
    return true;
  }

  private declareShort(command: CommandSymbol, option: TypedSymbol): void {
    const short = option.properties.get("short");
    if (!short || isMissing(short.value) || !isValidShort(short.value.value)) return;

    const letter = short.value.value;
    const owner = command.shorts.get(letter);
    if (!owner) {
      command.shorts.set(letter, option);
      return;
    }

    const ownerShort = owner.properties.get("short");
    this.diagnostics.error(
      "analysis/duplicate-short",
      `short '${letter}' is already used by option '${owner.name}'`,
      short.value.span,
      ownerShort ? [{ message: "first used here", span: ownerShort.value.span }] : undefined,
    );
  }

  private duplicateName(
    what: "option" | "argument",
    duplicate: TypedSymbol,
    existing: TypedSymbol,
    command: CommandSymbol,
  ): void {
    this.diagnostics.error(
      "analysis/duplicate-name",
      `${what} '${duplicate.name}' is already declared ${where(command)}`,
      duplicate.declaration.name.span,
      [{ message: "first declared here", span: existing.declaration.name.span }],
    );
  }
}
