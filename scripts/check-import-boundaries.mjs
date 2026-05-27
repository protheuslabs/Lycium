import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";

const ROOT = process.cwd();
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const SKIP_DIRS = new Set([".git", ".next", ".turbo", "coverage", "dist", "node_modules", "out"]);

const ZONES = [
  {
    root: "packages/contracts/src",
    label: "contracts",
    allowedPackages: new Set([]),
    deniedPathPrefixes: ["apps/", "services/", "packages/data-access/", "packages/ui/"],
  },
  {
    root: "packages/data-access/src",
    label: "data-access",
    allowedPackages: new Set(["@lycium/contracts"]),
    deniedPathPrefixes: ["apps/", "services/"],
  },
  {
    root: "apps/lycium-web/src",
    label: "web",
    allowedPackages: new Set(["@lycium/contracts", "@lycium/data-access", "@lycium/ui"]),
    deniedPathPrefixes: ["services/lycium-api/", "services/lycium-workers/"],
  },
];

function extensionOf(path) {
  return SOURCE_EXTENSIONS.find((extension) => path.endsWith(extension));
}

function shouldSkip(repoPath) {
  return repoPath.split("/").some((part) => SKIP_DIRS.has(part));
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const absolutePath = join(dir, entry);
    const repoPath = relative(ROOT, absolutePath).replaceAll("\\", "/");
    if (shouldSkip(repoPath)) continue;

    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      walk(absolutePath, files);
    } else if (extensionOf(repoPath)) {
      files.push({ absolutePath, repoPath });
    }
  }
  return files;
}

function zoneFor(repoPath) {
  return ZONES.find((zone) => repoPath.startsWith(`${zone.root}/`));
}

function importsFrom(source) {
  const matches = source.matchAll(/\bimport(?:\s+type)?[\s\S]*?\sfrom\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|\bexport(?:\s+type)?[\s\S]*?\sfrom\s+["']([^"']+)["']/g);
  return [...matches].map((match) => match[1] || match[2] || match[3]).filter(Boolean);
}

function packageName(specifier) {
  if (!specifier.startsWith("@")) return specifier.split("/")[0];
  const [scope, name] = specifier.split("/");
  return `${scope}/${name}`;
}

function resolveRelativeImport(fromFile, specifier) {
  const candidateBase = normalize(resolve(dirname(fromFile), specifier));
  const candidates = [
    candidateBase,
    ...SOURCE_EXTENSIONS.map((extension) => `${candidateBase}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => join(candidateBase, `index${extension}`)),
  ];
  const resolvedPath = candidates.find((candidate) => existsSync(candidate));
  return relative(ROOT, resolvedPath ?? candidateBase).replaceAll("\\", "/");
}

const violations = [];

for (const file of walk(ROOT)) {
  const zone = zoneFor(file.repoPath);
  if (!zone) continue;

  const source = readFileSync(file.absolutePath, "utf8");
  for (const specifier of importsFrom(source)) {
    if (specifier.startsWith(".")) {
      const targetPath = resolveRelativeImport(file.absolutePath, specifier);
      if (zone.deniedPathPrefixes.some((prefix) => targetPath.startsWith(prefix))) {
        violations.push(`${file.repoPath} imports forbidden relative target ${specifier} -> ${targetPath}`);
      }
      continue;
    }

    if (specifier.startsWith("@lycium/") && !zone.allowedPackages.has(packageName(specifier))) {
      violations.push(`${file.repoPath} imports ${specifier}, which is outside the ${zone.label} dependency boundary`);
    }
  }
}

if (violations.length > 0) {
  console.error("Import boundary guard failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Import boundary guard passed.");
