import type { ArgumentDef, CommandIndex, OptionDef } from "./schema-index";

type Row = readonly [label: string, description: string];

export function renderHelp(program: string, command: CommandIndex): string {
  const lines: string[] = [];
  if (command.description) lines.push(command.description, "");
  lines.push(`Usage: ${usage(program, command)}`);

  const commands = [...command.commands.values()].map((c): Row => [c.name, c.description ?? ""]);
  const args = command.arguments.map((a): Row => [argumentLabel(a), a.description ?? ""]);
  const options = optionRows([...command.options.values()]);

  section(lines, "Commands", commands);
  section(lines, "Arguments", args);
  section(lines, "Options", options);

  if (commands.length > 0) {
    const name = [program, ...command.path].join(" ");
    lines.push("", `Run '${name} <command> --help' for more information on a command.`);
  }

  return lines.join("\n");
}

function usage(program: string, command: CommandIndex): string {
  const parts = [program, ...command.path];
  if (command.options.size > 0) parts.push("[options]")
  if (command.commands.size > 0) parts.push(command.arguments.length > 0 ? "[command]" : "<command>");
  for (const arg of command.arguments) parts.push(argumentLabel(arg));

  return parts.join(" ");
}

function argumentLabel(arg: ArgumentDef): string {
  const name = arg.name + (arg.list ? "..." : "");
  return arg.required ? `<${name}>` : `[${name}]`;
}

function optionRows(options: readonly OptionDef[]): Row[] {
  const anyShort = options.some(o => o.short !== undefined);
  return options.map(o => {
    const short = o.short !== undefined ? `-${o.short}, ` : anyShort ? "    " : "";
    const value = o.takesValue ? ` <${o.valueType}>` : "";
    const description = [o.description, o.list ? "(repeatable)" : undefined]
      .filter((part): part is string => !!part)
      .join(" ");

    return [`${short}--${o.name}${value}`, description];
  });
}

function section(lines: string[], title: string, rows: readonly Row[]): void {
  if (rows.length === 0) return;
  const width = Math.max(...rows.map(([label]) => label.length));
  lines.push("", `${title}`);
  for (const [label, description] of rows) {
    lines.push(`  ${label.padEnd(width)}  ${description}`.trimEnd());
  }
}
