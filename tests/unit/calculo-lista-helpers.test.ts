import { describe, expect, it } from "vitest";
import {
  coberturaLabelsUnion,
  estaNaFaixaDePreco,
  filtrarPorFaixaDePreco,
  ordenarPorEscolha,
  parseQuiverResultado,
} from "@/components/venda/cotacoes/quiver-resultado";
import { validadeCotacao } from "@/components/venda/novo-lead/steps/calculo/CalculoContexto";
import { formatarNumeroCotacao } from "@/components/venda/novo-lead/hooks/useNumeroCotacao";

const payload = {
  cards: [
    {
      index: 2,
      seguradora: "Seguradora Beta",
      opcoes: [{ avista: "R$ 3.010,05" }],
      coberturasBasicas: { Casco: "110% FIPE" },
      coberturasAdicionais: { CarroReserva: "7 dias" },
    },
    {
      index: 0,
      seguradora: "Seguradora Alfa",
      opcoes: [{ avista: "R$ 2.345,67" }],
      coberturasBasicas: { Casco: "100% FIPE", "Danos materiais": "R$ 150.000,00" },
      coberturasAdicionais: { Vidros: "Completo" },
    },
    {
      index: 1,
      seguradora: "Seguradora Gama",
      // Sem opções/avista real — nenhum prêmio numérico extraível (sem
      // retorno de valor), não deve travar a ordenação nem a faixa.
      opcoes: [],
      coberturasBasicas: { Casco: "90% FIPE" },
    },
  ],
};

describe("ordenarPorEscolha (Cálculo · lista comparativa)", () => {
  it("menor preço: ordem ascendente pelo primeiro prêmio, sem retorno sempre por último", () => {
    const resultados = parseQuiverResultado(payload);
    const ordenado = ordenarPorEscolha(resultados, "menor");
    expect(ordenado.map((r) => r.seguradora)).toEqual([
      "Seguradora Alfa",
      "Seguradora Beta",
      "Seguradora Gama",
    ]);
  });

  it("maior preço: ordem descendente pelo primeiro prêmio, sem retorno sempre afunda pro fim", () => {
    const resultados = parseQuiverResultado(payload);
    const ordenado = ordenarPorEscolha(resultados, "maior");
    expect(ordenado.map((r) => r.seguradora)).toEqual([
      "Seguradora Beta",
      "Seguradora Alfa",
      "Seguradora Gama",
    ]);
  });

  it("retorno das cias: ordem de chegada (resultado.index), não altera a lista original", () => {
    const resultados = parseQuiverResultado(payload);
    const ordemOriginal = resultados.map((r) => r.seguradora);
    const ordenado = ordenarPorEscolha(resultados, "retorno");
    expect(ordenado.map((r) => r.seguradora)).toEqual([
      "Seguradora Alfa",
      "Seguradora Gama",
      "Seguradora Beta",
    ]);
    expect(resultados.map((r) => r.seguradora)).toEqual(ordemOriginal);
  });
});

describe("faixa de preço (Cálculo · lista comparativa)", () => {
  it.each([
    [3500, "ate3500", true],
    [3500.01, "ate3500", false],
    [3500.01, "3500a4000", true],
    [4000, "3500a4000", true],
    [4000.01, "4000a5000", true],
    [5000.01, "acima5000", true],
    [5000, "acima5000", false],
  ] as const)("premio %s na faixa %s -> %s", (premio, faixa, esperado) => {
    expect(estaNaFaixaDePreco(premio, faixa)).toBe(esperado);
  });

  it("sem faixa selecionada, tudo passa", () => {
    expect(estaNaFaixaDePreco(999999, "")).toBe(true);
  });

  it("filtra a lista pela faixa mas nunca esconde um card sem prêmio numérico", () => {
    const resultados = parseQuiverResultado(payload);
    const filtrados = filtrarPorFaixaDePreco(resultados, "acima5000");
    // Nenhum card real bate "acima5000" (2345/3010) — só sobra o sem-retorno.
    expect(filtrados.map((r) => r.seguradora)).toEqual(["Seguradora Gama"]);
  });

  it("faixa vazia mantém todos os cards, incluindo o sem prêmio", () => {
    const resultados = parseQuiverResultado(payload);
    expect(filtrarPorFaixaDePreco(resultados, "").map((r) => r.seguradora)).toEqual([
      "Seguradora Beta",
      "Seguradora Alfa",
      "Seguradora Gama",
    ]);
  });
});

describe("coberturaLabelsUnion (Cálculo · lista comparativa)", () => {
  it("une os labels reais de coberturasBasicas/Adicionais de todos os cards, sem repetir e na ordem de 1ª aparição", () => {
    const resultados = parseQuiverResultado(payload);
    expect(coberturaLabelsUnion(resultados)).toEqual([
      "Casco",
      "CarroReserva",
      "Danos materiais",
      "Vidros",
    ]);
  });

  it("lista vazia não gera labels", () => {
    expect(coberturaLabelsUnion([])).toEqual([]);
  });
});

describe("validadeCotacao (Cálculo · barra de contexto)", () => {
  it("soma 5 dias corridos à data base e formata dd/mm/aaaa", () => {
    expect(validadeCotacao(new Date(2026, 0, 27))).toBe("01/02/2026");
    expect(validadeCotacao(new Date(2026, 8, 25))).toBe("30/09/2026");
  });
});

describe("formatarNumeroCotacao (Cálculo · barra de contexto e Imprimir)", () => {
  it("usa o número real e o ano de criação da cotação, mesmo formato do comparativo lado a lado", () => {
    expect(formatarNumeroCotacao(155032, "2026-01-15T10:00:00Z")).toBe("COT-2026-155032");
  });

  it("preenche com zeros à esquerda até 5 dígitos", () => {
    expect(formatarNumeroCotacao(42, "2026-09-25T00:00:00Z")).toBe("COT-2026-00042");
  });

  it("retorna null sem número ou sem data de criação (cotação ainda não salva) — o chamador decide o '—'", () => {
    expect(formatarNumeroCotacao(null, "2026-01-15T10:00:00Z")).toBeNull();
    expect(formatarNumeroCotacao(42, null)).toBeNull();
  });
});
