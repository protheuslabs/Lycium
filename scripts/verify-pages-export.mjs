import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const outDir = path.resolve(repoRoot, process.argv[2] ?? "apps/lycium-web/out");
const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_LYCIUM_BASE_PATH ?? "/Lycium");
const publicSchemaRoot = "https://protheuslabs.github.io/Lycium/schemas/";
const requiredSchemas = [
  "lycium-course.schema.json",
  "lycium-program.schema.json",
  "lycium-curriculum-benchmark.schema.json",
];

const siteRoots = uniquePaths([
  basePath ? path.join(outDir, basePath.slice(1)) : outDir,
  outDir,
]).filter((candidate) => existsSync(candidate));

const failures = [];

if (!existsSync(outDir)) {
  failures.push(`Static export directory is missing: ${relative(outDir)}`);
}

if (siteRoots.length === 0) {
  failures.push(`No static site root found for base path ${basePath || "/"}.`);
}

const matchingRoot = siteRoots.find((siteRoot) => routeExists(siteRoot, "catalog"));

if (!matchingRoot) {
  failures.push(`Catalog route is missing: ${basePath}/catalog`);
}

const routeRoot = matchingRoot ?? siteRoots[0] ?? outDir;
const htmlRoutes = existsSync(routeRoot) ? collectHtmlRoutes(routeRoot) : [];
const courseRoute = htmlRoutes.find(isCourseRoute);
const unitRoute = htmlRoutes.find(isCourseUnitRoute);

if (!courseRoute) {
  failures.push("No exported course route found under /courses/[courseSlug].");
}

if (!unitRoute) {
  failures.push("No exported course unit route found under /courses/[courseSlug]/units/[unitSlug].");
}

for (const schemaFile of requiredSchemas) {
  const schemaPath = path.join(routeRoot, "schemas", schemaFile);
  if (!existsSync(schemaPath)) {
    failures.push(`Public schema is missing: ${basePath}/schemas/${schemaFile}`);
    continue;
  }

  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  if (schema.$id !== `${publicSchemaRoot}${schemaFile}`) {
    failures.push(`Public schema $id is not rooted at GitHub Pages: ${schemaFile}`);
  }
}

if (process.env.LYCIUM_REQUIRE_404 === "1" && !existsSync(path.join(outDir, "404.html"))) {
  failures.push("GitHub Pages fallback 404.html is missing.");
}

if (failures.length > 0) {
  console.error("GitHub Pages export verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("GitHub Pages export verification passed:");
console.log(`- catalog: ${basePath}/catalog`);
console.log(`- course: ${basePath}/${courseRoute}`);
console.log(`- unit: ${basePath}/${unitRoute}`);
for (const schemaFile of requiredSchemas) {
  console.log(`- schema: ${basePath}/schemas/${schemaFile}`);
}

function normalizeBasePath(value) {
  if (!value || value === "/") {
    return "";
  }
  return `/${value.replace(/^\/+|\/+$/g, "")}`;
}

function routeExists(siteRoot, route) {
  return existsSync(path.join(siteRoot, route, "index.html")) || existsSync(path.join(siteRoot, `${route}.html`));
}

function collectHtmlRoutes(siteRoot) {
  const routes = [];
  const stack = [siteRoot];

  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }
      if (entry.isFile() && entry.name === "index.html") {
        routes.push(toRoute(path.relative(siteRoot, entryPath)));
      }
    }
  }

  return routes.sort();
}

function isCourseRoute(route) {
  const parts = route.split("/");
  return parts.length === 3 && parts[0] === "courses" && parts[2] === "index.html";
}

function isCourseUnitRoute(route) {
  const parts = route.split("/");
  return parts.length === 5 && parts[0] === "courses" && parts[2] === "units" && parts[4] === "index.html";
}

function toRoute(filePath) {
  return filePath.split(path.sep).join("/");
}

function uniquePaths(paths) {
  return [...new Set(paths)];
}

function relative(filePath) {
  return path.relative(repoRoot, filePath) || ".";
}
