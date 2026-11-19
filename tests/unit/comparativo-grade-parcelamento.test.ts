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

describe("montarGradeParcelamento (franquias lado a lado, por oferta)", () => {
  const grade = montarGradeParcelamento(ofertas, escolhaPadrao);
  const porto = ofertas.findIndex((o) => o.seguradora === "porto");
  const azul = ofertas.findIndex((o) => o.seguradora === "azul");

  it("subcolunas = maior número de faixas de uma oferta", () => {
    expect(grade.nSlots).toBe(2);
    expect(colunasPorOferta(grade)).toBe(2);
  });

  it("cada oferta usa as suas próprias faixas; a que tem menos fica com a subcoluna vazia", () => {
    expect(grade.faixas[porto]).toEqual(["normal 100%", "reduzida 50%"]);
    expect(grade.faixas[azul]).toEqual(["normal 100%", ""]);
  });

  it("franquia por oferta e subcoluna", () => {
    expect(grade.franquias[porto]).toEqual(["R$ 3.000,00", "R$ 1.500,00"]);
    expect(grade.franquias[azul]).toEqual(["R$ 4.000,00", ""]);
  });

  it("linhas por quantidade de parcelas, em ordem crescente, uma célula por oferta e subcoluna", () => {
    expect(grade.linhas.map((l) => l.rotulo)).toEqual(["2 parcelas", "10 parcelas", "12 parcelas"]);
    expect(grade.linhas[0].celulas[porto][0]?.parcelas).toBe("2x R$ 600,00 *");
    expect(grade.linhas[0].celulas[porto][1]?.parcelas).toBe("2x R$ 700,00 *");
    expect(grade.linhas[1].celulas[azul][0]?.parcelas).toBe("10x R$ 90,00");
    expect(grade.linhas[1].celulas[azul][1]).toBeUndefined();
  });

  it("forma de pagamento escolhida por oferta", () => {
    expect(grade.formas.map((f) => f?.formaPagamento).sort()).toEqual([
      "Cartão de Crédito",
      "Débito em Conta",
    ]);
  });

  it("faixas com nomes diferentes entre ofertas continuam lado a lado (não vira bloco empilhado)", () => {
    const g = montarGradeParcelamento(
      parseQuiverResultado({
        temPremios: true,
        cards: [
          {
            index: 1,
            seguradora: "porto",
            produto: "A",
            nome: "A",
            opcoes: [{ tipo: "Compreensiva Gama", franquia: "F1", parcelas: "10x R$ 1,00" }],
            formaPagamento: "Cartão",
            coberturasBasicas: {},
          },
          {
            index: 2,
            seguradora: "azul",
            produto: "B",
            nome: "B",
            opcoes: [
              { tipo: "Compreensiva Ômega", franquia: "F2", parcelas: "10x R$ 2,00" },
              { tipo: "Reduzida Ômega", franquia: "F3", parcelas: "10x R$ 3,00" },
            ],
            formaPagamento: "Cartão",
            coberturasBasicas: {},
          },
        ],
      }),
      escolhaPadrao,
    );
    expect(g.nSlots).toBe(2);
    expect(colunasPorOferta(g)).toBe(2);
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
