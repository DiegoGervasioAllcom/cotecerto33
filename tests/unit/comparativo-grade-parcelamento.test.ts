import { describe, expect, it } from "vitest";
import {
  colunasPorOferta,
  montarGradeParcelamento,
} from "@/components/venda/cotacoes/ComparativoParcelamento";
import {
  gruposOpcoesResultado,
  parseQuiverResultado,
} from "@/components/venda/cotacoes/quiver-resultado";

const payload = {
  temPremios: true,
  cards: [
    {
      index: 1,
      seguradora: "porto",
      produto: "Auto",
      nome: "Plano A",
      premiosPorFormaPagamento: [
        {
          formaPagamento: "Cartão de Crédito",
          opcoes: [
            {
              tipo: "normal 100%",
              franquia: "Franquia: R$ 3.000,00",
              parcelas: "12x R$ 100,00 *",
              parcelasOpcoes: ["2x R$ 600,00 *", "12x R$ 100,00 *"],
            },
            {
              tipo: "reduzida 50%",
              franquia: "Franquia: R$ 1.500,00",
              parcelas: "12x R$ 120,00 *",
              parcelasOpcoes: ["2x R$ 700,00 *", "12x R$ 120,00 *"],
            },
          ],
        },
      ],
      coberturasBasicas: {},
    },
    {
      index: 2,
      seguradora: "azul",
      produto: "Auto",
      nome: "Plano B",
      premiosPorFormaPagamento: [
        {
          formaPagamento: "Débito em Conta",
          opcoes: [
            {
              tipo: "normal 100%",
              franquia: "Franquia: R$ 4.000,00",
              parcelas: "10x R$ 90,00",
              parcelasOpcoes: ["10x R$ 90,00"],
            },
          ],
        },
      ],
      coberturasBasicas: {},
    },
  ],
};

const ofertas = parseQuiverResultado(payload);
const escolhaPadrao = (r: (typeof ofertas)[number]) => {
  const g = gruposOpcoesResultado(r)[0];
  return { grupoId: g?.id ?? "", opcaoId: g?.opcoes[0]?.id ?? "" };
};

describe("montarGradeParcelamento (franquias lado a lado)", () => {
  const grade = montarGradeParcelamento(ofertas, escolhaPadrao);

  it("uma subcoluna por faixa, na ordem em que aparecem", () => {
    expect(grade.faixas).toEqual(["normal 100%", "reduzida 50%"]);
  });

  it("franquia por oferta e faixa; oferta sem a faixa fica vazia", () => {
    const porto = ofertas.findIndex((o) => o.seguradora === "porto");
    const azul = ofertas.findIndex((o) => o.seguradora === "azul");
    expect(grade.franquias[porto]).toEqual(["R$ 3.000,00", "R$ 1.500,00"]);
    expect(grade.franquias[azul]).toEqual(["R$ 4.000,00", ""]);
  });

  it("linhas por quantidade de parcelas, em ordem crescente, uma célula por oferta e faixa", () => {
    expect(grade.linhas.map((l) => l.rotulo)).toEqual(["2 parcelas", "10 parcelas", "12 parcelas"]);
    const porto = ofertas.findIndex((o) => o.seguradora === "porto");
    const linha2 = grade.linhas[0];
    expect(linha2.celulas[porto][0]?.parcelas).toBe("2x R$ 600,00 *");
    expect(linha2.celulas[porto][1]?.parcelas).toBe("2x R$ 700,00 *");
    const azul = ofertas.findIndex((o) => o.seguradora === "azul");
    expect(grade.linhas[1].celulas[azul][0]?.parcelas).toBe("10x R$ 90,00");
    expect(grade.linhas[1].celulas[azul][1]).toBeUndefined();
  });

  it("forma de pagamento escolhida por oferta", () => {
    expect(grade.formas.map((f) => f?.formaPagamento).sort()).toEqual([
      "Cartão de Crédito",
      "Débito em Conta",
    ]);
  });
});

describe("colunasPorOferta", () => {
  const base = { formas: [], franquias: [], avistas: [], linhas: [] };
  it("1 faixa = 1 coluna; 2 faixas lado a lado; mais de 2 empilha (1 coluna)", () => {
    expect(colunasPorOferta({ ...base, faixas: ["a"] })).toBe(1);
    expect(colunasPorOferta({ ...base, faixas: ["a", "b"] })).toBe(2);
    expect(colunasPorOferta({ ...base, faixas: ["a", "b", "c"] })).toBe(1);
    expect(colunasPorOferta({ ...base, faixas: [] })).toBe(1);
  });
});

describe("avistas por faixa (informativo)", () => {
  const comAvista = parseQuiverResultado({
    temPremios: true,
    cards: [
      {
        index: 1,
        seguradora: "porto",
        produto: "Auto",
        nome: "Plano A",
        premiosPorFormaPagamento: [
          {
            formaPagamento: "Débito em Conta",
            opcoes: [
              {
                tipo: "normal 100%",
                franquia: "Franquia: R$ 3.000,00",
                avista: "R$ 2.000,00",
                desconto: "7% no débito",
                parcelas: "10x R$ 210,00",
              },
              {
                tipo: "reduzida 50%",
                franquia: "Franquia: R$ 1.500,00",
                avista: "R$ 2.300,00",
                parcelas: "10x R$ 240,00",
              },
            ],
          },
        ],
        coberturasBasicas: {},
      },
    ],
  });
  const grade = montarGradeParcelamento(comAvista, escolhaPadrao);

  it("valor à vista e desconto por oferta e faixa", () => {
    expect(grade.avistas[0]).toEqual([
      { avista: "R$ 2.000,00", desconto: "7% no débito" },
      { avista: "R$ 2.300,00", desconto: "" },
    ]);
  });
});
