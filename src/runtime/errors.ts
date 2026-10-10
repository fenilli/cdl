export type UsageErrorCode =
  | "unknown-option"
  | "missing-option-value"
  | "unexpected-option-value"
  | "option-before-command"
  | "missing-argument"
  | "unexpected-argument"
  | "unknown-command";

export interface UsageError {
  readonly code: UsageErrorCode;
  readonly message: string;
}
