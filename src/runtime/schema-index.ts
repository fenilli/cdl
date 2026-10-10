import {
  SCHEMA_VERSION,
  type CommandSchema,
  type Schema,
  type ShortCircuit
} from "@schema/index";

export interface OptionDef {
  readonly name: string;
  readonly short: string | undefined;
  readonly description: string | undefined;
  readonly valueType: string;
  readonly takesValue: boolean;
  readonly list: boolean;
  readonly shortCircuit?: ShortCircuit
}

export interface ArgumentDef {
  readonly name: string;
  readonly description: string | undefined;
  readonly list: boolean;
  readonly required: boolean;
}

export interface CommandIndex {
  readonly name: string;
  readonly path: readonly string[];
  readonly description: string | undefined;
  readonly properties: Readonly<Record<string, string>>;
  readonly options: ReadonlyMap<string, OptionDef>;
  readonly shorts: ReadonlyMap<string, OptionDef>;
  readonly arguments: readonly ArgumentDef[];
  readonly commands: ReadonlyMap<string, CommandIndex>;
  readonly source: CommandSchema;
}

export interface RuntimeSchema {
  readonly program: string;
  readonly root: CommandIndex;
}

export function loadSchema(input: unknown): RuntimeSchema {
  if (typeof input !== "object" || input === null || !("version" in input) || !("root" in input)) {
    throw new Error("not a cdl schema: expected an object with 'version' and 'root'");
  }

  const schema = input as Schema;
  if ((schema.version as number) !== SCHEMA_VERSION) {
    throw new Error(
      `unsupported schema version ${String(schema.version)}; this runtime reads version ${SCHEMA_VERSION}`
    );
  }

  return { program: schema.root.properties.name ?? "cli", root: indexCommand(schema.root, []) };
}

export function flatten(root: CommandIndex): CommandIndex[] {
  return [root, ...[...root.commands.values()].flatMap(flatten)];
}

function indexCommand(command: CommandSchema, path: readonly string[]): CommandIndex {
  const options = new Map<string, OptionDef>();
  const shorts = new Map<string, OptionDef>();

  for (const option of command.options) {
    const def: OptionDef = {
      name: option.name,
      short: option.properties.short,
      description: option.properties.description,
      valueType: option.type,
      takesValue: option.type !== "boolean",
      list: option.list,
      shortCircuit: option.shortCircuit,
    };

    options.set(option.name, def);
    if (def.short !== undefined) shorts.set(def.short, def);
  }

  const commands = new Map<string, CommandIndex>();
  for (const child of command.commands) {
    commands.set(child.name, indexCommand(child, [...path, child.name]));
  }

  return {
    name: command.name,
    path,
    description: command.properties.description,
    properties: command.properties,
    options,
    shorts,
    arguments: command.arguments.map(a => ({
      name: a.name,
      description: a.properties.description,
      list: a.list,
      required: a.required,
    })),
    commands,
    source: command,
  };
}
