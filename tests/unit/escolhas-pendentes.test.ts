import { describe, expect, it } from "vitest";
import {
  aplicarPendentes,
  chavesPendentes,
  todasPendentes,
} from "@/components/venda/novo-lead/escolhas";
import { camposFaltantesCalculo } from "@/components/venda/novo-lead/calculoGate";
import {
  dadosEscolhidosTodos,
  perfilEscolhidoTodos,
  usoEscolhidoTodos,
} from "@/components/venda/novo-lead/types";

const todos = (v: boolean) => ({
  zeroKmEscolhido: v,
  perfilEscolhido: perfilEscolhidoTodos(v),
  usoEscolhido: usoEscolhidoTodos(v),
  dadosEscolhidos: dadosEscolhidosTodos(v),
});

describe("escolhas pendentes (persistência no banco)", () => {
  it("tudo respondido não gera chaves", () => {
    expect(chavesPendentes(todos(true))).toEqual([]);
  });

  it("ida e volta: o que ficou pendente volta pendente", () => {
    const e = {
      ...todos(true),
      dadosEscolhidos: { ...dadosEscolhidosTodos(true), combustivel: false },
    };
    const chaves = chavesPendentes(e);
    expect(chaves).toEqual(["dados:combustivel"]);
    expect(aplicarPendentes(chaves)).toEqual(e);
  });

  it("cotação nova (tudo pendente) sobrevive a salvar e reabrir", () => {
    const chaves = chavesPendentes(todos(false));
    expect(chaves).toContain("zeroKm");
    expect(chaves).toContain("perfil:garagem");
    expect(chaves).toContain("uso:tipoUso");
    expect(chaves).toContain("dados:tipoSeguro");
    expect(aplicarPendentes(chaves)).toEqual(todos(false));
  });

  it("cotação nunca salva pelo wizard (lead distribuído): tudo pendente", () => {
    const chaves = todasPendentes();
    expect(chaves).toHaveLength(14);
    expect(chaves).toEqual(chavesPendentes(todos(false)));
    expect(aplicarPendentes(chaves)).toEqual(todos(false));
  });

  it("lista vazia/ausente (cotações antigas e mobile) = tudo respondido", () => {
    expect(aplicarPendentes([])).toEqual(todos(true));
    expect(aplicarPendentes(null)).toEqual(todos(true));
  });
});

describe("gate: Tipo de seguro, cálculo e combustível", () => {
  const BASE = {
    cpf: "52998224725",
    nome: "F",
    nasc: "1990-05-10",
    sexo: "M",
    estadoCivil: "S",
    placa: "ABC1D23",
    cep: "1",
    celular: "1",
    cepPernoite: "01310-100",
    kmMensal: "1",
    tipoUso: "Particular",
    seguradorasSel: ["porto"],
    ...todos(true),
  };
  it("lista as 3 pendências", () => {
    const f = { ...BASE, dadosEscolhidos: dadosEscolhidosTodos(false) };
    expect(camposFaltantesCalculo(f)).toEqual(["Tipo de seguro", "Tipo de cálculo", "Combustível"]);
  });
  it("tudo respondido libera", () => {
    expect(camposFaltantesCalculo(BASE)).toEqual([]);
  });
});
