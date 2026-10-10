import type { ShortCircuit } from "@schema";
import type { UsageError } from "./errors";
import { tokenize, type ArgvToken } from "./argv";
import type { ArgumentDef, CommandIndex, OptionDef, RuntimeSchema } from "./schema-index";

export type Value = string | boolean | readonly string[] | undefined;

export type ParseResult =
  | {
    readonly kind: "run",
    readonly path: readonly string[];
    readonly args: Readonly<Record<string, Value>>;
    readonly options: Readonly<Record<string, Value>>;
  }
  | { readonly kind: "short-circuit", readonly flag: ShortCircuit; readonly path: readonly string[] }
  | { readonly kind: "error", readonly path: readonly string[]; readonly errors: readonly UsageError[] }

export class ArgvParser {
  private readonly program: string;
  private readonly tokens: readonly ArgvToken[];
  private readonly errors: UsageError[] = [];
  private index = 0;

  private command: CommandIndex;
  private readonly path: string[] = [];
  private values = new Map<string, Value>();
  private firstUse = new Map<string, string>();
  private positionals: string[] = [];
  private seenPositional = false;

  constructor(schema: RuntimeSchema, argv: readonly string[]) {
    this.program = schema.program;
    this.command = schema.root;
    this.tokens = tokenize(argv);
  }

  parse(): ParseResult {
    for (; this.index < this.tokens.length; this.index++) {
      const token = this.tokens[this.index];
      let fired: ParseResult | undefined;

      switch (token.kind) {
        case "terminator":
          break;
        case "positional":
          this.onPositional(token);
          break;
        case "long":
          fired = this.onLong(token);
          break;
        case "short":
          fired = this.onShort(token);
          break;
      }
      if (fired) return fired;
    }

    return this.finish();
  }

  private onPositional(token: Extract<ArgvToken, { kind: "positional" }>): void {
    if (!token.literal && !this.seenPositional) {
      const child = this.command.commands.get(token.value);
      if (child) {
        this.descend(child);
        return;
      }
    }

    this.seenPositional = true;
    this.positionals.push(token.value);
  }

  private onLong(token: Extract<ArgvToken, { kind: "long" }>): ParseResult | undefined {
    const flag = `--${token.name}`;
    const option = this.command.options.get(token.name);
    if (!option) {
      this.fail("unknown-option", `unkown option '${flag}'`);
      return undefined;
    }

    return this.apply(option, token.value, flag);
  }

  private onShort(token: Extract<ArgvToken, { kind: "short" }>): ParseResult | undefined {
    const { chars } = token;
    for (let i = 0; i < chars.length; i++) {
      const flag = `-${chars[i]}`;
      const option = this.command.shorts.get(chars[i]);
      if (!option) {
        this.fail("unknown-option", `unkown option '${flag}'`);
        return undefined;
      }

      if (!option.takesValue) {
        const fired = this.apply(option, undefined, flag);
        if (fired) return fired;
        continue;
      }

      let rest = chars.slice(i + 1);
      if (rest.startsWith("=")) rest = rest.slice(1);
      return this.apply(option, rest === "" ? undefined : rest, flag);
    }

    return undefined;
  }

  private apply(option: OptionDef, inline: string | undefined, flag: string): ParseResult | undefined {
    if (option.shortCircuit && inline === undefined) {
      return { kind: "short-circuit", flag: option.shortCircuit, path: [...this.path] };
    }

    if (!option.takesValue) {
      if (inline !== undefined) {
        this.fail("unexpected-option-value", `option '${flag}' does not take a value`);
      } else {
        this.set(option, true, flag);
      }

      return undefined;
    }

    let value = inline;
    if (value === undefined) {
      const next = this.tokens[this.index + 1];
      if (next?.kind === "positional") {
        value = next.value;
        this.index++;
      } else {
        this.fail("missing-option-value", `option '${flag}' needs a value`);
        return undefined;
      }
    }

    this.set(option, value, flag);
    return undefined;
  }

  private set(option: OptionDef, value: string | boolean, flag: string): void {
    if (!this.firstUse.has(option.name)) this.firstUse.set(option.name, flag);
    if (option.list) {
      const existing = this.values.get(option.name);
      this.values.set(option.name, [...(Array.isArray(existing) ? existing : []), String(value)]);
    } else {
      this.values.set(option.name, value);
    }
  }

  private descend(child: CommandIndex): void {
    for (const flag of this.firstUse.values()) {
      this.fail(
        "option-before-command",
        `option '${flag}' belongs to '${this.label()}' and cannot appear before '${child.name}'`
      );
    }

    this.command = child;
    this.path.push(child.name);
    this.values = new Map();
    this.firstUse = new Map();
    this.positionals = [];
    this.seenPositional = false;
  }

  private finish(): ParseResult {
    const args = this.assignArguments();

    const options: Record<string, Value> = {};
    for (const option of this.command.options.values()) {
      if (option.shortCircuit) continue;
      options[option.name] = this.values.has(option.name)
        ? this.values.get(option.name)
        : option.list
          ? []
          : option.takesValue
            ? undefined
            : false;
    }

    if (this.errors.length > 0) {
      return { kind: "error", path: [...this.path], errors: this.errors };
    }

    return { kind: "run", path: [...this.path], args, options };
  }

  private assignArguments(): Record<string, Value> {
    const args: Record<string, Value> = {};
    let next = 0;

    for (const arg of this.command.arguments) {
      if (arg.list) {
        const rest = this.positionals.slice(next);
        next = this.positionals.length;
        if (arg.required && rest.length === 0) this.missing(arg);
        args[arg.name] = rest;
      } else if (next < this.positionals.length) {
        args[arg.name] = this.positionals[next++];
      } else {
        if (arg.required) this.missing(arg);
        args[arg.name] = undefined;
      }
    }

    const extra = this.positionals.slice(next);
    if (extra.length > 0) {
      const first = `'${extra[0]}'`;
      const more = extra.length > 1 ? ` (and ${extra.length + 1} more)` : "";

      if (this.command.commands.size > 0 && this.command.arguments.length === 0) {
        this.fail("unknown-command", `unknown command ${first}${more}`);
      } else {
        this.fail("unexpected-argument", `unexpected argument ${first}${more}`);
      }
    }

    return args;
  }

  private missing(arg: ArgumentDef): void {
    const shown = arg.list ? `<${arg.name}...>` : `<${arg.name}>`;
    this.fail("missing-argument", `missing required argument ${shown}`);
  }

  private label(): string {
    return [this.program, ...this.path].join(" ");
  }

  private fail(code: UsageError["code"], message: string): void {
    this.errors.push({ code, message });
  }
}
