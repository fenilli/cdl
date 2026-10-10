export type ArgvToken =
  | { readonly kind: "positional"; readonly value: string; readonly literal: boolean }
  | { readonly kind: "long"; readonly name: string; readonly value: string | undefined }
  | { readonly kind: "short"; readonly chars: string }
  | { readonly kind: "terminator"; };

export function tokenize(argv: readonly string[]): ArgvToken[] {
  const tokens: ArgvToken[] = [];
  let literal = false;

  for (const raw of argv) {
    if (literal) {
      tokens.push({ kind: "positional", value: raw, literal: true });
    } else if (raw === "--") {
      tokens.push({ kind: "terminator" });
      literal = true;
    } else if (raw.startsWith("--")) {
      const eq = raw.indexOf("=");
      tokens.push(
        eq === -1
          ? { kind: "long", name: raw.slice(2), value: undefined }
          : { kind: "long", name: raw.slice(2, eq), value: raw.slice(eq + 1) }
      );
    } else if (raw.startsWith("-") && raw.length > 1) {
      tokens.push({ kind: "short", chars: raw.slice(1) });
    } else {
      tokens.push({ kind: "positional", value: raw, literal: false });
    }
  }

  return tokens;
}
