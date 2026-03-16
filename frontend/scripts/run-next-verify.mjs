import { rmSync } from "node:fs";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);

rmSync(".next-verify", { recursive: true, force: true });

const escapedArgs = args.map((arg) => (/\s/.test(arg) ? `"${arg.replaceAll('"', '\\"')}"` : arg)).join(" ");

try {
  execSync(`pnpm exec next ${escapedArgs}`, {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      NEXT_DIST_DIR: ".next-verify"
    }
  });
} catch (error) {
  process.exit(typeof error?.status === "number" ? error.status : 1);
}
