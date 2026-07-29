import type { TutorialDefinition } from "./tutorial-types";

export type TutorialProgress = { chapter: number; step: number };
export type TutorialStoredState =
  | { status: "step"; progress: TutorialProgress }
  | { status: "outro"; chapter: number }
  | { status: "completed" };

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const INITIAL_TUTORIAL_PROGRESS: TutorialProgress = { chapter: 0, step: 0 };
export const TUTORIAL_PROGRESS_VERSION = "v10-g6.4-1";

export function tutorialProgressStorageKey(userId: string, kind: TutorialDefinition["kind"]) {
  return `cotecerto:tutorial:${TUTORIAL_PROGRESS_VERSION}:${userId}:${kind}`;
}

export function isTutorialProgress(
  value: unknown,
  definition: TutorialDefinition,
): value is TutorialProgress {
  if (!value || typeof value !== "object") return false;

  const { chapter, step } = value as Record<string, unknown>;
  if (
    typeof chapter !== "number" ||
    typeof step !== "number" ||
    !Number.isInteger(chapter) ||
    !Number.isInteger(step) ||
    chapter < 0 ||
    step < 0
  )
    return false;

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

  try {
    storage.removeItem(key);
  } catch {
    /* armazenamento pode estar indisponível */
  }

  return INITIAL_TUTORIAL_PROGRESS;
}

export function readTutorialStoredState(
  storage: StorageLike,
  key: string,
  definition: TutorialDefinition,
): TutorialStoredState {
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return { status: "step", progress: INITIAL_TUTORIAL_PROGRESS };
  }
  if (!raw) return { status: "step", progress: INITIAL_TUTORIAL_PROGRESS };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isTutorialProgress(parsed, definition)) {
      return { status: "step", progress: parsed };
    }
    if (!parsed || typeof parsed !== "object") throw new Error("Estado inválido");
    const value = parsed as Record<string, unknown>;
    if (value.status === "completed") return { status: "completed" };
    if (value.status === "step" && isTutorialProgress(value.progress, definition)) {
      return { status: "step", progress: value.progress };
    }
    if (
      value.status === "outro" &&
      typeof value.chapter === "number" &&
      Number.isInteger(value.chapter) &&
      value.chapter >= 0 &&
      value.chapter < definition.chapters.length
    ) {
      return { status: "outro", chapter: value.chapter };
    }
  } catch {
    // Estado inválido também é removido abaixo.
  }

  try {
    storage.removeItem(key);
  } catch {
    /* armazenamento pode estar indisponível */
  }
  return { status: "step", progress: INITIAL_TUTORIAL_PROGRESS };
}
