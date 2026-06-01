import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const outDir = path.resolve(repoRoot, process.argv[2] ?? "apps/lycium-web/out");
const nextDir = path.resolve(repoRoot, "apps/lycium-web/.next");
const courseDataDir = path.resolve(repoRoot, "apps/lycium-web/src/courseData");
const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_LYCIUM_BASE_PATH ?? "/Lycium");
const siteRoot = [basePath ? path.join(outDir, basePath.slice(1)) : outDir, outDir].find((candidate) => existsSync(candidate)) ?? outDir;

const routeFiles = existsSync(siteRoot) ? collectFiles(siteRoot).filter((file) => path.basename(file) === "index.html") : [];
const chunksDir = path.join(nextDir, "static", "chunks");
const chunkFiles = existsSync(chunksDir) ? collectFiles(chunksDir).filter((file) => /\.(js|css)$/.test(file)) : [];
const courseDataFiles = existsSync(courseDataDir) ? collectFiles(courseDataDir).filter((file) => /\.(json|ts)$/.test(file)) : [];

const largestChunks = chunkFiles
  .map((file) => ({ file: relative(file), size: statSync(file).size }))
  .sort((a, b) => b.size - a.size)
  .slice(0, 8);

const report = {
  basePath: basePath || "/",
  routeCount: routeFiles.length,
  exportedArtifactBytes: directorySize(outDir),
  courseDataSourceBytes: sumSize(courseDataFiles),
  largestChunks,
};

console.log("Lycium web export report:");
console.log(`- base path: ${report.basePath}`);
console.log(`- route count: ${report.routeCount}`);
console.log(`- exported artifact size: ${formatBytes(report.exportedArtifactBytes)}`);
console.log(`- source course-data size: ${formatBytes(report.courseDataSourceBytes)}`);
console.log("- largest chunks:");
for (const chunk of largestChunks) {
  console.log(`  - ${chunk.file}: ${formatBytes(chunk.size)}`);
}

if (process.env.LYCIUM_EXPORT_REPORT_JSON === "1") {
  console.log(JSON.stringify(report, null, 2));
}

function collectFiles(root, files = []) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      collectFiles(entryPath, files);
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

function directorySize(root) {
  return existsSync(root) ? sumSize(collectFiles(root)) : 0;
}

function sumSize(files) {
  return files.reduce((total, file) => total + statSync(file).size, 0);
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function normalizeBasePath(value) {
  if (!value || value === "/") {
    return "";
  }
  return `/${value.replace(/^\/+|\/+$/g, "")}`;
}

function relative(filePath) {
  return path.relative(repoRoot, filePath).replaceAll("\\\\", "/");
}
