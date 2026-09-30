import { describe, expect, it } from "vitest";
import {
  avisoRecalculoGeral,
  deveLimparRecalculoUnico,
  estadoAoRecalcularUma,
  mesmaSelecao,
} from "@/components/venda/novo-lead/recalculo-unico";

const TODAS = ["Mapfre", "Porto", "HDI"];

describe("recalculo-unico", () => {
  it("mesmaSelecao ignora ordem", () => {
    expect(mesmaSelecao(["A", "B"], ["B", "A"])).toBe(true);
    expect(mesmaSelecao(["A"], ["A", "B"])).toBe(false);
  });

  it("guarda a seleção anterior ao recalcular uma cia", () => {
    expect(estadoAoRecalcularUma(null, TODAS, "Porto")).toEqual({
      seguradora: "Porto",
      anterior: TODAS,
    });
  });

  it("não guarda nada se a seleção já era só ela", () => {
    expect(estadoAoRecalcularUma(null, ["Porto"], "Porto")).toBeNull();
  });

  it("repetir o recálculo único preserva o 'antes' original", () => {
    const e1 = estadoAoRecalcularUma(null, TODAS, "Porto");
    expect(estadoAoRecalcularUma(e1, ["Porto"], "Porto")).toEqual(e1);
  });

  it("avisa só com estado e seleção atual reduzida; voltarN só se havia mais de uma", () => {
    const e = { seguradora: "Porto", anterior: TODAS };
    expect(avisoRecalculoGeral(e, ["Porto"])).toEqual({
      seguradora: "Porto",
      anterior: TODAS,
      voltarN: 3,
    });
    expect(avisoRecalculoGeral(null, ["Porto"])).toBeNull();
    expect(avisoRecalculoGeral(e, TODAS)).toBeNull();
    expect(
      avisoRecalculoGeral({ seguradora: "Porto", anterior: ["Mapfre"] }, ["Porto"])?.voltarN,
    ).toBeNull();
  });

  it("limpa só depois de vista reduzida e alterada", () => {
    const e = { seguradora: "Porto", anterior: TODAS };
    expect(deveLimparRecalculoUnico(e, TODAS, false)).toBe(false);
    expect(deveLimparRecalculoUnico(e, TODAS, true)).toBe(true);
    expect(deveLimparRecalculoUnico(e, ["Porto"], true)).toBe(false);
    expect(deveLimparRecalculoUnico(null, TODAS, true)).toBe(false);
  });
});
