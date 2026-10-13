import { describe, expect, it } from "vitest";
import { montarPayloadQuiver, type CotacaoRow } from "@/lib/quiver.functions";
import { seguradoraAceitaMoto } from "@/lib/seguradora-canonica";

function cotacao(ramo: string | undefined, seguradoras: string[]): CotacaoRow {
  return {
    id: "cotacao-teste",
    segurado: {},
    seguro: { ramo, seguradoras_sel: seguradoras },
    veiculo: { placa: "TTN0I33" },
    perfil: {},
    coberturas: {},
  };
}

const TODAS = [
  "Mapfre",
  "Aliro",
  "Yelum",
  "HDI",
  "Suhai",
  "Porto",
  "Azul",
  "Tokio",
  "Allianz",
  "Bradesco",
];

describe("payload Quiver - moto", () => {
  it("envia tipoProduto=moto e só as 6 seguradoras de moto", () => {
    const p = montarPayloadQuiver(cotacao("Moto", TODAS));

    expect(p.veiculo.tipoProduto).toBe("moto");
    expect([...(p.seguro.seguradorasDisponiveis ?? [])].sort()).toEqual([
      "allianz",
      "hdi seguros",
      "mapfre",
      "porto",
      "suhai",
      "tokio",
    ]);
  });

  it("automóvel não envia tipoProduto e mantém todas as seguradoras", () => {
    const p = montarPayloadQuiver(cotacao("Automóvel", TODAS));

    expect(p.veiculo).not.toHaveProperty("tipoProduto");
    expect(p.seguro.seguradorasDisponiveis).toHaveLength(10);
  });

  it("rascunho sem ramo se comporta como automóvel", () => {
    expect(montarPayloadQuiver(cotacao(undefined, TODAS)).veiculo).not.toHaveProperty(
      "tipoProduto",
    );
  });

  it("seguradoraAceitaMoto reconhece grafias de exibição", () => {
    expect(seguradoraAceitaMoto("HDI")).toBe(true);
    expect(seguradoraAceitaMoto("Porto Seguro")).toBe(true);
    expect(seguradoraAceitaMoto("Bradesco Auto")).toBe(false);
    expect(seguradoraAceitaMoto("Azul")).toBe(false);
  });
});
