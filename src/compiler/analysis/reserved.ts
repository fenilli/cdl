import type { ShortCircuit } from "@schema/index";

export interface ReservedFlag {
  readonly name: ShortCircuit;
  readonly appliesTo: "every-command" | "root";
  readonly injectRequires?: string;
  readonly defaults: { readonly description: string; readonly short?: string };
}

export const RESERVED_FLAGS: readonly ReservedFlag[] = [
  {
    name: "help",
    appliesTo: "every-command",
    defaults: { description: "show help", short: "h" }
  },
  {
    name: "version",
    appliesTo: "root",
    injectRequires: "version",
    defaults: { description: "show the version" }
  },
];

export function isReservedFlag(name: string, isRoot: boolean): boolean {
  return RESERVED_FLAGS.some(
    f => f.name === name && (f.appliesTo === "every-command" || isRoot)
  );
}
