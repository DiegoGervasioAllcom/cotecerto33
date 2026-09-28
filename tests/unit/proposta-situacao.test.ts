import { describe, it, expect } from "vitest";
import {
  PROPOSTA_SITUACAO,
  PROPOSTA_SITUACAO_STATUSES,
  agruparPropostasPorSituacao,
  dataHoraOuTraco,
  dataOuTraco,
  moedaOuTraco,
  propostaEstaConcluida,
  propostaSituacaoInfo,
  textoOuTraco,
} from "@/lib/proposta-situacao";

// Lógica pura de "Emissão & histórico" e "Transmitida" (Frente 3, V12.1.25/V12.1.13
// parciais) — roda offline, sem banco.

describe("propostaSituacaoInfo", () => {
  it("mapeia os status alcançáveis hoje (transmitida/falha)", () => {
    expect(propostaSituacaoInfo("transmitida")).toMatchObject({
      status: "transmitida",
      label: "Transmitida",
      chipClass: "chip-slate",
    });
    expect(propostaSituacaoInfo("falha")).toMatchObject({
      status: "falha",
      label: "Pendência da seguradora",
      chipClass: "chip-alert",
    });
  });

  it("mapeia os status futuros da integração sem simular nada — só o chip/label existe", () => {
    expect(propostaSituacaoInfo("bloqueada")).toMatchObject({
      status: "bloqueada",
      label: "Bloqueada",
      chipClass: "chip-alert",
    });
    expect(propostaSituacaoInfo("analise")).toMatchObject({
      status: "analise",
      label: "Em análise",
      chipClass: "chip-yellow",
    });
    expect(propostaSituacaoInfo("emitida")).toMatchObject({
      status: "emitida",
      label: "Emitida",
      chipClass: "chip-ok",
    });
    expect(propostaSituacaoInfo("recusada")).toMatchObject({
      status: "recusada",
      label: "Recusada",
      chipClass: "chip-alert",
    });
  });

  it("todo status conhecido tem chip/label/descrição não vazios (nenhum buraco no mapa)", () => {
    for (const status of PROPOSTA_SITUACAO_STATUSES) {
      const info = PROPOSTA_SITUACAO[status];
      expect(info.label.length).toBeGreaterThan(0);
      expect(info.descricao.length).toBeGreaterThan(0);
      expect(["chip-slate", "chip-alert", "chip-yellow", "chip-ok"]).toContain(info.chipClass);
    }
  });

  it("status desconhecido ou nulo cai em transmitida (fallback)", () => {
    expect(propostaSituacaoInfo(null).status).toBe("transmitida");
    expect(propostaSituacaoInfo("algo-novo-nao-mapeado").status).toBe("transmitida");
  });
});

describe("propostaEstaConcluida / agruparPropostasPorSituacao", () => {
  it("só emitida conta como concluída — o resto aguarda a seguradora (inclusive os status futuros)", () => {
    expect(propostaEstaConcluida("emitida")).toBe(true);
    expect(propostaEstaConcluida("transmitida")).toBe(false);
    expect(propostaEstaConcluida("falha")).toBe(false);
    expect(propostaEstaConcluida("bloqueada")).toBe(false);
    expect(propostaEstaConcluida("analise")).toBe(false);
    expect(propostaEstaConcluida("recusada")).toBe(false);
    expect(propostaEstaConcluida(null)).toBe(false);
  });

  it("agrupa também os status futuros (bloqueada/analise/recusada) em aguardando", () => {
    const rows = [
      { id: "a", transmissao_status: "bloqueada" },
      { id: "b", transmissao_status: "analise" },
      { id: "c", transmissao_status: "recusada" },
      { id: "d", transmissao_status: "emitida" },
    ];
    const { aguardando, concluidas } = agruparPropostasPorSituacao(rows);
    expect(aguardando.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(concluidas.map((r) => r.id)).toEqual(["d"]);
  });

  it("separa aguardando x concluídas preservando ordem", () => {
    const rows = [
      { id: "a", transmissao_status: "transmitida" },
      { id: "b", transmissao_status: "emitida" },
      { id: "c", transmissao_status: "falha" },
      { id: "d", transmissao_status: "emitida" },
    ];
    const { aguardando, concluidas } = agruparPropostasPorSituacao(rows);
    expect(aguardando.map((r) => r.id)).toEqual(["a", "c"]);
    expect(concluidas.map((r) => r.id)).toEqual(["b", "d"]);
  });

  it("PROPOSTA_SITUACAO_STATUSES inclui os dois status reais e os futuros", () => {
    expect(PROPOSTA_SITUACAO_STATUSES).toEqual(
      expect.arrayContaining([
        "transmitida",
        "falha",
        "bloqueada",
        "analise",
        "emitida",
        "recusada",
      ]),
    );
  });
});

describe("formatadores '—'", () => {
  it("textoOuTraco", () => {
    expect(textoOuTraco(null)).toBe("—");
    expect(textoOuTraco(undefined)).toBe("—");
    expect(textoOuTraco("")).toBe("—");
    expect(textoOuTraco("ABC123")).toBe("ABC123");
    expect(textoOuTraco(42)).toBe("42");
  });

  it("dataHoraOuTraco / dataOuTraco", () => {
    expect(dataHoraOuTraco(null)).toBe("—");
    expect(dataOuTraco(null)).toBe("—");
    expect(dataHoraOuTraco("2026-01-05T10:00:00Z")).not.toBe("—");
    expect(dataOuTraco("2026-01-05T10:00:00Z")).not.toBe("—");
  });

  it("moedaOuTraco", () => {
    expect(moedaOuTraco(null)).toBe("—");
    expect(moedaOuTraco(undefined)).toBe("—");
    expect(moedaOuTraco(1500)).toContain("1.500,00");
  });
});
