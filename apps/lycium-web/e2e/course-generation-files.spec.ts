import { expect, test, type Page } from "@playwright/test";

async function chooseDropdownOption(page: Page, label: string, optionName: string | RegExp) {
  const trigger = page.getByLabel(label);
  const currentText = (await trigger.textContent()) ?? "";
  if (typeof optionName === "string" && currentText.includes(optionName)) return;
  await trigger.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("option", { name: optionName }).first().click();
}

async function mockVerifiedAiConnection(page: Page) {
  await page.route("**/v1/local/ai/providers", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        {
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
        },
      ]),
    });
  });
  await page.route("**/v1/local/settings", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        local_data_dir: "/tmp/lycium-e2e",
        has_agent_api_key: true,
        agent_api_key_preview: "http://localhost:11434",
        active_agent_key_id: "local-model-localhost",
        agent_keys: [
          {
            id: "local-model-localhost",
            provider_id: "local-model",
            provider_label: "Ollama Local",
            key_preview: "http://localhost:11434",
            model: "llama3.1:8b",
            models: [{ id: "llama3.1:8b", label: "llama3.1:8b" }],
            models_fetched_at: "2026-06-06T00:00:00Z",
            is_active: true,
            connection_status: "verified",
            connection_message: "Connection verified.",
            last_verified_at: "2026-06-06T00:00:00Z",
            last_error: null,
            generation_adapter: "ollama-chat",
            local_provider: true,
            credential_label: "local path",
            credential_kind: "local_endpoint",
          },
        ],
      }),
    });
  });
}

async function mockQuietCatalogApis(page: Page) {
  await page.route("**/v1/courses?**", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify([]) });
  });
  await page.route("**/v1/programs?**", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify([]) });
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

function generatedFileBackedCourse() {
  return {
    title: "File Backed Macroeconomics Course",
    shortDescription: "A generated macroeconomics course grounded in uploaded source files.",
    difficultyLevel: "undergrad",
    category: "business-management",
    department: "economics",
    tags: ["macroeconomics", "files", "e2e"],
    sourceIds: ["input-source-1"],
    sourceRecords: [
      {
        id: "input-source-1",
        type: "document",
        title: "Uploaded macroeconomics notes",
        url: "artifact://file-macro-inflation",
      },
    ],
    metadata: { pacingLabel: "Module" },
    modules: [
      {
        id: "module-file-macroeconomics",
        title: "Module 1: File-backed macroeconomics",
        sourceIds: ["input-source-1"],
        sections: [
          {
            id: "file-backed-lesson",
            title: "Inflation from uploaded notes",
            pageType: "learn",
            sectionType: "lesson",
            sourceIds: ["input-source-1"],
            content: [
              {
                type: "text",
                heading: "Explanation",
                value: "Uploaded notes describe inflation as price-level reasoning grounded in price indexes.",
                sourceIds: ["input-source-1"],
              },
              {
                type: "conceptCards",
                title: "Concepts introduced",
                concepts: [
                  {
                    name: "Inflation",
                    description: "Quantitative price-level reasoning from index data.",
                    sourceSectionId: "file-backed-lesson",
                  },
                ],
                sourceIds: ["input-source-1"],
              },
            ],
          },
          {
            id: "file-backed-quiz",
            title: "Quiz: File-backed macroeconomics",
            pageType: "apply",
            sectionType: "assessment",
            sourceIds: ["input-source-1"],
            content: [
              {
                type: "quiz",
                sourceIds: ["input-source-1"],
                questions: Array.from({ length: 10 }, (_value, index) => ({
                  id: `q${index + 1}`,
                  question: `Which idea did the uploaded macroeconomics notes support? ${index + 1}`,
                  options: ["Inflation", "Typography", "Source maps", "Routing"],
                  answers: [0],
                })),
              },
            ],
          },
          {
            id: "file-backed-summary",
            title: "Module Summary: File-backed macroeconomics",
            pageType: "learn",
            sectionType: "summary",
            sourceIds: ["input-source-1"],
            content: [
              {
                type: "conceptCards",
                title: "Module concepts",
                concepts: [
                  {
                    name: "Inflation",
                    description: "Quantitative price-level reasoning from index data.",
                    sourceSectionId: "file-backed-lesson",
                  },
                ],
                sourceIds: ["input-source-1"],
              },
            ],
          },
        ],
      },
    ],
  };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test("uploaded files entered in the create-course UI reach course generation as input artifacts", async ({ page }) => {
  await mockQuietCatalogApis(page);
  await mockVerifiedAiConnection(page);

  const returnedArtifacts = [
    {
      id: "file-macro-inflation",
      kind: "text",
      filename: "inflation-notes.txt",
      title: "inflation-notes.txt",
      mimeType: "text/plain",
      sourceUrl: "",
      sourceDocumentUrl: "artifact://file-macro-inflation",
      extractedText: "Inflation notes covering price indexes and purchasing power.",
      extractionStatus: "extracted",
      extractionWarnings: [],
      textLength: 62,
      contentHash: "hash-inflation",
      reader: { contractVersion: "lycium-file-reader-v1", adapter: "lycium-local" },
    },
    {
      id: "file-macro-gdp",
      kind: "text",
      filename: "gdp-notes.txt",
      title: "gdp-notes.txt",
      mimeType: "text/plain",
      sourceUrl: "",
      sourceDocumentUrl: "artifact://file-macro-gdp",
      extractedText: "GDP notes covering output, income, and expenditure measures.",
      extractionStatus: "extracted",
      extractionWarnings: [],
      textLength: 58,
      contentHash: "hash-gdp",
      reader: { contractVersion: "lycium-file-reader-v1", adapter: "lycium-local" },
    },
    {
      id: "file-macro-unemployment",
      kind: "text",
      filename: "unemployment-notes.txt",
      title: "unemployment-notes.txt",
      mimeType: "text/plain",
      sourceUrl: "",
      sourceDocumentUrl: "artifact://file-macro-unemployment",
      extractedText: "Unemployment notes covering labor force measures and participation.",
      extractionStatus: "extracted",
      extractionWarnings: [],
      textLength: 64,
      contentHash: "hash-unemployment",
      reader: { contractVersion: "lycium-file-reader-v1", adapter: "lycium-local" },
    },
  ];
  let fileReaderPayload: { files?: Array<{ filename?: string; mimeType?: string; base64?: string }> } | null = null;
  let generationPayload: { input_artifacts?: unknown[]; source_urls?: string[] } | null = null;

  await page.route("**/v1/input-artifacts/read", async (route) => {
    fileReaderPayload = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        contractVersion: "lycium-file-reader-v1",
        provider: "lycium-local",
        replaceableBy: "infring-os-file-reader",
        artifactCount: returnedArtifacts.length,
        extractedArtifactCount: returnedArtifacts.length,
        artifacts: returnedArtifacts,
      }),
    });
  });
  await page.route("**/v1/agent/courses/jobs", async (route) => {
    generationPayload = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: 818181,
        status: "completed",
        progress: 1,
        message: "Course generated from uploaded file artifacts.",
        course_snapshot: {
          id: 818181,
          title: "File Backed Macroeconomics Course",
          status: "draft",
          generation_trace: { input_artifacts: returnedArtifacts },
          structure: generatedFileBackedCourse(),
        },
      }),
    });
  });

  await page.goto("/Lycium/catalog");
  await page.getByLabel("Settings").click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await page.getByRole("button", { name: /close settings/i }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create Course" });
  await expect(dialog).toBeVisible();
  await expect(page.getByPlaceholder("Describe the course you want to build...")).toBeEnabled();
  await page.getByPlaceholder("Describe the course you want to build...").fill("File backed macroeconomics course");
  await chooseDropdownOption(page, "College", "College of Business and Management");
  await chooseDropdownOption(page, "Department", "Economics");
  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "inflation-notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Inflation uses price indexes and purchasing power."),
    },
    {
      name: "gdp-notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("GDP measures output, income, and expenditure."),
    },
    {
      name: "unemployment-notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Unemployment uses labor force and participation measures."),
    },
  ]);

  await expect(page.getByText("inflation-notes.txt")).toBeVisible();
  await expect(page.getByText("gdp-notes.txt")).toBeVisible();
  await expect(page.getByText("unemployment-notes.txt")).toBeVisible();
  await dialog.getByRole("button", { name: /^Create course$/i }).click();

  await expect(page).toHaveURL(/\/Lycium\/courses\//);
  await expect(page.locator(".course-name")).toHaveText("File Backed Macroeconomics Course");
  const conceptStack = page.getByRole("region", { name: "Concepts introduced" });
  await expect(conceptStack).toBeVisible();
  await expect(conceptStack.getByRole("heading", { name: "Inflation" })).toBeVisible();
  expect(fileReaderPayload?.files?.map((file) => file.filename)).toEqual([
    "inflation-notes.txt",
    "gdp-notes.txt",
    "unemployment-notes.txt",
  ]);
  expect(fileReaderPayload?.files?.every((file) => file.mimeType === "text/plain" && Boolean(file.base64))).toBe(true);
  expect(generationPayload?.input_artifacts).toEqual(returnedArtifacts);
  expect(generationPayload?.source_urls).toEqual([]);
});

test("course creation submits mixed URL and file inputs to generation", async ({ page }) => {
  await mockQuietCatalogApis(page);
  await mockVerifiedAiConnection(page);

  const returnedArtifacts = [
    {
      id: "file-macro-data",
      kind: "text",
      filename: "macro-data-notes.txt",
      title: "macro-data-notes.txt",
      mimeType: "text/plain",
      sourceUrl: "",
      sourceDocumentUrl: "artifact://file-macro-data",
      extractedText: "Macroeconomics data notes covering GDP, inflation, and unemployment measures.",
      extractionStatus: "extracted",
      extractionWarnings: [],
      textLength: 82,
      contentHash: "hash-macro-data",
      reader: { contractVersion: "lycium-file-reader-v1", adapter: "lycium-local" },
    },
  ];
  const sourceUrls = ["https://example.edu/macroeconomics/syllabus", "https://openstax.org/books/principles-macroeconomics-3e"];
  let fileReaderPayload: { files?: Array<{ filename?: string; base64?: string }> } | null = null;
  let generationPayload: { input_artifacts?: unknown[]; source_urls?: string[] } | null = null;

  await page.route("**/v1/input-artifacts/read", async (route) => {
    fileReaderPayload = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        contractVersion: "lycium-file-reader-v1",
        provider: "lycium-local",
        replaceableBy: "infring-os-file-reader",
        artifactCount: returnedArtifacts.length,
        extractedArtifactCount: returnedArtifacts.length,
        artifacts: returnedArtifacts,
      }),
    });
  });
  await page.route("**/v1/agent/courses/jobs", async (route) => {
    generationPayload = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: 828282,
        status: "completed",
        progress: 1,
        message: "Course generated from mixed URL and file evidence.",
        course_snapshot: {
          id: 828282,
          title: "Mixed Input Macroeconomics Course",
          status: "draft",
          generation_trace: { input_artifacts: returnedArtifacts, source_urls: sourceUrls },
          structure: {
            ...generatedFileBackedCourse(),
            title: "Mixed Input Macroeconomics Course",
            shortDescription: "A generated macroeconomics course grounded in URLs and uploaded source files.",
          },
        },
      }),
    });
  });

  await page.goto("/Lycium/catalog");
  await page.getByLabel("Settings").click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await page.getByRole("button", { name: /close settings/i }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create Course" });
  await expect(dialog).toBeVisible();

  await page.getByPlaceholder("Describe the course you want to build...").fill("Mixed evidence macroeconomics course");
  await dialog.getByPlaceholder("https://example.com/source").first().fill(sourceUrls[0]);
  await dialog.getByRole("button", { name: /add another link/i }).click();
  await dialog.getByPlaceholder("https://example.com/source").nth(1).fill(sourceUrls[1]);
  await chooseDropdownOption(page, "College", "College of Business and Management");
  await chooseDropdownOption(page, "Department", "Economics");
  await page.locator('input[type="file"]').setInputFiles({
    name: "macro-data-notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Macroeconomics data notes covering GDP, inflation, and unemployment measures."),
  });
  await expect(page.getByText("macro-data-notes.txt")).toBeVisible();
  await dialog.getByRole("button", { name: /^Create course$/i }).click();

  await expect(page).toHaveURL(/\/Lycium\/courses\//);
  await expect(page.locator(".course-name")).toHaveText("Mixed Input Macroeconomics Course");
  expect(fileReaderPayload?.files?.map((file) => file.filename)).toEqual(["macro-data-notes.txt"]);
  expect(fileReaderPayload?.files?.every((file) => Boolean(file.base64))).toBe(true);
  expect(generationPayload?.source_urls).toEqual(sourceUrls);
  expect(generationPayload?.input_artifacts).toEqual(returnedArtifacts);
});
