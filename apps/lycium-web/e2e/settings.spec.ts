import { expect, test, type Page } from "@playwright/test";

async function mockSettingsApis(page: Page) {
  await page.route("**/v1/local/ai/providers", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
  await page.route("**/v1/local/settings", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ agent_keys: [] }),
    });
  });
  await page.route("**/v1/local/storage", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        local_data_dir: "/tmp/lycium-e2e",
        schema_version: 1,
        target_schema_version: 1,
        backup_count: 0,
        json_error_count: 0,
        json_errors: [],
        repair_warning_count: 0,
        repair_warnings: [],
        directories: [],
      }),
    });
  });
  await page.route("**/v1/generation-runs**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: 42,
          run_type: "course_generation_eval",
          status: "completed",
          prompt: "E2E persisted eval run",
          progress: 1,
          request_payload: {},
          result_summary: {
            scenario_report: {
              scenarioId: "chem-105-general-chemistry",
              scenarioLabel: "CHEM 105 General Chemistry",
              kind: "course",
              status: "passed",
              score: 0.99,
            },
          },
          trace: {},
          events: [],
          created_at: "2026-06-06T00:00:00Z",
          updated_at: "2026-06-06T00:00:00Z",
          completed_at: "2026-06-06T00:00:00Z",
        },
      ]),
    });
  });
  await page.route("**/v1/generation-evals/trend**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        runs: [
          {
            kind: "lycium.generationEvalRun",
            schemaVersion: 1,
            runId: "eval-route-run",
            createdAt: "2026-06-06T00:02:00Z",
            summary: {
              scenarioCount: 2,
              passedCount: 2,
              needsReviewCount: 0,
              failedCount: 0,
              averageScore: 0.98,
              minimumScore: 0.97,
            },
            scenarios: [],
            reports: [],
            metadata: {},
          },
        ],
        trend: {
          kind: "lycium.generationEvalTrend",
          schemaVersion: 1,
          runCount: 2,
          latestRunId: "eval-route-run",
          previousRunId: "eval-prior-run",
          latestSummary: {
            scenarioCount: 2,
            passedCount: 2,
            needsReviewCount: 0,
            failedCount: 0,
            averageScore: 0.98,
            minimumScore: 0.97,
          },
          scenarioTrends: [
            {
              scenarioId: "chem-105-general-chemistry",
              scenarioLabel: "CHEM 105 General Chemistry",
              status: "passed",
              previousStatus: "passed",
              score: 0.99,
              previousScore: 0.97,
              scoreDelta: 0.02,
            },
            {
              scenarioId: "multi-source-noisy-corpus",
              scenarioLabel: "Multi-source noisy corpus",
              status: "passed",
              previousStatus: null,
              score: 0.97,
              previousScore: null,
              scoreDelta: null,
            },
          ],
        },
      }),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test("settings eval dashboard renders persisted scenario trend", async ({ page }) => {
  await mockSettingsApis(page);
  await page.goto("/Lycium/settings");

  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Eval Score Dashboard" })).toBeVisible();

  const trendPanel = page.locator('[aria-label="Persisted generation eval trend"]');
  await expect(trendPanel).toBeVisible();
  await expect(trendPanel).toContainText("eval-route-run");
  await expect(trendPanel).toContainText("98%");
  await expect(trendPanel).toContainText("CHEM 105 General Chemistry");
  await expect(trendPanel).toContainText("+2 pts");
  await expect(trendPanel).toContainText("Multi-source noisy corpus");
  await expect(trendPanel).toContainText("New");

  const summary = page.getByLabel("Generation eval summary");
  await expect(summary).toContainText("Runs");
  await expect(summary).toContainText("1");
  await expect(summary).toContainText("99%");
});
