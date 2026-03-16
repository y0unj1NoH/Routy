import { rmSync } from "node:fs";

for (const directory of [".next", ".next-verify"]) {
  rmSync(directory, { recursive: true, force: true });
}
