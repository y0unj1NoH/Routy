import { rmSync } from "node:fs";

// Preserve the active dev build, but drop stale generated route types that can outlive deleted pages.
for (const directory of [".next", ".next-verify", ".next-dev/types"]) {
  rmSync(directory, { recursive: true, force: true });
}
