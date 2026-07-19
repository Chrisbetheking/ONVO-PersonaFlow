import { spawnSync } from "node:child_process";

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(npx, ["playwright", "test", "--workers=1"], {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
