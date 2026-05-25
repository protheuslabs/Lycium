import { buildFullCourseModules } from "../fullCourseScaffold";
import meta from "./metadata.json";
import { introToAiModuleSpecs } from "./fullCourseSpec";

const course = {
  ...meta,
  modules: buildFullCourseModules({
    coursePrefix: "ai",
    pacingLabel: meta.metadata?.pacingLabel ?? "Week",
    moduleSpecs: introToAiModuleSpecs,
    defaultSourceIds: meta.sourceIds,
  }),
};

export default course;
