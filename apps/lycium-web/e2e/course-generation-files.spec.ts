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
    title: "File Backed Chemistry Course",
    shortDescription: "A generated chemistry course grounded in uploaded source files.",
    difficultyLevel: "undergrad",
    category: "natural-sciences-mathematics",
    department: "chemistry",
    tags: ["chemistry", "files", "e2e"],
    sourceIds: ["input-source-1"],
    sourceRecords: [
      {
        id: "input-source-1",
        type: "document",
        title: "Uploaded chemistry notes",
        url: "artifact://file-chem-stoichiometry",
      },
    ],
    metadata: { pacingLabel: "Module" },
    modules: [
      {
        id: "module-file-chemistry",
        title: "Module 1: File-backed chemistry",
        sourceIds: ["input-source-1"],
        sections: [
          {
            id: "file-backed-lesson",
            title: "Stoichiometry from uploaded notes",
            pageType: "learn",
            sectionType: "lesson",
            sourceIds: ["input-source-1"],
            content: [
              {
                type: "text",
                heading: "Explanation",
                value: "Uploaded notes describe stoichiometry as mole-ratio reasoning grounded in balanced equations.",
                sourceIds: ["input-source-1"],
              },
              {
                type: "conceptCards",
                title: "Concepts introduced",
                concepts: [
                  {
                    name: "Stoichiometry",
                    description: "Quantitative mole-ratio reasoning from balanced chemical equations.",
                    sourceSectionId: "file-backed-lesson",
                  },
                ],
                sourceIds: ["input-source-1"],
              },
            ],
          },
          {
            id: "file-backed-quiz",
            title: "Quiz: File-backed chemistry",
            pageType: "apply",
            sectionType: "assessment",
            sourceIds: ["input-source-1"],
            content: [
              {
                type: "quiz",
                sourceIds: ["input-source-1"],
                questions: Array.from({ length: 10 }, (_value, index) => ({
                  id: `q${index + 1}`,
                  question: `Which idea did the uploaded chemistry notes support? ${index + 1}`,
                  options: ["Stoichiometry", "Typography", "Source maps", "Routing"],
                  answers: [0],
                })),
              },
            ],
          },
          {
            id: "file-backed-summary",
            title: "Module Summary: File-backed chemistry",
            pageType: "learn",
            sectionType: "summary",
            sourceIds: ["input-source-1"],
            content: [
              {
                type: "conceptCards",
                title: "Module concepts",
                concepts: [
                  {
                    name: "Stoichiometry",
                    description: "Quantitative mole-ratio reasoning from balanced chemical equations.",
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
      id: "file-chem-stoichiometry",
      kind: "text",
      filename: "stoichiometry-notes.txt",
      title: "stoichiometry-notes.txt",
      mimeType: "text/plain",
      sourceUrl: "",
      sourceDocumentUrl: "artifact://file-chem-stoichiometry",
      extractedText: "Stoichiometry notes covering mole ratios and limiting reagents.",
      extractionStatus: "extracted",
      extractionWarnings: [],
      textLength: 62,
      contentHash: "hash-stoichiometry",
      reader: { contractVersion: "lycium-file-reader-v1", adapter: "lycium-local" },
    },
    {
      id: "file-chem-equilibrium",
      kind: "text",
      filename: "equilibrium-notes.txt",
      title: "equilibrium-notes.txt",
      mimeType: "text/plain",
      sourceUrl: "",
      sourceDocumentUrl: "artifact://file-chem-equilibrium",
      extractedText: "Equilibrium notes covering equilibrium constants.",
      extractionStatus: "extracted",
      extractionWarnings: [],
      textLength: 48,
      contentHash: "hash-equilibrium",
      reader: { contractVersion: "lycium-file-reader-v1", adapter: "lycium-local" },
    },
    {
      id: "file-chem-titration",
      kind: "text",
      filename: "titration-notes.txt",
      title: "titration-notes.txt",
      mimeType: "text/plain",
      sourceUrl: "",
      sourceDocumentUrl: "artifact://file-chem-titration",
      extractedText: "Titration notes covering concentration and endpoint evidence.",
      extractionStatus: "extracted",
      extractionWarnings: [],
      textLength: 58,
      contentHash: "hash-titration",
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
          title: "File Backed Chemistry Course",
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
  await page.getByRole("button", { name: /^Create Course$/i }).click();
  const dialog = page.getByRole("dialog", { name: "Create Course" });
  await expect(dialog).toBeVisible();
  await expect(page.getByPlaceholder("Describe the course you want to build...")).toBeEnabled();
  await page.getByPlaceholder("Describe the course you want to build...").fill("File backed chemistry course");
  await chooseDropdownOption(page, "College", "College of Natural Sciences and Mathematics");
  await chooseDropdownOption(page, "Department", "Chemistry");
  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "stoichiometry-notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Stoichiometry uses mole ratios and limiting reagents."),
    },
    {
      name: "equilibrium-notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Equilibrium constants describe reaction balance."),
    },
    {
      name: "titration-notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Titration uses concentration and endpoint evidence."),
    },
  ]);

  await expect(page.getByText("stoichiometry-notes.txt")).toBeVisible();
  await expect(page.getByText("equilibrium-notes.txt")).toBeVisible();
  await expect(page.getByText("titration-notes.txt")).toBeVisible();
  await dialog.getByRole("button", { name: /^Create course$/i }).click();

  await expect(page).toHaveURL(/\/Lycium\/courses\//);
  await expect(page.locator(".course-name")).toHaveText("File Backed Chemistry Course");
  expect(fileReaderPayload?.files?.map((file) => file.filename)).toEqual([
    "stoichiometry-notes.txt",
    "equilibrium-notes.txt",
    "titration-notes.txt",
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
      id: "file-chem-lab",
      kind: "text",
      filename: "chem-lab-notes.txt",
      title: "chem-lab-notes.txt",
      mimeType: "text/plain",
      sourceUrl: "",
      sourceDocumentUrl: "artifact://file-chem-lab",
      extractedText: "General chemistry lab notes covering safety, titration, and measurement uncertainty.",
      extractionStatus: "extracted",
      extractionWarnings: [],
      textLength: 82,
      contentHash: "hash-lab",
      reader: { contractVersion: "lycium-file-reader-v1", adapter: "lycium-local" },
    },
  ];
  const sourceUrls = ["https://example.edu/chem105/syllabus", "https://openstax.org/books/chemistry-2e"];
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
          title: "Mixed Input Chemistry Course",
          status: "draft",
          generation_trace: { input_artifacts: returnedArtifacts, source_urls: sourceUrls },
          structure: {
            ...generatedFileBackedCourse(),
            title: "Mixed Input Chemistry Course",
            shortDescription: "A generated chemistry course grounded in URLs and uploaded source files.",
          },
        },
      }),
    });
  });

  await page.goto("/Lycium/catalog");
  await page.getByLabel("Settings").click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await page.getByRole("button", { name: /close settings/i }).click();
  await page.getByRole("button", { name: /^Create Course$/i }).click();
  const dialog = page.getByRole("dialog", { name: "Create Course" });
  await expect(dialog).toBeVisible();

  await page.getByPlaceholder("Describe the course you want to build...").fill("Mixed evidence chemistry course");
  await dialog.getByPlaceholder("https://example.com/source").first().fill(sourceUrls[0]);
  await dialog.getByRole("button", { name: /add another link/i }).click();
  await dialog.getByPlaceholder("https://example.com/source").nth(1).fill(sourceUrls[1]);
  await chooseDropdownOption(page, "College", "College of Natural Sciences and Mathematics");
  await chooseDropdownOption(page, "Department", "Chemistry");
  await page.locator('input[type="file"]').setInputFiles({
    name: "chem-lab-notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("General chemistry lab notes covering safety, titration, and measurement uncertainty."),
  });
  await expect(page.getByText("chem-lab-notes.txt")).toBeVisible();
  await dialog.getByRole("button", { name: /^Create course$/i }).click();

  await expect(page).toHaveURL(/\/Lycium\/courses\//);
  await expect(page.locator(".course-name")).toHaveText("Mixed Input Chemistry Course");
  expect(fileReaderPayload?.files?.map((file) => file.filename)).toEqual(["chem-lab-notes.txt"]);
  expect(fileReaderPayload?.files?.every((file) => Boolean(file.base64))).toBe(true);
  expect(generationPayload?.source_urls).toEqual(sourceUrls);
  expect(generationPayload?.input_artifacts).toEqual(returnedArtifacts);
});
