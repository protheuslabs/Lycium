import type { Page } from "@playwright/test";

// Presentation tests must not reach real provider settings or generation jobs.
export async function mockLocalUiApi(page: Page) {
  await page.route("**/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith("/settings")
      ? { agent_keys: [] }
      : path.includes("/completion")
        ? { completed_section_ids: [], section_statuses: {} }
        : path.includes("/bookmarks")
          ? null
          : path.endsWith("/learners")
            ? { id: 90001 }
            : [];
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  });
}
