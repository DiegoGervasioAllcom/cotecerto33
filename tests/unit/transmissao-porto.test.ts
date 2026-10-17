import { describe, expect, it } from "vitest";
import {
  camposPortoPayload,
  ehSeguradoraPorto,
  erroDeclaracoesPorto,
} from "@/lib/transmissao-porto";
import { RAMOS_ATIVIDADE_PORTO } from "@/components/venda/novo-lead/enumsRamoAtividade";

const declaracoesOk = {
  rendaMensal: "Até R$ 2.500,00",
  ramoAtividade: "Advogados",
  pessoaPoliticamenteExposta: "Não",
} as const;

describe("transmissão Porto — detecção da seguradora", () => {
  it.each(["Porto", "porto", "Porto Seguro", " porto seguro "])("%s é a Porto", (nome) => {
    expect(ehSeguradoraPorto(nome)).toBe(true);
  });
  it.each(["Suhai", "Azul", "Mapfre", ""])("%s não é a Porto", (nome) => {
    expect(ehSeguradoraPorto(nome)).toBe(false);
  });
});

describe("transmissão Porto — catálogo do Ramo de Atividade", () => {
  it("é uma lista fechada, sem vazios nem duplicados, com o texto exato do portal", () => {
    expect(RAMOS_ATIVIDADE_PORTO.length).toBeGreaterThan(100);
    expect(new Set(RAMOS_ATIVIDADE_PORTO).size).toBe(RAMOS_ATIVIDADE_PORTO.length);
    expect(RAMOS_ATIVIDADE_PORTO.every((r) => r.trim() === r && r.length > 0)).toBe(true);
    // O robô casa pelo texto: o catálogo do Ramo é DIFERENTE da lista de profissões do condutor.
    expect(RAMOS_ATIVIDADE_PORTO).toContain("Advogados");
  });
});

describe("transmissão Porto — validação no servidor (declarações)", () => {
  it("passa com renda, ramo e PEP válidos", () => {
    expect(erroDeclaracoesPorto("Porto", declaracoesOk)).toBeNull();
  });

  it("não exige nada de outras seguradoras", () => {
    expect(erroDeclaracoesPorto("Suhai", undefined)).toBeNull();
    expect(erroDeclaracoesPorto("Azul", {})).toBeNull();
  });

  it.each([
    ["sem declarações", undefined, /renda/i],
    ["sem renda", { ...declaracoesOk, rendaMensal: undefined }, /renda/i],
    ["renda fora da lista", { ...declaracoesOk, rendaMensal: "10 mil" }, /renda/i],
    ["sem PEP", { ...declaracoesOk, pessoaPoliticamenteExposta: undefined }, /politicamente/i],
    [
      "PEP fora da lista",
      { ...declaracoesOk, pessoaPoliticamenteExposta: "Talvez" },
      /politicamente/i,
    ],
    ["sem ramo", { ...declaracoesOk, ramoAtividade: undefined }, /ramo/i],
    [
      "ramo fora do catálogo (texto livre)",
      { ...declaracoesOk, ramoAtividade: "Advogado" },
      /ramo/i,
    ],
  ])("recusa %s", (_nome, declaracoes, esperado) => {
    expect(erroDeclaracoesPorto("Porto", declaracoes)).toMatch(esperado);
  });
});

describe("transmissão Porto — campos extras do payload", () => {
  it("franquia vem da opção escolhida, para qualquer seguradora", () => {
    expect(camposPortoPayload("Suhai", { tipo: "normal 100%" }, undefined)).toEqual({
      franquia: "normal 100%",
    });
    expect(camposPortoPayload("Porto", { tipo: " reduzida 75% " }, undefined)).toEqual({
      franquia: "reduzida 75%",
    });
  });

  it("sem opção ou sem tipo, não envia franquia (o robô pede a escolha se precisar)", () => {
    expect(camposPortoPayload("Porto", undefined, undefined)).toEqual({});
    expect(camposPortoPayload("Porto", { tipo: "" }, undefined)).toEqual({});
  });

  it("as declarações só saem para a Porto", () => {
    expect(camposPortoPayload("Porto", { tipo: "normal 100%" }, declaracoesOk)).toEqual({
      franquia: "normal 100%",
      ...declaracoesOk,
    });
    // dado pessoal que não precisa ir às outras seguradoras
    expect(camposPortoPayload("Suhai", { tipo: "normal 100%" }, declaracoesOk)).toEqual({
      franquia: "normal 100%",
    });
  });
});

describe("transmissão Porto — telefones fixos", () => {
  it("passa sem telefones (opcionais) e com telefones fixos válidos", () => {
    expect(erroDeclaracoesPorto("Porto", declaracoesOk)).toBeNull();
    expect(
      erroDeclaracoesPorto("Porto", {
        ...declaracoesOk,
        dddTelefoneResidencial: "11",
        telefoneResidencial: "33334444",
        dddTelefoneComercial: "11",
        telefoneComercial: "22223333",
      }),
    ).toBeNull();
  });

  it("bloqueia no servidor um celular no telefone fixo (a Porto recusaria a venda)", () => {
    const erro = erroDeclaracoesPorto("Porto", {
      ...declaracoesOk,
      dddTelefoneResidencial: "11",
      telefoneResidencial: "967922075",
    });
    expect(erro).toMatch(/residencial/);
    expect(erro).not.toContain("967922075");
    expect(
      erroDeclaracoesPorto("Porto", {
        ...declaracoesOk,
        dddTelefoneComercial: "11",
        telefoneComercial: "967922075",
      }),
    ).toMatch(/comercial/);
  });

  it("os telefones só saem no payload para a Porto, sem máscara", () => {
    const d = {
      ...declaracoesOk,
      dddTelefoneResidencial: "11",
      telefoneResidencial: "3333-4444",
      dddTelefoneComercial: "21",
      telefoneComercial: "2222-3333",
    };
    const porto = camposPortoPayload("Porto", undefined, d);
    expect(porto.telefoneResidencial).toEqual({ ddd: "11", numero: "33334444" });
    expect(porto.telefoneComercial).toEqual({ ddd: "21", numero: "22223333" });
    expect(camposPortoPayload("Suhai", undefined, d)).toEqual({});
  });

  it("sem telefone preenchido, o payload não leva a chave (o robô limpa o celular copiado)", () => {
    const campos = camposPortoPayload("Porto", undefined, declaracoesOk);
    expect(campos).not.toHaveProperty("telefoneResidencial");
    expect(campos).not.toHaveProperty("telefoneComercial");
  });
});
