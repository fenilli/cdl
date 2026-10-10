import { commandKey, type CommandSchema } from "@schema/index";
import type { UsageError } from "./errors";
import { ChainHooks, OverrideHooks } from "./hooks";
import { flatten, loadSchema, type CommandIndex, type RuntimeSchema } from "./schema-index";
import { renderHelp } from "./help";
import { ArgvParser, type ParseResult } from "./parse";

export interface SchemaTypes {
  readonly commands: {
    readonly [path: string]: {
      readonly args: object;
      readonly options: object;
      readonly properties: object;
    }
  }
}

export type CommandPath<S extends SchemaTypes> = Extract<keyof S["commands"], string>;

export interface Payload<S extends SchemaTypes, K extends CommandPath<S>, C> extends Output {
  readonly key: K;
  readonly path: readonly string[];
  readonly args: S["commands"][K]["args"];
  readonly options: S["commands"][K]["options"];
  readonly properties: S["commands"][K]["properties"];
  readonly context: C;
}

export type PayloadOf<S extends SchemaTypes, K extends CommandPath<S>, C> = {
  [P in K]: Payload<S, P, C>;
}[K];

export type Scope<S extends SchemaTypes, K extends CommandPath<S>> = K extends ""
  ? CommandPath<S>
  : Extract<CommandPath<S>, K | `${K} ${string}`>;

export type Handler<S extends SchemaTypes, K extends CommandPath<S>, C> = (
  payload: Payload<S, K, C>,
) => void | Promise<void>;

export type Hook<S extends SchemaTypes, K extends CommandPath<S>, C> = (
  payload: PayloadOf<S, K, C>,
) => void | Promise<void>;

export interface Output {
  print(text: string): void;
  printError(text: string): void;
}

export interface HelpPayload<S extends SchemaTypes, C> extends Output {
  readonly key: CommandPath<S>;
  readonly path: readonly string[];
  readonly program: string;
  readonly command: CommandSchema;
  readonly text: string;
  readonly context: C;
}

export interface VersionPayload<C> extends Output {
  readonly program: string;
  readonly version: string | undefined;
  readonly text: string;
  readonly context: C;
}

export interface ErrorPayload<S extends SchemaTypes, C> extends Output {
  readonly key: CommandPath<S>;
  readonly path: readonly string[];
  readonly error: unknown;
  readonly context: C;
}

export interface IO {
  out(text: string): void;
  err(text: string): void;
}

export interface CLIOptions<C> {
  readonly context?: C;
  readonly io?: IO;
}

const processIO: IO = {
  out: (text) => void process.stdout.write(text),
  err: (text) => void process.stderr.write(text),
};

type Loose = (payload: any) => unknown;

export class CLI<S extends SchemaTypes, C = undefined> {
  private readonly schema: RuntimeSchema;
  private readonly commands = new Map<string, CommandIndex>();
  private readonly context: C;
  private readonly io: IO;

  private readonly handlers = new OverrideHooks<Loose>();
  private readonly befores = new ChainHooks<Loose>();
  private readonly afters = new ChainHooks<Loose>();
  private readonly helpHooks = new OverrideHooks<Loose>();
  private readonly errorHooks = new OverrideHooks<Loose>();
  private versionHook: Loose | undefined;

  constructor(schema: unknown, options: CLIOptions<C>) {
    this.schema = loadSchema(schema);
    this.context = options.context as C;
    this.io = options.io ?? processIO;
    for (const command of flatten(this.schema.root)) {
      this.commands.set(commandKey(command.path), command);
    }
  }

  on<K extends CommandPath<S>>(key: K, handler: Handler<S, K, C>): this {
    this.handlers.set(this.known(key), handler);
    return this;
  }

  before(handler: Hook<S, CommandPath<S>, C>): this;
  before<K extends CommandPath<S>>(key: K, handler: Hook<S, Scope<S, K>, C>): this;
  before(a: string | Loose, b?: Loose): this {
    const [key, handler] = this.split(a, b);
    this.befores.add(key, handler);
    return this;
  }

  after(handler: Hook<S, CommandPath<S>, C>): this;
  after<K extends CommandPath<S>>(key: K, handler: Hook<S, Scope<S, K>, C>): this;
  after(a: string | Loose, b?: Loose): this {
    const [key, handler] = this.split(a, b);
    this.afters.add(key, handler);
    return this;
  }

  onHelp(handler: (payload: HelpPayload<S, C>) => void | Promise<void>): this;
  onHelp<K extends CommandPath<S>>(
    key: K,
    handler: (payload: HelpPayload<S, C>) => void | Promise<void>,
  ): this;
  onHelp(a: string | Loose, b?: Loose): this {
    const [key, handler] = this.split(a, b);
    this.helpHooks.set(key, handler);
    return this;
  }

  onVersion(handler: (payload: VersionPayload<C>) => void | Promise<void>): this {
    this.versionHook = handler;
    return this;
  }

  onError(handler: (payload: ErrorPayload<S, C>) => void | number | Promise<void | number>): this;
  onError<K extends CommandPath<S>>(
    key: K,
    handler: (payload: ErrorPayload<S, C>) => void | number | Promise<void | number>,
  ): this;
  onError(a: string | Loose, b?: Loose): this {
    const [key, handler] = this.split(a, b);
    this.errorHooks.set(key, handler);
    return this;
  }

  async run(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
    const parser = new ArgvParser(this.schema, argv);
    const result = parser.parse();
    switch (result.kind) {
      case "error":
        return this.usageError(result.path, result.errors);
      case "short-circuit":
        return result.flag === "help" ? this.showHelp(result.path) : this.showVersion();
      case "run":
        return this.execute(result);
    }
  }

  private async execute(result: Extract<ParseResult, { kind: "run" }>): Promise<number> {
    const { path } = result;
    const command = this.commandAt(path);
    const handler = this.handlers.exact(path);

    if (!handler) {
      if (command.commands.size > 0) return this.showHelp(path);
      this.io.err(`error: no handler registered for '${this.label(path)}'\n`);
      return 1;
    }

    const payload = {
      key: commandKey(path),
      path,
      args: result.args,
      options: result.options,
      properties: command.properties,
      context: this.context,
      ...this.output(),
    };

    return this.guarded(path, async () => {
      for (const before of this.befores.chain(path)) await before(payload);
      const code = await handler(payload);
      for (const after of this.afters.chain(path).reverse()) await after(payload);
      return typeof code === "number" ? code : 0;
    });
  }

  private showHelp(path: readonly string[]): Promise<number> {
    return this.guarded(path, async () => {
      const command = this.commandAt(path);
      const text = renderHelp(this.schema.program, command);
      const hook = this.helpHooks.nearest(path);
      if (hook) {
        await hook({
          key: commandKey(path),
          path,
          program: this.schema.program,
          command: command.source,
          text,
          context: this.context,
          ...this.output(),
        });
      } else {
        this.io.out(text + "\n");
      }
      return 0;
    });
  }

  private showVersion(): Promise<number> {
    return this.guarded([], async () => {
      const { program, root } = this.schema;
      const version = root.properties.version;
      const text = version === undefined ? program : `${program} ${version}`;
      if (this.versionHook) {
        await this.versionHook({ program, version, text, context: this.context, ...this.output() });
      } else {
        this.io.out(text + "\n");
      }
      return 0;
    });
  }

  private usageError(path: readonly string[], errors: readonly UsageError[]): number {
    for (const error of errors) this.io.err(`error: ${error.message}\n`);
    this.io.err(`\nTry '${this.label(path)} --help' for more information.\n`);
    return 2;
  }

  private async guarded(path: readonly string[], fn: () => Promise<number>): Promise<number> {
    try {
      return await fn();
    } catch (error) {
      return this.handleError(error, path);
    }
  }

  private async handleError(error: unknown, path: readonly string[]): Promise<number> {
    const hook = this.errorHooks.nearest(path);
    if (hook) {
      try {
        const code = await hook({
          key: commandKey(path),
          path,
          error,
          context: this.context,
          ...this.output(),
        });
        return typeof code === "number" ? code : 1;
      } catch (hookError) {
        error = hookError; // a failing error hook falls back to the default report
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    this.io.err(`error: ${message}\n`);
    return 1;
  }

  private output(): Output {
    return {
      print: (text) => this.io.out(text + "\n"),
      printError: (text) => this.io.err(text + "\n"),
    };
  }

  private commandAt(path: readonly string[]): CommandIndex {
    return this.commands.get(commandKey(path))!;
  }

  private label(path: readonly string[]): string {
    return [this.schema.program, ...path].join(" ");
  }

  /** Fails at registration, not at run time, when a key names no command. */
  private known(key: string): string {
    if (!this.commands.has(key)) throw new Error(`unknown command '${key}'`);
    return key;
  }

  /** Overload plumbing: (handler) means the root, (key, handler) a specific command. */
  private split(a: string | Loose, b: Loose | undefined): [string, Loose] {
    if (typeof a === "string") {
      if (!b) throw new TypeError("a handler function is required");
      return [this.known(a), b];
    }
    return ["", a];
  }
}
