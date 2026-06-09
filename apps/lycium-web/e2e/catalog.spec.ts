import { expect, test, type Page } from "@playwright/test";

async function chooseDropdownOption(page: Page, label: string, optionName: string | RegExp) {
  const trigger = page.getByLabel(label);
  const currentText = (await trigger.textContent()) ?? "";
  if (typeof optionName === "string" && currentText.includes(optionName)) {
    return;
  }
  await trigger.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("option", { name: optionName }).first().click();
}

function firstUsableCourseCard(page: Page) {
  return page
    .locator(".course-card:not(.create-course-card):not(.course-card--empty):not(.course-card--generating):not(.course-card--locked)")
    .first();
}

async function openCreateCourseDialog(page: Page) {
  const createCard = page.locator(".create-course-card").first();
  await expect(createCard).toBeVisible();
  await createCard.click({ force: true });
  await expect(page.getByRole("dialog", { name: "Create Course" })).toBeVisible();
}

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

async function mockEmptyAiConnection(page: Page) {
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
}

async function seedReadyForReviewCourse(page: Page) {
  await page.addInitScript(() => {
    const sourceRecord = {
      id: "source-e2e-review",
      type: "syllabus",
      title: "E2E Review Source",
      url: "https://example.edu/e2e-review-source",
    };
    const qualityReport = {
      gate: "publish",
      passed: true,
      score: 0.96,
      errors: [],
      warnings: [],
      metrics: {},
      checkedAt: "2026-06-06T00:00:00.000Z",
      workflow: {
        workflowVersion: "e2e",
        status: "passed",
        checkedAt: "2026-06-06T00:00:00.000Z",
        metrics: {},
        gates: [
          {
            gate: "review_publish",
            status: "passed",
            summary: "All publish-critical gates passed.",
            artifacts: {},
            issues: [],
          },
        ],
      },
    };
    const readyCourse = {
      key: "e2e-ready-review-course",
      title: "E2E Ready Review Course",
      source: "local",
      status: "ready_for_review",
      snapshotId: 987654,
      qualityReport,
      generation_trace: { quality_report: qualityReport },
      data: {
        title: "E2E Ready Review Course",
        shortDescription: "A seeded review-ready course for catalog lifecycle coverage.",
        category: "natural-sciences-mathematics",
        department: "chemistry",
        tags: ["e2e", "review"],
        sourceIds: [sourceRecord.id],
        sourceRecords: [sourceRecord],
        metadata: {
          curriculumBenchmarks: [{ id: "benchmark-e2e", title: "E2E Benchmark", sourceType: "syllabus" }],
          requirementOrigins: [{ title: "E2E requirement", originType: "common_academic_requirement" }],
          courseParityProfile: {
            coveragePercent: 92,
            commonRequiredTopics: ["source grounding", "review gates"],
          },
          sourceSlots: [
            {
              requiredConceptId: "source-grounding",
              primarySourceId: sourceRecord.id,
              fallbackSourceIds: [],
              replacementPolicy: "review_required",
            },
          ],
        },
        modules: [
          {
            id: "e2e-module",
            title: "Module 1",
            sourceIds: [sourceRecord.id],
            sections: [
              {
                id: "e2e-section",
                title: "Review section",
                pageType: "learn",
                sectionType: "lesson",
                sourceIds: [sourceRecord.id],
                content: [
                  {
                    type: "text",
                    value: "This review-ready course has enough evidence to exercise the publish lifecycle.",
                    sourceIds: [sourceRecord.id],
                  },
                ],
              },
            ],
          },
        ],
      },
    };
    window.localStorage.setItem("lycium-local-course-drafts", JSON.stringify([readyCourse]));
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("lycium-e2e-storage-cleared") === "1") {
      return;
    }
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.sessionStorage.setItem("lycium-e2e-storage-cleared", "1");
  });
});

test("manual course creation opens a blank editable draft", async ({ page }) => {
  await page.goto("/Lycium/catalog");

  await page.getByRole("button", { name: /^Create Course$/i }).click();
  await expect(page.getByRole("dialog", { name: "Create Course" })).toBeVisible();
  await page.getByRole("tab", { name: "Manual" }).click();
  await page.getByRole("button", { name: "Create blank course" }).click();

  await expect(page).toHaveURL(/\/Lycium\/courses\//);
  await expect(page.locator(".course-name")).toHaveText("Untitled course");
  await expect(page.getByRole("button", { name: "Edit course" })).toBeVisible();
  await expect(page.locator(".sidebar")).toContainText("1.1");
});

test("under-sourced AI creation produces a source-gated draft card", async ({ page }) => {
  await mockVerifiedAiConnection(page);
  await page.goto("/Lycium/catalog");

  await page.getByLabel("Settings").click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await page.getByRole("button", { name: /close settings/i }).click();
  await openCreateCourseDialog(page);
  await page.getByPlaceholder("Describe the course you want to build...").fill("Lifecycle Needs Sources Course");
  await chooseDropdownOption(page, "College", "College of Natural Sciences and Mathematics");
  await chooseDropdownOption(page, "Department", "Chemistry");
  const createButton = page.getByRole("dialog", { name: "Create Course" }).getByRole("button", { name: /^Create course$/i });
  await expect(createButton).toBeEnabled();
  await createButton.click();

  const sourceGatedCard = page.locator(".course-card").filter({ hasText: "Lifecycle Needs Sources Course" }).first();
  await expect(sourceGatedCard).toBeVisible();
  await expect(sourceGatedCard.locator(".course-lifecycle-badge-source")).toHaveText("Needs sources");
  await sourceGatedCard.click();

  await expect(page.getByRole("dialog", { name: "Lifecycle Needs Sources Course" })).toBeVisible();
  await expect(page.getByText("Sources needed")).toBeVisible();
  await expect(page.getByRole("button", { name: "Queue source" })).toBeDisabled();
  await expect(page).toHaveURL(/\/Lycium\/catalog$/);
});

test("catalog lifecycle badges expose review-ready and published states", async ({ page }) => {
  await seedReadyForReviewCourse(page);
  await page.goto("/Lycium/catalog");

  await page.getByPlaceholder("Search names, tags, and departments").fill("E2E Ready Review Course");
  const readyCard = page.locator(".course-card").filter({ hasText: "E2E Ready Review Course" }).first();
  await expect(readyCard).toBeVisible();
  await expect(readyCard.locator(".course-lifecycle-badge-review")).toHaveText("Publish ready");
  await readyCard.getByRole("button", { name: "Review and publish" }).click();
  await expect(page.getByRole("dialog", { name: "E2E Ready Review Course" })).toBeVisible();
  await expect(page.getByText("Generation review")).toBeVisible();
  await expect(page.getByText("Publish gate")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish course" })).toBeEnabled();
  await page.keyboard.press("Escape");

  await page.getByPlaceholder("Search names, tags, and departments").fill("CHEM 105");
  const publishedCard = page.locator(".course-card").filter({ hasText: "CHEM 105" }).first();
  await expect(publishedCard).toBeVisible();
  await expect(publishedCard.locator(".course-lifecycle-badge-published")).toHaveText("Published");
  await publishedCard.click();
  await expect(page).toHaveURL(/\/Lycium\/courses\//);
  await expect(page.locator(".content-view")).toBeVisible();
});

test("catalog loads, exposes create flow, and opens a course", async ({ page }) => {
  await page.goto("/Lycium/catalog");

  await expect(page.getByRole("button", { name: /create course/i })).toBeVisible();

  await openCreateCourseDialog(page);
  await expect(page.getByPlaceholder("Describe the course you want to build...")).toBeVisible();
  await page.getByRole("button", { name: /close create course/i }).click();

  const firstCourse = firstUsableCourseCard(page);
  await expect(firstCourse).toBeVisible();
  await firstCourse.click();
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.locator(".content-view")).toBeVisible();
});

test("catalog program and cluster navigation is data-driven", async ({ page }) => {
  await page.goto("/Lycium/catalog/programs");
  await expect(page.getByLabel("Select catalog view level")).toContainText("Programs");

  const firstProgram = page.locator(".program-showcase-card").first();
  await expect(firstProgram).toBeVisible();
  const programTitle = (await firstProgram.locator("h3").innerText()).trim();
  expect(programTitle.length).toBeGreaterThan(0);

  await firstProgram.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/Lycium\/catalog\/[^/]+$/);
  await expect(page.getByLabel("Select catalog view level")).toContainText("Clusters");

  const firstCluster = page.locator(".program-showcase-card").first();
  await expect(firstCluster).toBeVisible();
  const clusterTitle = (await firstCluster.locator("h3").innerText()).trim();
  expect(clusterTitle.length).toBeGreaterThan(0);

  await firstCluster.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/Lycium\/catalog\/[^/]+\/[^/]+$/);
  await expect(page.getByLabel("Select catalog view level")).toContainText("Courses");
  await expect(page.getByLabel(`${clusterTitle} requirements`)).toBeVisible();
  await expect(page.locator(".catalog-requirement-row").first()).toBeVisible();
  await expect(page.locator(".catalog-requirement-main").first()).toContainText(/evidence refs|Needs source evidence/);
  const firstClusterCourse = page.locator(".course-card:not(.create-course-card)").first();
  await expect(firstClusterCourse).toBeVisible();
  await expect(firstClusterCourse).toContainText("Satisfies:");
});

test("catalog search, filters, sort, and locked card behavior are generic", async ({ page }) => {
  await page.goto("/Lycium/catalog");

  const firstCourse = firstUsableCourseCard(page);
  await expect(firstCourse).toBeVisible();
  const firstCourseTitle = (await firstCourse.locator("h3").innerText()).trim();
  const searchToken = firstCourseTitle.split(/\s+/).find((token) => token.length > 2) ?? firstCourseTitle;

  await page.getByPlaceholder("Search names, tags, and departments").fill(searchToken);
  await expect(page.locator(".course-card").filter({ hasText: firstCourseTitle }).first()).toBeVisible();

  await chooseDropdownOption(page, "Sort courses", /Sort by Completion/);
  await expect(page.getByLabel("Sort courses")).toContainText("Completion");

  await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(page.getByRole("dialog", { name: "Catalog filters" })).toBeVisible();
  await expect(page.getByLabel("Filter by college")).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();

  const lockedCourse = page.locator(".course-card--locked").first();
  if (await lockedCourse.count()) {
    const currentUrl = page.url();
    await lockedCourse.click();
    await expect(page).toHaveURL(currentUrl);
  }
});


test("create-course modal reflects locked and unlocked AI states", async ({ page }) => {
  await page.goto("/Lycium/catalog");

  await openCreateCourseDialog(page);
  await expect(page.getByRole("note", { name: "AI course creation is locked." })).toBeVisible();
  await expect(page.getByPlaceholder("Describe the course you want to build...")).toBeDisabled();
  await expect(page.getByRole("button", { name: /add another link/i })).toBeDisabled();
  const lockedDialog = page.getByRole("dialog", { name: "Create Course" });
  await expect(lockedDialog.getByRole("button", { name: /^Create course$/i })).toBeDisabled();
  await page.getByRole("button", { name: /close create course/i }).click();

  await mockVerifiedAiConnection(page);
  await page.reload();
  await page.getByLabel("Settings").click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await expect(page.locator(".settings-key-preview").getByText("http://localhost:11434")).toBeVisible();
  await page.getByRole("button", { name: /close settings/i }).click();
  await openCreateCourseDialog(page);
  await expect(page.getByRole("note", { name: "AI course creation is locked." })).toHaveCount(0);

  const description = page.getByPlaceholder("Describe the course you want to build...");
  await expect(description).toBeEnabled();
  await description.fill("Create a source-backed course from the supplied material.");
  await expect(page.getByRole("button", { name: /add another link/i })).toBeEnabled();
  await chooseDropdownOption(page, "College", "College of Natural Sciences and Mathematics");
  await chooseDropdownOption(page, "Department", "Chemistry");
  const unlockedDialog = page.getByRole("dialog", { name: "Create Course" });
  await expect(unlockedDialog.getByRole("button", { name: /^Create course$/i })).toBeEnabled();
});

test("catalog controls support keyboard navigation and modal focus", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/Lycium/catalog");

  await page.getByLabel("Select catalog view level").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox", { name: "Select catalog view level" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox", { name: "Select catalog view level" })).toHaveCount(0);

  await page.getByRole("button", { name: /create course/i }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Create Course" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Create Course" })).toHaveCount(0);
});

test("settings modal and course shell survive route changes", async ({ page }) => {
  await mockEmptyAiConnection(page);
  await page.goto("/Lycium/catalog");

  await page.getByLabel("Settings").click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await page.getByRole("radio", { name: "Dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: /close settings/i }).click();
  await expect(page).toHaveURL(/\/Lycium\/catalog$/);

  const firstCourse = firstUsableCourseCard(page);
  await firstCourse.click();
  await expect(page.locator(".content-view")).toBeVisible();
  await page.getByLabel("Settings").click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await page.getByRole("button", { name: /close settings/i }).click();
  await expect(page).toHaveURL(/\/Lycium\/courses\//);
});

test("forked courses expose stable edit-mode controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/Lycium/catalog");

  const firstCourse = firstUsableCourseCard(page);
  await expect(firstCourse).toBeVisible();
  await firstCourse.getByRole("button", { name: /more info about/i }).click();
  await expect(page.getByRole("dialog", { name: /.+/ })).toBeVisible();
  await page.getByRole("button", { name: "Fork course" }).click();

  await expect(page).toHaveURL(/\/Lycium\/courses\//);
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.locator(".content-view")).toBeVisible();
  const forkUrl = page.url();
  const forkCourseName = (await page.locator(".course-name").innerText()).trim();
  expect(forkCourseName.toLowerCase()).toMatch(/^fork of /);
  await page.reload();
  await expect(page).toHaveURL(forkUrl);
  await expect.poll(async () => (await page.locator(".course-name").innerText()).trim().toLowerCase()).toBe(
    forkCourseName.toLowerCase(),
  );

  await page.getByRole("button", { name: "Edit course" }).click();
  await expect(page.getByRole("button", { name: "Cancel course edits" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save course edits" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open course settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit course title" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit module title" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit section title" })).toBeVisible();

  await page.getByRole("button", { name: "Edit course title" }).click();
  await expect(page.locator(".course-edit-native-dialog")).toBeVisible();
  await page.locator("#course-edit-native-field").fill("Forked E2E Saved Course");
  await page.locator(".course-edit-native-dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.locator(".course-name")).toHaveText("Forked E2E Saved Course");

  await page.getByRole("button", { name: "Open course settings" }).click();
  await expect(page.getByRole("dialog", { name: "Course settings" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Course settings" })).toHaveCount(0);

  await expect(page.getByRole("button", { name: /add block/i })).toBeVisible();
  await page.getByRole("button", { name: /add block/i }).click();
  await expect(page.locator(".course-edit-native-dialog")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Text" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Card" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Video" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "iframe" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Heading" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Quiz" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".course-edit-native-dialog")).toHaveCount(0);

  await page.locator(".sidebar-source-tab").click();
  await expect(page.locator(".course-sources-page")).toBeVisible();

  await page.getByRole("button", { name: "Save course edits" }).click();
  await expect(page.getByRole("button", { name: "Save course edits" })).toHaveCount(0);
  const savedDraftTitles = await page.evaluate(() => {
    const drafts = JSON.parse(window.localStorage.getItem("lycium-local-course-drafts") ?? "[]") as Array<{ title?: string }>;
    return drafts.map((draft) => draft.title ?? "");
  });
  expect(savedDraftTitles).toContain("Forked E2E Saved Course");
  expect(savedDraftTitles.some((title) => title.includes("conflict copy"))).toBe(false);
});
