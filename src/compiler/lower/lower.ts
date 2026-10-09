import {
  SCHEMA_VERSION,
  type ArgumentSchema,
  type CommandSchema,
  type OptionSchema,
  type Schema,
  type ValueType,
} from "@schema";
import type { Property, TypeRef } from "@compiler/syntax/ast";
import { RESERVED_FLAGS, type ReservedFlag, type CommandSymbol, type TypedSymbol, isBuiltinType } from "@compiler/analysis";

export function lower(root: CommandSymbol): Schema {
  return { version: SCHEMA_VERSION, root: lowerCommand(root) };
}

function lowerCommand(command: CommandSymbol): CommandSchema {
  return {
    name: command.name,
    properties: lowerProperties(command.properties),
    options: lowerOptions(command),
    arguments: command.arguments.map(lowerArgument),
    commands: [...command.commands.values()].map(lowerCommand),
  };
}

function lowerOptions(command: CommandSymbol): OptionSchema[] {
  const reserved = RESERVED_FLAGS.filter(
    f => f.appliesTo === "every-command" || command.isRoot,
  );

  const options: OptionSchema[] = [];
  for (const option of command.options.values()) {
    const flag = reserved.find(f => f.name === option.name);
    options.push(flag ? coerceReserved(option, flag) : lowerOption(option));
  }

  for (const flag of reserved) {
    if (command.options.has(flag.name)) continue;
    if (flag.injectRequires && !command.properties.has(flag.injectRequires)) continue;
    options.push(injectReserved(command, flag));
  }

  return options;
}

function lowerOption(option: TypedSymbol): OptionSchema {
  const type = option.declaration.type;
  return {
    name: option.name,
    type: valueType(type),
    list: type.list,
    properties: lowerProperties(option.properties),
  };
}

function coerceReserved(option: TypedSymbol, flag: ReservedFlag): OptionSchema {
  return {
    name: option.name,
    type: "boolean",
    list: false,
    properties: lowerProperties(option.properties),
    shortCircuit: flag.name,
  };
}

function injectReserved(command: CommandSymbol, flag: ReservedFlag): OptionSchema {
  const { description, short } = flag.defaults;
  const properties: Record<string, string> = { description };
  if (short !== undefined && !command.shorts.has(short)) properties.short = short;
  return { name: flag.name, type: "boolean", list: false, properties, shortCircuit: flag.name };
}

function lowerArgument(argument: TypedSymbol): ArgumentSchema {
  const type = argument.declaration.type;
  return {
    name: argument.name,
    type: valueType(type),
    list: type.list,
    required: !type.optional,
    properties: lowerProperties(argument.properties),
  };
}

function lowerProperties(properties: ReadonlyMap<string, Property>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, property] of properties) out[key] = property.value.value;
  return out;
}

function valueType(type: TypeRef): ValueType {
  const name = type.name.text;
  if (!isBuiltinType(name)) {
    throw new Error(`lower() needs an error-free analysis, but found unknown type '${name}'`);
  }

  return name;
}
