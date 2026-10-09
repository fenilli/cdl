export type MemberKeyword = "command" | "option" | "argument";
export type ScopeKind = "root" | "command" | "option" | "argument";

export interface ScopeRules {
  readonly properties: readonly string[];
  readonly members: readonly MemberKeyword[];
}

export const SCOPES: Readonly<Record<ScopeKind, ScopeRules>> = {
  root: {
    properties: ["name", "description", "version"],
    members: ["option", "argument", "command"]
  },
  command: {
    properties: ["description"],
    members: ["option", "argument", "command"]
  },
  option: { properties: ["description", "short"], members: [] },
  argument: { properties: ["description"], members: [] },
};

export const SCOPE_LABELS: Readonly<Record<ScopeKind, string>> = {
  root: "the top level",
  command: "a command",
  option: "an option",
  argument: "an argument"
};

export const KEYWORD_LABELS: Readonly<Record<MemberKeyword, string>> = {
  command: "a command",
  option: "an option",
  argument: "an argument"
};

export function scopesAllowingProperty(key: string): ScopeKind[] {
  return (Object.keys(SCOPES) as ScopeKind[]).filter(kind =>
    SCOPES[kind].properties.includes(key)
  );
}
