import { shuffleCards, type FlashcardDeck, type FlashcardHistory } from "./flashcardDomain";

export type SessionFilter = "all" | "missed" | "starred";
export type Grade = "known" | "review";
export type StudySession = {
  cardIds: string[];
  position: number;
  flipped: boolean;
  completed: boolean;
  visited: string[];
  grades: Record<string, Grade>;
};
export type SessionAction = { type: "flip" } | { type: "move"; delta: number } | { type: "grade"; grade: Grade } | { type: "finish" } | { type: "start"; session: StudySession };

export function createStudySession(deck: FlashcardDeck, history: FlashcardHistory, filter: SessionFilter = "all", shuffled = false, random = Math.random): StudySession {
  const ids = deck.cards.filter((card) => filter === "all" || (filter === "starred" ? history[deck.id]?.[card.id]?.starred : history[deck.id]?.[card.id]?.status === "review")).map((card) => card.id);
  const cardIds = shuffled ? shuffleCards(ids, random) : ids;
  return { cardIds, position: 0, flipped: false, completed: false, visited: cardIds.length ? [cardIds[0]] : [], grades: {} };
}

function atPosition(session: StudySession, position: number): StudySession {
  const id = session.cardIds[position];
  return { ...session, position, flipped: false, visited: id && !session.visited.includes(id) ? [...session.visited, id] : session.visited };
}

export function sessionReducer(session: StudySession, action: SessionAction): StudySession {
  if (action.type === "start") return action.session;
  if (session.completed || !session.cardIds.length) return session;
  if (action.type === "flip") return { ...session, flipped: !session.flipped };
  if (action.type === "finish") return { ...session, completed: true, flipped: false };
  if (action.type === "move") return atPosition(session, Math.max(0, Math.min(session.cardIds.length - 1, session.position + action.delta)));
  if (!session.flipped) return session;
  const grades = { ...session.grades, [session.cardIds[session.position]]: action.grade };
  const next = { ...session, grades };
  if (Object.keys(grades).length === session.cardIds.length) return { ...next, completed: true, flipped: false };
  const nextPosition = session.cardIds.findIndex((id, index) => index > session.position && !grades[id]);
  return atPosition(next, nextPosition < 0 ? session.cardIds.findIndex((id) => !grades[id]) : nextPosition);
}

export function sessionSummary(session: StudySession) {
  const values = Object.values(session.grades), known = values.filter((grade) => grade === "known").length;
  return { studied: session.visited.length, graded: values.length, known, needsReview: values.length - known, percentage: values.length ? Math.round(100 * known / values.length) : 0 };
}

export function restartSession(session: StudySession, shuffled = false): StudySession {
  const cardIds = shuffled ? shuffleCards(session.cardIds) : [...session.cardIds];
  return { cardIds, position: 0, flipped: false, completed: false, visited: cardIds.slice(0, 1), grades: {} };
}

/** Native controls keep their own keys; the study surface opts in to shortcuts. */
export function studyShortcut(key: string, revealed: boolean, interactive: boolean): SessionAction | null {
  if (interactive) return null;
  if (key === " " || key === "Enter") return { type: "flip" };
  if (key === "ArrowLeft" || key === "ArrowRight") return { type: "move", delta: key === "ArrowLeft" ? -1 : 1 };
  return revealed && (key === "1" || key === "2") ? { type: "grade", grade: key === "1" ? "review" : "known" } : null;
}
