import { describe, expect, it } from "vitest";
import { calcularProgresso, type CalculoProgressoRow } from "@/lib/calculo-progresso";

const t0 = Date.parse("2026-01-01T00:00:00Z");
const row = (etapa: string, seq: number, extra: Partial<CalculoProgressoRow> = {}) => ({
  cotacao_id: "c",
  etapa,
  seq,
  erro: null,
  iniciado_em: new Date(t0).toISOString(),
  atualizado_em: new Date(t0).toISOString(),
  ...extra,
});

describe("calcularProgresso", () => {
  it("sem linha: aguardando", () => {
    const v = calcularProgresso(undefined, "c", t0);
    expect(v.percent).toBe(0);
    expect(v.rotulo).toBe("Aguardando o robô");
  });
  it("etapa intermediária", () => {
    const v = calcularProgresso(row("veiculo", 3), "c", t0);
    expect(v.percent).toBe(50);
    expect(v.rotulo).toBe("Preenchendo dados do veículo");
    expect(v.passo).toBe(3);
  });
  it("último passo é indeterminado e não chega a 100", () => {
    const v = calcularProgresso(row("lendo_resultados", 6), "c", t0);
    expect(v.indeterminado).toBe(true);
    expect(v.percent).toBeLessThan(100);
  });
  it("concluido = 100 e final", () => {
    const v = calcularProgresso(row("concluido", 9), "c", t0);
    expect(v.percent).toBe(100);
    expect(v.final).toBe("concluido");
  });
  it("erro expõe mensagem", () => {
    const v = calcularProgresso(row("erro", 9, { erro: "falhou" }), "c", t0);
    expect(v.final).toBe("erro");
    expect(v.erro).toBe("falhou");
  });
  it("sem atualização só acima de 45 s", () => {
    expect(
      calcularProgresso(row("login", 1), "c", t0 + 45_000).semAtualizacaoHaSegundos,
    ).toBeNull();
    expect(calcularProgresso(row("login", 1), "c", t0 + 60_000).semAtualizacaoHaSegundos).toBe(60);
  });
});
