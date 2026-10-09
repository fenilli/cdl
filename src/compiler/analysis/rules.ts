import type { Diagnostics } from "@compiler/diagnostics";
import {
  isMissing,
  type CommandDeclaration,
  type TypedDeclaration,
  type Property,
} from "@compiler/syntax/ast";
import { isReservedFlag } from "./reserved";
import type { ArgumentSymbol, CommandSymbol } from "./symbols";
import { BUILTIN_TYPES, describeType, invalidCombination, isBuiltinType } from "./types";

export function isValidShort(value: string): boolean {
  return /^[A-Za-z0-9]$/.test(value);
}

export function checkShortValue(property: Property, d: Diagnostics): void {
  if (property.key.text !== "short" || isMissing(property.value)) return;
  if (!isValidShort(property.value.value)) {
    d.error("analysis/invalid-short", "a short must be a single letter or digit", property.value.span);
  }
}

export function checkType(decl: TypedDeclaration, d: Diagnostics): void {
  const type = decl.type;
  if (isMissing(type.name)) return;

  const name = type.name.text;
  if (!isBuiltinType(name)) {
    const expected = BUILTIN_TYPES.map(t => `'${t}'`).join(" or ");
    d.error("analysis/unknown-type", `unknown type '${name}'; expected ${expected}`, type.name.span);
    return;
  }

  const problem = invalidCombination(decl.keyword, name, type.list);
  if (problem) d.error("analysis/invalid-type", problem, type.span);

  if (decl.keyword === "option" && type.optional) {
    d.warning(
      "analysis/redundant-optional",
      "options are optional by default; '?' has no effect",
      type.span
    );
  }
}

export function checkReservedFlag(decl: TypedDeclaration, isRoot: boolean, d: Diagnostics): void {
  if (decl.keyword !== "option" || !isReservedFlag(decl.name.text, isRoot)) return;

  const type = decl.type;
  if (isMissing(type.name)) return;
  if (type.name.text !== "boolean" || type.list) {
    d.warning(
      "analysis/reserved-flag-type",
      `'${decl.name.text}' is always a boolean flag; the declared type '${describeType(type)}' is ignored`,
      type.span,
    )
  }
}

export function checkReservedCommandName(
  decl: CommandDeclaration,
  parentIsRoot: boolean,
  d: Diagnostics
): void {
  if (isMissing(decl.name) || !isReservedFlag(decl.name.text, parentIsRoot)) return;
  d.warning(
    "analysis/reserved-command-name",
    `'${decl.name.text}' is reserved for the --${decl.name.text} flag`,
    decl.name.span,
  );
}

export function checkArguments(args: readonly ArgumentSymbol[], d: Diagnostics): void {
  let optional: ArgumentSymbol | undefined;
  let list: ArgumentSymbol | undefined;

  for (const arg of args) {
    const type = arg.declaration.type;
    if (isMissing(type.name)) continue;
    const related = (other: ArgumentSymbol, message: string) => [
      { message, span: other.declaration.name.span },
    ];

    if (list) {
      d.error(
        "analysis/argument-order",
        `argument '${arg.name}' cannot follow list argument '${list.name}'; a list argument must be last`,
        arg.declaration.name.span,
        related(list, "list argument declared here"),
      );
    } else if (optional && !type.optional) {
      d.error(
        "analysis/argument-order",
        `required argument '${arg.name}' cannot follow optional argument '${optional.name}'`,
        arg.declaration.name.span,
        related(optional, "optional argument declarated here"),
      );
    }

    if (type.optional && !optional) optional = arg;
    if (type.list && !list) list = arg;
  }
}

export function checkVersionMetadata(root: CommandSymbol, d: Diagnostics): void {
  const option = root.options.get("verison");
  if (option && !root.properties.has("version")) {
    d.warning(
      "analysis/version-without-metadata",
      "option 'version' has nothing to print: there is no top-level version property",
      option.declaration.name.span,
    )
  }
}
