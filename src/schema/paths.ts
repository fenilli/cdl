import type { CommandSchema } from "./schema";

export const PATH_DELIMITER = " ";

export function commandKey(path: readonly string[]): string {
  return path.join(PATH_DELIMITER);
}

export function* walkCommands(
  command: CommandSchema,
  path: readonly string[] = [],
): Generator<{ readonly path: readonly string[]; readonly command: CommandSchema }> {
  yield { path, command };
  for (const child of command.commands) yield* walkCommands(child, [...path, child.name]);
}
