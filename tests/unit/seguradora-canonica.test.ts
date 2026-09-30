import { describe, expect, it } from "vitest";
import {
  acharAjusteCanonico,
  nomeCanonicoSeguradora,
  agruparPorCanonico,
} from "@/lib/seguradora-canonica";

describe("nomeCanonicoSeguradora", () => {
  it.each([
    ["HDI", "hdi seguros"],
    ["hdi seguros", "hdi seguros"],
    ["Porto Seguro", "porto"],
    ["Porto", "porto"],
    ["porto", "porto"],
    ["Azul Seguros", "azul"],
    ["  Pier ", "pier"],
    ["Itau", "itau"],
  ])("%s -> %s", (entrada, esperado) => {
    expect(nomeCanonicoSeguradora(entrada)).toBe(esperado);
  });
});

describe("acharAjusteCanonico", () => {
  const linha = (seguradora: string, v = "x") => ({ seguradora, vidros: v });

  it("acha linha gravada com nome de exibição ao pedir o canônico e vice-versa", () => {
    expect(acharAjusteCanonico([linha("Porto")], "porto")?.seguradora).toBe("Porto");
    expect(acharAjusteCanonico([linha("porto")], "Porto Seguro")?.seguradora).toBe("porto");
    expect(acharAjusteCanonico([linha("HDI")], "hdi seguros")?.seguradora).toBe("HDI");
  });

  it("prefere a linha com a chave canônica exata quando há duas", () => {
    const r = acharAjusteCanonico([linha("Porto", "velha"), linha("porto", "nova")], "Porto");
    expect(r?.vidros).toBe("nova");
  });

  it("devolve null quando não há", () => {
    expect(acharAjusteCanonico([linha("azul")], "porto")).toBeNull();
    expect(acharAjusteCanonico([], "porto")).toBeNull();
  });
});

describe("agruparPorCanonico", () => {
  const linha = (seguradora: string, v: string) => ({ seguradora, vidros: v });

  it("chaveia pelo canônico e, na colisão, fica a linha canônica — em qualquer ordem", () => {
    const a = agruparPorCanonico([linha("Porto", "velha"), linha("porto", "nova")]);
    const b = agruparPorCanonico([linha("porto", "nova"), linha("Porto", "velha")]);
    expect(a.porto.vidros).toBe("nova");
    expect(b.porto.vidros).toBe("nova");
    expect(Object.keys(a)).toEqual(["porto"]);
  });

  it("agrupa nomes de exibição e mantém as outras seguradoras", () => {
    const r = agruparPorCanonico([
      linha("HDI", "h"),
      linha("Azul Seguros", "a"),
      linha("pier", "p"),
    ]);
    expect(Object.keys(r).sort()).toEqual(["azul", "hdi seguros", "pier"]);
    expect(r["hdi seguros"].vidros).toBe("h");
  });

  it("vazio devolve objeto vazio", () => {
    expect(agruparPorCanonico([])).toEqual({});
  });
});
