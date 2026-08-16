import { describe, it, expect } from "vitest";
import { escolherAnoFipe, type AnoFipe } from "../../src/components/venda/novo-lead/hooks/useFipe";

// Lista real da FIPE para o Cobalt LTZ 1.8 Mec. (marca 23, modelo 6175):
// todo ano é "-5" porque o carro é flex — montar "2015-1" à mão devolvia
// "veículo não encontrado" e deixava o Valor FIPE vazio.
const ANOS_FLEX: AnoFipe[] = [
  { codigo: "2020-5", nome: "2020 Flex" },
  { codigo: "2019-5", nome: "2019 Flex" },
  { codigo: "2015-5", nome: "2015 Flex" },
  { codigo: "2014-5", nome: "2014 Flex" },
];

// Modelo vendido em duas versões de combustível no mesmo ano.
const ANOS_MISTOS: AnoFipe[] = [
  { codigo: "2015-1", nome: "2015 Gasolina" },
  { codigo: "2015-3", nome: "2015 Diesel" },
  { codigo: "2014-1", nome: "2014 Gasolina" },
];

describe("escolherAnoFipe", () => {
  it("usa o sufixo que a própria FIPE devolve (Flex = 5, não 1)", () => {
    expect(escolherAnoFipe(ANOS_FLEX, "2015", "Flex")?.codigo).toBe("2015-5");
  });

  it("desempata pelo combustível quando o ano tem mais de uma opção", () => {
    expect(escolherAnoFipe(ANOS_MISTOS, "2015", "Diesel")?.codigo).toBe("2015-3");
    expect(escolherAnoFipe(ANOS_MISTOS, "2015", "Gasolina")?.codigo).toBe("2015-1");
  });

  it("cai na primeira opção do ano quando o combustível não bate", () => {
    // Carro flex com o select em "Gasolina": melhor o valor do ano certo
    // do que campo vazio.
    expect(escolherAnoFipe(ANOS_FLEX, "2015", "Gasolina")?.codigo).toBe("2015-5");
    expect(escolherAnoFipe(ANOS_MISTOS, "2015", "")?.codigo).toBe("2015-1");
  });

  it("devolve null quando o ano não existe na lista", () => {
    expect(escolherAnoFipe(ANOS_FLEX, "1998", "Flex")).toBeNull();
    expect(escolherAnoFipe([], "2015", "Flex")).toBeNull();
  });

  it("não confunde ano com prefixo parecido", () => {
    // "32000-5" é o código de zero km; não pode ser lido como ano 3200.
    const comZeroKm: AnoFipe[] = [{ codigo: "32000-5", nome: "32000 Flex" }, ...ANOS_FLEX];
    expect(escolherAnoFipe(comZeroKm, "2015", "Flex")?.codigo).toBe("2015-5");
    expect(escolherAnoFipe(comZeroKm, "3200", "Flex")).toBeNull();
  });
});
