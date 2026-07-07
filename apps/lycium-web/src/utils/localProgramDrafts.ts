import type { LyciumProgram } from "@lycium/contracts";

const LOCAL_PROGRAM_DRAFTS_STORAGE_KEY = "lycium-local-program-drafts";

function getLocalStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function readJson<T>(key: string): T | null {
  const storage = getLocalStorage();
  if (!storage) {
    return null;
  }

  try {
    const value = storage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }

  storage.setItem(key, JSON.stringify(value));
}

export function readPersistedLocalPrograms(): LyciumProgram[] {
  return readJson<LyciumProgram[]>(LOCAL_PROGRAM_DRAFTS_STORAGE_KEY) ?? [];
}

export function mergeProgramsById(priorityPrograms: LyciumProgram[], fallbackPrograms: LyciumProgram[]): LyciumProgram[] {
  const priorityIds = new Set(priorityPrograms.map((program) => program.id));
  return [...priorityPrograms, ...fallbackPrograms.filter((program) => !priorityIds.has(program.id))];
}

export function persistLocalProgramDraft(program: LyciumProgram): void {
  const current = readPersistedLocalPrograms();
  const next = [program, ...current.filter((draft) => draft.id !== program.id)];
  writeJson(LOCAL_PROGRAM_DRAFTS_STORAGE_KEY, next);
}

export function deletePersistedLocalProgramDraft(programId: string): void {
  const current = readPersistedLocalPrograms();
  writeJson(
    LOCAL_PROGRAM_DRAFTS_STORAGE_KEY,
    current.filter((draft) => draft.id !== programId),
  );
}
