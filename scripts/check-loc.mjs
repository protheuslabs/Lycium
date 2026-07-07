import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const MAX_LOC = 500;
const LEGACY_LOC_LIMITS = new Map([
  ["apps/lycium-web/src/components/ContentView/contentView.css", 545],
  ["apps/lycium-web/src/components/CourseCatalog/CourseCatalog.tsx", 510],
  ["packages/contracts/src/courseTypes.ts", 532],
  ["services/lycium-api/app/course_agent_providers.py", 624],
  ["services/lycium-api/app/course_generation_workflow.py", 587],
  ["services/lycium-api/app/course_source_gaps.py", 719],
  ["services/lycium-api/app/program_course_scaffold.py", 526],
  ["services/lycium-api/app/submission_grading.py", 546],
]);
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
  "playwright-report",
  "test-results",
]);

function extensionOf(path) {
  const match = path.match(/\.[^.]+$/);
  return match ? match[0] : "";
}

function shouldSkip(path) {
  return path.split("/").some((part) => SKIP_DIRS.has(part));
}

function countLines(source) {
  if (!source) return 0;
  const normalized = source.replace(/\r\n?/g, "\n");
  const content = normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;
  return content.split("\n").length;
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

const measuredFiles = walk(ROOT).map((file) => ({
  ...file,
  limit: LEGACY_LOC_LIMITS.get(file.repoPath) ?? MAX_LOC,
  lines: countLines(readFileSync(file.absolutePath, "utf8")),
}));

const oversized = measuredFiles
  .filter((file) => file.lines > file.limit)
  .sort((a, b) => b.lines - a.lines);

if (oversized.length > 0) {
  console.error(`Code files exceeded their line budgets (default: ${MAX_LOC}).`);
  for (const file of oversized) {
    console.error(`${file.lines.toString().padStart(4, " ")} / ${file.limit.toString().padEnd(4, " ")} ${file.repoPath}`);
  }
  process.exit(1);
}

const legacyFiles = measuredFiles.filter((file) => file.lines > MAX_LOC && LEGACY_LOC_LIMITS.has(file.repoPath));

console.log(
  `LoC guard passed: new files are capped at ${MAX_LOC} lines; ${legacyFiles.length} legacy files remain within frozen budgets.`,
);
