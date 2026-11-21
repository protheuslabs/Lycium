import { expect, test, type Page } from "@playwright/test";
import { mockLocalUiApi } from "./fixtures/localUiApi";
import { openSiteSettings } from "./fixtures/siteNavigation";
import { buildEmptyLocalProgramDraft, buildEmptyRequirementGroupDraft } from "../src/utils/programDraftBuilders";

const activeTitle = "A Long Course Title About Evidence, Reasoning, and the Practice of Learning";
const completedTitle = "Understanding Economic Decisions";
const freshTitle = "A New Subject to Explore";

async function followPrimaryNavigation(page: Page, name: string) {
  const menu = page.getByRole("button", { name: "Open navigation", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("navigation", { name: "Primary navigation", exact: true }).getByRole("link", { name, exact: true }).click();
}

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
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
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
  await followPrimaryNavigation(page, "My Learning");
  await expect(page.locator(".learning-course-card")).toContainText("2 of 3 sections complete");
  await page.reload();
  await expect(page.locator(".learning-course-card")).toContainText("2 of 3 sections complete");
});

test("browsing home and catalog does not start courses or mark lessons viewed", async ({
  page,
}) => {
  await page.goto("/Lycium/");
  await followPrimaryNavigation(page, "Course catalog");
  await expect(page.getByRole("heading", { name: "Catalog", level: 1 })).toBeVisible();
  await followPrimaryNavigation(page, "My Learning");
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
  await openSiteSettings(page);
  await page.getByRole("radio", { name: "Dark mode", exact: true }).click();
  await page.getByRole("button", { name: "Close Settings", exact: true }).click();
  await expect(page).toHaveURL(/\/my-learning$/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByText("Progress saved on this device", { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("dashboard-empty-dark.png") });
  await page.locator(".top-bar").getByRole("link", { name: "Lycium home", exact: true }).click();
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
  await page.goto("/Lycium/catalog");
  await page.getByRole("button", { name: "Select catalog view level" }).click();
  await page.getByRole("option", { name: "Programs", exact: true }).click();
  const programCard = page.locator(".program-showcase-card").filter({ hasText: "Learning and Practice" }).first();
  await expect(programCard.locator(".catalog-authoring-content")).not.toBeVisible();
  await programCard.locator("summary").click();
  await expect(programCard.locator(".catalog-authoring-content")).toBeVisible();
  await expect(page).toHaveURL(/\/catalog\/programs$/);
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

test("catalog prerequisites retain an independent accessible action", async ({ page }) => {
  await page.goto("/Lycium/");
  await page.evaluate(() => {
    const courses = JSON.parse(localStorage.getItem("lycium-local-course-drafts")!);
    courses.find((course: { key: string }) => course.key === "fresh").data.prerequisites = [
      { type: "course", courseId: "active", title: "Foundational study" },
    ];
    localStorage.setItem("lycium-local-course-drafts", JSON.stringify(courses));
  });
  await page.goto("/Lycium/catalog");
  const card = page.locator(".course-tile").filter({ has: page.getByRole("heading", { name: freshTitle, exact: true }) });
  await expect(card.getByRole("button", { name: `Open ${freshTitle}`, exact: true })).toBeDisabled();
  await card.getByRole("button", { name: "Requires 1 course", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: freshTitle, exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Foundational study", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search courses", exact: true })).toHaveValue("Foundational study");
});

test("course cards share presentation across learner pages and retain catalog actions", async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const presentations = [];
  for (const route of ["/Lycium/", "/Lycium/my-learning", "/Lycium/catalog"]) {
    await page.goto(route);
    const card = page.locator(".course-tile").filter({ has: page.getByRole("heading", { name: activeTitle, exact: true }) }).first();
    await expect(card).toBeVisible();
    presentations.push(await card.evaluate((element) => {
      const style = getComputedStyle(element);
      const heading = getComputedStyle(element.querySelector("h3")!);
      return { radius: style.borderRadius, surface: style.backgroundColor, title: heading.fontSize };
    }));
  }
  expect(presentations[1]).toEqual(presentations[0]);
  expect(presentations[2]).toEqual(presentations[0]);
  const card = page.locator(".course-tile").filter({ has: page.getByRole("heading", { name: activeTitle, exact: true }) }).first();
  await card.getByRole("button", { name: `More info about ${activeTitle}`, exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/\/catalog$/);
  await page.keyboard.press("Escape");
  for (const theme of ["light", "dark"]) {
    await page.evaluate((mode) => { localStorage.setItem("lycium-theme-mode", mode); }, theme);
    await page.reload();
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.locator(".catalog-shell").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      if (width === 390) {
        await page.screenshot({ path: info.outputPath(`shared-catalog-${theme}-mobile.png`) });
      }
    }
    await page.screenshot({ path: info.outputPath(`shared-catalog-${theme}.png`) });
  }
  await page.getByRole("button", { name: `Open ${activeTitle}`, exact: true }).click();
  await expect(page.getByRole("heading", { name: activeTitle, level: 1 })).toBeVisible();
});

test("course fit and outcomes are inspectable without entering a lesson", async ({ page }, info) => {
  await page.goto("/Lycium/");
  await page.evaluate(() => {
    const courses = JSON.parse(localStorage.getItem("lycium-local-course-drafts")!);
    const course = courses.find((item: { key: string }) => item.key === "fresh");
    course.data.difficultyLevel = "Introductory";
    course.data.estimatedMinutes = 45;
    course.data.metadata.courseTemplate = {
      learningOutcomes: [
        { outcome: "Distinguish a supported explanation from an unsupported claim." },
        { outcome: "Apply a method to a new example and explain the result." },
        { outcome: "Evaluate a conclusion using relevant evidence." },
        { outcome: "Communicate a reasoned solution clearly." },
      ],
      description: "Private instruction: write a lesson about this.",
    };
    course.data.modules.push({ id: "practice", title: "Module 2: Practice and reflection", sections: [
      { id: "quiz", title: "Check your understanding", content: [{ type: "quiz", questions: [] }] },
      { id: "project", title: "Independent investigation", content: [{ type: "project", instructions: "Complete an investigation." }] },
    ] });
    localStorage.setItem("lycium-local-course-drafts", JSON.stringify(courses));
  });
  await page.goto("/Lycium/catalog");
  await page.getByRole("button", { name: `Open ${freshTitle}`, exact: true }).click();
  const outcomes = page.getByRole("region", { name: "What you'll learn", exact: true });
  await expect(outcomes.getByRole("listitem")).toHaveCount(4);
  await expect(page.locator(".overview-facts")).toContainText("~45 min");
  await expect(page.locator(".overview-facts")).toContainText("1 quiz · 1 project");
  await expect(page.locator(".overview-facts")).toContainText("Introductory");
  await expect(page.getByText("Private instruction:", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Expand all", exact: true }).click();
  await expect(page.locator(".overview-module[open]")).toHaveCount(2);
  await page.getByRole("button", { name: "Collapse all", exact: true }).click();
  await expect(page.locator(".overview-module[open]")).toHaveCount(0);
  await page.getByRole("link", { name: "Curriculum", exact: true }).click();
  await expect(page).toHaveURL(/#curriculum$/);
  expect(await page.evaluate(() => localStorage.getItem("lycium-progress-fresh"))).toBeNull();
  for (const theme of ["light", "dark"]) {
    await page.evaluate((mode) => localStorage.setItem("lycium-theme-mode", mode), theme);
    await page.reload();
    await page.getByRole("link", { name: "Overview", exact: true }).click();
    for (const width of [320, 390, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.locator(".learner-page-shell").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      if (width === 390 || width === 1280) await page.screenshot({ path: info.outputPath(`course-fit-${theme}-${width}.png`) });
    }
  }
});

test("site search opens shareable catalog results and supports a second search", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/Lycium/my-learning");
  const header = page.locator(".top-bar");
  await header.getByRole("searchbox", { name: "Search all courses", exact: true }).fill(completedTitle);
  await header.getByRole("button", { name: "Submit course search", exact: true }).click();
  await expect(page).toHaveURL(/\/catalog\?q=/);
  await expect(page.getByRole("searchbox", { name: "Search courses", exact: true })).toHaveValue(completedTitle);
  await expect(page.locator(".course-tile")).toHaveCount(1);
  await expect(page.locator(".course-tile")).toContainText(completedTitle);
  await page.reload();
  await expect(page.locator(".course-tile")).toHaveCount(1);
  await header.getByRole("searchbox", { name: "Search all courses", exact: true }).fill(freshTitle);
  await header.getByRole("button", { name: "Submit course search", exact: true }).click();
  await expect(page.getByRole("searchbox", { name: "Search courses", exact: true })).toHaveValue(freshTitle);
  await expect(page.locator(".course-tile")).toHaveCount(1);
  await expect(page.locator(".course-tile")).toContainText(freshTitle);
});

test("login is a quiet text action and settings uses the utility disclosure", async ({ page }, info) => {
  await page.goto("/Lycium/");
  const login = page.getByRole("button", { name: "Log in", exact: true });
  await expect(login.locator("svg")).toHaveCount(0);
  await expect(login).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(login).toHaveCSS("border-top-width", "0px");
  const trigger = page.getByRole("button", { name: "More options", exact: true });
  const options = page.getByRole("navigation", { name: "Site options", exact: true });
  await expect(options).not.toBeVisible();
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  await expect(options.getByRole("link", { name: "Settings", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(options).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.screenshot({ path: info.outputPath("login-and-settings.png") });
  await page.locator(".learner-hero-description").click();
  await expect(options).not.toBeVisible();
  await openSiteSettings(page);
  await expect(options).not.toBeVisible();
  await expect(page.getByRole("dialog", { name: "Settings", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close Settings", exact: true }).click();
  await expect(trigger).toBeFocused();
});

test("mobile navigation and search dialogs dismiss and restore focus", async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/Lycium/");
  const trigger = page.getByRole("button", { name: "Open navigation", exact: true });
  await trigger.click();
  const menu = page.getByRole("dialog", { name: "Navigation", exact: true });
  await expect(menu.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Escape");
  await expect(menu).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.mouse.click(2, 700);
  await expect(menu).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.screenshot({ path: info.outputPath("mobile-navigation.png") });
  await menu.getByRole("link", { name: "My Learning", exact: true }).click();
  await expect(page).toHaveURL(/\/my-learning$/);
  await expect(menu).not.toBeVisible();
  const searchTrigger = page.getByRole("button", { name: "Search courses", exact: true });
  await searchTrigger.click();
  const search = page.getByRole("dialog", { name: "Find a course", exact: true });
  await expect(search.getByRole("searchbox")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(searchTrigger).toBeFocused();
  await searchTrigger.click();
  await search.getByRole("searchbox").fill(completedTitle);
  await search.getByRole("button", { name: "Submit course search", exact: true }).click();
  await expect(page.locator(".course-tile")).toHaveCount(1);
  await expect(page.locator(".course-tile")).toContainText(completedTitle);
});

test("site chrome reflows and the footer exposes real destinations", async ({ page }, info) => {
  await page.goto("/Lycium/");
  const footer = page.getByRole("contentinfo", { name: "Site footer", exact: true });
  await expect(footer.getByRole("navigation", { name: "Learn", exact: true })).toBeAttached();
  await expect(footer.getByRole("link", { name: "Lycium GitHub repository", exact: true })).toHaveAttribute("rel", "noopener noreferrer");
  for (const theme of ["light", "dark"]) {
    await page.evaluate((mode) => localStorage.setItem("lycium-theme-mode", mode), theme);
    await page.reload();
    for (const width of [320, 390, 768, 900, 1024, 1101, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.locator(".top-bar").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      expect(await footer.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      const pieces = page.locator(".top-bar-title, .top-bar-navigation, .top-bar-search, .top-bar-actions");
      const boxes = await pieces.evaluateAll((elements) => elements.filter((element) => getComputedStyle(element).display !== "none").map((element) => {
        const box = element.getBoundingClientRect(); return { left: box.left, right: box.right };
      }));
      for (let index = 1; index < boxes.length; index += 1) expect(boxes[index].left).toBeGreaterThanOrEqual(boxes[index - 1].right);
      if (width === 390 || width === 1280) {
        await page.screenshot({ path: info.outputPath(`header-${theme}-${width}.png`) });
        await footer.scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath(`footer-${theme}-${width}.png`) });
        await page.locator(".learner-home h1").scrollIntoViewIfNeeded();
      }
    }
  }
  await footer.getByRole("link", { name: "Privacy Policy", exact: true }).click();
  await expect(page).toHaveURL(/\/legal\/privacy$/);
  await expect(page.locator("#main-content")).toBeVisible();
});
