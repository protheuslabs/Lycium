import type { LyciumCourseGenerationJob, LyciumGeneratedCourseRecord } from "@lycium/contracts";

type CourseGenerationRunLike = {
  job_id?: number | string | null;
  run_type?: string | null;
  status?: string | null;
};

type RecordLike = Record<string, unknown>;

export function isActiveCourseGenerationJob(job: LyciumCourseGenerationJob): boolean {
  return job.status === "queued" || job.status === "running" || job.status === "validating";
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function recordList(value: unknown): RecordLike[] {
  return Array.isArray(value)
    ? value.filter((item): item is RecordLike => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function currentStage(job: LyciumCourseGenerationJob): string {
  const workflowStatus = job.workflow_status;
  const workflowStage = workflowStatus && typeof workflowStatus === "object" && "stage" in workflowStatus
    ? workflowStatus.stage
    : null;
  return textValue(job.current_stage) || textValue(workflowStage) || "";
}

function planModules(job: LyciumCourseGenerationJob): RecordLike[] {
  const tracePlan = job.trace?.plan;
  const plan = tracePlan && typeof tracePlan === "object" && !Array.isArray(tracePlan) ? tracePlan : null;
  return recordList(plan && "modules" in plan ? plan.modules : null);
}

function courseModules(job: LyciumCourseGenerationJob): RecordLike[] {
  return recordList(job.course?.modules);
}

function latestTraceStage(job: LyciumCourseGenerationJob, stage: string): RecordLike | null {
  const stages = recordList(job.trace?.stages);
  for (let index = stages.length - 1; index >= 0; index -= 1) {
    if (textValue(stages[index].stage) === stage) {
      return stages[index];
    }
  }
  return null;
}

function stripGeneratedModulePrefix(title: string, moduleNumber: number): string {
  const withoutPrefix = title.replace(
    new RegExp(`^(?:module|week)\\s+${moduleNumber}\\s*[:.-]\\s*`, "i"),
    "",
  ).trim();
  return withoutPrefix || title;
}

function moduleTitle(job: LyciumCourseGenerationJob, moduleNumber: number): string | null {
  const stage = latestTraceStage(job, currentStage(job));
  const stageTitle = textValue(stage?.module_title);
  const courseTitle = textValue(courseModules(job)[moduleNumber - 1]?.title);
  const planTitle = textValue(planModules(job)[moduleNumber - 1]?.title);
  const title = stageTitle || courseTitle || planTitle;
  return title ? stripGeneratedModulePrefix(title, moduleNumber) : null;
}

function sectionTitle(job: LyciumCourseGenerationJob, moduleNumber: number, sectionNumber: number): string | null {
  const stage = latestTraceStage(job, currentStage(job));
  const stageTitle = textValue(stage?.section_title);
  if (stageTitle) return stageTitle;

  const courseSectionTitle = textValue(
    recordList(courseModules(job)[moduleNumber - 1]?.sections)[sectionNumber - 1]?.title,
  );
  if (courseSectionTitle) return courseSectionTitle;

  const modulePlan = planModules(job)[moduleNumber - 1];
  const lessonTitles = Array.isArray(modulePlan?.lessonTitles) ? modulePlan.lessonTitles : null;
  const lessonTitle = lessonTitles ? textValue(lessonTitles[sectionNumber - 1]) : null;
  if (lessonTitle) return lessonTitle;

  return textValue(recordList(modulePlan?.lessons)[sectionNumber - 1]?.title);
}

function nextModuleNumber(job: LyciumCourseGenerationJob): number {
  const completedModuleCount = courseModules(job).length;
  const plannedModuleCount = planModules(job).length;
  return Math.max(1, Math.min(completedModuleCount + 1, plannedModuleCount || completedModuleCount + 1));
}

function moduleDetail(label: string, moduleNumber: number, title: string | null): string {
  return title ? `${label} Module ${moduleNumber}: ${title}` : `${label} Module ${moduleNumber}`;
}

function sectionDetail(moduleNumber: number, sectionNumber: number, title: string | null): string {
  return title
    ? `Creating Module ${moduleNumber} Section ${sectionNumber}: ${title}`
    : `Creating Module ${moduleNumber} Section ${sectionNumber}`;
}

export function courseGenerationSpecificStatusMessage(job: LyciumCourseGenerationJob): string | null {
  const stage = currentStage(job);
  const lessonMatch = stage.match(/^module_(\d+)_lesson_(\d+)$/);
  if (lessonMatch) {
    const moduleNumber = Number(lessonMatch[1]);
    const sectionNumber = Number(lessonMatch[2]);
    return sectionDetail(moduleNumber, sectionNumber, sectionTitle(job, moduleNumber, sectionNumber));
  }

  const moduleSubstageMatch = stage.match(/^module_(\d+)_(?:media|quiz|summary|apply)$/);
  if (moduleSubstageMatch) {
    const moduleNumber = Number(moduleSubstageMatch[1]);
    return moduleDetail("Finishing", moduleNumber, moduleTitle(job, moduleNumber));
  }

  const moduleMatch = stage.match(/^module_(\d+)$/);
  if (moduleMatch) {
    const moduleNumber = Number(moduleMatch[1]);
    return moduleDetail("Creating", moduleNumber, moduleTitle(job, moduleNumber));
  }

  if (stage === "module_section_plan_generation" || stage === "section_plan_generation") {
    const moduleNumber = nextModuleNumber(job);
    return moduleDetail("Creating", moduleNumber, moduleTitle(job, moduleNumber));
  }

  if (stage === "section_fill_generation") {
    const moduleNumber = nextModuleNumber(job);
    return sectionDetail(moduleNumber, 1, sectionTitle(job, moduleNumber, 1));
  }

  return null;
}

export function courseGenerationWorkingTitle(job: LyciumCourseGenerationJob): string | null {
  const tracePlan = job.trace?.plan;
  const planTitle = tracePlan && typeof tracePlan === "object" && "title" in tracePlan ? tracePlan.title : null;
  const title = job.working_title || job.course?.title || job.course_snapshot?.title || planTitle;
  return typeof title === "string" && title.trim() ? title.trim() : null;
}

export function recoverableCourseGenerationJobId(runs: CourseGenerationRunLike[]): string | null {
  const run = runs.find((current) => (
    current.status === "running" &&
    current.run_type === "agent_generate_course_staged" &&
    current.job_id !== null &&
    current.job_id !== undefined
  ));
  return run ? String(run.job_id) : null;
}

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
