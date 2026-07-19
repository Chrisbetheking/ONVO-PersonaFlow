import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "src");
const extensions = new Set([".ts", ".tsx"]);
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (extensions.has(path.extname(entry.name))) files.push(full);
  }
}
walk(root);

const joined = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
const requiredMappings = [
  "open",
  "pending_review",
  "high",
  "current",
  "superseded",
  "manager_assigned",
  "published",
];
const displaySource = fs.readFileSync(
  path.join(root, "shared", "display.ts"),
  "utf8",
);
const failures = [];
for (const value of requiredMappings) {
  if (!displaySource.includes(`${value}:`))
    failures.push(`statusLabel 缺少 ${value}`);
}
if (
  joined.includes("dataMode === 'fallback'") ||
  joined.includes("dataMode==='fallback'")
) {
  failures.push("仍存在旧 fallback 数据状态");
}
const shellSource = fs.readFileSync(
  path.join(root, "app", "AppShell.tsx"),
  "utf8",
);
if ((shellSource.match(/switch-role-/g) || []).length !== 1) {
  failures.push("角色切换 data-testid 只能在单一空间切换入口中定义一次");
}
if (!shellSource.includes("stale-online-banner"))
  failures.push("缺少 stale_online 可见状态");
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`UI contract check passed (${files.length} source files).`);
