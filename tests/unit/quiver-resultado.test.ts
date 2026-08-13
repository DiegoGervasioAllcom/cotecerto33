import { describe, expect, it } from "vitest";
import {
  formasPagamentoResultado,
  gruposOpcoesResultado,
  ordenarResultados,
  parseQuiverResultado,
  premioNumerico,
  tituloResultado,
  vincularPremiosQuiver,
} from "@/components/venda/cotacoes/quiver-resultado";

const payloadCompletoAnonimizado = {
  temPremios: true,
  cards: [
    {
      index: 12,
      seguradora: "Seguradora Alfa",
      produto: "Auto Completo",
      nome: "Plano Premium",
      opcoes: [
        {
          tipo: "Compreensiva",
          franquia: "Reduzida · R$ 2.450,00",
          avista: "R$ 2.345,67",
          parcelas: "10x de R$ 251,90",
          desconto: "5% no débito",
        },
        {
          tipo: "Roubo e furto",
          franquia: "Sem franquia",
          avista: "R$ 1.234,50",
          parcelas: "6x de R$ 220,10",
        },
      ],
      formaPagamento: "Boleto",
      formasPagamento: {
        selecionada: "Cartão de crédito",
        opcoes: ["Cartão de crédito", "Débito em conta"],
      },
      premiosPorFormaPagamento: [
        {
          formaPagamento: "PIX",
          opcoes: [
            {
              tipo: "Compreensiva PIX",
              franquia: "Reduzida PIX · R$ 2.300,00",
              avista: "R$ 2.300,00",
              parcelas: "1x",
              desconto: "7% no PIX",
            },
          ],
        },
      ],
      coberturasBasicas: {
        Casco: "100% FIPE",
        "Danos materiais": "R$ 150.000,00",
      },
      coberturasAdicionais: { Vidros: "Completo", Reserva: "15 dias" },
    },
    {
      seguradora: "Seguradora Alfa",
      produto: "Auto Essencial",
      nome: "Plano Econômico",
      opcoes: [
        {
          tipo: "Compreensiva",
          franquia: "Normal · R$ 3.100,00",
          avista: "1.987,65",
          parcelas: "8x de R$ 260,00",
        },
      ],
      formasPagamento: { selecionada: "Boleto", opcoes: ["Boleto"] },
      coberturasBasicas: { Casco: "90% FIPE", "Danos materiais": "R$ 100.000,00" },
      coberturasAdicionais: { Vidros: "Básico" },
    },
    {
      seguradora: "Seguradora Beta",
      produto: "Auto Flex",
      nome: "Plano Flexível",
      opcoes: [
        {
          tipo: "Compreensiva",
          franquia: "Majorada · R$ 4.000,00",
          avista: "R$ 3.010,05",
          parcelas: "12x de R$ 275,40",
        },
      ],
      formaPagamento: "Cartão",
      coberturasBasicas: { Casco: "110% FIPE", "Danos corporais": "R$ 200.000,00" },
      coberturasAdicionais: { CarroReserva: "7 dias" },
    },
  ],
};

describe("resultado detalhado da Quiver", () => {
  it("preserva produtos da mesma seguradora, opções, franquias, coberturas e pagamentos", () => {
    const resultados = parseQuiverResultado(payloadCompletoAnonimizado);

    expect(resultados).toHaveLength(3);
    expect(resultados.map((item) => item.index)).toEqual([12, 1, 2]);
    expect(resultados.map((item) => item.cardId)).toEqual([
      "quiver-card-0",
      "quiver-card-1",
      "quiver-card-2",
    ]);
    expect(resultados.filter((item) => item.seguradora === "Seguradora Alfa")).toHaveLength(2);
    expect(resultados[0]).toMatchObject({
      produto: "Auto Completo",
      nome: "Plano Premium",
      opcoes: [
        {
          franquia: "Reduzida · R$ 2.450,00",
          avista: "R$ 2.345,67",
          parcelas: "10x de R$ 251,90",
          desconto: "5% no débito",
        },
        { franquia: "Sem franquia", avista: "R$ 1.234,50" },
      ],
      coberturasBasicas: { Casco: "100% FIPE", "Danos materiais": "R$ 150.000,00" },
      coberturasAdicionais: { Vidros: "Completo", Reserva: "15 dias" },
    });
    expect(formasPagamentoResultado(resultados[0])).toEqual([
      "Cartão de crédito",
      "Débito em conta",
      "Boleto",
      "PIX",
    ]);
    expect(tituloResultado(resultados[0])).toBe("Auto Completo · Plano Premium");
    expect(gruposOpcoesResultado(resultados[0])[1]).toEqual({
      formaPagamento: "PIX",
      opcoes: [
        {
          tipo: "Compreensiva PIX",
          franquia: "Reduzida PIX · R$ 2.300,00",
          avista: "R$ 2.300,00",
          parcelas: "1x",
          desconto: "7% no PIX",
        },
      ],
    });
  });

  it("descarta somente cards inválidos e aplica os defaults seguros do schema Zod", () => {
    expect(
      parseQuiverResultado({
        cards: [
          null,
          { seguradora: "" },
          { seguradora: "Seguradora Válida" },
          { seguradora: "Seguradora Inválida", opcoes: "não é lista" },
        ],
      }),
    ).toEqual([
      {
        cardId: "quiver-card-2",
        index: 2,
        seguradora: "Seguradora Válida",
        nome: "",
        opcoes: [],
      },
    ]);
    expect(parseQuiverResultado(null)).toEqual([]);
    expect(parseQuiverResultado({ cards: "não é lista" })).toEqual([]);
  });

  it.each([
    ["R$ 1.234,56", 1234.56],
    ["1.234,56", 1234.56],
    ["R$ 999,90 à vista", 999.9],
  ])("converte moeda brasileira %s sem inventar valor", (avista, esperado) => {
    expect(premioNumerico({ avista })).toBe(esperado);
  });

  it("usa infinito como fallback quando o prêmio está ausente ou malformado", () => {
    expect(premioNumerico()).toBe(Infinity);
    expect(premioNumerico({ avista: "Sob consulta" })).toBe(Infinity);
  });

  it("ordena pelo primeiro prêmio sem alterar a lista nem os cards originais", () => {
    const resultados = parseQuiverResultado(payloadCompletoAnonimizado);
    const ordemOriginal = resultados.map((item) => item.index);
    const ordenados = ordenarResultados(resultados);

    expect(ordenados.map((item) => item.index)).toEqual([1, 12, 2]);
    expect(resultados.map((item) => item.index)).toEqual(ordemOriginal);
    expect(ordenados).not.toBe(resultados);
    expect(ordenados[1]).toBe(resultados[0]);
  });

  it("gera identidade única por posição mesmo quando índices externos estão duplicados", () => {
    const resultados = parseQuiverResultado({
      cards: [
        { index: 7, seguradora: "Seguradora Alfa" },
        { index: 7, seguradora: "Seguradora Alfa" },
      ],
    });

    expect(resultados.map(({ index }) => index)).toEqual([7, 7]);
    expect(resultados.map(({ cardId }) => cardId)).toEqual(["quiver-card-0", "quiver-card-1"]);
    expect(new Set(resultados.map(({ cardId }) => cardId)).size).toBe(2);
  });

  it("faz pareamento global 1:1 sem reutilizar uma linha financeira entre vários cards", () => {
    const resultados = parseQuiverResultado({
      cards: [
        {
          seguradora: "Seguradora Alfa",
          opcoes: [{ tipo: "Compreensiva", avista: "R$ 1.500,00" }],
        },
        {
          seguradora: "Seguradora Alfa",
          opcoes: [{ tipo: "Compreensiva", avista: "R$ 1.500,00" }],
        },
      ],
    });
    const premios = [
      {
        id: "premio-unico",
        seguradora: "Seguradora Alfa",
        cobertura: "Compreensiva",
        premio: 1500,
      },
    ];

    expect(vincularPremiosQuiver(resultados, premios).size).toBe(0);
  });

  it("pareia duas linhas distintas uma única vez quando todos os discriminadores coincidem", () => {
    const resultados = parseQuiverResultado({
      cards: [
        {
          seguradora: "Seguradora Alfa",
          produto: "Auto Completo",
          opcoes: [{ tipo: "Compreensiva", avista: "R$ 1.500,00" }],
        },
        {
          seguradora: "Seguradora Alfa",
          produto: "Auto Essencial",
          opcoes: [{ tipo: "Roubo e furto", avista: "R$ 900,00" }],
        },
      ],
    });
    const premios = [
      { id: "p1", seguradora: "Seguradora Alfa", cobertura: "Compreensiva", premio: 1500 },
      { id: "p2", seguradora: "Seguradora Alfa", cobertura: "Roubo e furto", premio: 900 },
    ];
    const vinculados = vincularPremiosQuiver(resultados, premios);

    expect(vinculados.get("quiver-card-0")?.id).toBe("p1");
    expect(vinculados.get("quiver-card-1")?.id).toBe("p2");
    expect(new Set([...vinculados.values()].map(({ id }) => id)).size).toBe(2);
    expect(resultados.map(({ produto }) => produto)).toEqual(["Auto Completo", "Auto Essencial"]);
  });

  it.each([
    ["valor contraditório", { cobertura: "Compreensiva", premio: 1499 }],
    ["cobertura divergente", { cobertura: "Roubo e furto", premio: 1500 }],
  ])("não vincula quando há %s", (_caso, contraditorio) => {
    const [resultado] = parseQuiverResultado({
      cards: [
        {
          seguradora: "Seguradora Alfa",
          opcoes: [{ tipo: "Compreensiva", avista: "R$ 1.500,00" }],
        },
      ],
    });
    const premio = { id: "p1", seguradora: "Seguradora Alfa", ...contraditorio };

    expect(vincularPremiosQuiver([resultado], [premio]).size).toBe(0);
  });
});
