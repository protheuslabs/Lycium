import { RotateCw, Star, Volume2 } from "lucide-react";
import { useRef } from "react";
import type { Flashcard } from "./flashcardDomain";

type Props = {
  card: Flashcard;
  flipped: boolean;
  reversed: boolean;
  starred: boolean;
  tinted: boolean;
  audioSupported: boolean;
  showAudio?: boolean;
  onFlip: () => void;
  onStar: () => void;
  onSpeak: () => void;
  onMove?: (delta: number) => void;
};

export default function StudyCard({ card, flipped, reversed, starred, tinted, audioSupported, showAudio = true, onFlip, onStar, onSpeak, onMove }: Props) {
  const touch = useRef<{ x: number; y: number } | null>(null), swiped = useRef(false);
  const front = reversed ? card.back : card.front, back = reversed ? card.front : card.back;
  const contentClass = Math.max(front.length, back.length) > 400 ? " is-long" : Math.max(front.length, back.length) > 120 ? " is-medium" : "";
  return (
    <div className={"fc-card-stage" + (tinted ? " is-tinted" : "")}>
      <div className="fc-card-tools">
        {showAudio && <button className="fc-icon fc-card-tool" onClick={onSpeak} disabled={!audioSupported} aria-label="Read current side aloud" title={audioSupported ? "Read aloud" : "Audio is not supported in this browser"}><Volume2 size={18} /><span>Listen</span></button>}
        <button className="fc-icon fc-card-tool fc-star" onClick={onStar} aria-pressed={starred} aria-label={starred ? "Unstar card" : "Star card"} title={starred ? "Unstar card" : "Star card"}><Star size={18} fill={starred ? "currentColor" : "none"} /><span>{starred ? "Starred" : "Star"}</span></button>
      </div>
      <button className={"fc-card-trigger" + contentClass} data-study-card="true" onClick={() => { if (swiped.current) swiped.current = false; else onFlip(); }} onPointerDown={(event) => { swiped.current = false; if (onMove && event.pointerType === "touch") touch.current = { x: event.clientX, y: event.clientY }; }} onPointerUp={(event) => { if (!touch.current) return; const dx = event.clientX - touch.current.x, dy = event.clientY - touch.current.y; touch.current = null; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { swiped.current = true; onMove?.(dx < 0 ? 1 : -1); } }} onPointerCancel={() => { touch.current = null; }} aria-label={flipped ? "Flip card to prompt" : "Flip card to answer"} aria-describedby={flipped ? "fc-card-answer" : "fc-card-prompt"}>
        <span className={"fc-card-inner" + (flipped ? " is-flipped" : "")}>
          <span className="fc-card-face fc-card-front" aria-hidden={flipped}>
            <span className="fc-card-side-label">Prompt</span>
            <span className="fc-card-content" id="fc-card-prompt">{front}</span>
            <span className="fc-card-hint"><RotateCw size={14} /><span className="fc-mouse-hint">Click card to flip</span><span className="fc-touch-hint">Tap card to flip</span></span>
          </span>
          <span className="fc-card-face fc-card-back" aria-hidden={!flipped}>
            <span className="fc-card-side-label">Answer</span>
            <span className="fc-card-content" id="fc-card-answer">{back}</span>
            <span className="fc-card-hint"><RotateCw size={14} /><span className="fc-mouse-hint">Click card to flip back</span><span className="fc-touch-hint">Tap card to flip back</span></span>
          </span>
        </span>
      </button>
    </div>
  );
}
