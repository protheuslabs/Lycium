import type { LyciumCourseGenerationJob, LyciumGeneratedCourseRecord } from "@lycium/contracts";

export function generatedCourseRecordFromJob(
  job: LyciumCourseGenerationJob,
): LyciumGeneratedCourseRecord | null {
  const snapshot = job.course_snapshot;
  const structure = snapshot?.structure ?? job.course;
  if (!snapshot || !structure) return null;

  return {
    id: snapshot.id,
    title: snapshot.title || structure.title,
    structure,
    status: snapshot.status,
    generation_trace: snapshot.generation_trace ?? job.trace,
    qualityReport: snapshot.qualityReport ?? job.quality_report ?? undefined,
  };
}
