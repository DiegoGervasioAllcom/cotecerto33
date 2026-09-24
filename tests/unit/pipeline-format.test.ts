import { describe, it, expect } from "vitest";
import {
  diasLabel,
  pipelineHeaderResumo,
  pontoExato,
  proximaAcao,
  retornoLabel,
  veiculoResumo,
  type PontoExatoLead,
  type ProximaAcaoLead,
} from "@/components/venda/pipeline/pipeline-format";
import type { LeadEtapaBucket } from "@/lib/lead-etapa";
import type {
  PipelineCotacao,
  PipelineLeadRow,
  PipelinePropostaTransmitida,
} from "@/lib/pipeline-data";

// Lógica pura do card/header do Pipeline (Kanban/Tabela) — T6/T9. Roda offline.

describe("veiculoResumo", () => {
  it("junta marca, modelo e ano quando existem", () => {
    expect(veiculoResumo({ marca_nome: "Fiat", modelo_nome: "Argo", ano_modelo: "2022" })).toBe(
      "Fiat Argo 2022",
    );
  });

  it("ignora partes ausentes", () => {
    expect(veiculoResumo({ marca_nome: "Fiat", modelo_nome: null, ano_modelo: null })).toBe("Fiat");
  });

  it("retorna null sem veículo", () => {
    expect(veiculoResumo(null)).toBeNull();
    expect(veiculoResumo(undefined)).toBeNull();
  });
});

/** Cotação mínima válida (`PipelineCotacao`) — sobrescreve só o que o caso de teste precisa. */
function cotacao(overrides: Partial<PipelineCotacao> = {}): PipelineCotacao {
  return {
    id: "c1",
    lead_id: "l1",
    status: "rascunho",
    ramo: "auto",
    atualizado_em: "2026-09-01T00:00:00.000Z",
    step_atual: 0,
    transmissao_fase: null,
    segurado: null,
    veiculo: null,
    ...overrides,
  };
}

/** Lead mínimo (`PontoExatoLead`/`ProximaAcaoLead`) — sobrescreve só o que o caso de teste precisa. */
function lead(
  etapa: LeadEtapaBucket,
  overrides: {
    cotacao?: PipelineCotacao | null;
    propostaTransmitida?: PipelinePropostaTransmitida | null;
    motivo_perda?: string | null;
    transmissaoAbertaStatus?: "enviada" | "falha" | null;
  } = {},
): PontoExatoLead & ProximaAcaoLead {
  return {
    etapa,
    cotacao: overrides.cotacao ?? null,
    propostaTransmitida: overrides.propostaTransmitida ?? null,
    motivo_perda: overrides.motivo_perda ?? null,
    transmissaoAbertaStatus: overrides.transmissaoAbertaStatus ?? null,
  };
}

describe("pontoExato", () => {
  it("novo -> texto fixo", () => {
    expect(pontoExato(lead("novo"))).toBe("aguardando o primeiro contato");
  });

  it("cotacao -> usa o rótulo real do passo do wizard (STEPS[step_atual])", () => {
    expect(pontoExato(lead("cotacao", { cotacao: cotacao({ step_atual: 0 }) }))).toBe(
      "parou em Segurado",
    );
    expect(pontoExato(lead("cotacao", { cotacao: cotacao({ step_atual: 4 }) }))).toBe(
      "parou em Coberturas",
    );
  });

  it("cotacao sem cotação resolvida cai no fallback genérico", () => {
    expect(pontoExato(lead("cotacao", { cotacao: null }))).toBe("preenchendo a cotação");
  });

  it("negociacao -> texto fixo", () => {
    expect(pontoExato(lead("negociacao"))).toBe("no cálculo — comparando seguradoras");
  });

  it("finalizacao com sub-passo pré-envio (transmissao_fase) -> um texto por fase", () => {
    expect(
      pontoExato(lead("finalizacao", { cotacao: cotacao({ transmissao_fase: "dados" }) })),
    ).toBe("transmissão · dados complementares");
    expect(
      pontoExato(lead("finalizacao", { cotacao: cotacao({ transmissao_fase: "confirmacao" }) })),
    ).toBe("transmissão · confirmação");
    expect(
      pontoExato(lead("finalizacao", { cotacao: cotacao({ transmissao_fase: "pagamento" }) })),
    ).toBe("transmissão · pagamento");
  });

  it("finalizacao sem sub-passo pré-envio, tentativa 'enviada' -> transmitindo", () => {
    expect(
      pontoExato(
        lead("finalizacao", {
          cotacao: cotacao({ transmissao_fase: null }),
          transmissaoAbertaStatus: "enviada",
        }),
      ),
    ).toBe("transmissão · transmitindo");
  });

  it("finalizacao sem sub-passo pré-envio, tentativa 'falha' -> falhou", () => {
    expect(
      pontoExato(
        lead("finalizacao", {
          cotacao: cotacao({ transmissao_fase: null }),
          transmissaoAbertaStatus: "falha",
        }),
      ),
    ).toBe("transmissão · falhou");
  });

  it("finalizacao sem cotação resolvida cai no fallback genérico", () => {
    expect(pontoExato(lead("finalizacao", { cotacao: null }))).toBe("transmissão em andamento");
  });

  it("fechamento com proposta transmitida -> número + status legível", () => {
    expect(
      pontoExato(
        lead("fechamento", {
          propostaTransmitida: { numero: "123456", transmissao_status: "transmitida" },
        }),
      ),
    ).toBe("proposta 123456 · transmitida");
  });

  it("fechamento sem proposta transmitida cai no fallback fixo", () => {
    expect(pontoExato(lead("fechamento", { propostaTransmitida: null }))).toBe(
      "aguardando a seguradora",
    );
  });

  it("perdido -> null (o card mostra o chip de motivo de perda à parte)", () => {
    expect(pontoExato(lead("perdido", { motivo_perda: "Sem retorno" }))).toBeNull();
  });
});

describe("proximaAcao", () => {
  it("novo", () => {
    expect(proximaAcao(lead("novo"))).toBe("Fazer o primeiro contato");
  });

  it("cotacao — Segurado/Seguro (passos 0 e 1)", () => {
    expect(proximaAcao(lead("cotacao", { cotacao: cotacao({ step_atual: 0 }) }))).toBe(
      "Completar os dados do segurado",
    );
    expect(proximaAcao(lead("cotacao", { cotacao: cotacao({ step_atual: 1 }) }))).toBe(
      "Completar os dados do segurado",
    );
  });

  it("cotacao — Veículo/Perfil (passos 2 e 3)", () => {
    expect(proximaAcao(lead("cotacao", { cotacao: cotacao({ step_atual: 2 }) }))).toBe(
      "Completar os dados do veículo",
    );
    expect(proximaAcao(lead("cotacao", { cotacao: cotacao({ step_atual: 3 }) }))).toBe(
      "Completar os dados do veículo",
    );
  });

  it("cotacao — Coberturas (passo 4, último antes do cálculo)", () => {
    expect(proximaAcao(lead("cotacao", { cotacao: cotacao({ step_atual: 4 }) }))).toBe(
      "Ajustar coberturas e rodar o cálculo",
    );
  });

  it("negociacao", () => {
    expect(proximaAcao(lead("negociacao"))).toBe("Comparar seguradoras e enviar a proposta");
  });

  it("finalizacao sem tentativa ainda (sub-passo pré-envio)", () => {
    for (const fase of ["dados", "confirmacao", "pagamento"] as const) {
      expect(
        proximaAcao(lead("finalizacao", { cotacao: cotacao({ transmissao_fase: fase }) })),
      ).toBe("Completar os dados que a seguradora pede");
    }
  });

  it("finalizacao com tentativa real 'enviada' (ainda transmitindo)", () => {
    expect(
      proximaAcao(
        lead("finalizacao", {
          cotacao: cotacao({ transmissao_fase: null }),
          transmissaoAbertaStatus: "enviada",
        }),
      ),
    ).toBe("Aguardar o retorno do robô da seguradora");
  });

  it("finalizacao com tentativa real 'falha' (precisa reenviar)", () => {
    expect(
      proximaAcao(
        lead("finalizacao", {
          cotacao: cotacao({ transmissao_fase: null }),
          transmissaoAbertaStatus: "falha",
        }),
      ),
    ).toBe("Revisar e reenviar a transmissão");
  });

  it("fechamento", () => {
    expect(proximaAcao(lead("fechamento"))).toBe("Acompanhar a emissão da apólice");
  });

  it("perdido — usa o motivo_perda (mesmo padrão de hoje)", () => {
    expect(proximaAcao(lead("perdido", { motivo_perda: "Sem retorno" }))).toBe("Sem retorno");
    expect(proximaAcao(lead("perdido", { motivo_perda: null }))).toBeNull();
  });
});

describe("retornoLabel", () => {
  it("inclui a hora quando presente", () => {
    const hoje = new Date();
    const iso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    expect(retornoLabel({ leadId: "l1", data: iso, hora: "14:30:00" })).toBe(
      "Retorno hoje · 14:30",
    );
  });

  it("sem hora, mostra só a urgência", () => {
    const hoje = new Date();
    const iso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    expect(retornoLabel({ leadId: "l1", data: iso, hora: null })).toBe("Retorno hoje");
  });
});

describe("diasLabel", () => {
  it("0 dias -> 'hoje' com tooltip de menos de um dia", () => {
    expect(diasLabel(0)).toEqual({
      texto: "hoje",
      titulo: "Parado há menos de um dia",
    });
  });

  it("N dias -> 'há Nd' com tooltip 'Parado há N dia(s)'", () => {
    expect(diasLabel(1)).toEqual({ texto: "há 1d", titulo: "Parado há 1 dia(s)" });
    expect(diasLabel(8)).toEqual({ texto: "há 8d", titulo: "Parado há 8 dia(s)" });
  });
});

describe("pipelineHeaderResumo", () => {
  function leadHeader(etapa: LeadEtapaBucket): Pick<PipelineLeadRow, "etapa"> {
    return { etapa };
  }

  it("conta ativos, negociação e fechamento — perdido não entra nos totais", () => {
    const todos = [
      leadHeader("novo"),
      leadHeader("cotacao"),
      leadHeader("negociacao"),
      leadHeader("negociacao"),
      leadHeader("fechamento"),
      leadHeader("perdido"),
    ];
    const filtrados = [leadHeader("novo"), leadHeader("negociacao")];
    expect(pipelineHeaderResumo(todos, filtrados)).toBe(
      "2 de 5 leads em andamento · 2 em negociação · 1 em fechamento",
    );
  });
});
