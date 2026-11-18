import { describe, expect, it } from "vitest";
import { camposFaltantesCalculo } from "@/components/venda/novo-lead/calculoGate";
import {
  PERFIL_CAMPOS,
  perfilEscolhidoTodos,
  usoEscolhidoTodos,
} from "@/components/venda/novo-lead/types";

const BASE = {
  cpf: "52998224725",
  nome: "Fulano",
  nasc: "1990-05-10",
  sexo: "M",
  estadoCivil: "Solteiro(a)",
  placa: "ABC1D23",
  cep: "01310-100",
  celular: "11999999999",
  cepPernoite: "01310-100",
  kmMensal: "1000",
  zeroKmEscolhido: true,
  tipoUso: "Particular",
  perfilEscolhido: perfilEscolhidoTodos(true),
  usoEscolhido: usoEscolhidoTodos(true),
  seguradorasSel: ["porto"],
};

describe("gate do Calcular: Perfil obrigatório", () => {
  it("nenhuma pergunta respondida lista todas as pendências", () => {
    const f = { ...BASE, perfilEscolhido: perfilEscolhidoTodos(false) };
    const faltas = camposFaltantesCalculo(f);
    for (const c of PERFIL_CAMPOS) expect(faltas).toContain(c.label);
  });

  it("falta só a que não foi respondida", () => {
    const f = {
      ...BASE,
      perfilEscolhido: { ...perfilEscolhidoTodos(true), condutor: false },
    };
    expect(camposFaltantesCalculo(f)).toEqual(["Principal condutor"]);
  });

  it("tudo respondido libera", () => {
    const f = { ...BASE };
    expect(camposFaltantesCalculo(f)).toEqual([]);
  });
});

describe("gate do Calcular: Uso do veículo obrigatório", () => {
  it("nada escolhido (Particular) lista as 4 pendências", () => {
    const f = { ...BASE, usoEscolhido: usoEscolhidoTodos(false) };
    expect(camposFaltantesCalculo(f)).toEqual([
      "Finalidade de uso",
      "Uso comercial 2+ dias/semana",
      "Uso para trabalho",
      "Uso para estudo",
    ]);
  });

  it("uso comercial só é exigido para Particular", () => {
    const f = { ...BASE, tipoUso: "Taxi", usoEscolhido: usoEscolhidoTodos(false) };
    expect(camposFaltantesCalculo(f)).not.toContain("Uso comercial 2+ dias/semana");
  });

  it("tudo escolhido libera", () => {
    expect(camposFaltantesCalculo({ ...BASE })).toEqual([]);
  });
});

describe("gate do Calcular: CEP de pernoite", () => {
  const f = { ...BASE };
  it("vazio ou incompleto bloqueia", () => {
    expect(camposFaltantesCalculo({ ...f, cepPernoite: "" })).toEqual(["CEP de pernoite"]);
    expect(camposFaltantesCalculo({ ...f, cepPernoite: "01310" })).toEqual(["CEP de pernoite"]);
  });
  it("completo libera", () => {
    expect(camposFaltantesCalculo({ ...f, cepPernoite: "01310-100" })).toEqual([]);
  });
});
