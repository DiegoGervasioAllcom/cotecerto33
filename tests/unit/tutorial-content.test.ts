import { describe, expect, it } from "vitest";
import { tutorialDefinitions } from "@/components/tutorial/tutorial-content";

const CONTRACT = {
  sales: { content: 65, endings: 8, total: 73, spotlights: 56 },
  matriz: { content: 44, endings: 10, total: 54, spotlights: 41 },
  group: { content: 16, endings: 5, total: 21, spotlights: 14 },
} as const;

describe("contrato dos três roteiros do tutorial V10", () => {
  it.each(Object.entries(CONTRACT))(
    "%s mantém passos, encerramentos e spotlights do protótipo",
    (kind, expected) => {
      const definition = tutorialDefinitions[kind as keyof typeof tutorialDefinitions];
      const steps = definition.chapters.flatMap((chapter) => chapter.steps);

      expect(steps).toHaveLength(expected.content);
      expect(definition.chapters.filter((chapter) => chapter.outro)).toHaveLength(expected.endings);
      expect(steps.length + definition.chapters.length).toBe(expected.total);
      expect(steps.filter((step) => step.target)).toHaveLength(expected.spotlights);
    },
  );

  it("soma 148 momentos e 111 spotlights sem completar o roteiro artificialmente", () => {
    const definitions = Object.values(tutorialDefinitions);
    const steps = definitions.flatMap((definition) =>
      definition.chapters.flatMap((chapter) => chapter.steps),
    );
    const endings = definitions.flatMap((definition) =>
      definition.chapters.map((chapter) => chapter.outro),
    );

    expect(steps.length + endings.length).toBe(148);
    expect(steps.filter((step) => step.target)).toHaveLength(111);
    expect(steps.some((step) => step.target === ".page")).toBe(false);
  });

  it("não contém passos duplicados dentro do mesmo roteiro", () => {
    for (const definition of Object.values(tutorialDefinitions)) {
      const signatures = definition.chapters.flatMap((chapter) =>
        chapter.steps.map((step) =>
          JSON.stringify([
            step.route,
            step.target,
            step.position,
            step.prepare,
            step.hook,
            step.title,
            step.body,
            step.tip,
          ]),
        ),
      );

      expect(new Set(signatures).size, definition.kind).toBe(signatures.length);
    }
  });

  it("preserva hooks, dicas e encerramentos completos", () => {
    const definitions = Object.values(tutorialDefinitions);
    const chapters = definitions.flatMap((definition) => definition.chapters);
    const steps = chapters.flatMap((chapter) => chapter.steps);

    expect(steps.some((step) => step.hook)).toBe(true);
    expect(steps.some((step) => step.tip?.label && step.tip.text)).toBe(true);
    expect(chapters.every((chapter) => chapter.hook && chapter.outro.hook)).toBe(true);
    expect(chapters.filter((chapter) => chapter.outro.big)).not.toHaveLength(0);
    expect(chapters.filter((chapter) => chapter.outro.final)).toHaveLength(3);
  });

  it("prepara previews demonstrativos para alvos que não dependem de dados reais", () => {
    const steps = tutorialDefinitions.sales.chapters.flatMap((chapter) => chapter.steps);
    const preparationByTitle = new Map(steps.map((step) => [step.title, step.prepare]));

    expect(preparationByTitle.get("Pronto para cotar")).toBe("lead-ready");
    expect(preparationByTitle.get("A linha do tempo do aceite")).toBe("aceite-aceita");
    expect(preparationByTitle.get("Conferência final dos dados")).toBe("aceite-aceita");
    expect(preparationByTitle.get("Transmitir = oficializar a venda")).toBe("aceite-aceita");
    expect(preparationByTitle.get("E se a seguradora pedir uma pendência?")).toBe(
      "aceite-pendencia",
    );
    expect(preparationByTitle.get("Cada linha é uma venda sua")).toBe("extrato-venda");
    expect(preparationByTitle.get("Campanhas ativas")).toBe("extrato-campanha");
    expect(preparationByTitle.get("Quando o dinheiro entra")).toBe("extrato-pagamentos");
  });
});
