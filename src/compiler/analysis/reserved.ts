export interface ReservedFlag {
  readonly name: string;
  readonly appliesTo: "every-command" | "root";
}

export const RESERVED_FLAGS: readonly ReservedFlag[] = [
  { name: "help", appliesTo: "every-command" },
  { name: "version", appliesTo: "root" },
];

export function isReservedFlag(name: string, isRoot: boolean): boolean {
  return RESERVED_FLAGS.some(
    f => f.name === name && (f.appliesTo === "every-command" || isRoot)
  );
}
