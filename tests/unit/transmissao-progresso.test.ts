import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import {
  calcularTransmissaoProgresso,
  type TransmissaoProgressoRow,
} from "@/lib/transmissao-progresso";
import { TransmissaoEspera } from "@/components/venda/novo-lead/steps/transmissao/TransmissaoEspera";
import { CalculoEspera } from "@/components/calculo/CalculoCard";

const t0 = Date.parse("2026-01-01T00:00:00Z");
const row = (etapa: string, seq: number, extra: Partial<TransmissaoProgressoRow> = {}) => ({
  tentativa_id: "t",
  cotacao_id: "c",
  etapa,
  seq,
  erro: null,
  atualizado_em: new Date(t0).toISOString(),
  ...extra,
});

describe("calcularTransmissaoProgresso", () => {
  it("sem linha: aguardando, passo 1", () => {
    const v = calcularTransmissaoProgresso(undefined, t0);
    expect(v.rotulo).toBe("Aguardando o robô");
    expect(v.passo).toBe(1);
    expect(v.final).toBeNull();
  });
  it("etapa intermediária", () => {
    const v = calcularTransmissaoProgresso(row("localizando_cotacao", 3), t0);
    expect(v.passo).toBe(3);
    expect(v.rotulo).toBe("Localizando a cotação");
  });
  it("na_fila fica no passo 1", () => {
    expect(calcularTransmissaoProgresso(row("na_fila", 0), t0).passo).toBe(1);
  });
  it("concluido e erro são finais; erro expõe a mensagem", () => {
    expect(calcularTransmissaoProgresso(row("concluido", 9), t0).final).toBe("concluido");
    const e = calcularTransmissaoProgresso(row("erro", 9, { erro: "falhou" }), t0);
    expect(e.final).toBe("erro");
    expect(e.erro).toBe("falhou");
  });
  it("sem atualização só acima de 45 s", () => {
    const r = row("confirmando", 6);
    expect(calcularTransmissaoProgresso(r, t0 + 45_000).semAtualizacaoHaSegundos).toBeNull();
    expect(calcularTransmissaoProgresso(r, t0 + 60_000).semAtualizacaoHaSegundos).toBe(60);
  });
});

type P = Record<string, unknown>;
function passos(v?: Parameters<typeof TransmissaoEspera>[0]["v"]) {
  const el = TransmissaoEspera({ v }) as ReactElement<P>;
  return el.props as { passos: string[]; atual: number; titulo: string };
}

describe("TransmissaoEspera", () => {
  it("mostra título e os 6 passos reais", () => {
    const p = passos();
    expect(p.titulo).toBe("Transmitindo sua proposta");
    expect(p.passos).toHaveLength(6);
    expect(p.passos[0]).toBe("Entrando no portal");
    expect(p.passos[5]).toBe("Confirmando a transmissão");
  });
  it("destaca o passo atual por etapa", () => {
    expect(passos(calcularTransmissaoProgresso(row("na_fila", 0), t0)).atual).toBe(1);
    expect(passos(calcularTransmissaoProgresso(row("preenchendo_efetivacao", 5), t0)).atual).toBe(
      5,
    );
  });
  it("concluido/erro marcam todos como ok", () => {
    expect(passos(calcularTransmissaoProgresso(row("concluido", 9), t0)).atual).toBe(7);
    expect(passos(calcularTransmissaoProgresso(row("erro", 9, { erro: "x" }), t0)).atual).toBe(7);
  });
});

describe("CalculoEspera (casca compartilhada)", () => {
  it("continua com o título e os passos do cálculo", () => {
    const el = CalculoEspera({}) as ReactElement<P>;
    const p = el.props as { titulo: string; passos: string[]; atual: number };
    expect(p.titulo).toBe("Calculando sua cotação");
    expect(p.passos).toHaveLength(6);
    expect(p.atual).toBe(1);
  });
});
