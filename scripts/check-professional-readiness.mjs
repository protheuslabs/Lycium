import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

const tracks = [
  {
    name: "review/publish UI",
    evidence: [
      file("apps/lycium-web/src/components/CourseCatalog/CourseReviewPanel.tsx"),
      file("services/lycium-api/app/routes/course_review_routes.py"),
    ],
  },
  {
    name: "first-class benchmark persistence",
    evidence: [
      file("services/lycium-api/app/curriculum_artifacts.py"),
      file("packages/contracts/schemas/lycium-curriculum-benchmark.schema.json"),
      file("services/lycium-api/tests/test_curriculum_benchmarks_and_ai_settings.py"),
    ],
  },
  {
    name: "benchmark extraction pipeline",
    evidence: [
      file("services/lycium-api/app/curriculum_benchmark_extraction.py"),
      file("services/lycium-api/app/curriculum_benchmarks.py"),
    ],
  },
  {
    name: "course generation eval suite",
    evidence: [
      file("services/lycium-api/app/course_generation_scenarios.py"),
      file("services/lycium-api/tests/test_course_generation_scenarios.py"),
    ],
  },
  {
    name: "provider connection test matrix",
    evidence: [
      file("services/lycium-api/app/ai_providers.json"),
      file("services/lycium-api/tests/test_provider_connections.py"),
    ],
  },
  {
    name: "generation observability",
    evidence: [
      file("services/lycium-api/app/generation_observability.py"),
      file("services/lycium-api/tests/test_generation_observability.py"),
    ],
  },
  {
    name: "contract docs generated from schemas",
    evidence: [
      file("docs/contracts/schema-reference.md"),
      file("packages/contracts/scripts/generate-schema-docs.mjs"),
      contains("package.json", "check:docs"),
      contains(".github/workflows/ci.yml", "Check generated contract docs"),
    ],
  },
  {
    name: "local data migration/versioning",
    evidence: [
      file("services/lycium-api/app/local_store_core.py"),
      file("services/lycium-api/tests/test_local_data_migrations.py"),
    ],
  },
  {
    name: "local secret handling",
    evidence: [
      file("docs/security/local-secrets.md"),
      file("services/lycium-api/app/security.py"),
      file("services/lycium-api/tests/test_local_security.py"),
    ],
  },
  {
    name: "CI deployment verification",
    evidence: [
      file("scripts/verify-pages-export.mjs"),
      contains(".github/workflows/ci.yml", "Verify GitHub Pages export"),
      contains(".github/workflows/deploy-pages.yml", "Verify GitHub Pages export"),
    ],
  },
];

const failures = [];

for (const track of tracks) {
  for (const item of track.evidence) {
    const failure = item.check();
    if (failure) {
      failures.push(`${track.name}: ${failure}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Professional readiness check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Professional readiness check passed: ${tracks.length} tracks have concrete repo evidence.`);

function file(repoPath) {
  return {
    check() {
      return existsSync(resolve(repoPath)) ? "" : `missing ${repoPath}`;
    },
  };
}

function contains(repoPath, expectedText) {
  return {
    check() {
      const absolutePath = resolve(repoPath);
      if (!existsSync(absolutePath)) {
        return `missing ${repoPath}`;
      }
      const text = readFileSync(absolutePath, "utf8");
      return text.includes(expectedText) ? "" : `${repoPath} does not include "${expectedText}"`;
    },
  };
}

function resolve(repoPath) {
  return path.join(root, repoPath);
}
