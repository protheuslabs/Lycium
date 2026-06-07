import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { courseCategories, getCourseCategoryDepartments } from "../../courseData/courseTaxonomy";

type CourseGenerationHandler = (
  event: FormEvent<HTMLFormElement>,
  sourceLinks: string[],
  classification: { category: string; department: string },
) => void;

type CreateCourseModalOptions = {
  canCreateCourse: boolean;
  onGenerateCourse: CourseGenerationHandler;
  onCreateManualCourse: () => void;
};

export type CreateCourseMode = "ai" | "manual";

export function useCreateCourseModal({ canCreateCourse, onGenerateCourse, onCreateManualCourse }: CreateCourseModalOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<CreateCourseMode>("ai");
  const [sourceLinks, setSourceLinks] = useState([""]);
  const [college, setCollege] = useState("");
  const [department, setDepartment] = useState("");

  const collegeOptions = useMemo(
    () => courseCategories.map((category) => ({ value: category.id, label: category.label })),
    [],
  );
  const departmentOptions = useMemo(
    () => getCourseCategoryDepartments(college).map((entry) => ({ value: entry.id, label: entry.label })),
    [college],
  );

  const handleCollegeChange = (value: string) => {
    setCollege(value);
    setDepartment("");
  };

  const handleSourceLinkChange = (index: number, value: string) => {
    setSourceLinks((currentLinks) => currentLinks.map((link, linkIndex) => (linkIndex === index ? value : link)));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (mode === "manual") {
      event.preventDefault();
      onCreateManualCourse();
      setIsOpen(false);
      return;
    }

    if (!canCreateCourse || !college || !department) {
      event.preventDefault();
      return;
    }

    onGenerateCourse(
      event,
      sourceLinks.map((link) => link.trim()).filter(Boolean),
      { category: college, department },
    );
    setIsOpen(false);
  };

  return {
    college,
    collegeOptions,
    mode,
    department,
    departmentOptions,
    handleCollegeChange,
    handleSourceLinkChange,
    handleSubmit,
    isOpen,
    setMode,
    setDepartment,
    setIsOpen,
    sourceLinks,
    addSourceLink: () => setSourceLinks((currentLinks) => [...currentLinks, ""]),
  };
}
