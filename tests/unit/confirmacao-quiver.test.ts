import { describe, it, expect } from "vitest";
import {
  formatarDataBr,
  montarConfirmacaoQuiver,
  normalizarEstadoCivil,
} from "../../src/components/venda/novo-lead/steps/transmissao/confirmacao-quiver";
import type { Form } from "../../src/components/venda/novo-lead/types";
import type { DadosComplementaresTransmissao } from "../../src/components/venda/novo-lead/steps/TransmissaoDadosComplementares.schema";

// O teste só lê os campos que a função usa; o resto do Form fica de fora.
function form(parcial: Partial<Form>): Form {
  return parcial as Form;
}

const DADOS: DadosComplementaresTransmissao = {
  rg: "1",
  dataEmissaoRg: "01/01/2020",
  orgaoEmissorRg: "SSP",
  cepResidencial: "01001-000",
  numeroEndereco: "1",
  mesmoEnderecoCorrespondencia: true,
  enderecoCorrespondencia: { cep: "", logradouro: "", numero: "", bairro: "", cidade: "", uf: "" },
  renavam: "12345678901",
  corVeiculo: "Branco",
  diaVencimentoDemaisParcelas: "10",
  desejaReceberPropostaPorEmail: "Não",
};

const BASE = form({
  marca: "Chevrolet",
  modelo: "Cobalt LTZ",
  anoModelo: "2015",
  placa: "FTP4J82",
  chassi: "9BGJC69Z0FB105973",
  sexo: "Masculino",
  estadoCivil: "Solteiro(a)",
  condutorMesmo: "sim",
  tipoGaragem: "Sim, com portão manual",
  usoTrabalho: "Não trabalha",
  usoEstudo: "Não estuda",
  tipoUso: "Particular",
  usoComercialDoisDias: "nao",
  categoriaTaxi: "",
  utilizacaoLocadora: "",
  rcfDm: "50000",
  rcfDc: "50000",
  danosMorais: "R$ 0,00",
});

const RES = { seguradora: "Suhai", produto: "Roubo e Furto + PT Colisão" };

function valor(conf: ReturnType<typeof montarConfirmacaoQuiver>, bloco: string, rotulo: string) {
  return conf.blocos.find((b) => b.titulo === bloco)?.linhas.find((l) => l.rotulo === rotulo)
    ?.valor;
}

describe("utilitários", () => {
  it("formata data ISO e preserva o resto", () => {
    expect(formatarDataBr("2026-10-01")).toBe("01/10/2026");
    expect(formatarDataBr("01/10/2026")).toBe("01/10/2026");
    expect(formatarDataBr("")).toBe("—");
  });
  it("normaliza estado civil", () => {
    expect(normalizarEstadoCivil("Solteiro(a)")).toBe("Solteiro");
    expect(normalizarEstadoCivil("União estável")).toBe("União estável");
    expect(normalizarEstadoCivil("")).toBe("—");
  });
});

describe("montarConfirmacaoQuiver", () => {
  it("monta título e os três blocos na ordem do portal", () => {
    const c = montarConfirmacaoQuiver(BASE, RES, DADOS, { fipeValor: "R$ 43.182,00" });
    expect(c.titulo).toBe("Confirmação — Roubo e Furto + PT Colisão");
    expect(c.blocos.map((b) => b.titulo)).toEqual(["Dados do veículo", "Perfil", "Coberturas"]);
    expect(valor(c, "Dados do veículo", "Valor Fipe")).toBe("R$ 43.182,00");
    expect(valor(c, "Dados do veículo", "Chassi")).toBe("9BGJC69Z0FB105973");
    expect(valor(c, "Perfil", "Estado civil")).toBe("Solteiro");
    expect(valor(c, "Perfil", "Garagem na residência")).toBe("Sim, com portão manual");
    expect(valor(c, "Coberturas", "Danos Materiais")).toMatch(/50\.000,00/);
    expect(valor(c, "Coberturas", "Danos Morais")).toBe("R$ 0,00");
    expect(c.avisos).toEqual([]);
  });

  it("sexo do condutor segue o segurado quando condutor é o mesmo", () => {
    const c = montarConfirmacaoQuiver(BASE, RES, DADOS);
    expect(valor(c, "Perfil", "Sexo do condutor")).toBe("Masculino");
  });

  it("condutor diferente usa o sexo do condutor", () => {
    const c = montarConfirmacaoQuiver(
      { ...BASE, condutorMesmo: "nao", condSexo: "Feminino" },
      RES,
      DADOS,
    );
    expect(valor(c, "Perfil", "Sexo do condutor")).toBe("Feminino");
  });

  it("utilização: táxi e locadora usam o campo específico", () => {
    const taxi = montarConfirmacaoQuiver(
      { ...BASE, tipoUso: "Táxi", categoriaTaxi: "Comum" },
      RES,
      DADOS,
    );
    expect(valor(taxi, "Perfil", "Utilização do veículo")).toBe("Comum");
    expect(valor(taxi, "Perfil", "Uso comercial 2+ dias/semana")).toBeUndefined();
    const loc = montarConfirmacaoQuiver(
      { ...BASE, tipoUso: "Locadora (Contrato)", utilizacaoLocadora: "Uso próprio" },
      RES,
      DADOS,
    );
    expect(valor(loc, "Perfil", "Utilização do veículo")).toBe("Uso próprio");
  });

  it("particular mostra uso comercial 2+ dias", () => {
    const c = montarConfirmacaoQuiver({ ...BASE, usoComercialDoisDias: "sim" }, RES, DADOS);
    expect(valor(c, "Perfil", "Uso comercial 2+ dias/semana")).toBe("Sim");
    expect(valor(c, "Perfil", "Utilização do veículo")).toBe("Particular");
  });

  it("campos ausentes aparecem como travessão, sem inventar", () => {
    const c = montarConfirmacaoQuiver(form({}), { seguradora: "Suhai" }, null);
    expect(c.titulo).toBe("Confirmação");
    expect(valor(c, "Dados do veículo", "Código Fipe")).toBe("—");
    expect(valor(c, "Dados do veículo", "Valor Fipe")).toBe("—");
    expect(valor(c, "Dados do veículo", "Modelo")).toBe("—");
    expect(valor(c, "Perfil", "Estado civil")).toBe("—");
    expect(valor(c, "Coberturas", "Danos Morais")).toBe("—");
    expect(c.avisos).toEqual([]);
  });

  it("avisa correspondência diferente", () => {
    const c = montarConfirmacaoQuiver(BASE, RES, { ...DADOS, mesmoEnderecoCorrespondencia: false });
    expect(c.avisos).toHaveLength(1);
    expect(c.avisos[0]).toContain("endereço residencial");
  });
});
