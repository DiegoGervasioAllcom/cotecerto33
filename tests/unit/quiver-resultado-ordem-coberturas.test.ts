import { describe, expect, it } from "vitest";
import {
  ehLinhaModalidade,
  modalidadeComValor,
  ordenarCoberturaLabels,
  parseValorBRL,
} from "@/components/venda/cotacoes/quiver-resultado";

describe("ordenarCoberturaLabels (ordem do comparativo, como a Quiver)", () => {
  it("ordena pela ordem fixa independente da chegada", () => {
    const chegada = [
      "APP Morte (por passageiro)",
      "Vidros",
      "Danos Corporais a terceiros",
      "Modalidade",
      "Carro Reserva",
      "Danos Materiais a terceiros",
      "Assistência",
      "Danos Morais",
      "APP Invalidez (por passageiro)",
    ];
    expect(ordenarCoberturaLabels(chegada)).toEqual([
      "Modalidade",
      "Danos Materiais a terceiros",
      "Danos Corporais a terceiros",
      "Danos Morais",
      "Carro Reserva",
      "Assistência",
      "Vidros",
      "APP Morte (por passageiro)",
      "APP Invalidez (por passageiro)",
    ]);
  });

  it("'Valor mercado' (nome do robô para a Modalidade) abre a tabela", () => {
    expect(ordenarCoberturaLabels(["Danos Morais", "Valor mercado", "Assistência"])).toEqual([
      "Valor mercado",
      "Danos Morais",
      "Assistência",
    ]);
  });

  it("rótulo desconhecido vai para o fim, na ordem de chegada", () => {
    expect(ordenarCoberturaLabels(["Zeta", "Vidros", "Alfa", "Modalidade"])).toEqual([
      "Modalidade",
      "Vidros",
      "Zeta",
      "Alfa",
    ]);
  });

  it("ignora acento e caixa; extensão de reboque e tipo de peça no fim do bloco conhecido", () => {
    expect(
      ordenarCoberturaLabels(["Tipo de peça para reparo", "Extensão de Reboque", "ASSISTENCIA"]),
    ).toEqual(["ASSISTENCIA", "Extensão de Reboque", "Tipo de peça para reparo"]);
  });
});

import { rotuloSecao } from "@/components/venda/novo-lead/steps/calculo/CalculoFiltroSecao";
import { logoSeguradora, marcaSeguradora } from "@/lib/seguradora-marcas";

describe("rótulos do comparativo", () => {
  it("abas de seção sem o prefixo longo do portal", () => {
    expect(rotuloSecao("Cotações para a cobertura Compreensiva")).toBe("Compreensiva");
    expect(rotuloSecao("Ofertas adicionais")).toBe("Ofertas adicionais");
  });

  it("resolve a marca da seguradora sem diferenciar caixa/acento e com variações do portal", () => {
    expect(marcaSeguradora("azul")?.wm).toBe("azul");
    expect(marcaSeguradora("porto")?.wm).toBe("Porto");
    expect(marcaSeguradora("hdi seguros")?.wm).toBe("HDI");
    expect(marcaSeguradora("itau")?.wm).toBe("Itaú");
    expect(marcaSeguradora("Seguradora Desconhecida")).toBeNull();
  });
});

describe("logos das seguradoras (arquivos em public/seguradoras)", () => {
  it("resolve o arquivo por nome do banco ou do robô; sem arquivo devolve null", () => {
    expect(logoSeguradora("Porto")).toBe("/seguradoras/porto.png");
    expect(logoSeguradora("hdi seguros")).toBe("/seguradoras/hdi.png");
    expect(logoSeguradora("tokio")).toBe("/seguradoras/tokio.png");
    expect(logoSeguradora("Seguradora Desconhecida")).toBeNull();
  });
});

describe("Modalidade com o valor da FIPE", () => {
  it("lê valores em reais", () => {
    expect(parseValorBRL("R$ 43.726,00")).toBe(43726);
    expect(parseValorBRL("43726")).toBe(43726);
    expect(parseValorBRL("R$ 1.234,56")).toBe(1234.56);
    expect(parseValorBRL("43726.50")).toBe(43726.5);
    expect(parseValorBRL("")).toBeNull();
    expect(parseValorBRL(null)).toBeNull();
  });

  it("acrescenta o valor em reais (percentual × FIPE) quando falta", () => {
    expect(modalidadeComValor("100% V.R. (FIPE)", 43726)).toMatch(
      /^100% V\.R\. \(FIPE\) R\$\s43\.726,00$/,
    );
    expect(modalidadeComValor("80% V.R. (FIPE)", 43726)).toMatch(/R\$\s34\.980,80$/);
    expect(modalidadeComValor("90,0% V.R. (FIPE)", 40000)).toMatch(/R\$\s36\.000,00$/);
  });

  it("não mexe quando já tem R$, sem percentual ou sem FIPE", () => {
    expect(modalidadeComValor("100% V.R. (FIPE) R$ 43.726,00", 43726)).toBe(
      "100% V.R. (FIPE) R$ 43.726,00",
    );
    expect(modalidadeComValor("Valor determinado", 43726)).toBe("Valor determinado");
    // percentual sem referência à FIPE/V.R.: não calcula (evita valor enganoso)
    expect(modalidadeComValor("Cobertura 100%", 43726)).toBe("Cobertura 100%");
    expect(modalidadeComValor("100% V.R. (FIPE)", null)).toBe("100% V.R. (FIPE)");
  });

  it("reconhece as linhas de modalidade pelo rótulo", () => {
    expect(ehLinhaModalidade("Modalidade")).toBe(true);
    expect(ehLinhaModalidade("Valor mercado")).toBe(true);
    expect(ehLinhaModalidade("Valor determinado")).toBe(false);
    expect(ehLinhaModalidade("Danos Morais")).toBe(false);
  });
});
