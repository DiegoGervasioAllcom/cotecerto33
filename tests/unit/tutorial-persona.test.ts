import { describe, expect, it } from "vitest";
import { tutorialDefinitions } from "@/components/tutorial/tutorial-content";
import { resolveTutorialKind } from "@/components/tutorial/tutorial-persona";

describe("roteiro por persona", () => {
  it.each([
    [{ role: "matriz", isGroupView: false, isFranqIndividual: false, scopeLoading: false }, "matriz"],
    [{ role: "vendedor", isGroupView: false, isFranqIndividual: false, scopeLoading: false }, "sales"],
    [{ role: "master", isGroupView: true, isFranqIndividual: false, scopeLoading: false }, "group"],
    [{ role: "supervisor", isGroupView: true, isFranqIndividual: false, scopeLoading: false }, "group"],
    [{ role: "franqueado", isGroupView: false, isFranqIndividual: true, scopeLoading: false }, "sales"],
    [{ role: "franqueado", isGroupView: true, isFranqIndividual: false, scopeLoading: false }, "group"],
    [{ role: "franqueado", isGroupView: false, isFranqIndividual: false, scopeLoading: true }, null],
  ] as const)("resolve %o para %s", (input, expected) => {
    expect(resolveTutorialKind(input)).toBe(expected);
  });

  it("mantém roteiros navegáveis, com capítulos e passos", () => {
    for (const definition of Object.values(tutorialDefinitions)) {
      expect(definition.chapters.length).toBeGreaterThan(0);
      for (const chapter of definition.chapters) {
        expect(chapter.steps.length).toBeGreaterThan(0);
        for (const step of chapter.steps) expect(step.route).toMatch(/^\//);
      }
    }
  });

  it("mantém a extensão dos roteiros definida no protótipo V10", () => {
    const total = (kind: keyof typeof tutorialDefinitions) =>
      tutorialDefinitions[kind].chapters.reduce((sum, chapter) => sum + chapter.steps.length, 0);

    expect(total("sales")).toBe(73);
    expect(total("matriz")).toBe(54);
    expect(total("group")).toBe(21);
  });
});
