import { generateProblem, parsePracticeConfig, type PracticeConfig } from "./practiceEngine";

export const SESSION_KEY = "lycium-practice-session-v1";
export const emptyWork = { step: 0, operation: "", answer: "", notes: "", feedback: "", hint: false, solution: false, assisted: false };
export type PracticeWork = typeof emptyWork;
export type Attempt = {
  skillId: string; version: number; seed: number; stage: "equation" | "calculation" | "answer";
  response: string; result: string; assisted: boolean;
  stepId?: string;
};
export type PracticeSession = {
  skills: PracticeConfig[]; seed: number; index: number; completed: number;
  mode: "guided" | "independent"; length: number; work: PracticeWork;
  attempts: Attempt[];
  ended?: boolean;
};

export function startSession(skills: PracticeConfig[], seed = 0, mode: PracticeSession["mode"] = "guided", length = 0): PracticeSession {
  return { skills, seed, mode, length, index: 0, completed: 0, work: emptyWork, attempts: [] };
}

export function readSession(): PracticeSession | null {
  try {
    const session = JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? "null") as PracticeSession | null;
    if (!session || !Array.isArray(session.skills) || !session.skills.length ||
        !Array.isArray(session.attempts) || !Number.isSafeInteger(session.index) || session.index < 0 ||
        !Number.isSafeInteger(session.completed) || session.completed < 0 || session.completed > session.index + 1 ||
        !Number.isSafeInteger(session.length) || session.length < 0 ||
        !["guided", "independent"].includes(session.mode) || !session.work ||
        !Number.isInteger(session.work.step) || session.work.step < 0 || session.work.step > 30 ||
        [session.work.answer, session.work.notes, session.work.operation, session.work.feedback].some(value => typeof value !== "string")) return null;
    const skills = session.skills.map(parsePracticeConfig);
    generateProblem(skills[0], session.seed);
    const work = session.mode === "independent" && session.work.step > 0
      ? { ...session.work, step: session.attempts.at(-1)?.result === "correct" ? 1 : 0 }
      : session.work;
    return { ...session, skills, work };
  } catch {
    return null;
  }
}
