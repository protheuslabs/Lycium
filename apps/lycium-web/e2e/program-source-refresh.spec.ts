import { expect, test, type Page } from "@playwright/test";

async function mockVerifiedAiConnection(page: Page) {
  await page.route("**/v1/local/ai/providers", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "local-model",
          label: "Ollama Local",
          default_model: "test-model",
          model_fetch_supported: true,
          local_provider: true,
          credential_label: "local path",
          credential_placeholder: "Local Path",
        },
      ]),
    });
  });
  await page.route("**/v1/local/settings", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        agent_keys: [
          {
            id: "test-local-key",
            provider_id: "local-model",
            provider_label: "Ollama Local",
            key_preview: "http://localhost:11434",
            model: "test-model",
            models: ["test-model"],
            is_active: true,
            connection_status: "verified",
          },
        ],
      }),
    });
  });
}

async function openFirstUsableCourse(page: Page) {
  const firstCourse = page
    .locator(".course-card:not(.create-course-card):not(.course-card--empty):not(.course-card--generating):not(.course-card--locked)")
    .first();
  await expect(firstCourse).toBeVisible();
  await firstCourse.click();
  await expect(page.locator(".content-view")).toBeVisible();
}

async function seedRefreshableCourse(page: Page) {
  await page.addInitScript(() => {
    const sourceRecord = {
      id: "source-e2e-refresh",
      type: "textbook",
      title: "E2E Refresh Source",
      url: "https://example.edu/e2e-refresh-source",
    };
    const course = {
      key: "e2e-refreshable-course",
      title: "E2E Refreshable Course",
      source: "local",
      status: "draft",
      snapshotId: 454545,
      data: {
        title: "E2E Refreshable Course",
        shortDescription: "A seeded API-backed draft for section refresh coverage.",
        category: "natural-sciences-mathematics",
        department: "chemistry",
        tags: ["e2e", "refresh"],
        sourceIds: [sourceRecord.id],
        sourceRecords: [sourceRecord],
        metadata: { pacingLabel: "Module", editPolicy: { editable: true, ownerCanEdit: true } },
        modules: [
          {
            id: "refresh-module",
            title: "Module 1",
            sourceIds: [sourceRecord.id],
            sections: [
              {
                id: "refresh-section",
                title: "Refresh target",
                pageType: "learn",
                sectionType: "lesson",
                sourceIds: [sourceRecord.id],
                content: [
                  {
                    type: "text",
                    heading: "Refresh target",
                    value: "This section can be refreshed from source-backed feedback.",
                    sourceIds: [sourceRecord.id],
                  },
                  { type: "heading", title: "Concepts introduced", sourceIds: [sourceRecord.id] },
                  {
                    type: "conceptCard",
                    title: "Source-backed refresh",
                    description: "A section revision that uses feedback and source evidence.",
                    sourceIds: [sourceRecord.id],
                  },
                ],
              },
              {
                id: "refresh-summary",
                title: "Module summary",
                pageType: "learn",
                sectionType: "summary",
                sourceIds: [sourceRecord.id],
                content: [
                  { type: "heading", title: "Module concepts", sourceIds: [sourceRecord.id] },
                  {
                    type: "conceptCard",
                    title: "Source-backed refresh",
                    description: "A source-supported concept reviewed from the module.",
                    sourceIds: [sourceRecord.id],
                    sourceSectionId: "refresh-section",
                  },
                ],
              },
            ],
          },
        ],
      },
    };
    window.localStorage.setItem("lycium-local-course-drafts", JSON.stringify([course]));
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test("program requirement source warnings open the source-gap modal", async ({ page }) => {
  await page.goto("/Lycium/catalog/programs");
  const firstProgram = page.locator(".program-showcase-card").first();
  await expect(firstProgram).toBeVisible();
  await firstProgram.focus();
  await page.keyboard.press("Enter");

  const firstCluster = page.locator(".program-showcase-card").first();
  await expect(firstCluster).toBeVisible();
  await firstCluster.focus();
  await page.keyboard.press("Enter");

  const addSourceButton = page.locator(".catalog-requirement-source-warning").getByRole("button", { name: "Add source" }).first();
  await expect(addSourceButton).toBeVisible();
  await addSourceButton.click();

  const dialog = page.getByRole("dialog").first();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Sources needed");
  await expect(page.getByLabel("Source URL")).toBeVisible();
});

test("section refresh is blocked for non API-backed course pages", async ({ page }) => {
  await page.goto("/Lycium/catalog");
  await openFirstUsableCourse(page);

  const refreshButton = page.getByRole("button", { name: "Refresh this section with AI" });
  await expect(refreshButton).toBeVisible();
  await expect(refreshButton).toBeDisabled();
  await expect(refreshButton).toHaveAttribute("title", /API-backed snapshot and verified AI model/);
});

test("section refresh modal opens when an API-backed course and verified model are available", async ({ page }) => {
  await mockVerifiedAiConnection(page);
  await seedRefreshableCourse(page);
  await page.goto("/Lycium/catalog");
  await page.getByPlaceholder("Search names, tags, and departments").fill("E2E Refreshable Course");
  await page.locator(".course-card").filter({ hasText: "E2E Refreshable Course" }).first().click();

  const refreshButton = page.getByRole("button", { name: "Refresh this section with AI" });
  await expect(refreshButton).toBeEnabled();
  await refreshButton.click();

  const dialog = page.getByRole("dialog", { name: "Refresh this section" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Overall direction")).toBeVisible();
  await expect(dialog.getByText("Sources to avoid")).toBeVisible();
  await expect(dialog.getByText("[1] E2E Refresh Source")).toBeVisible();
});
