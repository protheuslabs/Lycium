import { useEffect, useReducer, useRef, useState, type KeyboardEvent } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCheck, Maximize2, Minimize2, Pause, Play, RotateCcw, Settings2, Shuffle, Square, Volume2 } from "lucide-react";
import type { FlashcardDeck, FlashcardHistory } from "./flashcardDomain";
import { createStudySession, restartSession, sessionReducer, sessionSummary, studyShortcut, type Grade, type SessionFilter } from "./flashcardSession";
import StudyCard from "./StudyCard";

type Props = { deck: FlashcardDeck; history: FlashcardHistory; onGrade: (cardId: string, grade: Grade) => void; onStar: (cardId: string) => void; onEdit: () => void; focused: boolean; onFocus: () => void };

export default function FlashcardStudy({ deck, history, onGrade, onStar, onEdit, focused, onFocus }: Props) {
  const [session, dispatch] = useReducer(sessionReducer, null, () => createStudySession(deck, history));
  const [filter, setFilter] = useState<SessionFilter>("all");
  const [shuffled, setShuffled] = useState(false), [reversed, setReversed] = useState(false);
  const [tinted, setTinted] = useState(false), [playing, setPlaying] = useState(false);
  const [interval, setIntervalSeconds] = useState(4), [autoAudio, setAutoAudio] = useState(false);
  const [audioSupported] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => typeof window !== "undefined" ? window.speechSynthesis?.getVoices() ?? [] : []);
  const [voiceURI, setVoiceURI] = useState(""), [rate, setRate] = useState(1);
  const [feedback, setFeedback] = useState("");
  const surface = useRef<HTMLElement>(null), completion = useRef<HTMLHeadingElement>(null);
  const card = deck.cards.find((item) => item.id === session.cardIds[session.position]);
  const summary = sessionSummary(session);
  const missed = deck.cards.filter((item) => history[deck.id]?.[item.id]?.status === "review").length;
  const starred = deck.cards.filter((item) => history[deck.id]?.[item.id]?.starred).length;
  const sideText = card ? (session.flipped !== reversed ? card.back : card.front) : "";

  useEffect(() => { surface.current?.focus({ preventScroll: true }); }, []);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const update = () => setVoices(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener("voiceschanged", update);
    return () => { window.speechSynthesis.cancel(); window.speechSynthesis.removeEventListener("voiceschanged", update); };
  }, []);
  useEffect(() => { if (session.completed) completion.current?.focus(); }, [session.completed]);
  useEffect(() => {
    if (!playing || session.completed || !card) return;
    const timer = window.setTimeout(() => dispatch(session.flipped ? (session.position === session.cardIds.length - 1 ? { type: "finish" } : { type: "move", delta: 1 }) : { type: "flip" }), interval * 1000);
    return () => window.clearTimeout(timer);
  }, [playing, session, interval, card]);
  useEffect(() => {
    if (!playing || !autoAudio || !audioSupported || !sideText || session.completed) return;
    const speech = new SpeechSynthesisUtterance(sideText);
    speech.rate = rate; speech.voice = voices.find((voice) => voice.voiceURI === voiceURI) ?? null;
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(speech);
    return () => window.speechSynthesis.cancel();
  }, [playing, autoAudio, audioSupported, sideText, rate, voices, voiceURI, session.completed]);
  useEffect(() => {
    const pause = () => { if (document.hidden) { setPlaying(false); window.speechSynthesis?.cancel(); } };
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, []);

  function stop() { setPlaying(false); window.speechSynthesis?.cancel(); }
  function start(nextFilter = filter, nextShuffled = shuffled) {
    stop(); setFilter(nextFilter); setShuffled(nextShuffled); setFeedback("");
    dispatch({ type: "start", session: createStudySession(deck, history, nextFilter, nextShuffled) });
    surface.current?.focus({ preventScroll: true });
  }
  function grade(value: Grade) {
    if (!card || !session.flipped || session.completed) return;
    stop(); onGrade(card.id, value); dispatch({ type: "grade", grade: value });
    setFeedback(value === "known" ? "Marked known. Next card." : "Saved for review. Next card.");
    surface.current?.focus({ preventScroll: true });
  }
  function restart(nextShuffled = shuffled) {
    stop(); setShuffled(nextShuffled); setFeedback("");
    dispatch({ type: "start", session: restartSession(session, nextShuffled) });
    surface.current?.focus({ preventScroll: true });
  }
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || event.isDefaultPrevented()) return;
    const target = event.target as HTMLElement;
    const cardControl = target.closest("[data-study-card]");
    if (cardControl && (event.key === " " || event.key === "Enter")) return; // Native button activation.
    const interactive = !!target.closest("input,textarea,select,button,a,summary,[role=dialog],[contenteditable=true]") && !cardControl;
    const action = studyShortcut(event.key, session.flipped, interactive);
    if (!action || !card || session.completed) return;
    event.preventDefault();
    if (action.type === "grade") grade(action.grade);
    else { stop(); dispatch(action); }
  }
  function speak() {
    if (!audioSupported) return;
    const speech = new SpeechSynthesisUtterance(sideText);
    speech.rate = rate; speech.voice = voices.find((voice) => voice.voiceURI === voiceURI) ?? null;
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(speech);
  }

  return (
    <section className="fc-study" aria-label="Study flashcards" tabIndex={-1} ref={surface} onKeyDown={onKeyDown}>
      <div className="fc-study-toolbar">
        <label className="fc-filter-label"><span className="sr-only">Study cards</span><select aria-label="Study cards" value={filter} onChange={(event) => start(event.target.value as SessionFilter)}><option value="all">All cards ({deck.cards.length})</option><option value="missed">Needs review ({missed})</option><option value="starred">Starred ({starred})</option></select></label>
        <div className="fc-inline-actions">
          <button className="fc-icon" onClick={() => restart()} aria-label="Restart session" title="Restart session"><RotateCcw size={18} /></button>
          <button className="fc-icon" onClick={onFocus} aria-label={focused ? "Exit focus mode" : "Focus mode"} title={focused ? "Exit focus mode" : "Focus mode"}>{focused ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
          <details className="fc-settings"><summary aria-label="Study settings"><Settings2 size={18} /><span>Options</span></summary><div className="fc-popover">
            <h3>Study options</h3>
            <label><span>Back side first</span><input type="checkbox" checked={reversed} onChange={(event) => { stop(); setReversed(event.target.checked); if (session.flipped) dispatch({ type: "flip" }); }} /></label>
            <label><span>Tint cards with deck color</span><input type="checkbox" checked={tinted} onChange={(event) => setTinted(event.target.checked)} /></label>
            <label><span>Seconds per side</span><select value={interval} onChange={(event) => setIntervalSeconds(Number(event.target.value))}>{[2, 4, 6, 8, 10].map((seconds) => <option key={seconds} value={seconds}>{seconds}s</option>)}</select></label>
            <p>Autoplay shows both sides and advances without grading.</p>
            <h3>Read aloud</h3>
            {audioSupported ? <><label><span>Audio during autoplay</span><input type="checkbox" checked={autoAudio} onChange={(event) => setAutoAudio(event.target.checked)} /></label><label><span>Voice / language</span><select aria-label="Voice and language" value={voiceURI} onChange={(event) => setVoiceURI(event.target.value)}><option value="">Browser default</option>{voices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>)}</select></label><label><span>Reading speed</span><select value={rate} onChange={(event) => setRate(Number(event.target.value))}>{[0.75, 1, 1.25, 1.5].map((speed) => <option key={speed} value={speed}>{speed}×</option>)}</select></label><button className="fc-button" onClick={() => window.speechSynthesis.cancel()}><Square size={14} /> Stop audio</button></> : <p>Read aloud is not supported in this browser.</p>}
          </div></details>
        </div>
      </div>

      {!session.cardIds.length ? <div className="fc-empty"><h2>{deck.cards.length ? "No cards in this selection" : "Your first card starts here"}</h2><p>{deck.cards.length ? "Star cards as you study, or choose all cards to start a full round." : "Add a question and answer, or import a whole set from your notes."}</p><button className="fc-button fc-primary" onClick={deck.cards.length ? () => start("all") : onEdit}>{deck.cards.length ? "Study all cards" : "Add cards"}</button></div>
        : session.completed ? <div className="fc-complete"><div className="fc-complete-icon"><CheckCheck size={30} /></div><h2 ref={completion} tabIndex={-1}>Round complete</h2><p>{summary.graded ? "A little more familiar, one card at a time." : "You’ve viewed every card in this round. Grade cards next time to track your recall."}</p><div className="fc-results"><div><strong>{summary.studied}</strong><span>Studied</span></div><div><strong>{summary.known}</strong><span>Known</span></div><div><strong>{summary.needsReview}</strong><span>Need review</span></div><div><strong>{summary.graded ? summary.percentage + "%" : "—"}</strong><span>Of graded cards known</span></div></div>{summary.graded < session.cardIds.length && <p>{summary.graded} of {session.cardIds.length} cards graded in this round.</p>}<div className="fc-centered-actions"><button className="fc-button fc-primary" onClick={() => restart()}><RotateCcw size={16} /> Start again</button>{summary.needsReview > 0 && <button className="fc-button" onClick={() => { stop(); setFilter("missed"); const ids = session.cardIds.filter((id) => session.grades[id] === "review"); dispatch({ type: "start", session: { cardIds: ids, position: 0, visited: ids.slice(0, 1), flipped: false, completed: false, grades: {} } }); }}>Review {summary.needsReview} missed</button>}</div></div>
          : card ? <>
            <div className="fc-round-progress"><span>Card {session.position + 1} <span className="fc-muted">/ {session.cardIds.length}</span></span><span>{summary.graded} graded <span className="fc-progress-dot">·</span> {summary.known} known</span></div>
            <progress className="fc-progress" value={summary.graded} max={session.cardIds.length} aria-label="Cards graded" />
            <StudyCard key={card.id} card={card} flipped={session.flipped} reversed={reversed} starred={!!history[deck.id]?.[card.id]?.starred} tinted={tinted} audioSupported={audioSupported} onFlip={() => { stop(); dispatch({ type: "flip" }); }} onStar={() => onStar(card.id)} onSpeak={speak} onMove={(delta) => { stop(); dispatch({ type: "move", delta }); }} />
            <div className="fc-grade-actions"><button className="fc-button fc-review" disabled={!session.flipped} onClick={() => grade("review")}>Needs review <kbd>1</kbd></button><button className="fc-button fc-primary" disabled={!session.flipped} onClick={() => grade("known")}><Check size={18} /> Know it <kbd>2</kbd></button></div>
            <div className="fc-player"><div className="fc-player-side"><button className={"fc-icon" + (shuffled ? " is-active" : "")} aria-label="Shuffle cards" aria-pressed={shuffled} title="Shuffle starts a new round" onClick={() => restart(!shuffled)}><Shuffle size={19} /></button><button className="fc-icon" aria-label={playing ? "Pause autoplay" : "Start autoplay"} aria-pressed={playing} onClick={() => { if (playing) stop(); else setPlaying(true); }}>{playing ? <Pause size={19} /> : <Play size={19} />}</button></div><div className="fc-player-navigation"><button className="fc-button fc-circle" aria-label="Previous card" disabled={session.position === 0} onClick={() => { stop(); dispatch({ type: "move", delta: -1 }); }}><ArrowLeft size={20} /></button><span>{session.position + 1} / {session.cardIds.length}</span><button className="fc-button fc-circle" aria-label="Next card" disabled={session.position === session.cardIds.length - 1} onClick={() => { stop(); dispatch({ type: "move", delta: 1 }); }}><ArrowRight size={20} /></button></div><div className="fc-player-side fc-player-end">{session.position === session.cardIds.length - 1 && <button className="fc-text-button" onClick={() => { stop(); dispatch({ type: "finish" }); }}>Finish round</button>}</div></div>
            <div className="fc-study-hint">{playing ? <span><Volume2 size={14} /> Autoplay · {interval}s per side · no grading</span> : <span>{session.flipped ? "How well did you recall it?" : "Think of your answer, then flip to check."}</span>}</div>
          </> : null}
      <p className="fc-shortcuts"><kbd>Space</kbd> / <kbd>Enter</kbd> flip <span>·</span> <kbd>←</kbd> <kbd>→</kbd> navigate <span>·</span> <kbd>1</kbd> / <kbd>2</kbd> grade after revealing</p>
      <p className="sr-only" role="status">{feedback}</p>
    </section>
  );
}
