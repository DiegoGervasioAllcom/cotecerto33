import { describe, expect, it } from "vitest";
import { ehAreaDaFull, resolveNavExperiencia } from "@/lib/nav-experience";
import type { AreaChave } from "@/lib/use-areas";

describe("resolveNavExperiencia", () => {
  it.each([
    [
      "vendedor",
      {
        role: "vendedor",
        isFranqIndividual: false,
        isFranqFull: false,
        isGroupView: false,
        franqPend: false,
      },
      { venLike: true, fullLike: false, grpLike: false },
    ],
    [
      "franquia Individual",
      {
        role: "franqueado",
        isFranqIndividual: true,
        isFranqFull: false,
        isGroupView: false,
        franqPend: false,
      },
      { venLike: true, fullLike: false, grpLike: false },
    ],
    [
      "franquia Full — ganha o menu novo, não o de grupo",
      {
        role: "franqueado",
        isFranqIndividual: false,
        isFranqFull: true,
        isGroupView: true,
        franqPend: false,
      },
      { venLike: false, fullLike: true, grpLike: false },
    ],
    [
      "master",
      {
        role: "master",
        isFranqIndividual: false,
        isFranqFull: false,
        isGroupView: true,
        franqPend: false,
      },
      { venLike: false, fullLike: false, grpLike: true },
    ],
    [
      "supervisor — é time interno, não usa nenhuma das 3 (nav por área)",
      {
        role: "supervisor",
        isFranqIndividual: false,
        isFranqFull: false,
        isGroupView: true,
        franqPend: false,
      },
      { venLike: false, fullLike: false, grpLike: false },
    ],
    [
      "matriz — nenhuma das 3 (nav por área)",
      {
        role: "matriz",
        isFranqIndividual: false,
        isFranqFull: false,
        isGroupView: false,
        franqPend: false,
      },
      { venLike: false, fullLike: false, grpLike: false },
    ],
    [
      "franqueado com modalidade ainda carregando — nenhuma das 3, pra não piscar",
      {
        role: "franqueado",
        isFranqIndividual: false,
        isFranqFull: false,
        isGroupView: false,
        franqPend: true,
      },
      { venLike: false, fullLike: false, grpLike: false },
    ],
  ] as const)("%s", (_label, input, expected) => {
    expect(resolveNavExperiencia(input)).toEqual(expected);
  });
});

describe("ehAreaDaFull", () => {
  const TODAS_AS_AREAS: AreaChave[] = [
    "mdash",
    "mleads",
    "mdist",
    "maprov",
    "mfranq",
    "mvend",
    "msuperv",
    "mpipe",
    "mvendas",
    "mcomm",
    "mprem",
    "mestorno",
    "mren",
    "mrel",
    "mmsgs",
    "macessos",
    "mconf",
  ];

  it("exclui só Franquias e Configurações globais (regra 8)", () => {
    expect(ehAreaDaFull("mfranq")).toBe(false);
    expect(ehAreaDaFull("mconf")).toBe(false);
  });

  it("mantém as outras 15 áreas do time interno", () => {
    const restantes = TODAS_AS_AREAS.filter(ehAreaDaFull);
    expect(restantes).toHaveLength(15);
    expect(restantes).not.toContain("mfranq");
    expect(restantes).not.toContain("mconf");
  });
});
