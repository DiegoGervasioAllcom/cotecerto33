import { describe, expect, it } from "vitest";
import { camposFaltantesCalculo } from "@/components/venda/novo-lead/calculoGate";
import type { Form } from "@/components/venda/novo-lead/types";

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
  zeroKm: false,
  dataSaidaConcessionaria: "",
  odometro: "",
} as unknown as Form;

const DATA = "Data de saída da concessionária";
const ODO = "Odômetro (km)";

describe("gate do Calcular com Zero km", () => {
  it("zeroKm sem data e sem odômetro: faltam os dois", () => {
    expect(camposFaltantesCalculo({ ...base, zeroKm: true })).toEqual([DATA, ODO]);
  });
  it("zeroKm sem data: falta a data", () => {
    expect(camposFaltantesCalculo({ ...base, zeroKm: true, odometro: "10" })).toEqual([DATA]);
  });
  it("zeroKm sem odômetro: falta o odômetro", () => {
    expect(
      camposFaltantesCalculo({ ...base, zeroKm: true, dataSaidaConcessionaria: "2026-09-01" }),
    ).toEqual([ODO]);
  });
  it("zeroKm só com espaços conta como vazio", () => {
    expect(
      camposFaltantesCalculo({
        ...base,
        zeroKm: true,
        dataSaidaConcessionaria: " ",
        odometro: " ",
      }),
    ).toEqual([DATA, ODO]);
  });
  it("zeroKm com ambos preenchidos libera", () => {
    expect(
      camposFaltantesCalculo({
        ...base,
        zeroKm: true,
        dataSaidaConcessionaria: "2026-09-01",
        odometro: "10",
      }),
    ).toEqual([]);
  });
  it("sem zeroKm, campos vazios liberam", () => {
    expect(camposFaltantesCalculo(base)).toEqual([]);
  });
  it("sem zeroKm, campos escondidos preenchidos não interferem", () => {
    expect(
      camposFaltantesCalculo({ ...base, dataSaidaConcessionaria: "2026-09-01", odometro: "5" }),
    ).toEqual([]);
  });
});
