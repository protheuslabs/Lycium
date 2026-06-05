export type LyciumCourseFeedbackRating = "up" | "down";
export type LyciumCourseFeedbackMagnitude = 1 | 2 | 3;

export type LyciumCourseSourceSuggestion = {
  id?: string;
  url: string;
  description?: string | null;
  created_at?: string;
};

export type LyciumCourseFeedbackNote = {
  id?: string;
  rating?: LyciumCourseFeedbackRating | null;
  feedback_magnitude?: LyciumCourseFeedbackMagnitude | null;
  text?: string | null;
  created_at?: string;
};

export type LyciumCourseFeedbackRatingEvent = {
  id?: string;
  rating: LyciumCourseFeedbackRating;
  created_at?: string;
};

export type LyciumCourseFeedbackRecord = {
  course_key: string;
  course_title?: string | null;
  rating?: LyciumCourseFeedbackRating | null;
  rating_events?: LyciumCourseFeedbackRatingEvent[];
  feedback_notes?: LyciumCourseFeedbackNote[];
  source_suggestions?: LyciumCourseSourceSuggestion[];
  updated_at?: string | null;
};

export type LyciumCourseFeedbackPayload = {
  course_key: string;
  course_title?: string | null;
  rating?: LyciumCourseFeedbackRating | null;
  feedback_text?: string | null;
  feedback_magnitude?: LyciumCourseFeedbackMagnitude | null;
  source_url?: string | null;
  source_description?: string | null;
};

export type LyciumCourseHealthStatus = "unknown" | "healthy" | "watch" | "needs_review";

export type LyciumCourseHealthRecord = {
  course_key: string;
  course_title?: string | null;
  status: LyciumCourseHealthStatus;
  score: number | null;
  latest_rating?: LyciumCourseFeedbackRating | null;
  rating_counts: Record<LyciumCourseFeedbackRating, number>;
  feedback_note_count: number;
  source_suggestion_count: number;
  average_feedback_magnitude: number | null;
  signals: string[];
  updated_at?: string | null;
};

