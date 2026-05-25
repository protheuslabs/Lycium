import { buildFullCourseModules } from "../fullCourseScaffold";
import meta from "./metadata.json";
import { introToPythonModuleSpecs } from "./fullCourseSpec";

const course = {
  ...meta,
  modules: buildFullCourseModules({
    coursePrefix: "py",
    pacingLabel: meta.metadata?.pacingLabel ?? "Week",
    moduleSpecs: introToPythonModuleSpecs,
    defaultSourceIds: meta.sourceIds,
  }),
};

export default course;
