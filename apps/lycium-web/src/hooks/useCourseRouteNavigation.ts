import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { CourseEntry, CourseSection } from "../courseTypes";
import { browserStorage, localApiSyncEnabled, lyciumApi, scrollCoursePageToTop } from "../runtime/appRuntime";
import {
  browserPathForRoute,
  findBookmarkedSection,
  getCoursePath,
  getCourseSectionIndex,
  getCourseSectionPath,
  getFirstCourseSection,
} from "../utils/courseRouting";

type RouterLike = {
  push: (path: string) => void;
  replace: (path: string) => void;
};

type UseCourseRouteNavigationArgs = {
  router: RouterLike;
  currentPathRef: MutableRefObject<string>;
  setCurrentCourseKey: Dispatch<SetStateAction<string>>;
  setCurrentSectionIndex: Dispatch<SetStateAction<number>>;
};

export function useCourseRouteNavigation({
  router,
  currentPathRef,
  setCurrentCourseKey,
  setCurrentSectionIndex,
}: UseCourseRouteNavigationArgs) {
  const rememberCourseSection = useCallback((course: CourseEntry, section: CourseSection, path: string) => {
    const bookmark = {
      course_key: course.key,
      course_title: course.title,
      section_id: section.id,
      section_title: section.title,
      path,
    };
    browserStorage.writeBookmark(course.key, bookmark);
    if (localApiSyncEnabled) {
      lyciumApi.saveBookmark(bookmark).catch((err) => console.warn("Failed to save course bookmark:", err));
    }
  }, []);

  const pushSectionPath = useCallback(
    (course: CourseEntry, section: CourseSection, replace = false) => {
      const nextPath = getCourseSectionPath(course, section);
      if (currentPathRef.current !== nextPath) {
        if (typeof window !== "undefined") {
          window.history[replace ? "replaceState" : "pushState"](null, "", browserPathForRoute(nextPath));
        } else if (replace) {
          router.replace(nextPath);
        } else {
          router.push(nextPath);
        }
      }
      currentPathRef.current = nextPath;
      rememberCourseSection(course, section, nextPath);
      scrollCoursePageToTop();
    },
    [currentPathRef, rememberCourseSection, router],
  );

  const openCourseByEntry = useCallback(
    async (course: CourseEntry, replace = false) => {
      setCurrentCourseKey(course.key);
      let targetSection = findBookmarkedSection(course, browserStorage.readBookmark(course.key));
      if (!targetSection && localApiSyncEnabled) {
        try {
          targetSection = findBookmarkedSection(course, await lyciumApi.loadBookmark(course.key));
        } catch (err) {
          console.warn("Local bookmark unavailable:", err);
        }
      }

      const sectionToOpen = targetSection ?? getFirstCourseSection(course);
      if (sectionToOpen) {
        const sectionIndex = getCourseSectionIndex(course, sectionToOpen);
        setCurrentSectionIndex(sectionIndex >= 0 ? sectionIndex : 0);
        pushSectionPath(course, sectionToOpen, replace);
        return;
      }

      const nextPath = getCoursePath(course);
      if (typeof window !== "undefined") {
        window.history[replace ? "replaceState" : "pushState"](null, "", browserPathForRoute(nextPath));
      } else if (replace) {
        router.replace(nextPath);
      } else {
        router.push(nextPath);
      }
      currentPathRef.current = nextPath;
      scrollCoursePageToTop();
    },
    [currentPathRef, pushSectionPath, router, setCurrentCourseKey, setCurrentSectionIndex],
  );

  return { openCourseByEntry, pushSectionPath, rememberCourseSection };
}
