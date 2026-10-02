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

describe("cepCirculacao no payload do robô (V12.x: campo removido)", () => {
  it.each([
    ["Particular com circulação antiga", { tipo_uso: "Particular", cep_circulacao: "20040-020" }],
    ["uso vazio com circulação antiga", { cep_circulacao: "20040-020" }],
    ["comercial com circulação antiga", { tipo_uso: "Táxi", cep_circulacao: "20040-020" }],
    ["comercial sem circulação", { tipo_uso: "Táxi" }],
  ])("%s: sempre o pernoite", (_n, v) => {
    expect(circ(v)).toBe("01310100");
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

describe("gate do Calcular nunca exige CEP de circulação", () => {
  it.each(["Particular", "Táxi", ""])("uso %j sem circulação libera", (tipoUso) => {
    expect(camposFaltantesCalculo({ ...base, tipoUso })).toEqual([]);
  });
});
