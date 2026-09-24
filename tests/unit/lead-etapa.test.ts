import { describe, it, expect } from "vitest";
import {
  leadEtapaBucket,
  primeiraOcorrenciaPorChave,
  pickMaisRecentePorLead,
  type LeadEtapaInput,
} from "@/lib/lead-etapa";

// Lógica pura do Pipeline V12 — roda offline, sem banco.

const baseInput: LeadEtapaInput = {
  statusPipeline: "novo",
  cotacaoStatus: null,
  transmissaoEmAberto: false,
  propostaTransmitida: false,
  emEtapaTransmissao: false,
};

describe("leadEtapaBucket", () => {
  it("statusPipeline perdido cai em perdido", () => {
    expect(leadEtapaBucket({ ...baseInput, statusPipeline: "perdido" })).toBe("perdido");
  });

  it("propostaTransmitida true cai em fechamento", () => {
    expect(leadEtapaBucket({ ...baseInput, propostaTransmitida: true })).toBe("fechamento");
  });

  it("transmissaoEmAberto true cai em finalizacao", () => {
    expect(leadEtapaBucket({ ...baseInput, transmissaoEmAberto: true })).toBe("finalizacao");
  });

  it("emEtapaTransmissao true (sem transmissaoEmAberto) também cai em finalizacao", () => {
    expect(leadEtapaBucket({ ...baseInput, emEtapaTransmissao: true })).toBe("finalizacao");
  });

  it("cotacaoStatus em EM_NEGOCIACAO_STATUSES cai em negociacao", () => {
    expect(leadEtapaBucket({ ...baseInput, cotacaoStatus: "calculada" })).toBe("negociacao");
    expect(leadEtapaBucket({ ...baseInput, cotacaoStatus: "proposta" })).toBe("negociacao");
  });

  it("cotacaoStatus em EM_COTACAO_STATUSES cai em cotacao", () => {
    expect(leadEtapaBucket({ ...baseInput, cotacaoStatus: "rascunho" })).toBe("cotacao");
  });

  it("cotacaoStatus null cai em novo, independente do statusPipeline", () => {
    expect(leadEtapaBucket({ ...baseInput, statusPipeline: "contato", cotacaoStatus: null })).toBe(
      "novo",
    );
    expect(
      leadEtapaBucket({ ...baseInput, statusPipeline: "qualificado", cotacaoStatus: null }),
    ).toBe("novo");
  });

  it("cotacaoStatus desconhecido (fora das listas) também cai em novo", () => {
    expect(leadEtapaBucket({ ...baseInput, cotacaoStatus: "cancelada" })).toBe("novo");
  });

  // Casos de sinais concorrentes — provam a ordem de prioridade real da função.

  it("perdido ganha de propostaTransmitida, transmissaoEmAberto e cotacaoStatus simultaneamente", () => {
    expect(
      leadEtapaBucket({
        statusPipeline: "perdido",
        cotacaoStatus: "calculada",
        transmissaoEmAberto: true,
        propostaTransmitida: true,
        emEtapaTransmissao: true,
      }),
    ).toBe("perdido");
  });

  it("fechamento (propostaTransmitida) ganha de finalizacao (transmissaoEmAberto) mesmo com ambos true", () => {
    expect(
      leadEtapaBucket({
        ...baseInput,
        transmissaoEmAberto: true,
        propostaTransmitida: true,
      }),
    ).toBe("fechamento");
  });

  it("finalizacao (transmissaoEmAberto) ganha de negociacao mesmo com cotacaoStatus em negociação", () => {
    expect(
      leadEtapaBucket({
        ...baseInput,
        cotacaoStatus: "proposta",
        transmissaoEmAberto: true,
      }),
    ).toBe("finalizacao");
  });

  it("finalizacao (emEtapaTransmissao) ganha de negociacao mesmo com cotacaoStatus em negociação", () => {
    expect(
      leadEtapaBucket({
        ...baseInput,
        cotacaoStatus: "proposta",
        emEtapaTransmissao: true,
      }),
    ).toBe("finalizacao");
  });

  it("fechamento (propostaTransmitida) ganha de finalizacao (emEtapaTransmissao) mesmo com ambos true", () => {
    expect(
      leadEtapaBucket({
        ...baseInput,
        emEtapaTransmissao: true,
        propostaTransmitida: true,
      }),
    ).toBe("fechamento");
  });

  it("perdido ganha de emEtapaTransmissao mesmo com ambos true", () => {
    expect(
      leadEtapaBucket({
        ...baseInput,
        statusPipeline: "perdido",
        emEtapaTransmissao: true,
      }),
    ).toBe("perdido");
  });

  it("negociacao ganha de cotacao quando o cotacaoStatus está em ambas as listas ao mesmo tempo (impossível no schema, mas prova a ordem de checagem)", () => {
    // EM_NEGOCIACAO_STATUSES é checado antes de EM_COTACAO_STATUSES no código;
    // "calculada" nunca está nas duas listas, então isso só documenta a ordem.
    expect(leadEtapaBucket({ ...baseInput, cotacaoStatus: "calculada" })).toBe("negociacao");
    expect(leadEtapaBucket({ ...baseInput, cotacaoStatus: "rascunho" })).not.toBe("negociacao");
  });
});

describe("primeiraOcorrenciaPorChave", () => {
  it("mantém só a primeira ocorrência de cada chave, preservando a ordem de entrada", () => {
    const rows = [
      { id: "a", valor: 1 },
      { id: "b", valor: 2 },
      { id: "a", valor: 3 },
      { id: "c", valor: 4 },
      { id: "b", valor: 5 },
    ];

    const resultado = primeiraOcorrenciaPorChave(rows, (row) => row.id);

    expect(resultado).toEqual([
      { id: "a", valor: 1 },
      { id: "b", valor: 2 },
      { id: "c", valor: 4 },
    ]);
  });

  it("com chaves todas distintas, mantém todas as linhas na ordem original", () => {
    const rows = [{ id: "x" }, { id: "y" }, { id: "z" }];

    expect(primeiraOcorrenciaPorChave(rows, (row) => row.id)).toEqual(rows);
  });

  it("array vazio retorna array vazio", () => {
    expect(primeiraOcorrenciaPorChave([], (row: { id: string }) => row.id)).toEqual([]);
  });
});

describe("pickMaisRecentePorLead", () => {
  it("com 2 linhas para o mesmo lead_id, mantém no Map a de atualizado_em mais recente", () => {
    const rows = [
      { lead_id: "lead-1", atualizado_em: "2026-01-01T00:00:00.000Z", valor: "antiga" },
      { lead_id: "lead-1", atualizado_em: "2026-02-01T00:00:00.000Z", valor: "recente" },
    ];

    const resultado = pickMaisRecentePorLead(rows);

    expect(resultado.size).toBe(1);
    expect(resultado.get("lead-1")).toEqual({
      lead_id: "lead-1",
      atualizado_em: "2026-02-01T00:00:00.000Z",
      valor: "recente",
    });
  });

  it("não depende da ordem de entrada: a linha mais recente vence mesmo vindo primeiro", () => {
    const rows = [
      { lead_id: "lead-1", atualizado_em: "2026-02-01T00:00:00.000Z", valor: "recente" },
      { lead_id: "lead-1", atualizado_em: "2026-01-01T00:00:00.000Z", valor: "antiga" },
    ];

    expect(pickMaisRecentePorLead(rows).get("lead-1")?.valor).toBe("recente");
  });

  it("linhas com lead_id null são ignoradas (não entram no Map)", () => {
    const rows = [
      { lead_id: null, atualizado_em: "2026-01-01T00:00:00.000Z" },
      { lead_id: null, atualizado_em: "2026-02-01T00:00:00.000Z" },
    ];

    const resultado = pickMaisRecentePorLead(rows);

    expect(resultado.size).toBe(0);
  });

  it("múltiplos lead_id distintos geram uma entrada no Map por lead", () => {
    const rows = [
      { lead_id: "lead-1", atualizado_em: "2026-01-01T00:00:00.000Z" },
      { lead_id: "lead-2", atualizado_em: "2026-01-02T00:00:00.000Z" },
      { lead_id: "lead-3", atualizado_em: "2026-01-03T00:00:00.000Z" },
    ];

    const resultado = pickMaisRecentePorLead(rows);

    expect(resultado.size).toBe(3);
    expect([...resultado.keys()]).toEqual(["lead-1", "lead-2", "lead-3"]);
  });
});
