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

const codexProvider = {
  id: "codex-runtime",
  label: "Codex",
  default_model: "codex",
  recommended_model: "codex",
  model_fetch_supported: true,
  generation_adapter: "local-agent-runtime",
  local_provider: true,
  credential_label: "bridge command",
  credential_placeholder: "Auto-filled Lycium bridge command",
  credential_default: "python3 services/lycium-api/scripts/agent_runtime_bridge.py --runtime codex",
  credential_kind: "local_runtime",
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

function multipleLocalSettings(activeKeyId = "local-model-localhost") {
  return {
    local_data_dir: "/tmp/lycium-e2e",
    has_agent_api_key: true,
    agent_api_key_preview: activeKeyId === "local-model-localhost" ? "http://localhost:11434" : "codex bridge",
    active_agent_key_id: activeKeyId,
    agent_keys: [
      {
        id: "local-model-localhost",
        provider_id: "local-model",
        provider_label: "Ollama Local",
        key_preview: "http://localhost:11434",
        model: "llama3.1:8b",
        models: [{ id: "llama3.1:8b", label: "llama3.1:8b" }],
        models_fetched_at: "2026-06-06T00:00:00Z",
        connection_status: "verified",
        connection_message: "Connection verified.",
        last_verified_at: "2026-06-06T00:00:00Z",
        last_error: null,
        is_active: activeKeyId === "local-model-localhost",
        generation_adapter: "ollama-chat",
        local_provider: true,
        credential_label: "local path",
        credential_kind: "local_endpoint",
      },
      {
        id: "codex-runtime-local",
        provider_id: "codex-runtime",
        provider_label: "Codex",
        key_preview: "codex bridge",
        model: "codex",
        models: [{ id: "codex", label: "codex" }],
        models_fetched_at: "2026-06-06T00:00:00Z",
        connection_status: "verified",
        connection_message: "Connection verified.",
        last_verified_at: "2026-06-06T00:00:00Z",
        last_error: null,
        is_active: activeKeyId === "codex-runtime-local",
        generation_adapter: "local-agent-runtime",
        local_provider: true,
        credential_label: "bridge command",
        credential_kind: "local_runtime",
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
}

async function mockMultipleLocalProviderSettingsApis(page: Page) {
  let settings = multipleLocalSettings();

  await page.route("**/v1/local/ai/providers", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([localProvider, codexProvider]),
    });
  });
  await page.route("**/v1/local/settings/active-key", async (route) => {
    const payload = route.request().postDataJSON() as { key_id?: string };
    settings = multipleLocalSettings(payload.key_id ?? "local-model-localhost");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(settings),
    });
  });
  await page.route("**/v1/local/settings", async (route) => {
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
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test("provider picker starts blank and follows recognizable API key formats", async ({ page }) => {
  await mockSettingsApis(page);
  await page.goto("/Lycium/settings");

  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  const providerButton = page.getByRole("button", { name: "AI provider" });
  await expect(providerButton).toContainText("Select");

  await providerButton.click();
  await expect(page.getByRole("option", { name: "Select" })).toBeVisible();
  await expect(page.locator(".settings-provider-dropdown .dropdown-separator")).toHaveText(["Local", "API"]);
  await page.getByRole("option", { name: "Select" }).click();

  const apiKeyInput = page.locator("#agent-api-key");
  await apiKeyInput.fill("sk-ant-api03-test-key");
  await expect(providerButton).toContainText("Anthropic");

  await apiKeyInput.fill("AIzaSyD5nZ4wS0meGoogleStyleKey123");
  await expect(providerButton).toContainText("Google Gemini");

  await apiKeyInput.fill("sk-or-v1-openrouter-test-key");
  await expect(providerButton).toContainText("OpenRouter");

  await apiKeyInput.fill("sk-proj-openai-test-key");
  await expect(providerButton).toContainText("OpenAI");
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

  await expect(page.getByText("Ollama Local verified with 1 models.")).toHaveCount(0);
  const savedKeys = page.getByLabel("Saved API keys");
  await expect(savedKeys).toContainText("Ollama Local - local");
  await expect(savedKeys).not.toContainText("http://localhost:11434");
  await expect(savedKeys).not.toContainText("Active");
  await expect(savedKeys).not.toContainText("Ready");
  await expect(savedKeys.locator(".settings-key-active-check")).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh Ollama Local connection" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete Ollama Local connection" })).toHaveCount(0);
  await page.getByRole("button", { name: "Ollama Local actions" }).click();
  await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
  await page.getByRole("heading", { name: "Display" }).click();
  await expect(page.getByRole("menuitem", { name: "Edit" })).toHaveCount(0);
  await page.getByRole("button", { name: "Ollama Local actions" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await expect(page.getByRole("button", { name: "AI provider" })).toContainText("Ollama Local");
  await expect(endpointInput).toHaveValue("http://localhost:11434");

  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  const reloadedSavedKeys = page.getByLabel("Saved API keys");
  await expect(page.getByText("Ollama Local is active with llama3.1:8b.")).toHaveCount(0);
  await expect(reloadedSavedKeys).toContainText("Ollama Local - local");
  await expect(reloadedSavedKeys).not.toContainText("http://localhost:11434");
  await expect(reloadedSavedKeys).not.toContainText("Active");
  await expect(reloadedSavedKeys).not.toContainText("Ready");
  await expect(reloadedSavedKeys.locator(".settings-key-active-check")).toBeVisible();
});

test("activating a saved model does not overwrite the add model row", async ({ page }) => {
  await mockMultipleLocalProviderSettingsApis(page);
  await page.goto("/Lycium/settings");

  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  const providerButton = page.getByRole("button", { name: "AI provider" });
  const endpointInput = page.getByPlaceholder("Local Path");
  await expect(providerButton).toContainText("Ollama Local");
  await expect(endpointInput).toHaveValue("http://localhost:11434");

  await endpointInput.fill("http://localhost:3001");
  await page.locator('.settings-key-row[aria-label="Codex local connection"] .settings-key-provider').click();

  await expect(page.getByRole("button", { name: "Codex local connection, active" })).toBeVisible();
  await expect(providerButton).toContainText("Ollama Local");
  await expect(endpointInput).toHaveValue("http://localhost:3001");
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
  const unverifiedSavedKeys = page.getByLabel("Saved API keys");
  await expect(unverifiedSavedKeys).toContainText("Ollama Local - local");
  await expect(unverifiedSavedKeys).toContainText("Not connected");
  await expect(unverifiedSavedKeys).not.toContainText("http://localhost:9999");
  await expect(page.getByRole("button", { name: "Refresh Ollama Local connection" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete Ollama Local connection" })).toHaveCount(0);
  await page.getByRole("button", { name: "Ollama Local actions" }).click();
  await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();

  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  const reloadedUnverifiedSavedKeys = page.getByLabel("Saved API keys");
  await expect(reloadedUnverifiedSavedKeys).toContainText("Ollama Local - local");
  await expect(reloadedUnverifiedSavedKeys).toContainText("Not connected");
  await expect(reloadedUnverifiedSavedKeys).not.toContainText("http://localhost:9999");
  await expect(page.getByText("Ollama Local is saved but not verified yet.")).toBeVisible();
});
