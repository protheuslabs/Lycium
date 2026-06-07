import { expect, test } from "@playwright/test";

const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "[role='button']",
  "[role='checkbox']",
  "[role='combobox']",
  "[role='link']",
  "[role='radio']",
  "[role='searchbox']",
  "[role='textbox']",
].join(",");

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

test("visible interactive catalog controls expose accessible names", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/Lycium/catalog");

  await expect(page.getByRole("button", { name: /create course/i })).toBeVisible();

  const unnamedControls = await page.locator(INTERACTIVE_SELECTOR).evaluateAll((nodes) => {
    function isVisible(element: Element) {
      const htmlElement = element as HTMLElement;
      const style = window.getComputedStyle(htmlElement);
      const rect = htmlElement.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    }

    function accessibleName(element: Element) {
      const input = element as HTMLInputElement;
      return (
        element.getAttribute("aria-label") ||
        element.getAttribute("aria-labelledby") ||
        element.getAttribute("title") ||
        input.placeholder ||
        input.value ||
        element.textContent ||
        ""
      ).trim();
    }

    return nodes
      .filter((node) => isVisible(node) && !node.hasAttribute("disabled") && accessibleName(node).length === 0)
      .map((node) => {
        const htmlElement = node as HTMLElement;
        return `${htmlElement.tagName.toLowerCase()}${htmlElement.id ? `#${htmlElement.id}` : ""}`;
      });
  });

  expect(unnamedControls).toEqual([]);
});

test("primary dialogs keep modal semantics under keyboard navigation", async ({ page }) => {
  await page.goto("/Lycium/catalog");

  await page.keyboard.press("Tab");
  await expect.poll(async () => page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");

  const createCourseButton = page.getByRole("button", { name: /^Create Course$/i }).first();
  await expect(createCourseButton).toBeVisible();
  await createCourseButton.click({ force: true });
  await expect(page.getByRole("dialog", { name: "Create Course" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Create Course" })).toHaveCount(0);

  await page.getByLabel("Settings").click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Settings" })).toHaveCount(0);
});
