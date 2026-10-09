export const SCHEMA_VERSION = 1;

export const VALUE_TYPES = ["string", "boolean"] as const;
export type ValueType = typeof VALUE_TYPES[number];

export type ShortCircuit = "help" | "version";

export type Properties = Readonly<Record<string, string>>;

export interface Schema {
  readonly version: typeof SCHEMA_VERSION;
  readonly root: CommandSchema;
}

export interface CommandSchema {
  readonly name: string;
  readonly properties: Properties;
  readonly options: readonly OptionSchema[];
  readonly arguments: readonly ArgumentSchema[];
  readonly commands: readonly CommandSchema[];
}

export interface OptionSchema {
  readonly name: string;
  readonly type: ValueType;
  readonly list: boolean;
  readonly properties: Properties;
  readonly shortCircuit?: ShortCircuit;
}

export interface ArgumentSchema {
  readonly name: string;
  readonly type: ValueType;
  readonly list: boolean;
  readonly required: boolean;
  readonly properties: Properties;
}
