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
import type { PipelineResumoEtapa } from "@/lib/pipeline-query";

// Lógica pura do card/header do Pipeline (Kanban/Tabela) — T6/T8/T9. Roda offline.

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

/**
 * Lead mínimo (`PontoExatoLead & ProximaAcaoLead`) — sobrescreve só o que o
 * caso de teste precisa. Pipeline V12, T8/T9: os campos vêm soltos na linha
 * da view `pipeline_leads_etapa` (não mais aninhados em
 * `cotacao`/`propostaTransmitida`).
 */
function lead(
  etapa: LeadEtapaBucket,
  overrides: Partial<PontoExatoLead & ProximaAcaoLead> = {},
): PontoExatoLead & ProximaAcaoLead {
  return {
    etapa,
    cotacao_status: null,
    step_atual: null,
    transmissao_fase: null,
    transmissao_aberta_status: null,
    proposta_numero: null,
    proposta_transmissao_status: null,
    motivo_perda: null,
    ...overrides,
  };
}

describe("pontoExato", () => {
  it("novo -> texto fixo", () => {
    expect(pontoExato(lead("novo"))).toBe("aguardando o primeiro contato");
  });

  it("cotacao -> usa o rótulo real do passo do wizard (STEPS[step_atual])", () => {
    expect(pontoExato(lead("cotacao", { step_atual: 0 }))).toBe("parou em Segurado");
    expect(pontoExato(lead("cotacao", { step_atual: 4 }))).toBe("parou em Coberturas");
  });

  it("cotacao sem passo resolvido cai no fallback genérico", () => {
    expect(pontoExato(lead("cotacao", { step_atual: null }))).toBe("preenchendo a cotação");
  });

  it("negociacao -> texto fixo", () => {
    expect(pontoExato(lead("negociacao"))).toBe("no cálculo — comparando seguradoras");
  });

  it("finalizacao com sub-passo pré-envio (transmissao_fase) -> um texto por fase", () => {
    expect(pontoExato(lead("finalizacao", { transmissao_fase: "dados" }))).toBe(
      "transmissão · dados complementares",
    );
    expect(pontoExato(lead("finalizacao", { transmissao_fase: "confirmacao" }))).toBe(
      "transmissão · confirmação",
    );
    expect(pontoExato(lead("finalizacao", { transmissao_fase: "pagamento" }))).toBe(
      "transmissão · pagamento",
    );
  });

  it("finalizacao sem sub-passo pré-envio, tentativa 'enviada' -> transmitindo", () => {
    expect(
      pontoExato(
        lead("finalizacao", {
          transmissao_fase: null,
          cotacao_status: "calculada",
          transmissao_aberta_status: "enviada",
        }),
      ),
    ).toBe("transmissão · transmitindo");
  });

  it("finalizacao sem sub-passo pré-envio, tentativa 'falha' -> falhou", () => {
    expect(
      pontoExato(
        lead("finalizacao", {
          transmissao_fase: null,
          cotacao_status: "calculada",
          transmissao_aberta_status: "falha",
        }),
      ),
    ).toBe("transmissão · falhou");
  });

  it("finalizacao sem cotação resolvida (cotacao_status null) cai no fallback genérico", () => {
    expect(pontoExato(lead("finalizacao", { transmissao_fase: null, cotacao_status: null }))).toBe(
      "transmissão em andamento",
    );
  });

  it("fechamento com proposta transmitida -> número + status legível", () => {
    expect(
      pontoExato(
        lead("fechamento", {
          proposta_numero: "123456",
          proposta_transmissao_status: "transmitida",
        }),
      ),
    ).toBe("proposta 123456 · transmitida");
  });

  it("fechamento sem proposta transmitida cai no fallback fixo", () => {
    expect(pontoExato(lead("fechamento", { proposta_numero: null }))).toBe(
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
    expect(proximaAcao(lead("cotacao", { step_atual: 0 }))).toBe("Completar os dados do segurado");
    expect(proximaAcao(lead("cotacao", { step_atual: 1 }))).toBe("Completar os dados do segurado");
  });

  it("cotacao — Veículo/Perfil (passos 2 e 3)", () => {
    expect(proximaAcao(lead("cotacao", { step_atual: 2 }))).toBe("Completar os dados do veículo");
    expect(proximaAcao(lead("cotacao", { step_atual: 3 }))).toBe("Completar os dados do veículo");
  });

  it("cotacao — Coberturas (passo 4, último antes do cálculo)", () => {
    expect(proximaAcao(lead("cotacao", { step_atual: 4 }))).toBe(
      "Ajustar coberturas e rodar o cálculo",
    );
  });

  it("negociacao", () => {
    expect(proximaAcao(lead("negociacao"))).toBe("Comparar seguradoras e enviar a proposta");
  });

  it("finalizacao sem tentativa ainda (sub-passo pré-envio)", () => {
    for (const fase of ["dados", "confirmacao", "pagamento"] as const) {
      expect(proximaAcao(lead("finalizacao", { transmissao_fase: fase }))).toBe(
        "Completar os dados que a seguradora pede",
      );
    }
  });

  it("finalizacao com tentativa real 'enviada' (ainda transmitindo)", () => {
    expect(
      proximaAcao(
        lead("finalizacao", { transmissao_fase: null, transmissao_aberta_status: "enviada" }),
      ),
    ).toBe("Aguardar o retorno do robô da seguradora");
  });

  it("finalizacao com tentativa real 'falha' (precisa reenviar)", () => {
    expect(
      proximaAcao(
        lead("finalizacao", { transmissao_fase: null, transmissao_aberta_status: "falha" }),
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
  /**
   * Pipeline V12, T8: `pipelineHeaderResumo` deixou de receber a lista
   * completa de leads (não existe mais em memória com a paginação por
   * coluna) — passa a receber o agregado `etapa -> total` já pronto
   * (`PipelineResumoEtapa[]`, de `fetchPipelineResumoEtapas`) mais os dois
   * filtros que decidem o numerador (`etapaFiltro`/`statusFiltro`).
   */
  function resumo(etapa: LeadEtapaBucket, total: number): PipelineResumoEtapa {
    return { etapa, total, valorTotal: 0 };
  }

  const AGREGADO: PipelineResumoEtapa[] = [
    resumo("novo", 1),
    resumo("cotacao", 1),
    resumo("negociacao", 2),
    resumo("fechamento", 1),
    resumo("perdido", 3),
  ];

  it("com etapaFiltro='todas' e statusFiltro='todos', numerador = total de ativos", () => {
    expect(pipelineHeaderResumo(AGREGADO, "todas", "todos")).toBe(
      "5 de 5 leads em andamento · 2 em negociação · 1 em fechamento",
    );
  });

  it("com etapaFiltro numa etapa específica, numerador = total só dessa etapa", () => {
    expect(pipelineHeaderResumo(AGREGADO, "negociacao", "todos")).toBe(
      "2 de 5 leads em andamento · 2 em negociação · 1 em fechamento",
    );
  });

  it("com statusFiltro='perdidos', numerador zera (perdido não entra nos ativos)", () => {
    expect(pipelineHeaderResumo(AGREGADO, "todas", "perdidos")).toBe(
      "0 de 5 leads em andamento · 2 em negociação · 1 em fechamento",
    );
  });

  it("com etapaFiltro='perdido', numerador zera mesmo com statusFiltro='todos'", () => {
    expect(pipelineHeaderResumo(AGREGADO, "perdido", "todos")).toBe(
      "0 de 5 leads em andamento · 2 em negociação · 1 em fechamento",
    );
  });

  it("etapa sem linha no agregado conta como 0, não quebra", () => {
    const semFinalizacao = [resumo("novo", 2)];
    expect(pipelineHeaderResumo(semFinalizacao, "todas", "todos")).toBe(
      "2 de 2 leads em andamento · 0 em negociação · 0 em fechamento",
    );
  });
});
