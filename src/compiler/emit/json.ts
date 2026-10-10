import type { Schema } from "@schema/index";

export function emitJson(schema: Schema): string {
  return JSON.stringify(schema, null, 2) + "\n";
}
