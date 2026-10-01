import { describe, expect, it } from "vitest";
import { montarPayloadQuiver, type CotacaoRow } from "@/lib/quiver.functions";
import { camposFaltantesCalculo } from "@/components/venda/novo-lead/calculoGate";
import type { Form } from "@/components/venda/novo-lead/types";

function cot(veiculo: Record<string, unknown>): CotacaoRow {
  return {
    id: "c1",
    segurado: {},
    seguro: { seguradoras_sel: ["Porto"] },
    veiculo,
    perfil: { cep_pernoite: "01310-100" },
    coberturas: {},
  };
}
const circ = (v: Record<string, unknown>) =>
  (montarPayloadQuiver(cot(v)).veiculo as Record<string, string>).cepCirculacao;

describe("cepCirculacao no payload do robô (V12.x)", () => {
  it("Particular usa o pernoite mesmo com circulação antiga no rascunho", () => {
    expect(circ({ tipo_uso: "Particular", cep_circulacao: "20040-020" })).toBe("01310100");
  });
  it("tipo de uso vazio usa o pernoite", () => {
    expect(circ({ cep_circulacao: "20040-020" })).toBe("01310100");
  });
  it("uso comercial usa a circulação", () => {
    expect(circ({ tipo_uso: "Táxi", cep_circulacao: "20040-020" })).toBe("20040020");
  });
  it("uso comercial sem circulação cai no pernoite", () => {
    expect(circ({ tipo_uso: "Táxi" })).toBe("01310100");
  });
});

const base = {
  cpf: "1",
  nome: "n",
  sexo: "F",
  estadoCivil: "Casado",
  placa: "ABC1D23",
  email: "a@b.c",
  cep: "1",
  celular: "1",
  cepPernoite: "1",
  kmMensal: "1",
  seguradorasSel: ["Porto"],
  cepCirculacao: "",
} as unknown as Form;

describe("gate do Calcular com CEP de circulação", () => {
  it("Particular sem circulação libera", () => {
    expect(camposFaltantesCalculo({ ...base, tipoUso: "Particular" })).toEqual([]);
  });
  it("comercial sem circulação bloqueia", () => {
    expect(camposFaltantesCalculo({ ...base, tipoUso: "Táxi" })).toContain("CEP de circulação");
  });
  it("comercial com circulação libera", () => {
    expect(
      camposFaltantesCalculo({ ...base, tipoUso: "Táxi", cepCirculacao: "20040-020" }),
    ).toEqual([]);
  });
});
