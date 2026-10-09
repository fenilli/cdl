import { VALUE_TYPES, type ValueType } from "@schema";
import type { TypeRef } from "@compiler/syntax/ast";

export const BUILTIN_TYPES = VALUE_TYPES;
export type BuiltinType = ValueType;

export function isBuiltinType(name: string): name is BuiltinType {
  return (BUILTIN_TYPES as readonly string[]).includes(name);
}

export function describeType(type: TypeRef): string {
  return type.name.text + (type.list ? "[]" : "") + (type.optional ? "?" : "");
}

export function invalidCombination(
  keyword: "option" | "argument",
  type: BuiltinType,
  list: boolean,
): string | undefined {
  if (type === "boolean" && keyword === "argument") return "an argument cannot be boolean";
  if (type === "boolean" && list) return "a boolean cannot be a list";

  return undefined;
}
