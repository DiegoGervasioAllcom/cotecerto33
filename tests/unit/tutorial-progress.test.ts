import { describe, expect, it } from "vitest";
import { tutorialDefinitions } from "@/components/tutorial/tutorial-content";
import { INITIAL_TUTORIAL_PROGRESS, readTutorialProgress } from "@/components/tutorial/tutorial-progress";

function storageWith(value: string | null) {
  let stored = value;
  return {
    getItem: () => stored,
    setItem: (nextKey: string, nextValue: string) => { void nextKey; stored = nextValue; },
    removeItem: () => { stored = null; },
    value: () => stored,
  };
}

describe("progresso do tutorial", () => {
  it.each([
    '{"chapter":99,"step":0}',
    '{"chapter":0,"step":99}',
    '{"chapter":-1,"step":0}',
    '{"chapter":0,"step":1.5}',
    '{"chapter":"0","step":0}',
    "json inválido",
  ])("remove o progresso inválido (%s) e reinicia", (invalid) => {
    const storage = storageWith(invalid);

    expect(readTutorialProgress(storage, "tutorial", tutorialDefinitions.sales)).toEqual(INITIAL_TUTORIAL_PROGRESS);
    expect(storage.value()).toBeNull();
  });

  it("mantém uma posição existente do roteiro", () => {
    const storage = storageWith('{"chapter":1,"step":2}');

    expect(readTutorialProgress(storage, "tutorial", tutorialDefinitions.sales)).toEqual({ chapter: 1, step: 2 });
    expect(storage.value()).toBe('{"chapter":1,"step":2}');
  });
});
