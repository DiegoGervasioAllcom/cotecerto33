import { describe, expect, it } from "vitest";
import { tutorialDefinitions } from "@/components/tutorial/tutorial-content";
import {
  INITIAL_TUTORIAL_PROGRESS,
  readTutorialProgress,
  readTutorialStoredState,
  TUTORIAL_PROGRESS_VERSION,
  tutorialProgressStorageKey,
} from "@/components/tutorial/tutorial-progress";

function storageWith(value: string | null, initialKey = "tutorial") {
  const values = new Map<string, string>();
  if (value !== null) values.set(initialKey, value);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, nextValue: string) => {
      values.set(key, nextValue);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    value: (key = initialKey) => values.get(key) ?? null,
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

    expect(readTutorialProgress(storage, "tutorial", tutorialDefinitions.sales)).toEqual(
      INITIAL_TUTORIAL_PROGRESS,
    );
    expect(storage.value()).toBeNull();
  });

  it("mantém uma posição existente do roteiro", () => {
    const storage = storageWith('{"chapter":1,"step":2}');

    expect(readTutorialProgress(storage, "tutorial", tutorialDefinitions.sales)).toEqual({
      chapter: 1,
      step: 2,
    });
    expect(storage.value()).toBe('{"chapter":1,"step":2}');
  });

  it("isola o progresso por versão, usuário e roteiro", () => {
    expect(TUTORIAL_PROGRESS_VERSION).toMatch(/^v10-g6\.4-\d+$/);
    expect(tutorialProgressStorageKey("usuario-a", "sales")).toBe(
      `${"cotecerto:tutorial"}:${TUTORIAL_PROGRESS_VERSION}:usuario-a:sales`,
    );
    expect(tutorialProgressStorageKey("usuario-a", "sales")).not.toBe(
      tutorialProgressStorageKey("usuario-b", "sales"),
    );
    expect(tutorialProgressStorageKey("usuario-a", "sales")).not.toBe(
      tutorialProgressStorageKey("usuario-a", "matriz"),
    );
  });

  it("ignora progresso de uma versão incompatível sem apagá-lo", () => {
    const incompatibleKey = "cotecerto:tutorial:v10-g6.4-0:usuario-a:sales";
    const currentKey = tutorialProgressStorageKey("usuario-a", "sales");
    const storage = storageWith('{"chapter":1,"step":2}', incompatibleKey);

    expect(readTutorialProgress(storage, currentKey, tutorialDefinitions.sales)).toEqual(
      INITIAL_TUTORIAL_PROGRESS,
    );
    expect(storage.value(incompatibleKey)).toBe('{"chapter":1,"step":2}');
  });

  it.each([
    [
      '{"status":"step","progress":{"chapter":2,"step":13}}',
      { status: "step", progress: { chapter: 2, step: 13 } },
    ],
    ['{"status":"outro","chapter":3}', { status: "outro", chapter: 3 }],
    ['{"status":"completed"}', { status: "completed" }],
  ] as const)("restaura o estado persistido %s", (raw, expected) => {
    const storage = storageWith(raw);

    expect(readTutorialStoredState(storage, "tutorial", tutorialDefinitions.sales)).toEqual(
      expected,
    );
  });

  it.each([
    '{"status":"step","progress":{"chapter":99,"step":0}}',
    '{"status":"outro","chapter":99}',
    '{"status":"step"}',
    '{"status":"desconhecido"}',
  ])("rejeita o estado incompatível %s", (raw) => {
    const storage = storageWith(raw);

    expect(readTutorialStoredState(storage, "tutorial", tutorialDefinitions.sales)).toEqual({
      status: "step",
      progress: INITIAL_TUTORIAL_PROGRESS,
    });
    expect(storage.value()).toBeNull();
  });
});
