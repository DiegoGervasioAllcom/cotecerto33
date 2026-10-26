import { describe, expect, it } from "vitest";
import {
  camposFaltantesCalculo,
  CAMPOS_OBRIGATORIOS_CALCULO,
} from "@/components/venda/novo-lead/calculoGate";
import { aplicarRamo, formPadraoMobile } from "@/components/mobile/cotar/defaults";
import { CAMPOS_POR_PASSO, faltantesDoPasso } from "@/components/mobile/cotar/passos";
import { seguradoSchema } from "@/lib/schemas/cotacaoSegurado.schema";
import { seguroSchema } from "@/lib/schemas/cotacaoSeguro.schema";

const preenchido = () => ({
  ...formPadraoMobile(),
  cpf: "123.456.789-09",
  nome: "Fulano de Tal",
  sexo: "Masculino",
  estadoCivil: "Casado(a)",
  celular: "(11) 91234-5678",
  cep: "01001-000",
  placa: "ABC1D23",
  kmMensal: "1.000 km",
  cepPernoite: "01001-000",
});

describe("cotar mobile: defaults x gate", () => {
  it("só os campos perguntados ao usuário separam o default do gate", () => {
    const vazios = camposFaltantesCalculo(formPadraoMobile());
    const perguntados = CAMPOS_OBRIGATORIOS_CALCULO.map((c) => c.label);
    expect(vazios).toEqual(perguntados);
    // todo campo do gate é coberto por algum passo do wizard
    const cobertos = new Set(CAMPOS_POR_PASSO.flat());
    for (const c of CAMPOS_OBRIGATORIOS_CALCULO) expect(cobertos.has(c.campo)).toBe(true);
  });

  it("preenchendo os campos dos passos o gate libera (Auto e Moto)", () => {
    expect(camposFaltantesCalculo(preenchido())).toEqual([]);
    const moto = aplicarRamo(preenchido(), "Moto");
    expect(camposFaltantesCalculo(moto)).toEqual([]);
    expect(moto.seguradorasSel.length).toBeGreaterThan(0);
  });

  it("zero km fica desligado (senão o gate exige data/odômetro)", () => {
    expect(formPadraoMobile().zeroKm).toBe(false);
  });

  it("moto só leva seguradoras que existem no portal e Auto volta ao padrão", () => {
    const moto = aplicarRamo(formPadraoMobile(), "Moto");
    expect(moto.seguradorasSel).not.toContain("Aliro");
    expect(moto.seguradorasSel).not.toContain("Yelum");
    expect(aplicarRamo(moto, "Automóvel").seguradorasSel).toEqual(
      formPadraoMobile().seguradorasSel,
    );
  });

  it("defaults passam nos schemas zod do desktop", () => {
    const f = preenchido();
    expect(seguroSchema.safeParse(f).success).toBe(true);
    expect(seguradoSchema.safeParse(f).success).toBe(true);
  });

  it("faltantesDoPasso aponta os vazios por passo", () => {
    expect(faltantesDoPasso(0, formPadraoMobile())).toContain("CPF");
    expect(faltantesDoPasso(1, formPadraoMobile())).toEqual(["Placa"]);
    expect(faltantesDoPasso(2, formPadraoMobile())).toEqual(["CEP de pernoite", "Km mensal"]);
    expect(faltantesDoPasso(3, formPadraoMobile())).toEqual([]);
  });
});
