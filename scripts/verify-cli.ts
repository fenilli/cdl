import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "cdlc-verify-"));
try {
  execFileSync("node", ["dist/cdlc.mjs", "build", "src/cdlc/cdlc.cdl", "-o", tmp], { stdio: "pipe" });

  let ok = true;
  for (const file of ["schema.json", "schema.d.ts"]) {
    const same = readFileSync(join(tmp, file), "utf-8") === readFileSync(join("src/cdlc/generated", file), "utf-8");
    console.log(`${same ? "same   " : "DIFFERS"} ${file}`);
    ok &&= same;
  }
  if (!ok) {
    console.error("generated files are stale: run `npm run gen:cli`, rebuild, and commit");
    process.exitCode = 1;
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
