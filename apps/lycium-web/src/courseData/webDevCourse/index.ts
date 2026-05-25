import { buildFullCourseModules } from "../fullCourseScaffold";
import meta from "./metadata.json";
import { webDevModuleSpecs } from "./fullCourseSpec";

const course = {
  ...meta,
  modules: buildFullCourseModules({
    coursePrefix: "web",
    pacingLabel: meta.metadata?.pacingLabel ?? "Week",
    moduleSpecs: webDevModuleSpecs,
    defaultSourceIds: meta.sourceIds,
  }),
};

export default course;
