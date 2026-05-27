import Button from "../Button/Button";

type FeedbackRating = "up" | "down";

type FeedbackControlProps = {
  rating: FeedbackRating | null;
  pulse: FeedbackRating | null;
  disabled?: boolean;
  onLike: () => void;
  onDislike: () => void;
};

export default function FeedbackControl({
  rating,
  pulse,
  disabled = false,
  onLike,
  onDislike,
}: FeedbackControlProps) {
  return (
    <>
      <Button
        className={`course-feedback-nav-button ${rating === "up" ? "course-feedback-nav-button--liked" : ""} ${
          pulse === "up" ? "course-feedback-nav-button--pulse" : ""
        }`}
        variant="icon"
        iconOnly
        selected={rating === "up"}
        tone="positive"
        onClick={onLike}
        disabled={disabled}
        aria-pressed={rating === "up"}
        aria-label="This course is useful"
      >
        <ThumbsUpIcon />
      </Button>
      <Button
        className={`course-feedback-nav-button ${rating === "down" ? "course-feedback-nav-button--disliked" : ""} ${
          pulse === "down" ? "course-feedback-nav-button--pulse" : ""
        }`}
        variant="icon"
        iconOnly
        selected={rating === "down"}
        tone="negative"
        onClick={onDislike}
        disabled={disabled}
        aria-pressed={rating === "down"}
        aria-label="This course needs work"
      >
        <ThumbsDownIcon />
      </Button>
    </>
  );
}

function ThumbsUpIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 10v11H4.5A2.5 2.5 0 0 1 2 18.5v-6A2.5 2.5 0 0 1 4.5 10H7Z" />
      <path d="M7 10l4.4-7.1c.8-1.2 2.7-.7 2.7.8v4.1h4.2c1.9 0 3.3 1.8 2.8 3.6l-1.8 6.9A3.6 3.6 0 0 1 15.8 21H7V10Z" />
    </svg>
  );
}

function ThumbsDownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 3v11H4.5A2.5 2.5 0 0 1 2 11.5v-6A2.5 2.5 0 0 1 4.5 3H7Z" />
      <path d="M7 14l4.4 7.1c.8 1.2 2.7.7 2.7-.8v-4.1h4.2c1.9 0 3.3-1.8 2.8-3.6L19.3 5.7A3.6 3.6 0 0 0 15.8 3H7v11Z" />
    </svg>
  );
}
