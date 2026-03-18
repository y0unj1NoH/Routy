import { rmSync } from "node:fs";

// Preserve active dev artifacts so `typecheck:stable` does not break a running `next dev`.
for (const directory of [".next", ".next-verify"]) {
  rmSync(directory, { recursive: true, force: true });
}
