import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarPersonaComEmpresa, uniq } from "../helpers/supabase";
import { leadEtapaBucket, type LeadEtapaBucket, type LeadEtapaInput } from "@/lib/lead-etapa";
import type { Database } from "@/integrations/supabase/database.types";

type LeadStatusPipeline = Database["public"]["Enums"]["lead_status"];
type CotacaoStatus = Database["public"]["Enums"]["cotacao_status"];

/**
 * T2 (Pipeline V12 — paginação server-side): gabarito de equivalência entre
 * `leadEtapaBucket()` (TS, `src/lib/lead-etapa.ts`) e a view
 * `pipeline_leads_etapa` (SQL, migration
 * `20260924162114_v12_pipeline_kanban_paginado.sql`). Para cada cenário: cria
 * lead/cotação/transmissão/proposta reais via client admin, calcula o bucket
 * em TS a partir dos mesmos sinais, lê `etapa` da view para o `lead_id` real
 * e confere que os dois batem — sempre.
 *
 * Cobre TODOS os ~15 cenários de `tests/unit/lead-etapa.test.ts` (a fonte de
 * verdade da regra) e os 3 casos de "mais recente" (`DISTINCT ON` da view:
 * cotação, tentativa de transmissão e proposta transmitida).
 *
 * Duas substituições documentadas em relação ao teste unitário puro
 * (já validadas manualmente na T0):
 * - `cotacaoStatus: null` do teste TS, quando o sinal testado
 *   (`transmissaoEmAberto`/`emEtapaTransmissao`) exige uma cotação real no
 *   schema (não existe tentativa de transmissão nem `step_atual` sem uma
 *   linha em `cotacoes`), vira um `cotacaoStatus` placeholder (`'rascunho'`
 *   — fora de `EM_NEGOCIACAO_STATUSES`, não compete na prioridade). A ordem
 *   de decisão de `leadEtapaBucket` garante que o placeholder é ignorado de
 *   qualquer forma nesses casos.
 * - `cotacaoStatus: "cancelada"` do teste TS não é um valor do enum
 *   `cotacao_status` do banco (`rascunho|calculada|proposta|aceita|perdida|
 *   enviada_quiver|erro_quiver`) — usamos `'aceita'`, que também está fora
 *   das duas listas (`EM_NEGOCIACAO_STATUSES`/`EM_COTACAO_STATUSES`), mesmo
 *   efeito no cálculo.
 *
 * 1 cenário do teste unitário é redundante, não "impossível": "negociacao
 * ganha de cotacao quando cotacaoStatus está em ambas as listas" (o próprio
 * comentário do teste TS diz "documenta a ordem") na prática só reexecuta,
 * com valores únicos, os cenários `cotacaoStatus: 'calculada'` (→ negociação,
 * caso 5 abaixo) e `cotacaoStatus: 'rascunho'` (→ cotação, caso 7 abaixo) —
 * não é uma combinação de sinais nova, então não ganhou linha própria aqui.
 *
 * Sem cleanup em `afterAll`: segue o padrão majoritário de `tests/db/**`
 * (nomes únicos via `uniq()`; `bun run db:reset` limpa tudo quando precisar).
 */

async function lerEtapa(leadId: string): Promise<{
  etapa: string | null;
  cotacao_id: string | null;
  transmissao_aberta_status: string | null;
  proposta_numero: string | null;
}> {
  const { data, error } = await admin
    .from("pipeline_leads_etapa")
    .select("etapa,cotacao_id,transmissao_aberta_status,proposta_numero")
    .eq("lead_id", leadId)
    .single();
  if (error || !data) throw new Error(`ler pipeline_leads_etapa: ${error?.message}`);
  return data;
}

describe("pipeline_leads_etapa — equivalência com leadEtapaBucket()", () => {
  let empresaId: string;
  let vendedorId: string;

  beforeAll(async () => {
    const vendedor = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: "vend-pipeline-equiv",
    });
    empresaId = vendedor.empresaId;
    vendedorId = vendedor.userId;
  });

  async function criarLead(statusPipeline: LeadStatusPipeline): Promise<string> {
    const { data, error } = await admin
      .from("leads")
      .insert({
        nome: uniq("Lead Pipeline Equivalência"),
        empresa_id: empresaId,
        responsavel_id: vendedorId,
        status_pipeline: statusPipeline,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`criar lead: ${error?.message}`);
    return data.id;
  }

  async function criarCotacao(
    leadId: string,
    status: CotacaoStatus,
    stepAtual = 0,
  ): Promise<string> {
    const { data, error } = await admin
      .from("cotacoes")
      .insert({
        empresa_id: empresaId,
        responsavel_id: vendedorId,
        lead_id: leadId,
        status,
        step_atual: stepAtual,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`criar cotação: ${error?.message}`);
    return data.id;
  }

  async function criarTransmissaoAberta(
    cotacaoId: string,
    status: "enviada" | "falha" = "enviada",
    criadoEm?: string,
  ): Promise<void> {
    const { error } = await admin.from("cotacao_transmissoes").insert({
      cotacao_id: cotacaoId,
      status,
      ...(criadoEm ? { criado_em: criadoEm } : {}),
    });
    if (error) throw new Error(`criar tentativa de transmissão: ${error.message}`);
  }

  async function criarPropostaTransmitida(opts: {
    leadId: string;
    cotacaoId: string | null;
    numero?: string;
    atualizadoEm?: string;
  }): Promise<void> {
    const { error } = await admin.from("propostas").insert({
      empresa_id: empresaId,
      responsavel_id: vendedorId,
      lead_id: opts.leadId,
      cotacao_id: opts.cotacaoId,
      status: "transmitida",
      transmissao_status: "transmitida",
      numero: opts.numero,
      ...(opts.atualizadoEm ? { atualizado_em: opts.atualizadoEm } : {}),
    });
    if (error) throw new Error(`criar proposta transmitida: ${error.message}`);
  }

  // ---------------------------------------------------------------------
  // Cenários table-driven — 1:1 com tests/unit/lead-etapa.test.ts
  // ---------------------------------------------------------------------

  type Cenario = {
    nome: string;
    statusPipeline: LeadStatusPipeline;
    /** `null` = lead sem nenhuma cotação. */
    cotacaoStatus: CotacaoStatus | null;
    stepAtual?: number;
    transmissaoAberta?: boolean;
    propostaTransmitida?: boolean;
    esperado: LeadEtapaBucket;
  };

  const cenarios: Cenario[] = [
    {
      nome: "statusPipeline perdido cai em perdido",
      statusPipeline: "perdido",
      cotacaoStatus: null,
      esperado: "perdido",
    },
    {
      nome: "propostaTransmitida true cai em fechamento",
      statusPipeline: "novo",
      cotacaoStatus: null,
      propostaTransmitida: true,
      esperado: "fechamento",
    },
    {
      nome: "transmissaoEmAberto true cai em finalizacao",
      statusPipeline: "novo",
      cotacaoStatus: "rascunho", // placeholder — ver comentário do arquivo
      transmissaoAberta: true,
      esperado: "finalizacao",
    },
    {
      nome: "emEtapaTransmissao true (sem transmissaoEmAberto) também cai em finalizacao",
      statusPipeline: "novo",
      cotacaoStatus: "rascunho", // placeholder — ver comentário do arquivo
      stepAtual: 6,
      esperado: "finalizacao",
    },
    {
      nome: "cotacaoStatus 'calculada' (EM_NEGOCIACAO_STATUSES) cai em negociacao",
      statusPipeline: "novo",
      cotacaoStatus: "calculada",
      esperado: "negociacao",
    },
    {
      nome: "cotacaoStatus 'proposta' (EM_NEGOCIACAO_STATUSES) cai em negociacao",
      statusPipeline: "novo",
      cotacaoStatus: "proposta",
      esperado: "negociacao",
    },
    {
      nome: "cotacaoStatus 'rascunho' (EM_COTACAO_STATUSES) cai em cotacao",
      statusPipeline: "novo",
      cotacaoStatus: "rascunho",
      esperado: "cotacao",
    },
    {
      nome: "sem cotação, statusPipeline 'contato' cai em novo",
      statusPipeline: "contato",
      cotacaoStatus: null,
      esperado: "novo",
    },
    {
      nome: "sem cotação, statusPipeline 'qualificado' cai em novo",
      statusPipeline: "qualificado",
      cotacaoStatus: null,
      esperado: "novo",
    },
    {
      nome: "cotacaoStatus fora das duas listas ('aceita') também cai em novo",
      statusPipeline: "novo",
      cotacaoStatus: "aceita", // substitui 'cancelada' do teste TS — ver comentário do arquivo
      esperado: "novo",
    },
    {
      nome: "perdido ganha de propostaTransmitida, transmissaoEmAberto e emEtapaTransmissao simultaneamente",
      statusPipeline: "perdido",
      cotacaoStatus: "calculada",
      stepAtual: 6,
      transmissaoAberta: true,
      propostaTransmitida: true,
      esperado: "perdido",
    },
    {
      nome: "fechamento ganha de finalizacao (transmissaoEmAberto) mesmo com ambos true",
      statusPipeline: "novo",
      cotacaoStatus: "rascunho", // placeholder — ver comentário do arquivo
      transmissaoAberta: true,
      propostaTransmitida: true,
      esperado: "fechamento",
    },
    {
      nome: "finalizacao (transmissaoEmAberto) ganha de negociacao mesmo com cotacaoStatus em negociação",
      statusPipeline: "novo",
      cotacaoStatus: "proposta",
      transmissaoAberta: true,
      esperado: "finalizacao",
    },
    {
      nome: "finalizacao (emEtapaTransmissao) ganha de negociacao mesmo com cotacaoStatus em negociação",
      statusPipeline: "novo",
      cotacaoStatus: "proposta",
      stepAtual: 6,
      esperado: "finalizacao",
    },
    {
      nome: "fechamento ganha de finalizacao (emEtapaTransmissao) mesmo com ambos true",
      statusPipeline: "novo",
      cotacaoStatus: "rascunho", // placeholder — ver comentário do arquivo
      stepAtual: 6,
      propostaTransmitida: true,
      esperado: "fechamento",
    },
    {
      nome: "perdido ganha de emEtapaTransmissao mesmo com ambos true",
      statusPipeline: "perdido",
      cotacaoStatus: "rascunho", // placeholder — ver comentário do arquivo
      stepAtual: 6,
      esperado: "perdido",
    },
  ];

  it.each(cenarios)("$nome", async (c) => {
    const leadId = await criarLead(c.statusPipeline);
    let cotacaoId: string | null = null;
    if (c.cotacaoStatus !== null) {
      cotacaoId = await criarCotacao(leadId, c.cotacaoStatus, c.stepAtual ?? 0);
      if (c.transmissaoAberta) await criarTransmissaoAberta(cotacaoId);
    }
    if (c.propostaTransmitida) {
      await criarPropostaTransmitida({ leadId, cotacaoId });
    }

    const input: LeadEtapaInput = {
      statusPipeline: c.statusPipeline,
      cotacaoStatus: c.cotacaoStatus,
      transmissaoEmAberto: !!c.transmissaoAberta,
      propostaTransmitida: !!c.propostaTransmitida,
      emEtapaTransmissao: c.cotacaoStatus !== null && c.stepAtual === 6,
    };
    const bucketTs = leadEtapaBucket(input);
    expect(bucketTs).toBe(c.esperado);

    const { etapa: etapaView } = await lerEtapa(leadId);
    expect(etapaView).toBe(c.esperado);
    expect(etapaView).toBe(bucketTs);
  });

  // ---------------------------------------------------------------------
  // "Mais recente" — DISTINCT ON da view
  // ---------------------------------------------------------------------

  it("2 cotações no mesmo lead: view usa a de atualizado_em mais recente", async () => {
    const leadId = await criarLead("novo");
    const antiga = new Date(Date.now() - 60_000).toISOString();
    const recente = new Date().toISOString();

    await admin
      .from("cotacoes")
      .insert({
        empresa_id: empresaId,
        responsavel_id: vendedorId,
        lead_id: leadId,
        status: "rascunho",
        criado_em: antiga,
        atualizado_em: antiga,
      })
      .select("id")
      .single();
    const { data: cotRecente, error } = await admin
      .from("cotacoes")
      .insert({
        empresa_id: empresaId,
        responsavel_id: vendedorId,
        lead_id: leadId,
        status: "calculada",
        criado_em: recente,
        atualizado_em: recente,
      })
      .select("id")
      .single();
    if (error || !cotRecente) throw new Error(`criar cotação recente: ${error?.message}`);

    // Se a view usasse a cotação antiga ('rascunho'), o bucket seria 'cotacao'.
    const resultado = await lerEtapa(leadId);
    expect(resultado.etapa).toBe("negociacao");
    expect(resultado.cotacao_id).toBe(cotRecente.id);
  });

  it("2 tentativas de transmissão na mesma cotação: view usa a de criado_em mais recente", async () => {
    const leadId = await criarLead("novo");
    const cotacaoId = await criarCotacao(leadId, "proposta");
    const antiga = new Date(Date.now() - 60_000).toISOString();
    const recente = new Date().toISOString();

    await criarTransmissaoAberta(cotacaoId, "falha", antiga);
    await criarTransmissaoAberta(cotacaoId, "enviada", recente);

    const resultado = await lerEtapa(leadId);
    expect(resultado.etapa).toBe("finalizacao");
    // Prova que o DISTINCT ON pegou a tentativa mais recente ('enviada'), não a mais antiga ('falha').
    expect(resultado.transmissao_aberta_status).toBe("enviada");
  });

  it("2 propostas transmitidas pro mesmo lead: view usa a de atualizado_em mais recente (NOVO/mais determinístico que o client atual, que não tem .order() nessa query — não é regressão)", async () => {
    const leadId = await criarLead("novo");
    const cotacaoA = await criarCotacao(leadId, "calculada");
    const cotacaoB = await criarCotacao(leadId, "calculada");
    const antiga = new Date(Date.now() - 60_000).toISOString();
    const recente = new Date().toISOString();

    await criarPropostaTransmitida({
      leadId,
      cotacaoId: cotacaoA,
      numero: "PRP-ANTIGA",
      atualizadoEm: antiga,
    });
    await criarPropostaTransmitida({
      leadId,
      cotacaoId: cotacaoB,
      numero: "PRP-RECENTE",
      atualizadoEm: recente,
    });

    const resultado = await lerEtapa(leadId);
    expect(resultado.etapa).toBe("fechamento");
    expect(resultado.proposta_numero).toBe("PRP-RECENTE");
  });
});
