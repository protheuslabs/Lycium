import type { CourseData, CourseEntry } from "../courseTypes";
import aiCourse from "./introToAiCourse";
import webDevCourse from "./webDevCourse";
import pythonCourse from "./introToPythonCourse";
import mlsysCourse from "./machineLearningSystemsCourse";
import softwareArchitectureCourse from "./softwareArchitectureCourse";
import { softwareEngineeringCourseWrappers } from "./programs";

export const localCourses: CourseEntry[] = [
  {
    key: "local-ai",
    title: aiCourse.title,
    data: aiCourse as CourseData,
    source: "local",
  },
  {
    key: "local-web",
    title: webDevCourse.title,
    data: webDevCourse as CourseData,
    source: "local",
  },
  {
    key: "local-python",
    title: pythonCourse.title,
    data: pythonCourse as CourseData,
    source: "local",
  },
  {
    key: "local-mlsys",
    title: mlsysCourse.title,
    data: mlsysCourse as CourseData,
    source: "local",
  },
  {
    key: "local-software-architecture",
    title: softwareArchitectureCourse.title,
    data: softwareArchitectureCourse as CourseData,
    source: "local",
  },
  ...softwareEngineeringCourseWrappers,
];
