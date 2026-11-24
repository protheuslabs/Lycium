import { useEffect, useRef, useState } from "react";
import { CalendarCheck, CheckCheck, RotateCcw } from "lucide-react";
import type { FlashcardDeck, FlashcardStore } from "./flashcardDomain";
import { applyScheduledReview, previewReview, RATING_LABELS, reviewAvailability, reviewInterval } from "./spacedReview";
import type { ReviewRating } from "./spacedReviewData";
import StudyCard from "./StudyCard";

type Props = { deck: FlashcardDeck; store: FlashcardStore; commit: (update: (current: FlashcardStore) => FlashcardStore) => void; onStar: (cardId: string) => void; onEdit: () => void };
type Outcomes = { cardId: string; options: Awaited<ReturnType<typeof previewReview>>; at: Date };

export default function SpacedReviewPanel({ deck, store, commit, onStar, onEdit }: Props) {
  const [now, setNow] = useState(() => new Date());
  const [queue, setQueue] = useState<string[] | null>(null), [flipped, setFlipped] = useState(false);
  const [newLimit, setNewLimit] = useState(20), [ratings, setRatings] = useState<ReviewRating[]>([]);
  const [outcomes, setOutcomes] = useState<Outcomes | null>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const grading = useRef(false), surface = useRef<HTMLElement>(null);
  const availability = reviewAvailability(deck, store.schedules ?? {}, now);
  const card = deck.cards.find((item) => item.id === queue?.[0]);
  const saved = card ? store.schedules?.[deck.id]?.[card.id] : undefined;
  const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
  const laterToday = availability.later.filter((id) => Date.parse(store.schedules?.[deck.id]?.[id].memory.dueAt ?? "") <= endOfDay.getTime()).length;
  const complete = queue !== null && !queue.length;

  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = window.setInterval(tick, 30000);
    window.addEventListener("focus", tick);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", tick); };
  }, []);
  useEffect(() => {
    if (!card) return;
    let cancelled = false;
    const at = new Date();
    previewReview(card.id, saved, at).then((options) => { if (!cancelled) setOutcomes({ cardId: card.id, options, at }); }).catch((failure: unknown) => { if (!cancelled) setError(failure instanceof Error ? failure.message : "Unable to initialize the scheduler."); });
    return () => { cancelled = true; };
  }, [card, saved]);

  function start() {
    const time = new Date(), available = reviewAvailability(deck, store.schedules ?? {}, time);
    setNow(time); setQueue([...available.due, ...available.fresh.slice(0, newLimit)]); setRatings([]); setFlipped(false); setError("");
    surface.current?.focus({ preventScroll: true });
  }
  async function grade(rating: ReviewRating) {
    if (!card || !flipped || grading.current || outcomes?.cardId !== card.id) return;
    grading.current = true; setBusy(true); setError("");
    try {
      const at = new Date();
      const result = await applyScheduledReview(store, deck.id, card.id, rating, at);
      const scheduled = result.schedules?.[deck.id]?.[card.id];
      if (!scheduled) throw new Error("The scheduler did not return a review state.");
      commit((current) => {
        if (!current.decks.some((item) => item.id === deck.id && item.cards.some((entry) => entry.id === card.id))) throw new Error("This card was removed. Start a fresh round.");
        if (current.schedules?.[deck.id]?.[card.id] !== saved) throw new Error("This card changed while reviewing. Start a fresh round.");
        return { ...current, schedules: { ...current.schedules, [deck.id]: { ...current.schedules?.[deck.id], [card.id]: scheduled } } };
      });
      setRatings((values) => [...values, rating]); setQueue((values) => values?.slice(1) ?? null); setFlipped(false); setNow(at);
      surface.current?.focus({ preventScroll: true });
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to schedule this review."); }
    finally { grading.current = false; setBusy(false); }
  }

  return <section className="fc-spaced-review" aria-label="Daily review" ref={surface} tabIndex={-1} onKeyDown={(event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || busy || !card) return;
    const target = event.target as HTMLElement, onCard = target.closest("[data-study-card]");
    if (onCard && (event.key === " " || event.key === "Enter")) return;
    if (target.closest("input,textarea,select,summary,button,a,[contenteditable=true]") && !onCard) return;
    if (event.key === " " || event.key === "Enter") { event.preventDefault(); setFlipped(!flipped); }
    if (flipped && ["1", "2", "3", "4"].includes(event.key)) { event.preventDefault(); void grade(Number(event.key) as ReviewRating); }
  }}>
    {error && <p role="alert" className="fc-warning">{error}</p>}
    {queue === null || complete ? <div className="fc-review-overview">
      <div className="fc-complete-icon">{complete ? <CheckCheck size={28} /> : <CalendarCheck size={28} />}</div>
      <h2>{complete ? "Review round finished" : "Build a lasting memory"}</h2>
      <p>Review cards when they’re due. Your rating determines when you see each one again.</p>
      {complete && <p role="status">{ratings.length} cards rated · {ratings.filter((rating) => rating === 1).length} Again · {ratings.filter((rating) => rating === 2).length} Hard · {ratings.filter((rating) => rating === 3).length} Good · {ratings.filter((rating) => rating === 4).length} Easy</p>}
      <div className="fc-review-counts"><div><strong>{availability.due.length}</strong><span>Due now</span></div><div><strong>{availability.fresh.length}</strong><span>New cards</span></div><div><strong>{availability.later.length}</strong><span>Scheduled later</span></div></div>
      {laterToday > 0 && <p>{laterToday} {laterToday === 1 ? "card returns" : "cards return"} later today, including learning steps.</p>}
      {availability.nextDue && <p>Next due: <time dateTime={availability.nextDue}>{new Date(availability.nextDue).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time></p>}
      {!!deck.cards.length && <label className="fc-review-limit">New cards in this round<select aria-label="New cards per review round" value={newLimit} onChange={(event) => setNewLimit(Number(event.target.value))}><option value={0}>Due cards only</option>{[10, 20, 50].map((count) => <option value={count} key={count}>Up to {count}</option>)}</select></label>}
      <div className="fc-centered-actions"><button className="fc-button fc-primary" onClick={deck.cards.length ? start : onEdit} disabled={!!deck.cards.length && !availability.due.length && (!newLimit || !availability.fresh.length)}>{complete ? <RotateCcw size={16} /> : <CalendarCheck size={16} />}{deck.cards.length ? "Start review" : "Add cards"}</button></div>
      <p className="fc-review-note">Flashcards mode is always available for free study and does not change your review schedule.</p>
    </div> : card ? <>
      <div className="fc-study-toolbar"><span>{ratings.length} reviewed · {queue.length} remaining</span><button className="fc-text-button" disabled={busy} onClick={() => { setQueue(null); setFlipped(false); }}>Back to review overview</button></div>
      <StudyCard key={card.id} card={card} flipped={flipped} reversed={false} starred={!!store.history[deck.id]?.[card.id]?.starred} tinted={false} audioSupported={false} showAudio={false} onFlip={() => { if (!busy) setFlipped(!flipped); }} onStar={() => onStar(card.id)} onSpeak={() => {}} />
      <div className="fc-scheduled-actions">{flipped ? ([1, 2, 3, 4] as const).map((rating) => {
        const option = outcomes?.cardId === card.id ? outcomes.options.find((item) => item.rating === rating) : undefined;
        return <button key={rating} className={"fc-button fc-scheduled-rating fc-rating-" + rating} disabled={busy || !option} onClick={() => void grade(rating)}><strong>{RATING_LABELS[rating]} <kbd>{rating}</kbd></strong><span>{option ? reviewInterval(option.dueAt, outcomes?.at ?? now) : "Loading…"}</span></button>;
      }) : <button className="fc-button fc-primary fc-reveal" disabled={busy} onClick={() => { setFlipped(true); surface.current?.focus({ preventScroll: true }); }}>Reveal answer</button>}</div>
      <p className="fc-study-hint">{flipped ? "Again: forgot · Hard: difficult · Good: recalled · Easy: effortless" : "Recall the answer before revealing it."}</p>
    </> : <div className="fc-empty"><p>This card is no longer available.</p><button className="fc-button" onClick={() => setQueue(null)}>Return to overview</button></div>}
  </section>;
}
