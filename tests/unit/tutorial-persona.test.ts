import { describe, expect, it } from "vitest";
import { tutorialDefinitions } from "@/components/tutorial/tutorial-content";
import {
  resolveTutorialKind,
  resolveTutorialPersona,
} from "@/components/tutorial/tutorial-persona";

describe("roteiro por persona", () => {
  it.each([
    [
      { role: "matriz", isGroupView: false, isFranqIndividual: false, scopeLoading: false },
      "matriz",
    ],
    [
      { role: "vendedor", isGroupView: false, isFranqIndividual: false, scopeLoading: false },
      "sales",
    ],
    [{ role: "master", isGroupView: true, isFranqIndividual: false, scopeLoading: false }, "group"],
    [
      { role: "supervisor", isGroupView: true, isFranqIndividual: false, scopeLoading: false },
      "group",
    ],
    [
      { role: "franqueado", isGroupView: false, isFranqIndividual: true, scopeLoading: false },
      "sales",
    ],
    [
      { role: "franqueado", isGroupView: true, isFranqIndividual: false, scopeLoading: false },
      "group",
    ],
    [
      { role: "franqueado", isGroupView: false, isFranqIndividual: false, scopeLoading: true },
      null,
    ],
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

  it.each([
    {
      experiencia: "Matriz",
      input: {
        role: "matriz",
        isGroupView: false,
        isFranqIndividual: false,
        scopeLoading: false,
      },
      kind: "matriz",
      presentation: ["Ana", "CENTRO DE COMANDO DA MATRIZ"],
    },
    {
      experiencia: "Vendedor",
      input: {
        role: "vendedor",
        isGroupView: false,
        isFranqIndividual: false,
        scopeLoading: false,
      },
      kind: "sales",
      presentation: ["Rafinha", "A PRIMEIRA SEMANA DA RAFINHA"],
    },
    {
      experiencia: "Master",
      input: {
        role: "master",
        isGroupView: true,
        isFranqIndividual: false,
        scopeLoading: false,
      },
      kind: "group",
      presentation: ["Douglas", "ÁREA DO MASTER FRANQUEADO"],
    },
    {
      experiencia: "Supervisor",
      input: {
        role: "supervisor",
        isGroupView: true,
        isFranqIndividual: false,
        scopeLoading: false,
      },
      kind: "group",
      presentation: ["Paula", "ÁREA DO SUPERVISOR (MATRIZ)"],
    },
    {
      experiencia: "Franquia Individual",
      input: {
        role: "franqueado",
        isGroupView: false,
        isFranqIndividual: true,
        scopeLoading: false,
      },
      kind: "sales",
      presentation: ["Felipe", "ÁREA DA FRANQUIA (INDIVIDUAL)"],
    },
    {
      experiencia: "Franquia Full",
      input: {
        role: "franqueado",
        isGroupView: true,
        isFranqIndividual: false,
        scopeLoading: false,
      },
      kind: "group",
      presentation: ["Marcelo", "ÁREA DO FRANQUEADO"],
    },
  ] as const)(
    "$experiencia recebe o roteiro $kind com apresentação própria",
    ({ input, kind, presentation }) => {
      const persona = resolveTutorialPersona(input);

      expect(persona?.kind).toBe(kind);
      expect(
        [persona?.guideName, persona?.title, persona?.eyebrow, persona?.intro].join(" "),
      ).toContain(presentation[0]);
      expect(persona?.eyebrow).toContain(presentation[1]);
    },
  );

  it("não oferece uma apresentação provisória enquanto a modalidade da franquia carrega", () => {
    expect(
      resolveTutorialPersona({
        role: "franqueado",
        isGroupView: false,
        isFranqIndividual: false,
        scopeLoading: true,
      }),
    ).toBeNull();
  });
});
