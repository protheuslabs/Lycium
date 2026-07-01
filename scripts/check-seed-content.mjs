import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const failures = [];

const seedFiles = [
  {
    path: "apps/lycium-web/src/courseData/localCourses.ts",
    emptyExportPattern: /export\s+const\s+localCourses\s*:\s*CourseEntry\[\]\s*=\s*\[\s*\]\s*;/,
    label: "local course catalog seeds",
  },
  {
    path: "apps/lycium-web/src/courseData/programs/index.ts",
    emptyExportPattern: /export\s+const\s+localPrograms\s*:\s*LyciumProgram\[\]\s*=\s*\[\s*\]\s*;/,
    label: "local program catalog seeds",
  },
];

for (const seedFile of seedFiles) {
  const absolutePath = join(ROOT, seedFile.path);
  if (!existsSync(absolutePath)) {
    failures.push(`${seedFile.path} is missing; clean-start seed guard cannot verify ${seedFile.label}.`);
    continue;
  }
  const source = readFileSync(absolutePath, "utf8");
  if (!seedFile.emptyExportPattern.test(source)) {
    failures.push(`${seedFile.path} must keep ${seedFile.label} empty unless a new catalog seed is explicitly approved.`);
  }
}

const allowedCourseDataTsFiles = new Set([
  "cleanCatalog.test.ts",
  "courseTaxonomy.ts",
  "fullCourseScaffold.ts",
  "localCourses.test.ts",
  "localCourses.ts",
]);
const courseDataDir = join(ROOT, "apps/lycium-web/src/courseData");
for (const entry of readdirSync(courseDataDir, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
  if (allowedCourseDataTsFiles.has(entry.name)) continue;
  failures.push(
    `apps/lycium-web/src/courseData/${entry.name} looks like committed course seed code. Courses must be structured data artifacts, not TypeScript modules.`
  );
}

if (failures.length) {
  console.error("Seed content guard failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Seed content guard passed: catalog starts from generated, manual, or imported artifacts.");
