import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";

const ROOT = process.cwd();
const manifestPath = join(ROOT, "data-boundaries.manifest.json");
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py"];
const SKIP_DIRS = new Set([".git", ".next", ".turbo", ".pytest_cache", "coverage", "dist", "node_modules", "out", "__pycache__"]);

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const failures = [];
const boundaryById = new Map(manifest.boundaries.map((boundary) => [boundary.id, boundary]));

for (const boundary of manifest.boundaries) {
  for (const root of boundary.roots ?? []) {
    if (!boundary.optional && !existsSync(join(ROOT, root))) {
      failures.push(`${boundary.id}: missing required root ${root}`);
    }
  }
}

checkWebSeedContentImports();
checkSourceIndexIsolation();
checkRuntimeOnlyRoots();

if (failures.length > 0) {
  console.error("Data boundary guard failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Data boundary guard passed: ${manifest.boundaries.length} boundaries checked.`);

function checkWebSeedContentImports() {
  const appBoundary = boundaryById.get("web-app-code");
  const seedBoundary = boundaryById.get("local-seed-content");
  if (!appBoundary || !seedBoundary) return;

  const appFiles = appBoundary.roots.flatMap((root) => walk(join(ROOT, root))).filter(isSourceFile);
  const allowed = new Set(appBoundary.mayImportSeedContentFrom ?? []);
  const seedRoots = seedBoundary.roots.map((root) => normalizeRepoPath(root));

  for (const file of appFiles) {
    const repoPath = repoRelative(file);
    if (allowed.has(repoPath)) continue;

    for (const specifier of importsFrom(readFileSync(file, "utf8"))) {
      const target = specifier.startsWith(".") ? resolveRelativeImport(file, specifier) : specifier;
      if (seedRoots.some((root) => target === root || target.startsWith(`${root}/`)) || specifier.includes("courseData")) {
        failures.push(`${repoPath} imports seed content via ${specifier}; route through an approved data adapter/root.`);
      }
    }
  }
}

function checkSourceIndexIsolation() {
  const boundary = boundaryById.get("source-index-service");
  if (!boundary) return;

  for (const file of boundary.roots.flatMap((root) => walk(join(ROOT, root))).filter(isSourceFile)) {
    const repoPath = repoRelative(file);
    const source = readFileSync(file, "utf8");
    for (const specifier of importsFrom(source)) {
      const normalized = specifier.toLowerCase();
      if (normalized.includes("lycium") || normalized.startsWith("@lycium/")) {
        failures.push(`${repoPath} imports ${specifier}; source-index must remain detachable from Lycium app packages.`);
      }
    }
  }
}

function checkRuntimeOnlyRoots() {
  for (const boundary of manifest.boundaries.filter((item) => item.runtimeOnly)) {
    for (const root of boundary.roots ?? []) {
      const absoluteRoot = join(ROOT, root);
      if (!existsSync(absoluteRoot)) continue;
      const files = walk(absoluteRoot).filter((file) => !repoRelative(file).endsWith(".gitkeep"));
      if (files.length > 0) {
        failures.push(`${boundary.id}: runtime-only root ${root} contains files inside the repo workspace.`);
      }
    }
  }
}

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const absolutePath = join(dir, entry);
    const repoPath = repoRelative(absolutePath);
    if (repoPath.split("/").some((part) => SKIP_DIRS.has(part))) continue;
    const stat = statSync(absolutePath);
    if (stat.isDirectory()) walk(absolutePath, files);
    else files.push(absolutePath);
  }
  return files;
}

function importsFrom(source) {
  const importMatches = source.matchAll(/\bimport(?:\s+type)?[\s\S]*?\sfrom\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|\bexport(?:\s+type)?[\s\S]*?\sfrom\s+["']([^"']+)["']|^\s*from\s+([\w.]+)\s+import\s+/gm);
  return [...importMatches].map((match) => match[1] || match[2] || match[3] || match[4]).filter(Boolean);
}

function resolveRelativeImport(fromFile, specifier) {
  const candidateBase = normalize(resolve(dirname(fromFile), specifier));
  const candidates = [
    candidateBase,
    ...SOURCE_EXTENSIONS.map((extension) => `${candidateBase}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => join(candidateBase, `index${extension}`)),
  ];
  return normalizeRepoPath(relative(ROOT, candidates.find((candidate) => existsSync(candidate)) ?? candidateBase));
}

function isSourceFile(file) {
  return SOURCE_EXTENSIONS.some((extension) => file.endsWith(extension));
}

function repoRelative(file) {
  return normalizeRepoPath(relative(ROOT, file));
}

function normalizeRepoPath(value) {
  return value.replaceAll("\\\\", "/");
}
