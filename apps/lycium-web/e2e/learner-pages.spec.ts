import { expect, test } from "@playwright/test";
import { mockLocalUiApi } from "./fixtures/localUiApi";
import { buildEmptyLocalProgramDraft, buildEmptyRequirementGroupDraft } from "../src/utils/programDraftBuilders";

const activeTitle = "A Long Course Title About Evidence, Reasoning, and the Practice of Learning";
const completedTitle = "Understanding Economic Decisions";
const freshTitle = "A New Subject to Explore";

function makeCourse(key: string, title: string, category = "natural-sciences-mathematics") {
  return {
    key,
    title,
    source: "local",
    status: "published",
    data: {
      title,
      category,
      shortDescription:
        "A course fixture with real structure and independently stored learning progress.",
      metadata: { editPolicy: { editable: false } },
      modules: [
        {
          id: "shared-module",
          title: "Module 1: Foundations",
          sections: [
            {
              id: "shared-one",
              title: "First lesson",
              content: [{ type: "text", value: "An introductory explanation." }],
            },
            {
              id: "shared-two",
              title: "Applying the ideas",
              content: [
                { type: "text", value: "Practice connects an explanation to a concrete task." },
              ],
            },
            {
              id: "shared-three",
              title: "Bringing it together",
              content: [{ type: "text", value: "A concluding lesson." }],
            },
          ],
        },
      ],
    },
  };
}

test.beforeEach(async ({ page }) => {
  await mockLocalUiApi(page);
  await page.addInitScript(
    ({ activeTitle, courses }) => {
      if (sessionStorage.getItem("learner-pages-seeded")) return;
      localStorage.clear();
      localStorage.setItem("lycium-theme-mode", "light");
      localStorage.setItem("lycium-local-course-drafts", JSON.stringify(courses));
      localStorage.setItem(
        "lycium-progress-active",
        JSON.stringify({ completedSectionIds: ["shared-one"], sectionStatuses: {} }),
      );
      localStorage.setItem(
        "lycium-bookmark-active",
        JSON.stringify({
          course_key: "active",
          course_title: activeTitle,
          section_id: "shared-two",
          path: "/outdated/path",
        }),
      );
      localStorage.setItem(
        "lycium-progress-completed",
        JSON.stringify({
          completedSectionIds: ["shared-one", "shared-two", "shared-three"],
          sectionStatuses: {},
        }),
      );
      sessionStorage.setItem("learner-pages-seeded", "1");
    },
    {
      activeTitle,
      courses: [
        makeCourse("active", activeTitle),
        makeCourse("completed", completedTitle, "business-management"),
        makeCourse("fresh", freshTitle),
      ],
    },
  );
});

test("login entry explains availability and offers a real local-learning path", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 750 });
  await page.goto("/Lycium/");
  const trigger = page.getByRole("button", { name: "Log in", exact: true });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Log in", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Account sign-in is not available yet.");
  await expect(dialog.getByRole("textbox")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole("link", { name: "Continue without an account" }).click();
  await expect(page).toHaveURL(/\/my-learning$/);
  await expect(page.getByRole("heading", { name: "My Learning", level: 1 })).toBeVisible();
});

test("home is a distinct destination with a loaded image, course discovery, and dashboard navigation", async ({
  page,
}, info) => {
  const imageLoaded = page.waitForResponse(
    (response) => /\/learning-world\.[^/]+\.webp/.test(response.url()) && response.ok(),
  );
  await page.goto("/Lycium/");
  await expect(page.getByRole("heading", { name: "Lycium", level: 1, exact: true })).toBeVisible();
  await imageLoaded;
  await expect(
    page.getByRole("button", { name: `Resume ${activeTitle}`, exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator(".home-course-grid .learning-course-card")).toHaveCount(3);
  await page.getByLabel("Filter home courses by subject").selectOption("business-management");
  await expect(page.locator(".home-course-grid .learning-course-card")).toHaveCount(1);
  await expect(page.locator(".home-course-grid")).toContainText(completedTitle);
  await page.getByLabel("Filter home courses by subject").selectOption("all");
  for (const width of [320, 390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      await page
        .locator(".learner-page-shell")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    const nextSection = await page.locator(".home-continue").boundingBox();
    expect(nextSection!.y).toBeLessThan(900);
  }
  await page.screenshot({ path: info.outputPath("home-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath("home-mobile.png") });
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "My Learning", exact: true })
    .click();
  await expect(page).toHaveURL(/\/my-learning$/);
  await expect(page.getByRole("heading", { name: "My Learning", level: 1 })).toBeVisible();
});

test("dashboard leads with a saved lesson and filters course-scoped progress without KPIs", async ({ page }, info) => {
  await page.goto("/Lycium/my-learning");
  await expect(page.locator(".learning-stats")).toHaveCount(0);
  await expect(page.locator(".continue-learning")).toContainText("Applying the ideas");
  await expect(page.locator(".learning-course-card")).toHaveCount(1);
  await expect(page.locator(".learning-course-card")).toContainText("1 of 3 sections complete");
  await expect(page.locator(".learning-course-card")).toContainText("Applying the ideas");
  await expect(page.locator(".learning-course-card")).not.toContainText(freshTitle);
  await page.getByRole("searchbox", { name: "Search your courses" }).fill("not a course");
  await expect(page.getByRole("heading", { name: "No matching courses" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search your courses" }).fill("");
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `Review ${completedTitle}`, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".learning-course-card")).toContainText("100%");
  await page.getByRole("button", { name: "In progress", exact: true }).click();
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page
        .locator(".learner-page-shell")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
  }
  await page.screenshot({ path: info.outputPath("dashboard-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath("dashboard-mobile.png") });
});

test("resume opens the saved section and returns updated progress to the dashboard", async ({
  page,
}) => {
  await page.goto("/Lycium/my-learning");
  await page.getByRole("button", { name: `Resume ${activeTitle}`, exact: true }).first().click();
  await expect(page).toHaveURL(/\/units\/applying-the-ideas-shared-two$/);
  await expect(page.getByRole("heading", { name: "Applying the ideas", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Mark section complete", exact: true }).click();
  await page.getByRole("link", { name: "My Learning", exact: true }).click();
  await expect(page.locator(".learning-course-card")).toContainText("2 of 3 sections complete");
  await page.reload();
  await expect(page.locator(".learning-course-card")).toContainText("2 of 3 sections complete");
});

test("browsing home and catalog does not start courses or mark lessons viewed", async ({
  page,
}) => {
  await page.goto("/Lycium/");
  await page.getByRole("link", { name: "Course catalog", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catalog", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "My Learning", exact: true }).click();
  await expect(page.locator(".learning-course-card")).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem("lycium-progress-fresh"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("lycium-bookmark-fresh"))).toBeNull();
});

test("dashboard has honest empty and dark-mode states", async ({ page }, info) => {
  await page.goto("/Lycium/my-learning");
  await page.evaluate(() => {
    for (const key of [
      "lycium-progress-active",
      "lycium-bookmark-active",
      "lycium-progress-completed",
    ])
      localStorage.removeItem(key);
  });
  await page.reload();
  await expect(page.locator(".learning-course-card")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Find your first course" })).toBeVisible();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("radio", { name: "Dark mode", exact: true }).click();
  await page.getByRole("button", { name: "Close Settings", exact: true }).click();
  await expect(page).toHaveURL(/\/my-learning$/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByText("Progress saved on this device", { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("dashboard-empty-dark.png") });
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lycium", level: 1, exact: true })).toBeVisible();
});

test("course overview reveals curriculum without starting the course, then starts the selected lesson", async ({ page }, info) => {
  await page.goto("/Lycium/");
  await page.getByRole("link", { name: freshTitle, exact: true }).click();
  await expect(page.getByRole("heading", { name: freshTitle, level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Course curriculum" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("lycium-progress-fresh"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("lycium-bookmark-fresh"))).toBeNull();
  await page.locator(".course-artwork img").evaluate((image: HTMLImageElement) => image.decode());
  for (const width of [320, 390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.locator(".learner-page-shell").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  await page.screenshot({ path: info.outputPath("course-overview-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath("course-overview-mobile.png") });
  await page.getByRole("button", { name: "1.2 Applying the ideas" }).click();
  await expect(page).toHaveURL(/\/units\/applying-the-ideas-shared-two$/);
  await expect(page.getByRole("heading", { name: "Applying the ideas", level: 1 })).toBeVisible();
});

test("ordered curriculum keeps later sections locked until prior work is completed", async ({ page }) => {
  await page.addInitScript(() => {
    const courses = JSON.parse(localStorage.getItem("lycium-local-course-drafts") ?? "[]");
    for (const course of courses) if (course.key === "fresh") course.data.orderMandatory = true;
    localStorage.setItem("lycium-local-course-drafts", JSON.stringify(courses));
  });
  await page.goto("/Lycium/catalog");
  await page.getByRole("button", { name: `Open ${freshTitle}`, exact: true }).click();
  await expect(page.getByRole("button", { name: "1.2 Applying the ideas Locked" })).toBeDisabled();
  await page.getByRole("button", { name: "Start course", exact: true }).click();
  await page.getByRole("button", { name: "Mark section complete", exact: true }).click();
  await page.getByRole("link", { name: freshTitle, exact: true }).click();
  await expect(page.getByRole("button", { name: "1.2 Applying the ideas", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "1.3 Bringing it together Locked" })).toBeDisabled();
});

test("subject-specific covers load from course metadata", async ({ page }, info) => {
  await page.goto("/Lycium/catalog");
  const subjects = [
    { id: "computing", title: "Programming Foundations", category: "computing-information-sciences", department: "computer-science" },
    { id: "finance", title: "Markets and Decisions", category: "business-management", department: "finance" },
    { id: "chemistry", title: "Molecules and Reactions", category: "natural-sciences-mathematics", department: "chemistry" },
    { id: "engineering", title: "Structures in Equilibrium", category: "computing-information-sciences", department: "mechanical-engineering" },
  ];
  await page.evaluate((fixtures) => {
    const courses = JSON.parse(localStorage.getItem("lycium-local-course-drafts") ?? "[]");
    localStorage.setItem("lycium-local-course-drafts", JSON.stringify([...courses, ...fixtures]));
  }, subjects.map((subject) => ({ ...makeCourse(subject.id, subject.title, subject.category), data: { ...makeCourse(subject.id, subject.title, subject.category).data, department: subject.department } })));
  await page.reload();
  for (const subject of subjects) {
    await page.getByRole("searchbox", { name: "Search courses", exact: true }).fill(subject.title);
    const card = page.locator(".course-card").filter({ has: page.getByRole("button", { name: `Open ${subject.title}`, exact: true }) });
    await expect(card.locator("img")).toHaveAttribute("src", new RegExp(`/${subject.id}\\.[^/]+\\.webp`));
    await card.locator("img").evaluate((image: HTMLImageElement) => image.decode());
    await page.screenshot({ path: info.outputPath(`${subject.id}-artwork.png`) });
  }
  await page.screenshot({ path: info.outputPath("subject-artwork.png") });
});

test("program presentation puts the learning path ahead of collapsed diagnostics", async ({ page }, info) => {
  const program = { ...buildEmptyLocalProgramDraft("Learning and Practice"), id: "visual-program" };
  const cluster = { ...buildEmptyRequirementGroupDraft(program, "Foundations"), id: "foundation" };
  cluster.requirements = [{ id: "course-one", type: "complete_course", courseId: "active", title: "Develop foundational understanding" }];
  program.requirementGroups = [cluster];
  await page.goto("/Lycium/");
  await page.evaluate((fixture) => localStorage.setItem("lycium-local-program-drafts", JSON.stringify([fixture])), program);
  await page.goto("/Lycium/programs/learning-and-practice-visual-program");
  await expect(page.getByRole("heading", { name: "Learning and Practice", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Learning path", exact: true })).toBeVisible();
  await expect(page.locator(".program-quality-panel")).not.toBeVisible();
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.locator(".program-view-shell").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  await page.getByText("Program details", { exact: true }).click();
  await expect(page.locator(".program-quality-panel")).toBeVisible();
  await page.screenshot({ path: info.outputPath("program-details.png") });
});
