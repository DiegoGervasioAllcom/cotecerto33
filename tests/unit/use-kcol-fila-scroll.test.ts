import { describe, expect, it } from "vitest";
import { calcularTemAcimaAbaixo, contarForaDaVista } from "@/lib/use-kcol-fila-scroll";

// Lógica pura da rolagem interna por coluna do Kanban (Pipeline V12, T14) —
// mesmo critério de `kFilaScroll` no protótipo. Roda offline (sem DOM).

describe("calcularTemAcimaAbaixo", () => {
  it("nem acima nem abaixo quando o conteúdo cabe inteiro (sem sobra)", () => {
    expect(calcularTemAcimaAbaixo(0, 200, 200)).toEqual({ temAcima: false, temAbaixo: false });
  });

  it("tem-abaixo quando ainda há conteúdo depois do fim visível, no topo", () => {
    expect(calcularTemAcimaAbaixo(0, 500, 200)).toEqual({ temAcima: false, temAbaixo: true });
  });

  it("tem-acima quando rolou pra baixo o bastante (margem de 4px)", () => {
    expect(calcularTemAcimaAbaixo(10, 500, 200)).toEqual({ temAcima: true, temAbaixo: true });
  });

  it("some tem-abaixo ao chegar no fim da fila", () => {
    expect(calcularTemAcimaAbaixo(300, 500, 200)).toEqual({ temAcima: true, temAbaixo: false });
  });

  it("margem de 4px evita piscar no repouso (scrollTop=4 ainda conta como não-acima)", () => {
    expect(calcularTemAcimaAbaixo(4, 500, 200).temAcima).toBe(false);
    expect(calcularTemAcimaAbaixo(5, 500, 200).temAcima).toBe(true);
  });
});

describe("contarForaDaVista", () => {
  it("conta só os cards que começam abaixo da dobra (+8px de folga)", () => {
    const itens = [
      { offsetTop: 0, offsetHeight: 100 }, // termina em 100 — visível
      { offsetTop: 100, offsetHeight: 100 }, // termina em 200 — na borda, visível
      { offsetTop: 200, offsetHeight: 100 }, // termina em 300 — fora
      { offsetTop: 300, offsetHeight: 100 }, // termina em 400 — fora
    ];
    // clientHeight 200, scrollTop 0 → limite = 200; +8 de folga
    expect(contarForaDaVista(itens, 0, 200)).toBe(2);
  });

  it("zero quando tudo cabe na vista", () => {
    const itens = [{ offsetTop: 0, offsetHeight: 50 }];
    expect(contarForaDaVista(itens, 0, 200)).toBe(0);
  });

  it("desconta o que já rolou (scrollTop desloca o limite pra baixo)", () => {
    const itens = [
      { offsetTop: 0, offsetHeight: 100 },
      { offsetTop: 100, offsetHeight: 100 },
      { offsetTop: 200, offsetHeight: 100 },
    ];
    // rolou 100px: limite = 100 + 200 = 300 — só o 3º item (200..300) fica na borda/fora
    expect(contarForaDaVista(itens, 100, 200)).toBe(0);
    expect(contarForaDaVista(itens, 0, 200)).toBe(1);
  });
});
