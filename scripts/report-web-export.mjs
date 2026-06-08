import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const outDirArg = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
const outDir = path.resolve(repoRoot, outDirArg ?? "apps/lycium-web/out");
const nextDir = path.resolve(repoRoot, "apps/lycium-web/.next");
const courseDataDir = path.resolve(repoRoot, "apps/lycium-web/src/courseData");
const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_LYCIUM_BASE_PATH ?? "/Lycium");
const siteRoot = [basePath ? path.join(outDir, basePath.slice(1)) : outDir, outDir].find((candidate) => existsSync(candidate)) ?? outDir;
const shouldCheckBudget = process.argv.includes("--check") || process.env.LYCIUM_EXPORT_REPORT_CHECK === "1";
const budget = {
  maxRouteCount: numberEnv("LYCIUM_EXPORT_MAX_ROUTES", 5000),
  maxArtifactBytes: bytesEnv("LYCIUM_EXPORT_MAX_ARTIFACT_MB", 250),
  maxCourseDataBytes: bytesEnv("LYCIUM_EXPORT_MAX_COURSE_DATA_MB", 2),
  maxLargestChunkBytes: bytesEnv("LYCIUM_EXPORT_MAX_CHUNK_KB", 900, 1024),
};

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

if (shouldCheckBudget) {
  const failures = budgetFailures(report, budget);
  if (failures.length > 0) {
    console.error("Web export budget check failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }
  console.log("Web export budget check passed:");
  console.log(`- max routes: ${budget.maxRouteCount}`);
  console.log(`- max artifact size: ${formatBytes(budget.maxArtifactBytes)}`);
  console.log(`- max course-data source size: ${formatBytes(budget.maxCourseDataBytes)}`);
  console.log(`- max largest chunk: ${formatBytes(budget.maxLargestChunkBytes)}`);
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

function numberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function bytesEnv(name, fallback, multiplier = 1024 * 1024) {
  return numberEnv(name, fallback) * multiplier;
}

function budgetFailures(currentReport, currentBudget) {
  const failures = [];
  const largestChunk = currentReport.largestChunks[0];

  if (currentReport.routeCount === 0) {
    failures.push("route count is 0; run the web static export before checking budget");
  }
  if (currentReport.exportedArtifactBytes === 0) {
    failures.push("exported artifact size is 0 B; run the web static export before checking budget");
  }
  if (currentReport.routeCount > currentBudget.maxRouteCount) {
    failures.push(`route count ${currentReport.routeCount} exceeds ${currentBudget.maxRouteCount}`);
  }
  if (currentReport.exportedArtifactBytes > currentBudget.maxArtifactBytes) {
    failures.push(
      `exported artifact size ${formatBytes(currentReport.exportedArtifactBytes)} exceeds ${formatBytes(currentBudget.maxArtifactBytes)}`,
    );
  }
  if (currentReport.courseDataSourceBytes > currentBudget.maxCourseDataBytes) {
    failures.push(
      `source course-data size ${formatBytes(currentReport.courseDataSourceBytes)} exceeds ${formatBytes(currentBudget.maxCourseDataBytes)}`,
    );
  }
  if (largestChunk && largestChunk.size > currentBudget.maxLargestChunkBytes) {
    failures.push(
      `largest chunk ${largestChunk.file} is ${formatBytes(largestChunk.size)}, exceeding ${formatBytes(currentBudget.maxLargestChunkBytes)}`,
    );
  }

  return failures;
}
