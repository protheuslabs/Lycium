import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const MAX_LOC = 500;
const CODE_EXTENSIONS = new Set([".cjs", ".css", ".js", ".jsx", ".mjs", ".py", ".scss", ".ts", ".tsx"]);
const SKIP_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  ".venv",
  "__pycache__",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
]);

function extensionOf(path) {
  const match = path.match(/\.[^.]+$/);
  return match ? match[0] : "";
}

function shouldSkip(path) {
  return path.split("/").some((part) => SKIP_DIRS.has(part));
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const absolutePath = join(dir, entry);
    const repoPath = relative(ROOT, absolutePath).replaceAll("\\", "/");
    if (shouldSkip(repoPath)) continue;

    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      walk(absolutePath, files);
      continue;
    }

    if (CODE_EXTENSIONS.has(extensionOf(entry))) {
      files.push({ absolutePath, repoPath });
    }
  }
  return files;
}

const oversized = walk(ROOT)
  .map((file) => ({
    ...file,
    lines: readFileSync(file.absolutePath, "utf8").split(/\r\n|\r|\n/).length,
  }))
  .filter((file) => file.lines > MAX_LOC)
  .sort((a, b) => b.lines - a.lines);

if (oversized.length > 0) {
  console.error(`Code files must stay at or below ${MAX_LOC} lines.`);
  for (const file of oversized) {
    console.error(`${file.lines.toString().padStart(4, " ")} ${file.repoPath}`);
  }
  process.exit(1);
}

console.log(`LoC guard passed: all code files are at or below ${MAX_LOC} lines.`);
