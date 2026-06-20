import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const distDir = path.join(root, "dist");

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

await Promise.all([
  cp(path.join(root, "index.html"), path.join(distDir, "index.html")),
  cp(path.join(root, "src"), path.join(distDir, "src"), { recursive: true }),
  cp(path.join(root, "public", "schedule.json"), path.join(distDir, "schedule.json")),
  cp(path.join(root, "public", "world-cup-2026.ics"), path.join(distDir, "world-cup-2026.ics")),
  cp(path.join(root, "public", "calendars"), path.join(distDir, "calendars"), { recursive: true })
]);

console.log(`Built static site in ${path.relative(root, distDir)}/`);
