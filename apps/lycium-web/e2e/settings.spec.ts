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

const localProvider = {
  id: "local-model",
  label: "Ollama Local",
  default_model: "llama3.1:8b",
  recommended_model: "llama3.1:8b",
  model_fetch_supported: true,
  generation_adapter: "ollama-chat",
  local_provider: true,
  credential_label: "local path",
  credential_placeholder: "Local Path",
  credential_default: "http://localhost:11434",
};

function localSettings(endpoint = "http://localhost:11434", status: "verified" | "unverified" = "verified") {
  const isVerified = status === "verified";
  return {
    local_data_dir: "/tmp/lycium-e2e",
    has_agent_api_key: true,
    agent_api_key_preview: endpoint,
    active_agent_key_id: "local-model-localhost",
    agent_keys: [
      {
        id: "local-model-localhost",
        provider_id: "local-model",
        provider_label: "Ollama Local",
        key_preview: endpoint,
        model: "llama3.1:8b",
        models: isVerified ? [{ id: "llama3.1:8b", label: "llama3.1:8b" }] : [],
        models_fetched_at: isVerified ? "2026-06-06T00:00:00Z" : null,
        connection_status: status,
        connection_message: isVerified ? "Connection verified." : "Local model endpoint could not be reached.",
        last_verified_at: isVerified ? "2026-06-06T00:00:00Z" : null,
        last_error: isVerified ? null : "Local model endpoint could not be reached.",
        is_active: true,
        generation_adapter: "ollama-chat",
        local_provider: true,
        credential_label: "local path",
        credential_kind: "local_endpoint",
      },
    ],
  };
}

async function mockLocalProviderSettingsApis(page: Page) {
  let settings = {
    local_data_dir: "/tmp/lycium-e2e",
    has_agent_api_key: false,
    agent_api_key_preview: null,
    active_agent_key_id: null,
    agent_keys: [],
  };

  await page.route("**/v1/local/ai/providers", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([localProvider]),
    });
  });
  await page.route("**/v1/local/settings", async (route) => {
    if (route.request().method() === "PUT") {
      const payload = route.request().postDataJSON() as { agent_api_key?: string };
      settings = localSettings(payload.agent_api_key ?? "http://localhost:11434");
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(settings),
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
    await route.fulfill({ contentType: "application/json", body: JSON.stringify([]) });
  });
  await page.route("**/v1/generation-evals/trend**", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ runs: [], trend: null }) });
  });
}

async function mockUnavailableLocalProviderSettingsApis(page: Page) {
  let settings = {
    local_data_dir: "/tmp/lycium-e2e",
    has_agent_api_key: false,
    agent_api_key_preview: null,
    active_agent_key_id: null,
    agent_keys: [],
  };

  await page.route("**/v1/local/ai/providers", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([localProvider]),
    });
  });
  await page.route("**/v1/local/settings", async (route) => {
    if (route.request().method() === "PUT") {
      const payload = route.request().postDataJSON() as { agent_api_key?: string };
      settings = localSettings(payload.agent_api_key ?? "http://localhost:9999", "unverified");
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(settings),
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
    await route.fulfill({ contentType: "application/json", body: JSON.stringify([]) });
  });
  await page.route("**/v1/generation-evals/trend**", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ runs: [], trend: null }) });
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

test("local model endpoint saves as an active verified connection across reload", async ({ page }) => {
  await mockLocalProviderSettingsApis(page);
  await page.goto("/Lycium/settings");

  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await page.getByRole("button", { name: "AI provider" }).click();
  await page.getByRole("option", { name: "Ollama Local" }).click();

  const endpointInput = page.getByPlaceholder("Local Path");
  await expect(endpointInput).toHaveValue("http://localhost:11434");
  await page.getByRole("button", { name: "Add API key" }).click();

  await expect(page.getByText("Ollama Local verified with 1 models.")).toBeVisible();
  await expect(page.getByLabel("AI connection diagnostics")).toContainText("http://localhost:11434");
  await expect(page.getByLabel("AI connection diagnostics")).toContainText("Verified");

  await page.reload();

  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await expect(page.getByLabel("AI connection diagnostics")).toContainText("Ollama Local");
  await expect(page.getByLabel("AI connection diagnostics")).toContainText("http://localhost:11434");
  await expect(page.getByLabel("AI connection diagnostics")).toContainText("1 discovered");
});

test("unavailable local model endpoint remains saved and recoverable", async ({ page }) => {
  await mockUnavailableLocalProviderSettingsApis(page);
  await page.goto("/Lycium/settings");

  await page.getByRole("button", { name: "AI provider" }).click();
  await page.getByRole("option", { name: "Ollama Local" }).click();

  const endpointInput = page.getByPlaceholder("Local Path");
  await endpointInput.fill("http://localhost:9999");
  await page.getByRole("button", { name: "Add API key" }).click();

  await expect(page.getByText("Ollama Local saved, but Lycium could not verify it yet.")).toBeVisible();
  await expect(page.getByLabel("AI connection diagnostics")).toContainText("Needs check");
  await expect(page.getByLabel("AI connection diagnostics")).toContainText("http://localhost:9999");
  await expect(page.getByRole("button", { name: "Verify", exact: true })).toBeVisible();

  await page.reload();

  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await expect(page.getByLabel("AI connection diagnostics")).toContainText("Ollama Local");
  await expect(page.getByLabel("AI connection diagnostics")).toContainText("Needs check");
  await expect(page.getByLabel("AI connection diagnostics")).toContainText("http://localhost:9999");
  await expect(page.getByText("Ollama Local is saved but not verified yet.")).toBeVisible();
});
