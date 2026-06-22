import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { LyciumProgram } from "@lycium/contracts";
import { validateLyciumProgram } from "@lycium/contracts";
import sourceRecordsData from "../courseData/sourceRecords";
import type { CourseEntry } from "../courseTypes";
import { browserStorage, localApiSyncEnabled, lyciumApi, repositorySet } from "../runtime/appRuntime";
import { formatCourseValidationErrors, validateCourseEntry } from "../utils/courseValidation";
import { mergeCourseEntriesByKey, readPersistedLocalCourseEntries } from "../utils/localCourseDrafts";

type UseConfiguredCoursesOptions = {
  setCourses: Dispatch<SetStateAction<CourseEntry[]>>;
  setLearnerId: Dispatch<SetStateAction<number | null>>;
  setPrograms?: Dispatch<SetStateAction<LyciumProgram[]>>;
};

function remoteCourseKey(row: { id: string | number; structure: { metadata?: unknown } }): string {
  const metadata = row.structure.metadata && typeof row.structure.metadata === "object"
    ? row.structure.metadata as Record<string, unknown>
    : {};
  const scaffoldCourseId = metadata.scaffoldCourseId;
  return typeof scaffoldCourseId === "string" && scaffoldCourseId.trim() ? scaffoldCourseId : `remote-${row.id}`;
}

function shouldTryLocalApiSync(): boolean {
  if (localApiSyncEnabled) {
    return true;
  }

  if (typeof window === "undefined") {
    return false;
  }

  return ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname);
}

function remoteCourseRequiresSourceValidation(row: { status?: string }): boolean {
  return row.status !== "needs_sources";
}

export function useConfiguredCourses({ setCourses, setLearnerId, setPrograms }: UseConfiguredCoursesOptions) {
  useEffect(() => {
    const mergePersistedLocalCourses = (courses: CourseEntry[]) => {
      const persisted = readPersistedLocalCourseEntries();
      if (persisted.length === 0) {
        return courses;
      }

      return mergeCourseEntriesByKey(persisted, courses);
    };

    if (repositorySet.mode !== "local") {
      repositorySet.courses
        .listCourses()
        .then((courseCards) => {
          const configuredCourses = courseCards
            .flatMap((card) => (card.course ? [card.course] : []))
            .map((course): CourseEntry => ({ ...course, source: course.source === "local" ? "local" : "remote" }));

          if (configuredCourses.length > 0) {
            setCourses(mergePersistedLocalCourses(configuredCourses));
          } else {
            setCourses((current) => mergePersistedLocalCourses(current));
          }
        })
        .catch((err: unknown) => console.warn("Configured course repository unavailable:", err));
      return;
    }

    const tryLocalApiSync = shouldTryLocalApiSync();

    if (!tryLocalApiSync) {
      const stored = browserStorage.readLearnerId();
      if (stored) {
        setLearnerId(stored);
      }
      setCourses((current) => mergePersistedLocalCourses(current));
      return;
    }

    const fetchRemoteCourses = async () => {
      try {
        const rows = await lyciumApi.listRemoteCourses(100, "all");
        const remoteCourses: CourseEntry[] = [];
        for (const row of rows) {
          const snapshotId = Number(row.id);
          const entry: CourseEntry = {
            key: remoteCourseKey(row),
            title: row.title,
            data: row.structure,
            snapshotId,
            source: "remote",
            status: row.status,
            generation_trace: row.generation_trace,
            qualityReport: row.qualityReport,
          };
          if (row.status === "needs_sources") {
            remoteCourses.push(entry);
            continue;
          }
          const validation = validateCourseEntry(entry, {
            centralSourceRecords: sourceRecordsData.sources,
            requireSources: remoteCourseRequiresSourceValidation(row),
          });
          if (validation.valid) {
            remoteCourses.push(entry);
          } else {
            console.warn(`Skipping invalid remote course ${entry.key}: ${formatCourseValidationErrors(validation.errors)}`);
          }
        }
        setCourses((prev) =>
          mergePersistedLocalCourses([...remoteCourses, ...prev.filter((course) => course.source === "local")]),
        );
      } catch (err) {
        if (localApiSyncEnabled) {
          console.warn("Remote courses unavailable:", err);
        }
      }
    };

    const fetchRemotePrograms = async () => {
      if (!setPrograms) {
        return;
      }

      try {
        const rows = await lyciumApi.listRemotePrograms(100);
        const remotePrograms = rows.flatMap((row) => {
          const program = row.structure.program;
          if (!program) {
            return [];
          }
          const validation = validateLyciumProgram(program);
          if (!validation.valid) {
            console.warn(`Skipping invalid remote program ${row.id}: ${validation.errors.join("; ")}`);
            return [];
          }
          return [program];
        });
        if (remotePrograms.length > 0) {
          setPrograms((current) => {
            const remoteIds = new Set(remotePrograms.map((program) => program.id));
            return [...remotePrograms, ...current.filter((program) => !remoteIds.has(program.id))];
          });
        }
      } catch (err) {
        if (localApiSyncEnabled) {
          console.warn("Remote programs unavailable:", err);
        }
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
        if (localApiSyncEnabled) {
          console.warn("Unable to create learner:", err);
        }
      }
    };

    fetchRemoteCourses();
    fetchRemotePrograms();
    if (localApiSyncEnabled) {
      ensureLearner();
    } else {
      const stored = browserStorage.readLearnerId();
      if (stored) {
        setLearnerId(stored);
      }
    }
  }, [setCourses, setLearnerId, setPrograms]);
}
