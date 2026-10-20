import { describe, expect, it } from "vitest";
import {
  camposTokioPayload,
  dataEmDiasSp,
  ehSeguradoraTokio,
  erroDadosTokio,
  erroVencimentoTokio,
  vencimentoPadraoTokio,
} from "@/lib/transmissao-tokio";
import {
  dadosComplementaresTransmissaoPortoSchema,
  dadosComplementaresTransmissaoSchema,
  validarDadosComplementaresTokio,
} from "@/components/venda/novo-lead/steps/TransmissaoDadosComplementares.schema";

// 19/10/2026 às 12:00 em São Paulo (15:00 UTC).
const AGORA = new Date("2026-10-19T15:00:00Z");

describe("Tokio — detecção e datas (fuso de São Paulo)", () => {
  it.each(["tokio", "Tokio", " tokio "])("%s é a Tokio", (n) => {
    expect(ehSeguradoraTokio(n)).toBe(true);
  });
  it.each(["porto", "Suhai", ""])("%s não é a Tokio", (n) => {
    expect(ehSeguradoraTokio(n)).toBe(false);
  });

  it("o vencimento padrão é hoje + 7 dias", () => {
    expect(vencimentoPadraoTokio(AGORA)).toBe("26/10/2026");
    expect(vencimentoPadraoTokio(AGORA, "Débito/PIX Aut")).toBe("27/10/2026");
    expect(vencimentoPadraoTokio(AGORA, "Cartão de Crédito")).toBe("26/10/2026");
    expect(dataEmDiasSp(0, AGORA)).toBe("19/10/2026");
  });

  it("usa o dia de São Paulo, não o de UTC (23h30 em SP já é o dia seguinte em UTC)", () => {
    const tarde = new Date("2026-10-20T02:30:00Z"); // 19/10 23:30 em SP
    expect(dataEmDiasSp(0, tarde)).toBe("19/10/2026");
    expect(vencimentoPadraoTokio(tarde)).toBe("26/10/2026");
  });
});

describe("erroVencimentoTokio", () => {
  it("aceita hoje e datas futuras reais", () => {
    expect(erroVencimentoTokio("19/10/2026", AGORA)).toBeNull();
    expect(erroVencimentoTokio("26/10/2026", AGORA)).toBeNull();
  });
  it("exige o valor", () => {
    expect(erroVencimentoTokio("", AGORA)).toMatch(/Informe o vencimento/);
    expect(erroVencimentoTokio(undefined, AGORA)).toMatch(/Informe o vencimento/);
  });
  it("recusa data passada, formato errado e data inexistente", () => {
    expect(erroVencimentoTokio("18/10/2026", AGORA)).toMatch(/passada/);
    expect(erroVencimentoTokio("2026-10-26", AGORA)).toMatch(/dd\/mm\/aaaa/);
    expect(erroVencimentoTokio("31/02/2027", AGORA)).toMatch(/dd\/mm\/aaaa/);
  });
  it("a mensagem nunca repete o valor digitado", () => {
    expect(erroVencimentoTokio("18/10/2026", AGORA)).not.toContain("18/10/2026");
  });
});

const dadosOk = {
  rendaMensal: "Até R$ 2.500,00",
  pessoaPoliticamenteExposta: "Não",
  vencimentoPrimeiraParcela: "26/10/2026",
};

describe("erroDadosTokio (servidor)", () => {
  it("passa com tudo certo, e com telefone fixo válido", () => {
    expect(erroDadosTokio("tokio", "Auto", dadosOk, AGORA)).toBeNull();
    expect(
      erroDadosTokio(
        "tokio",
        "Auto Clássico",
        { ...dadosOk, dddTelefoneResidencial: "11", telefoneResidencial: "33334444" },
        AGORA,
      ),
    ).toBeNull();
  });
  it("aceita as opções de renda exclusivas da Tokio", () => {
    for (const renda of ["Não desejo informar", "Sem Renda"]) {
      expect(erroDadosTokio("tokio", "Auto", { ...dadosOk, rendaMensal: renda }, AGORA)).toBeNull();
    }
  });
  it("exige o produto (a conferência na Confirmação é por igualdade)", () => {
    expect(erroDadosTokio("tokio", undefined, dadosOk, AGORA)).toMatch(/Produto da Tokio/);
    expect(erroDadosTokio("tokio", "  ", dadosOk, AGORA)).toMatch(/Produto da Tokio/);
  });
  it("exige renda, PEP e vencimento válidos", () => {
    expect(erroDadosTokio("tokio", "Auto", { ...dadosOk, rendaMensal: "xx" }, AGORA)).toMatch(
      /renda/,
    );
    expect(
      erroDadosTokio("tokio", "Auto", { ...dadosOk, pessoaPoliticamenteExposta: undefined }, AGORA),
    ).toMatch(/politicamente/);
    expect(
      erroDadosTokio(
        "tokio",
        "Auto",
        { ...dadosOk, vencimentoPrimeiraParcela: "01/01/2020" },
        AGORA,
      ),
    ).toMatch(/passada/);
  });
  it("bloqueia celular no telefone fixo", () => {
    expect(
      erroDadosTokio(
        "tokio",
        "Auto",
        { ...dadosOk, dddTelefoneResidencial: "11", telefoneResidencial: "967922075" },
        AGORA,
      ),
    ).toMatch(/celular não é aceito/);
  });
  it("não exige nada de outras seguradoras", () => {
    expect(erroDadosTokio("Porto", undefined, undefined, AGORA)).toBeNull();
    expect(erroDadosTokio("Suhai", undefined, {}, AGORA)).toBeNull();
  });
});

describe("camposTokioPayload", () => {
  it("só para a Tokio, com o telefone só em dígitos", () => {
    const d = {
      ...dadosOk,
      dddTelefoneResidencial: "11",
      telefoneResidencial: "3333-4444",
    };
    expect(camposTokioPayload("tokio", d)).toEqual({
      rendaMensal: "Até R$ 2.500,00",
      pessoaPoliticamenteExposta: "Não",
      vencimentoPrimeiraParcela: "26/10/2026",
      telefoneResidencial: { ddd: "11", numero: "33334444" },
    });
    expect(camposTokioPayload("Porto", d)).toEqual({});
    expect(camposTokioPayload("Suhai", d)).toEqual({});
  });
  it("sem telefone fixo, a chave não vai (o robô repete o celular do segurado)", () => {
    expect(camposTokioPayload("tokio", dadosOk)).not.toHaveProperty("telefoneResidencial");
    expect(camposTokioPayload("tokio", undefined)).toEqual({});
  });
});

describe("schema dos dados complementares — Tokio", () => {
  // Sem RG, data/órgão emissor, renavam, cor, dia de vencimento nem e-mail de envio: a Tokio não os tem.
  const base = {
    cepResidencial: "04567-090",
    numeroEndereco: "123",
    email: "cliente@email.com",
    mesmoEnderecoCorrespondencia: true,
    enderecoCorrespondencia: {
      cep: "",
      logradouro: "",
      numero: "",
      bairro: "",
      cidade: "",
      uf: "",
    },
    // O estado do formulário guarda os campos que a Tokio não tem como "" — a validação não pode recusá-los.
    rg: "",
    dataEmissaoRg: "",
    orgaoEmissorRg: "",
    renavam: "",
    corVeiculo: "",
    diaVencimentoDemaisParcelas: "",
    desejaReceberPropostaPorEmail: "Não",
  };
  const hoje = new Date();
  const dd = (n: number) => String(n).padStart(2, "0");
  const amanha = new Date(hoje.getTime() + 2 * 86_400_000);
  const futuro = `${dd(amanha.getDate())}/${dd(amanha.getMonth() + 1)}/${amanha.getFullYear()}`;
  const tokio = {
    ...base,
    rendaMensal: "Sem Renda",
    pessoaPoliticamenteExposta: "Não",
    vencimentoPrimeiraParcela: futuro,
  };

  it('aceita o estado real do formulário (RG, renavam, cor e dia como "") e devolve o formato esperado', () => {
    const r = validarDadosComplementaresTokio(tokio as never);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.rg).toBe("");
      expect(r.data.renavam).toBe("");
      expect(r.data.rendaMensal).toBe("Sem Renda");
    }
  });
  it("aceita sem RG, renavam e cor", () => {
    expect(validarDadosComplementaresTokio(tokio as never).success).toBe(true);
  });
  it("exige renda, PEP e vencimento", () => {
    for (const campo of [
      "rendaMensal",
      "pessoaPoliticamenteExposta",
      "vencimentoPrimeiraParcela",
    ]) {
      const r = validarDadosComplementaresTokio({
        ...tokio,
        [campo]: undefined,
      } as never);
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues.some((i) => i.path[0] === campo)).toBe(true);
    }
  });
  it("recusa celular no telefone fixo, no campo certo", () => {
    const r = validarDadosComplementaresTokio({
      ...tokio,
      dddTelefoneResidencial: "11",
      telefoneResidencial: "967922075",
    } as never);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.find((i) => i.path[0] === "telefoneResidencial")?.message).toMatch(
        /celular não é aceito/,
      );
    }
  });
  it("a Porto continua com as 4 faixas de renda: 'Sem Renda' não vale nela", () => {
    const porto = {
      ...base,
      rg: "123456789",
      dataEmissaoRg: "15/08/2020",
      orgaoEmissorRg: "SSP",
      renavam: "12345678901",
      corVeiculo: "Branco",
      diaVencimentoDemaisParcelas: "10",
      desejaReceberPropostaPorEmail: "Não",
      pessoaPoliticamenteExposta: "Não",
      ramoAtividade: "Advogados",
    };
    expect(
      dadosComplementaresTransmissaoPortoSchema.safeParse({
        ...porto,
        rendaMensal: "Até R$ 2.500,00",
      }).success,
    ).toBe(true);
    expect(
      dadosComplementaresTransmissaoPortoSchema.safeParse({ ...porto, rendaMensal: "Sem Renda" })
        .success,
    ).toBe(false);
  });
  it("as outras seguradoras continuam exigindo RG, renavam e cor", () => {
    const r = dadosComplementaresTransmissaoSchema.safeParse(tokio);
    expect(r.success).toBe(false);
    if (!r.success) {
      const campos = r.error.issues.map((i) => i.path[0]);
      expect(campos).toContain("rg");
      expect(campos).toContain("renavam");
    }
  });
});
