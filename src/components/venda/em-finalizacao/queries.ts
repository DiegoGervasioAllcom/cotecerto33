// Query + tipos de `/venda/em-finalizacao` — extraído da rota (revisão
// V12.3.10) pra ela não crescer com o adaptador de impressão e o preview do
// tutorial. Mesmo padrão de `em-negociacao/queries.ts`.
import { supabase } from "@/integrations/supabase/client";
import { primeiraOcorrenciaPorChave, TRANSMISSAO_EM_ABERTO_STATUSES } from "@/lib/lead-etapa";
import { embed1a1 } from "@/lib/postgrest-embed";

// A Etapa 7 (wizard de transmissão via Quiver) grava cada tentativa em
// `cotacao_transmissoes`. Enquanto o robô não devolve o resultado pelo
// webhook, a tentativa fica com status='enviada'; se o portal recusa, vira
// 'falha' (o vendedor precisa agir — reabrir a Etapa 7 e reenviar). Só
// quando a tentativa vira 'transmitida' é que a cotação sai desta lista —
// nesse ponto ela já vive em Propostas/Emissão. Cada linha é a ÚLTIMA
// tentativa por cotação (mais recente primeiro, deduplicada em memória).
export type TentativaRow = {
  id: string;
  cotacao_id: string;
  status: string;
  motivo: string | null;
  mensagem: string | null;
  seguradora: string | null;
  premio: number | null;
  parcelas_num: number | null;
  valor_parcela: number | null;
  forma_pagamento: string | null;
  criado_em: string;
  proposta_id: string | null;
  cotacoes: {
    numero: number;
    criado_em: string;
    // 1:1 (`cotacao_id` é PK) — o PostgREST devolve objeto, não array.
    segurado: { nome: string | null } | null;
    veiculo: {
      marca_nome: string | null;
      modelo_nome: string | null;
      ano_modelo: string | null;
      placa: string | null;
    } | null;
  } | null;
};

export type Row = {
  tentativaId: string;
  cotacaoId: string;
  numero: number;
  /** `criado_em` da COTAÇÃO (para o número `COT-AAAA-NNNNN`) — não confundir
   * com `criadoEm` abaixo, que é da tentativa de transmissão. */
  cotacaoCriadoEm: string;
  status: string;
  motivo: string | null;
  mensagem: string | null;
  seguradora: string | null;
  premio: number | null;
  parcelasNum: number | null;
  valorParcela: number | null;
  formaPagamento: string | null;
  criadoEm: string;
  propostaId: string | null;
  segurado: string;
  veiculo: string;
  /** Objeto cru de `cotacao_veiculo`, só pro modal "Imprimir cotação"
   * (`docDadosDaTransmissao`, ver `em-finalizacao/print.ts`) — a tabela
   * mostra `veiculo` (string) acima. */
  veiculoRaw: {
    marca_nome: string | null;
    modelo_nome: string | null;
    ano_modelo: string | null;
    placa: string | null;
  } | null;
};

export const EM_FINALIZACAO_ROWS_QUERY_KEY = ["venda", "em-finalizacao", "rows"] as const;

/**
 * Consulta as tentativas de transmissão em aberto (`TRANSMISSAO_EM_ABERTO_STATUSES`)
 * ligadas a cotações do PRÓPRIO vendedor — mesmo escopo do badge
 * `countEmFinalizacaoPendente` (`src/lib/nav-badges.ts`): `cotacao_transmissoes`
 * não tem `responsavel_id` direto, então o `cotacoes!inner(...)` traz a
 * cotação ligada só para poder filtrar por `responsavel_id` (a RLS já libera
 * a empresa toda; este filtro é a semântica da tela, "minhas propostas",
 * igual à decisão já aplicada em `em-negociacao/queries.ts`).
 */
export function fetchEmFinalizacaoRows(uid: string) {
  return supabase
    .from("cotacao_transmissoes")
    .select(
      "id,cotacao_id,status,motivo,mensagem,seguradora,premio,parcelas_num,valor_parcela,forma_pagamento,criado_em,proposta_id," +
        "cotacoes!inner(numero,criado_em,responsavel_id,segurado:cotacao_segurado(nome),veiculo:cotacao_veiculo(marca_nome,modelo_nome,ano_modelo,placa))",
    )
    .eq("cotacoes.responsavel_id", uid)
    .in("status", TRANSMISSAO_EM_ABERTO_STATUSES)
    .order("criado_em", { ascending: false })
    .limit(500);
}

/**
 * Uma cotação pode ter várias tentativas (retransmissão após falha) — só a
 * mais recente importa. Assume que `data` já vem ordenada por criado_em desc
 * (responsabilidade de `fetchEmFinalizacaoRows`).
 */
export function dedupTentativas(data: readonly TentativaRow[] | null): Row[] {
  return primeiraOcorrenciaPorChave(data ?? [], (t) => t.cotacao_id).map((t) => {
    const c = t.cotacoes;
    const veiculo = embed1a1(c?.veiculo);
    const segurado = embed1a1(c?.segurado);
    return {
      tentativaId: t.id,
      cotacaoId: t.cotacao_id,
      numero: c?.numero ?? 0,
      cotacaoCriadoEm: c?.criado_em ?? t.criado_em,
      status: t.status,
      motivo: t.motivo,
      mensagem: t.mensagem,
      seguradora: t.seguradora,
      premio: t.premio,
      parcelasNum: t.parcelas_num,
      valorParcela: t.valor_parcela,
      formaPagamento: t.forma_pagamento,
      criadoEm: t.criado_em,
      propostaId: t.proposta_id,
      segurado: segurado?.nome || "—",
      veiculo: veiculo
        ? [veiculo.marca_nome, veiculo.modelo_nome, veiculo.ano_modelo].filter(Boolean).join(" ") +
          (veiculo.placa ? ` · ${veiculo.placa}` : "")
        : "—",
      veiculoRaw: veiculo ?? null,
    };
  });
}
