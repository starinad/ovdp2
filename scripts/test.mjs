import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const output = await mkdtemp(join(tmpdir(), "oblig-tests-"));
try {
  for (const args of [
    [
      "node_modules/typescript/bin/tsc",
      "tests/domain.test.ts",
      "--outDir",
      output,
      "--module",
      "commonjs",
      "--target",
      "ES2022",
      "--esModuleInterop",
      "--strict",
      "--skipLibCheck",
    ],
    ["--test", join(output, "tests/domain.test.js")],
  ]) {
    const result = spawnSync(process.execPath, args, { stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      break;
    }
  }
} finally {
  await rm(output, { recursive: true, force: true });
}
