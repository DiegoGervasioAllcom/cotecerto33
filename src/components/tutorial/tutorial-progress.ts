import type { TutorialDefinition } from "./tutorial-types";

export type TutorialProgress = { chapter: number; step: number };

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const INITIAL_TUTORIAL_PROGRESS: TutorialProgress = { chapter: 0, step: 0 };

export function isTutorialProgress(value: unknown, definition: TutorialDefinition): value is TutorialProgress {
  if (!value || typeof value !== "object") return false;

  const { chapter, step } = value as Record<string, unknown>;
  if (
    typeof chapter !== "number" ||
    typeof step !== "number" ||
    !Number.isInteger(chapter) ||
    !Number.isInteger(step) ||
    chapter < 0 ||
    step < 0
  ) return false;

  const currentChapter = definition.chapters[chapter];
  return Boolean(currentChapter && step < currentChapter.steps.length);
}

/** Lê somente posições que ainda existem no roteiro atual; o resto volta ao início. */
export function readTutorialProgress(
  storage: StorageLike,
  key: string,
  definition: TutorialDefinition,
): TutorialProgress {
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return INITIAL_TUTORIAL_PROGRESS;
  }

  if (!raw) return INITIAL_TUTORIAL_PROGRESS;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isTutorialProgress(parsed, definition)) return parsed;
  } catch {
    // JSON inválido também é removido abaixo.
  }

  try { storage.removeItem(key); } catch { /* armazenamento pode estar indisponível */ }

  return INITIAL_TUTORIAL_PROGRESS;
}
