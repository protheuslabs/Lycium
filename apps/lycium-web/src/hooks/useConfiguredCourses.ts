import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import sourceRecordsData from "../courseData/sourceRecords";
import type { CourseEntry } from "../courseTypes";
import { browserStorage, localApiSyncEnabled, lyciumApi, repositorySet } from "../runtime/appRuntime";
import { formatCourseValidationErrors, validateCourseEntry } from "../utils/courseValidation";

type UseConfiguredCoursesOptions = {
  setCourses: Dispatch<SetStateAction<CourseEntry[]>>;
  setLearnerId: Dispatch<SetStateAction<number | null>>;
};

export function useConfiguredCourses({ setCourses, setLearnerId }: UseConfiguredCoursesOptions) {
  useEffect(() => {
    if (repositorySet.mode !== "local") {
      repositorySet.courses
        .listCourses()
        .then((courseCards) => {
          const configuredCourses = courseCards
            .flatMap((card) => (card.course ? [card.course] : []))
            .map((course): CourseEntry => ({ ...course, source: course.source === "local" ? "local" : "remote" }));

          if (configuredCourses.length > 0) {
            setCourses(configuredCourses);
          }
        })
        .catch((err: unknown) => console.warn("Configured course repository unavailable:", err));
      return;
    }

    if (!localApiSyncEnabled) {
      const stored = browserStorage.readLearnerId();
      if (stored) {
        setLearnerId(stored);
      }
      return;
    }

    const fetchRemoteCourses = async () => {
      try {
        const rows = await lyciumApi.listRemoteCourses(100, "all");
        const remoteCourses: CourseEntry[] = [];
        for (const row of rows) {
          const snapshotId = Number(row.id);
          const entry: CourseEntry = {
            key: `remote-${row.id}`,
            title: row.title,
            data: row.structure,
            snapshotId,
            source: "remote",
            status: row.status,
            generation_trace: row.generation_trace,
            qualityReport: row.qualityReport,
          };
          const validation = validateCourseEntry(entry, {
            centralSourceRecords: sourceRecordsData.sources,
            requireSources: true,
          });
          if (validation.valid) {
            remoteCourses.push(entry);
          } else {
            console.warn(`Skipping invalid remote course ${entry.key}: ${formatCourseValidationErrors(validation.errors)}`);
          }
        }
        setCourses((prev) => [...remoteCourses, ...prev.filter((course) => course.source === "local")]);
      } catch (err) {
        console.warn("Remote courses unavailable:", err);
      }
    };

    const ensureLearner = async () => {
      const stored = browserStorage.readLearnerId();
      if (stored) {
        setLearnerId(stored);
        return;
      }
      try {
        const learner = await lyciumApi.createLearner({
          name: "Lycium Learner",
          goal: "Build a personalized course catalog",
          level: "beginner",
          preferences: { modalities: ["text", "video"], time_budget: "4h/week" },
        });
        browserStorage.writeLearnerId(learner.id);
        setLearnerId(Number(learner.id));
      } catch (err) {
        console.warn("Unable to create learner:", err);
      }
    };

    fetchRemoteCourses();
    ensureLearner();
  }, [setCourses, setLearnerId]);
}
