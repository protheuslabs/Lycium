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
            models: [{ id: "test-model", label: "test-model" }],
            is_active: true,
            connection_status: "verified",
          },
        ],
      }),
    });
  });
}

async function mockUnverifiedAiConnection(page: Page) {
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
            key_preview: "http://localhost:9999",
            model: "test-model",
            models: [{ id: "test-model", label: "test-model" }],
            is_active: true,
            connection_status: "unverified",
            connection_message: "Local model endpoint could not be reached.",
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

async function seedNonApiBackedCourse(page: Page) {
  await page.addInitScript(() => {
    const course = {
      key: "e2e-non-api-refresh-course",
      title: "E2E Non API Refresh Course",
      source: "local",
      status: "draft",
      data: {
        title: "E2E Non API Refresh Course",
        shortDescription: "A seeded local draft without an API snapshot for section refresh lock coverage.",
        category: "natural-sciences-mathematics",
        department: "chemistry",
        tags: ["e2e", "refresh", "local"],
        sourceIds: [],
        sourceRecords: [],
        metadata: { pacingLabel: "Module", editPolicy: { editable: true, ownerCanEdit: true } },
        modules: [
          {
            id: "non-api-module",
            title: "Module 1",
            sections: [
              {
                id: "non-api-section",
                title: "Local section",
                pageType: "learn",
                sectionType: "lesson",
                content: [
                  {
                    type: "text",
                    heading: "Local section",
                    value: "This local draft has no API snapshot, so section refresh must explain the lock.",
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

async function seedProgramRequirementSourceGapCourse(page: Page) {
  await page.addInitScript(() => {
    const sourceGapCourse = {
      key: "local-se-computing-systems",
      title: "Computing Systems Foundations",
      source: "local",
      status: "needs_sources",
      data: {
        title: "Computing Systems Foundations",
        shortDescription: "A seeded program requirement draft that needs source evidence.",
        category: "computing-information-sciences",
        department: "software-engineering",
        tags: ["e2e", "source gap"],
        sourceIds: [],
        sourceRecords: [],
        metadata: {
          status: "needs_sources",
          scaffoldCourseId: "local-se-computing-systems",
          sourceGaps: [
            {
              id: "gap-computing-systems",
              scopeType: "course",
              scopeId: "local-se-computing-systems",
              title: "Add computing systems sources",
              neededFor: "Program requirement source coverage",
              requiredConcepts: ["operating systems", "computer architecture"],
              recommendedSourceTypes: ["textbook", "open_courseware"],
              minimumUsefulSources: 2,
              currentSourceCount: 0,
              severity: "blocking",
            },
          ],
        },
        modules: [
          {
            id: "source-gap-module",
            title: "Source coverage needed",
            sections: [
              {
                id: "source-gap-section",
                title: "Add sources to continue",
                pageType: "learn",
                sectionType: "source-gap",
                content: [{ type: "text", value: "Add source evidence before this course is generated." }],
              },
            ],
          },
        ],
      },
    };
    window.localStorage.setItem("lycium-local-course-drafts", JSON.stringify([sourceGapCourse]));
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test("program requirement source warnings open the source-gap modal", async ({ page }) => {
  await seedProgramRequirementSourceGapCourse(page);
  await page.goto("/Lycium/catalog/full-stack-engineer-program-full-stack-engineer");

  const firstCluster = page.locator(".program-showcase-card").filter({ hasText: "Foundations" }).first();
  await expect(firstCluster).toBeVisible();
  await firstCluster.click();

  const addSourceButton = page.locator(".catalog-requirement-source-warning").getByRole("button", { name: "Add source" }).first();
  await expect(addSourceButton).toBeVisible();
  await addSourceButton.click();

  const dialog = page.getByRole("dialog").first();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Sources needed");
  await expect(page.getByLabel("Source URL")).toBeVisible();
});

test("section refresh is blocked for non API-backed course pages", async ({ page }) => {
  await seedNonApiBackedCourse(page);
  await page.goto("/Lycium/catalog");
  await page.getByPlaceholder("Search names, tags, and departments").fill("E2E Non API Refresh Course");
  await page.locator(".course-card").filter({ hasText: "E2E Non API Refresh Course" }).first().click();
  await expect(page.locator(".content-view")).toBeVisible();

  const refreshButton = page.getByRole("button", { name: "Why section refresh is unavailable" });
  await expect(refreshButton).toBeVisible();
  await expect(refreshButton).toHaveAttribute("title", /API-backed course snapshots/);
  await refreshButton.click();

  const dialog = page.getByRole("dialog", { name: "Section refresh unavailable" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("AI section refresh is locked.");
  await expect(dialog).toContainText("API-backed course snapshots");
});

test("section refresh is blocked when the active model is unverified", async ({ page }) => {
  await mockUnverifiedAiConnection(page);
  await seedRefreshableCourse(page);
  await page.goto("/Lycium/catalog");
  await page.getByLabel("Settings").click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await expect(page.getByText("Ollama Local is saved but not verified yet.")).toBeVisible();
  await page.getByRole("button", { name: /close settings/i }).click();
  await page.getByPlaceholder("Search names, tags, and departments").fill("E2E Refreshable Course");
  await page.locator(".course-card").filter({ hasText: "E2E Refreshable Course" }).first().click();

  const refreshButton = page.getByRole("button", { name: "Why section refresh is unavailable" });
  await expect(refreshButton).toBeVisible();
  await expect(refreshButton).toHaveAttribute("title", /saved but not connected/);
  await refreshButton.click();

  const dialog = page.getByRole("dialog", { name: "Section refresh unavailable" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("AI section refresh is locked.");
  await expect(dialog).toContainText("Refresh the connection in Settings");
  await expect(dialog.getByRole("link", { name: "Open Settings" })).toBeVisible();
});

test("section refresh modal opens when an API-backed course and verified model are available", async ({ page }) => {
  await mockVerifiedAiConnection(page);
  await seedRefreshableCourse(page);
  await page.goto("/Lycium/catalog");
  await page.getByLabel("Settings").click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await expect(page.locator(".settings-key-preview").getByText("http://localhost:11434")).toBeVisible();
  await page.getByRole("button", { name: /close settings/i }).click();
  await page.getByPlaceholder("Search names, tags, and departments").fill("E2E Refreshable Course");
  await page.locator(".course-card").filter({ hasText: "E2E Refreshable Course" }).first().click();

  const refreshButton = page.getByRole("button", { name: "Refresh this section with AI" });
  await expect(refreshButton).toBeEnabled();
  await refreshButton.click();

  const dialog = page.getByRole("dialog", { name: "Regenerate section?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("This will ask the selected model to regenerate the current section");
  await expect(dialog.getByRole("button", { name: "Yes, regenerate" })).toBeEnabled();
});
