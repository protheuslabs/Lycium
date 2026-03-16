export type LearningBlockType =
  | "text"
  | "video"
  | "quiz"
  | "game"
  | "project"
  | "lab"
  | "infographic";

export interface SourceReference {
  id: string;
  url: string;
  title?: string;
  trustScore?: number;
}

export interface LearningBlock {
  id: string;
  type: LearningBlockType;
  title?: string;
  content?: string;
  sources?: SourceReference[];
}

export interface CourseSection {
  id: string;
  title: string;
  learningObjectives?: string[];
  blocks: LearningBlock[];
}

export interface CourseSnapshot {
  id: string;
  learnerId?: string;
  title: string;
  generatedFromPrompt?: string;
  sections: CourseSection[];
}
