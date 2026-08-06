import { describe, it, expect } from "vitest";
import { veiculoLabel } from "@/lib/veiculo";

// Regressão: a tela de distribuição selecionava `dados_veiculo` (coluna inexistente),
// o que fazia a query INTEIRA do PostgREST falhar. O fix passou a selecionar `dados`
// e montar o rótulo com este helper. Cobrimos os formatos que o JSON `dados` assume.
describe("veiculoLabel (unitário puro)", () => {
  it("dados null retorna travessão", () => {
    expect(veiculoLabel(null)).toBe("—");
  });

  it("veiculo aninhado em dados.veiculo com nomes canônicos monta 'MARCA MODELO ANO · COR'", () => {
    const dados = {
      veiculo: { marca_nome: "FIAT", modelo_nome: "UNO", ano_modelo: "2020", cor: "PRATA" },
    };
    expect(veiculoLabel(dados)).toBe("FIAT UNO 2020 · PRATA");
  });

  it("veiculo na raiz de dados com nomes legados funciona pelo fallback", () => {
    const dados = { marca: "VW", modelo: "GOL", ano: "2015" };
    expect(veiculoLabel(dados)).toBe("VW GOL 2015");
  });

  it("preserva o texto legado salvo diretamente em dados.veiculo", () => {
    expect(veiculoLabel({ veiculo: "VW Polo 2023" })).toBe("VW Polo 2023");
  });

  it("preserva os campos achatados usados pelo pipeline legado", () => {
    expect(
      veiculoLabel({
        veiculo_marca: "Chevrolet",
        veiculo_modelo: "Onix",
        veiculo_ano: 2024,
      }),
    ).toBe("Chevrolet Onix 2024");
  });

  it("ignora tipos inesperados sem expor objetos ao React", () => {
    expect(veiculoLabel({ veiculo: ["FIAT", "UNO"] })).toBe("—");
    expect(veiculoLabel({ veiculo: { marca_nome: { nome: "FIAT" }, modelo_nome: true } })).toBe(
      "—",
    );
  });

  it("objeto vazio retorna travessão", () => {
    expect(veiculoLabel({})).toBe("—");
  });

  it("sem cor não deixa ' · ' sobrando", () => {
    const dados = { veiculo: { marca_nome: "FIAT", modelo_nome: "UNO", ano_modelo: "2020" } };
    const label = veiculoLabel(dados);
    expect(label).toBe("FIAT UNO 2020");
    expect(label.endsWith(" · ")).toBe(false);
    expect(label).not.toContain(" · ");
  });
});
