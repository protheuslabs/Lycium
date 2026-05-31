import type { CourseEntry } from "../../courseTypes";
import { getCourseCategoryLabel } from "../../courseData/courseTaxonomy";
import { getBookmarkedModuleSection, getCourseProgress } from "../../utils/courseRouting";
import { getUnmetCoursePrerequisites } from "./catalogPrerequisites";
import {
  type CatalogActivityFilter,
  type CatalogSortMode,
  type CatalogVisibleCourse,
  compareCatalogSort,
  getCourseSearchScore,
  normalizeSearchText,
} from "./catalogUtils";

type VisibleCatalogCourseOptions = {
  activityFilter: CatalogActivityFilter;
  catalogCourseMap: Map<string, CourseEntry>;
  collegeFilter: string;
  courses: CourseEntry[];
  departmentFilter: string;
  difficultyFilter: string;
  isClusterScoped: boolean;
  searchQuery: string;
  selectedClusterCourseIds: Set<string>;
  showLockedCourses: boolean;
  sortMode: CatalogSortMode;
};

export function getVisibleCatalogCourses({
  activityFilter,
  catalogCourseMap,
  collegeFilter,
  courses,
  departmentFilter,
  difficultyFilter,
  isClusterScoped,
  searchQuery,
  selectedClusterCourseIds,
  showLockedCourses,
  sortMode,
}: VisibleCatalogCourseOptions): CatalogVisibleCourse[] {
  const query = normalizeSearchText(searchQuery);

  return courses
    .map((course) => {
      const courseProgress = getCourseProgress(course);
      const bookmarkedSection = getBookmarkedModuleSection(course);
      const hasActiveCoursePage = Boolean(bookmarkedSection);
      const hasCourseActivity = hasActiveCoursePage || courseProgress.viewed > 0 || courseProgress.completed > 0;
      const unmetPrerequisites = getUnmetCoursePrerequisites(course, catalogCourseMap);
      const isLocked = !hasCourseActivity && unmetPrerequisites.length > 0;

      return {
        course,
        courseProgress,
        bookmarkedSection,
        hasCourseActivity,
        isLocked,
        unmetPrerequisites,
        collegeLabel: getCourseCategoryLabel(course.data.category),
        searchScore: getCourseSearchScore(course, query),
      };
    })
    .filter(({ course, courseProgress, hasCourseActivity, isLocked, searchScore }) => {
      const matchesCollege = collegeFilter === "all" || course.data.category === collegeFilter;
      const matchesDepartment = departmentFilter === "all" || course.data.department === departmentFilter;
      const matchesDifficulty = difficultyFilter === "all" || course.data.difficultyLevel === difficultyFilter;
      const matchesCluster = !isClusterScoped || selectedClusterCourseIds.has(course.key);
      const matchesSearch = !query || searchScore > 0;
      const matchesAvailability = showLockedCourses || !isLocked;
      const matchesActivity =
        activityFilter === "all" ||
        (activityFilter === "not-started" && !hasCourseActivity) ||
        (activityFilter === "in-progress" && hasCourseActivity && courseProgress.percentage < 100) ||
        (activityFilter === "completed" && courseProgress.percentage >= 100);

      return matchesCollege && matchesDepartment && matchesDifficulty && matchesCluster && matchesSearch && matchesAvailability && matchesActivity;
    })
    .sort((a, b) => {
      if (query) {
        return b.searchScore - a.searchScore || compareCatalogSort(a, b, sortMode);
      }

      return compareCatalogSort(a, b, sortMode);
    });
}
