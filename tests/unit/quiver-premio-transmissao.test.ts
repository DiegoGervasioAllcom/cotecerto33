import { describe, expect, it } from "vitest";
import { calcularPremioTransmissao } from "@/components/venda/cotacoes/quiver-resultado";

/**
 * Ajustes pós-deploy V12 (item 2, regra 2 do AGENTS.md — dinheiro no
 * servidor): `calcularPremioTransmissao` é a função pura que
 * `transmitirPropostaQuiver` usa para recalcular o prêmio a partir de
 * `cotacoes.quiver_resultado_raw`, em vez de confiar no valor calculado no
 * front. Base de comissão/desconto com parcelamento = nº de parcelas × valor
 * da parcela (mesma regra de `fn_premio_total_de_parcelas`,
 * `supabase/migrations/20260928090000_premio_base_soma_parcelas.sql`).
 */

const CARD_AVISTA = {
  seguradora: "Seguradora Alfa",
  produto: "Auto Completo",
  produtoId: "10290_81",
  // Produto só à vista (sem `parcelas`) — a opção escolhida pelo front chega
  // com `parcelasEscolhidas: ""`.
  opcoes: [
    {
      tipo: "Compreensiva",
      franquia: "Reduzida · R$ 2.450,00",
      avista: "R$ 2.345,67",
    },
  ],
  formaPagamento: "Boleto",
};

const CARD_PARCELADO_MATCH = {
  seguradora: "Seguradora Alfa",
  produto: "Auto Completo",
  produtoId: "10290_81",
  opcoes: [
    {
      tipo: "Compreensiva",
      franquia: "Reduzida · R$ 2.450,00",
      avista: "R$ 2.345,67",
      parcelas: "10x de R$ 251,90",
    },
  ],
  formaPagamento: "Boleto",
};

const CARD_SO_PARCELADO = {
  seguradora: "Suhai",
  produto: "Roubo e Furto c/ Assistência",
  produtoId: "suhai-rf",
  opcoes: [
    {
      tipo: "Roubo e furto",
      franquia: "Sem franquia",
      parcelas: "em 12x de R$ 463,20",
    },
  ],
  formaPagamento: "Boleto",
};

const CARD_3X_SEM_JUROS = {
  seguradora: "Yelum",
  produto: "Auto Flex",
  produtoId: "yelum-flex",
  opcoes: [
    {
      tipo: "Compreensiva",
      franquia: "Normal",
      parcelas: "3x sem juros de R$ 429,25",
    },
  ],
  formaPagamento: "Cartão",
};

const CARD_SEM_QUANTIDADE = {
  seguradora: "Mapfre",
  produto: "Auto Essencial",
  produtoId: "mapfre-essencial",
  opcoes: [
    {
      tipo: "Compreensiva",
      franquia: "Normal",
      // texto sem quantidade de parcelas — não dá pra extrair com segurança
      parcelas: "sem juros de R$ 429,25",
    },
  ],
  formaPagamento: "Boleto",
};

// Textos reais gravados em produção por versões anteriores do robô/front
// (ver `cotacao_transmissoes.parcelas`) — sem o "de" entre "Nx" e o valor,
// ou com asterisco solto no fim. `extrairParcelamento` precisa tratar os
// dois do mesmo jeito que "10x de R$ ...".
const CARD_PARCELADO_SEM_DE = {
  seguradora: "Porto",
  produto: "Auto Porto",
  produtoId: "porto-auto",
  opcoes: [
    {
      tipo: "Compreensiva",
      franquia: "Normal",
      parcelas: "em 12x de R$ 623,92",
    },
  ],
  formaPagamento: "Boleto",
};

const CARD_PARCELADO_COM_ASTERISCO = {
  seguradora: "Azul",
  produto: "Auto Azul",
  produtoId: "azul-auto",
  opcoes: [
    {
      tipo: "Compreensiva",
      franquia: "Normal",
      parcelas: "3x R$ 429,25 *",
    },
  ],
  formaPagamento: "Cartão",
};

// Card com duas variantes de opção (mesmo bundle tipo/franquia/avista),
// diferindo só no texto de `parcelas` escolhido: uma com o texto "À vista
// R$ ..." literal gravado por versões antigas do front, outra sem `parcelas`
// (front atual manda `parcelasEscolhidas: ""`). Ambas precisam cair no
// mesmo cálculo à vista, a partir de `avista`, nunca do texto de parcelas.
const CARD_AVISTA_TEXTO_LITERAL = {
  seguradora: "Bradesco",
  produto: "Auto Bradesco",
  produtoId: "bradesco-auto",
  opcoes: [
    {
      tipo: "Compreensiva",
      franquia: "Normal",
      avista: "R$ 1.287,74",
      parcelas: "À vista R$ 1.287,74",
    },
    {
      tipo: "Compreensiva",
      franquia: "Normal",
      avista: "R$ 1.287,74",
    },
  ],
  formaPagamento: "Boleto",
};

function raw(cards: unknown[]) {
  return { temPremios: true, cards };
}

describe("calcularPremioTransmissao", () => {
  it("à vista: usa o valor de `avista` do card/opção", () => {
    const resultado = calcularPremioTransmissao(raw([CARD_AVISTA]), {
      seguradora: "Seguradora Alfa",
      produtoId: "10290_81",
      formaPagamento: "Boleto",
      parcelasEscolhidas: "",
      opcao: {
        tipo: "Compreensiva",
        franquia: "Reduzida · R$ 2.450,00",
        avista: "R$ 2.345,67",
      },
    });
    expect(resultado).toEqual({ ok: true, premio: 2345.67, parcelasNum: null, valorParcela: null });
  });

  it('só parcelado ("em 12x de R$ 463,20"): base = 12 × 463,20 = 5.558,40, nunca o valor de 1 parcela', () => {
    const resultado = calcularPremioTransmissao(raw([CARD_SO_PARCELADO]), {
      seguradora: "Suhai",
      produtoId: "suhai-rf",
      formaPagamento: "Boleto",
      parcelasEscolhidas: "em 12x de R$ 463,20",
      opcao: { tipo: "Roubo e furto", franquia: "Sem franquia" },
    });
    expect(resultado).toEqual({
      ok: true,
      premio: 5558.4,
      parcelasNum: 12,
      valorParcela: 463.2,
    });
  });

  it('"3x sem juros de R$ 429,25": base = 3 × 429,25 = 1.287,75', () => {
    const resultado = calcularPremioTransmissao(raw([CARD_3X_SEM_JUROS]), {
      seguradora: "Yelum",
      produtoId: "yelum-flex",
      formaPagamento: "Cartão",
      parcelasEscolhidas: "3x sem juros de R$ 429,25",
      opcao: { tipo: "Compreensiva", franquia: "Normal" },
    });
    expect(resultado).toEqual({
      ok: true,
      premio: 1287.75,
      parcelasNum: 3,
      valorParcela: 429.25,
    });
  });

  it("texto sem quantidade de parcelas: recusa em vez de gravar valor incompleto", () => {
    const resultado = calcularPremioTransmissao(raw([CARD_SEM_QUANTIDADE]), {
      seguradora: "Mapfre",
      produtoId: "mapfre-essencial",
      formaPagamento: "Boleto",
      parcelasEscolhidas: "sem juros de R$ 429,25",
      opcao: { tipo: "Compreensiva", franquia: "Normal" },
    });
    expect(resultado.ok).toBe(false);
  });

  it('"em 12x de R$ 623,92" (sem "de" entre "Nx" e o valor no início do texto): base = 12 × 623,92 = 7.487,04', () => {
    const resultado = calcularPremioTransmissao(raw([CARD_PARCELADO_SEM_DE]), {
      seguradora: "Porto",
      produtoId: "porto-auto",
      formaPagamento: "Boleto",
      parcelasEscolhidas: "em 12x de R$ 623,92",
      opcao: { tipo: "Compreensiva", franquia: "Normal" },
    });
    expect(resultado).toEqual({
      ok: true,
      premio: 7487.04,
      parcelasNum: 12,
      valorParcela: 623.92,
    });
  });

  it('"3x R$ 429,25 *" (sem "de", com asterisco no fim): base = 3 × 429,25 = 1.287,75', () => {
    const resultado = calcularPremioTransmissao(raw([CARD_PARCELADO_COM_ASTERISCO]), {
      seguradora: "Azul",
      produtoId: "azul-auto",
      formaPagamento: "Cartão",
      parcelasEscolhidas: "3x R$ 429,25 *",
      opcao: { tipo: "Compreensiva", franquia: "Normal" },
    });
    expect(resultado).toEqual({
      ok: true,
      premio: 1287.75,
      parcelasNum: 3,
      valorParcela: 429.25,
    });
  });

  it('à vista com texto literal "À vista R$ 1.287,74" em `parcelasEscolhidas`: usa `avista`, nunca o texto de parcelas', () => {
    const resultado = calcularPremioTransmissao(raw([CARD_AVISTA_TEXTO_LITERAL]), {
      seguradora: "Bradesco",
      produtoId: "bradesco-auto",
      formaPagamento: "Boleto",
      parcelasEscolhidas: "À vista R$ 1.287,74",
      opcao: { tipo: "Compreensiva", franquia: "Normal", avista: "R$ 1.287,74" },
    });
    expect(resultado).toEqual({ ok: true, premio: 1287.74, parcelasNum: null, valorParcela: null });
  });

  it("à vista com `parcelasEscolhidas` vazio (front atual): também usa `avista`", () => {
    const resultado = calcularPremioTransmissao(raw([CARD_AVISTA_TEXTO_LITERAL]), {
      seguradora: "Bradesco",
      produtoId: "bradesco-auto",
      formaPagamento: "Boleto",
      parcelasEscolhidas: "",
      opcao: { tipo: "Compreensiva", franquia: "Normal", avista: "R$ 1.287,74" },
    });
    expect(resultado).toEqual({ ok: true, premio: 1287.74, parcelasNum: null, valorParcela: null });
  });

  it("opção/card não encontrado no resultado atual: recusa (nunca confia no front)", () => {
    const resultado = calcularPremioTransmissao(raw([CARD_PARCELADO_MATCH]), {
      seguradora: "Seguradora Que Não Existe",
      produtoId: "10290_81",
      formaPagamento: "Boleto",
      parcelasEscolhidas: "10x de R$ 251,90",
      opcao: { tipo: "Compreensiva", franquia: "Reduzida · R$ 2.450,00", avista: "R$ 2.345,67" },
    });
    expect(resultado.ok).toBe(false);

    const bundleErrado = calcularPremioTransmissao(raw([CARD_PARCELADO_MATCH]), {
      seguradora: "Seguradora Alfa",
      produtoId: "10290_81",
      formaPagamento: "Boleto",
      parcelasEscolhidas: "10x de R$ 251,90",
      opcao: { tipo: "Franquia inexistente", franquia: "Reduzida · R$ 2.450,00" },
    });
    expect(bundleErrado.ok).toBe(false);
  });

  it("forma de pagamento não encontrada no card: recusa", () => {
    const resultado = calcularPremioTransmissao(raw([CARD_PARCELADO_MATCH]), {
      seguradora: "Seguradora Alfa",
      produtoId: "10290_81",
      formaPagamento: "PIX",
      parcelasEscolhidas: "10x de R$ 251,90",
      opcao: { tipo: "Compreensiva", franquia: "Reduzida · R$ 2.450,00", avista: "R$ 2.345,67" },
    });
    expect(resultado.ok).toBe(false);
  });
  describe("à vista sem `avista` (Suhai: preço só na variante de parcelas)", () => {
    const cardSuhai = (parcelas: string) => ({
      seguradora: "Suhai",
      produto: "Auto Suhai",
      produtoId: "suhai-auto",
      opcoes: [{ tipo: "Compreensiva", franquia: "Normal", parcelas }],
      formaPagamento: "Boleto",
    });
    const chamar = (parcelas: string, avista?: string) =>
      calcularPremioTransmissao(raw([cardSuhai(parcelas)]), {
        seguradora: "Suhai",
        produtoId: "suhai-auto",
        formaPagamento: "Boleto",
        parcelasEscolhidas: parcelas,
        opcao: { tipo: "Compreensiva", franquia: "Normal", ...(avista ? { avista } : {}) },
      });

    it("`avista` vazio e parcelas 'À vista R$ 3.193,82': usa o valor do texto, 1 parcela", () => {
      expect(chamar("À vista R$ 3.193,82")).toEqual({
        ok: true,
        premio: 3193.82,
        parcelasNum: null,
        valorParcela: null,
      });
    });

    it("percentual antes do preço não vira o valor: 'À vista (5,5% desc.) R$ 3.193,82'", () => {
      expect(chamar("À vista (5,5% desc.) R$ 3.193,82")).toEqual({
        ok: true,
        premio: 3193.82,
        parcelasNum: null,
        valorParcela: null,
      });
    });

    it("`avista` preenchido continua valendo sobre o texto", () => {
      const r = calcularPremioTransmissao(
        raw([
          {
            ...cardSuhai("À vista R$ 999,00"),
            opcoes: [
              {
                tipo: "Compreensiva",
                franquia: "Normal",
                avista: "R$ 1.000,00",
                parcelas: "À vista R$ 999,00",
              },
            ],
          },
        ]),
        {
          seguradora: "Suhai",
          produtoId: "suhai-auto",
          formaPagamento: "Boleto",
          parcelasEscolhidas: "À vista R$ 999,00",
          opcao: { tipo: "Compreensiva", franquia: "Normal", avista: "R$ 1.000,00" },
        },
      );
      expect(r).toEqual({ ok: true, premio: 1000, parcelasNum: null, valorParcela: null });
    });

    it("sem nenhum valor extraível: recusa", () => {
      expect(chamar("À vista").ok).toBe(false);
    });

    it("texto sem vírgula decimal ou valor zero: recusa (nunca confunde quantidade)", () => {
      expect(chamar("À vista 12").ok).toBe(false);
      expect(chamar("À vista em 12x").ok).toBe(false);
      expect(chamar("À vista R$ 0,00").ok).toBe(false);
    });
  });
});
