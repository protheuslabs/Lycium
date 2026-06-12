import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { courseCategories, getCourseCategoryDepartments } from "../../courseData/courseTaxonomy";

type CourseGenerationHandler = (
  event: FormEvent<HTMLFormElement>,
  sourceLinks: string[],
  classification: { category: string; department: string },
  sourceFiles: File[],
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
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
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

  const handleSourceFilesChange = (files: FileList | null) => {
    const nextFiles = Array.from(files ?? []);
    setSourceFiles((currentFiles) => {
      const seen = new Set(currentFiles.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
      return [
        ...currentFiles,
        ...nextFiles.filter((file) => {
          const key = `${file.name}:${file.size}:${file.lastModified}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }),
      ];
    });
  };

  const handleRemoveSourceFile = (index: number) => {
    setSourceFiles((currentFiles) => currentFiles.filter((_file, fileIndex) => fileIndex !== index));
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
      sourceFiles,
    );
    setSourceFiles([]);
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
    handleSourceFilesChange,
    handleRemoveSourceFile,
    handleSubmit,
    isOpen,
    setMode,
    setDepartment,
    setIsOpen,
    sourceLinks,
    sourceFiles,
    addSourceLink: () => setSourceLinks((currentLinks) => [...currentLinks, ""]),
  };
}
