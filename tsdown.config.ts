import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    compiler: "src/compiler/index.ts",
    schema: "src/schema/index.ts",
    cdlc: "src/cdlc/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  platform: "node",
  shims: true,
});
