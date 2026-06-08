import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const tempRoot = mkdtempSync(path.join(tmpdir(), "lycium-export-report-"));
const scriptPath = path.join(repoRoot, "scripts", "report-web-export.mjs");

mkdirSync(path.join(tempRoot, "apps/lycium-web/out/Lycium/catalog"), { recursive: true });
mkdirSync(path.join(tempRoot, "apps/lycium-web/out/Lycium/courses/example"), { recursive: true });
mkdirSync(path.join(tempRoot, "apps/lycium-web/.next/static/chunks"), { recursive: true });
mkdirSync(path.join(tempRoot, "apps/lycium-web/src/courseData"), { recursive: true });

writeFileSync(path.join(tempRoot, "apps/lycium-web/out/Lycium/catalog/index.html"), "<main>Catalog</main>");
writeFileSync(path.join(tempRoot, "apps/lycium-web/out/Lycium/courses/example/index.html"), "<main>Course</main>");
writeFileSync(path.join(tempRoot, "apps/lycium-web/.next/static/chunks/app.js"), "console.log('small chunk');");
writeFileSync(path.join(tempRoot, "apps/lycium-web/src/courseData/example.ts"), "export const example = [];");

const pass = runReport(["--check"], {
  LYCIUM_EXPORT_MAX_ROUTES: "3",
  LYCIUM_EXPORT_MAX_ARTIFACT_MB: "1",
  LYCIUM_EXPORT_MAX_COURSE_DATA_MB: "1",
  LYCIUM_EXPORT_MAX_CHUNK_KB: "1",
});
assertStatus(pass, 0, "expected fixture export to pass budget");
assertIncludes(pass.stdout, "route count: 2");
assertIncludes(pass.stdout, "Web export budget check passed");

const fail = runReport(["--check"], { LYCIUM_EXPORT_MAX_ROUTES: "1" });
assertStatus(fail, 1, "expected route budget failure");
assertIncludes(fail.stderr, "route count 2 exceeds 1");

const missingExportRoot = mkdtempSync(path.join(tmpdir(), "lycium-export-report-empty-"));
const zero = spawnSync(process.execPath, [scriptPath, "--check"], {
  cwd: missingExportRoot,
  encoding: "utf8",
  env: { ...process.env, NEXT_PUBLIC_LYCIUM_BASE_PATH: "/Lycium" },
});
assertStatus(zero, 1, "expected missing export to fail budget");
assertIncludes(zero.stderr, "route count is 0");

console.log("Web export report tests passed.");

function runReport(args, env = {}) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: tempRoot,
    encoding: "utf8",
    env: { ...process.env, NEXT_PUBLIC_LYCIUM_BASE_PATH: "/Lycium", ...env },
  });
}

function assertStatus(result, expectedStatus, message) {
  if (result.status !== expectedStatus) {
    console.error(message);
    console.error(result.stdout);
    console.error(result.stderr);
    process.exit(1);
  }
}

function assertIncludes(value, expected) {
  if (!value.includes(expected)) {
    console.error(`Expected output to include: ${expected}`);
    console.error(value);
    process.exit(1);
  }
}
