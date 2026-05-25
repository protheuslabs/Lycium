import { COURSE_CATALOG_PATH } from "./courseRouting";

const LAST_CONTENT_PATH_STORAGE_KEY = "lycium-last-content-path";

export function readSettingsBackdropPath() {
  if (typeof window === "undefined") {
    return COURSE_CATALOG_PATH;
  }

  try {
    return window.sessionStorage.getItem(LAST_CONTENT_PATH_STORAGE_KEY) || COURSE_CATALOG_PATH;
  } catch {
    return COURSE_CATALOG_PATH;
  }
}

export function writeSettingsBackdropPath(path: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(LAST_CONTENT_PATH_STORAGE_KEY, path);
  } catch {
    // Session storage is best-effort state for the modal backdrop only.
  }
}
