import { describe, expect, it } from "vitest";
import { camposFaltantesCalculo } from "@/components/venda/novo-lead/calculoGate";
import { PERFIL_CAMPOS, perfilEscolhidoTodos } from "@/components/venda/novo-lead/types";

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
    const f = { ...BASE, perfilEscolhido: perfilEscolhidoTodos(true) };
    expect(camposFaltantesCalculo(f)).toEqual([]);
  });
});
