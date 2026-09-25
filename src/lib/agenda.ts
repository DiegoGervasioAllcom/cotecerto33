// Helpers e fontes de dados da tela "Minha agenda" (Frente 9, V12; V12.3.2
// acrescenta as 2 últimas fontes). Espelha
// agQuando()/agRetornos()/agRisco()/agSeguradora()/agAprovacoes()/agLembretes()/agTudo()
// do protótipo v12 (cotecerto_prototipo_v12.html):
//  1) retornos agendados (lead_agendamentos, done=false, do próprio vendedor)
//  2) negócios em risco: cotações calculada/proposta paradas há mais de
//     RISCO_DIAS_PARADO dias sem atualização (query derivada — sem tabela
//     própria, mesmo filtro base de status de em-negociacao.tsx). RLS de
//     `cotacoes` libera SELECT pra toda a empresa, não só o dono — por isso
//     o filtro por `responsavel_id = uid` é feito aqui, não só na RLS.
//  3) pendência da seguradora: propostas com transmissao_status='falha' do
//     vendedor. Mesma ressalva do item 2: RLS de `propostas` também libera
//     SELECT pra empresa inteira, então filtramos por `responsavel_id = uid`
//     explicitamente. O protótipo também lista "assinatura pendente/análise"
//     — sem coluna equivalente hoje, fica fora.
//  4) aprovações que o vendedor pediu: desconto_solicitacoes do próprio
//     solicitante ainda pendentes. O protótipo também lista pedido de VIP —
//     não existe tabela de VIP no banco, então essa fonte cobre só desconto.
//  5) lembretes pessoais (lembretes, done=false — RLS já restringe ao dono)
// "Pendência da seguradora" e "aprovações" não têm ação de "marcar como
// feito" — quem resolve é a seguradora/quem aprova, não o vendedor.

import { supabase } from "@/integrations/supabase/client";
import { veiculoLabel } from "@/lib/veiculo";
import { formatarNumeroCotacao } from "@/lib/cotacao-numero";
import type { LembreteTipo } from "@/lib/schemas/lembrete.schema";

export type FonteAgenda = "retorno" | "risco" | "seguradora" | "aprovacao" | "lembrete";

export const FONTE_LABEL: Record<FonteAgenda, string> = {
  retorno: "Retorno agendado",
  risco: "Negócio em risco",
  seguradora: "Pendências da seguradora",
  aprovacao: "Aprovações que você pediu",
  lembrete: "Lembrete",
};

export type Urgencia = {
  label: string;
  chipClass: "chip-alert" | "chip-yellow" | "chip-slate";
  ord: 0 | 1 | 2 | 3;
};

function inicioDoDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** "2026-09-18" -> Date local à meia-noite. Evita o bug de `new Date(iso)`
 * interpretar a data como UTC e "voltar" um dia em fusos negativos. */
export function parseDataISO(dataISO: string): Date {
  const [y, m, d] = dataISO.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Classifica uma data (yyyy-mm-dd) em atrasado/hoje/amanhã/depois —
 * mesma regra de agQuando() do protótipo. */
export function classificarUrgencia(dataISO: string, agora: Date = new Date()): Urgencia {
  const hoje = inicioDoDia(agora);
  const data = parseDataISO(dataISO);
  const amanha = new Date(hoje);
  amanha.setDate(hoje.getDate() + 1);

  if (data.getTime() < hoje.getTime())
    return { label: "atrasado", chipClass: "chip-alert", ord: 0 };
  if (data.getTime() === hoje.getTime()) return { label: "hoje", chipClass: "chip-yellow", ord: 1 };
  if (data.getTime() === amanha.getTime())
    return { label: "amanhã", chipClass: "chip-slate", ord: 2 };
  return {
    label: data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    chipClass: "chip-slate",
    ord: 3,
  };
}

export type AgendaItem = {
  /** `${fonte}:${id da linha de origem}` — chave estável para a lista e para as ações. */
  id: string;
  fonte: FonteAgenda;
  data: string;
  hora: string | null;
  titulo: string;
  texto: string;
  /** Lead associado (retorno sempre tem; lembrete só quando vinculado). */
  leadId: string | null;
  statusPipeline: string | null;
  /** Só para fonte "risco" — cotação parada, usada para abrir o comparativo. */
  cotacaoId: string | null;
  /** Só para fonte "seguradora" — proposta bloqueada, usada para abrir a Emissão. */
  propostaId: string | null;
  /** Só para fonte "lembrete" — define o ícone do item. */
  tipoLembrete: LembreteTipo | null;
};

/** Ordena atrasado -> hoje -> amanhã -> resto; dentro do mesmo grupo, por hora. */
export function ordenarAgenda(itens: AgendaItem[], agora: Date = new Date()): AgendaItem[] {
  return [...itens].sort((a, b) => {
    const ua = classificarUrgencia(a.data, agora).ord;
    const ub = classificarUrgencia(b.data, agora).ord;
    if (ua !== ub) return ua - ub;
    return (a.hora ?? "").localeCompare(b.hora ?? "");
  });
}

/** Critério objetivo de "negócio em risco" (decidido com o usuário): cotação
 * calculada/proposta sem nenhuma atualização há mais de N dias. */
export const RISCO_DIAS_PARADO = 2;

export function limiteRiscoISO(agora: Date = new Date()): string {
  return new Date(agora.getTime() - RISCO_DIAS_PARADO * 24 * 60 * 60 * 1000).toISOString();
}

export function diasParados(atualizadoEm: string, agora: Date = new Date()): number {
  const dias = (agora.getTime() - new Date(atualizadoEm).getTime()) / (24 * 60 * 60 * 1000);
  return Math.max(0, Math.floor(dias));
}

// ---------------------------------------------------------------------------
// Fonte 1 — retornos agendados (lead_agendamentos)
// ---------------------------------------------------------------------------
export type RetornoRow = {
  id: string;
  data: string;
  hora: string | null;
  nota: string | null;
  lead: {
    id: string;
    nome: string | null;
    dados: Record<string, unknown> | null;
    status_pipeline: string;
  } | null;
};

/** Só os retornos que o próprio vendedor marcou (RLS permite mais gente ver o
 * mesmo lead — matriz/gestão —, mas "minha agenda" é sobre o compromisso
 * pessoal de quem agendou). */
export async function fetchRetornosAgenda(userId: string): Promise<RetornoRow[]> {
  const { data, error } = await supabase
    .from("lead_agendamentos")
    .select("id,data,hora,nota,lead:leads(id,nome,dados,status_pipeline)")
    .eq("done", false)
    .eq("criado_por", userId)
    .order("data", { ascending: true })
    .order("hora", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as unknown as RetornoRow[];
}

export function retornoParaItem(r: RetornoRow): AgendaItem {
  const nome = r.lead?.nome || "Cliente";
  const veiculo = r.lead ? veiculoLabel(r.lead.dados) : "—";
  return {
    id: `retorno:${r.id}`,
    fonte: "retorno",
    data: r.data,
    hora: r.hora,
    titulo: veiculo !== "—" ? `${nome} — ${veiculo}` : nome,
    texto: r.nota || "Retorno agendado",
    leadId: r.lead?.id ?? null,
    statusPipeline: r.lead?.status_pipeline ?? null,
    cotacaoId: null,
    propostaId: null,
    tipoLembrete: null,
  };
}

// ---------------------------------------------------------------------------
// Fonte 2 — negócios em risco (derivado de cotacoes, sem tabela própria)
// ---------------------------------------------------------------------------
export type RiscoRow = {
  id: string;
  numero: number;
  criado_em: string;
  atualizado_em: string;
  segurado: { nome: string | null } | null;
  veiculo: {
    marca_nome: string | null;
    modelo_nome: string | null;
    ano_modelo: string | null;
  } | null;
};

/** RLS de `cotacoes` libera SELECT pra toda a empresa (matriz/gestão), não só
 * o dono — "minha agenda" é sobre o que é meu, então filtramos por
 * `responsavel_id` explicitamente (não dá pra confiar só na RLS aqui). */
export async function fetchRiscoAgenda(
  userId: string,
  agora: Date = new Date(),
): Promise<RiscoRow[]> {
  const { data, error } = await supabase
    .from("cotacoes")
    .select(
      "id,numero,criado_em,atualizado_em," +
        "segurado:cotacao_segurado(nome)," +
        "veiculo:cotacao_veiculo(marca_nome,modelo_nome,ano_modelo)",
    )
    .eq("responsavel_id", userId)
    .in("status", ["calculada", "proposta"])
    .lt("atualizado_em", limiteRiscoISO(agora))
    .order("atualizado_em", { ascending: true })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as RiscoRow[];
}

export function riscoParaItem(c: RiscoRow, agora: Date = new Date()): AgendaItem {
  const nome = c.segurado?.nome || "Cliente";
  const veiculo = c.veiculo
    ? [c.veiculo.marca_nome, c.veiculo.modelo_nome, c.veiculo.ano_modelo].filter(Boolean).join(" ")
    : "";
  const dias = diasParados(c.atualizado_em, agora);
  const dt = new Date(c.atualizado_em);
  const dataISO = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  return {
    id: `risco:${c.id}`,
    fonte: "risco",
    data: dataISO,
    hora: null,
    titulo: `${nome}${veiculo ? ` — ${veiculo}` : ""} · ${formatarNumeroCotacao(c.numero, c.criado_em) ?? ""}`,
    texto: `Parada há ${dias} dia${dias === 1 ? "" : "s"} sem atualização`,
    leadId: null,
    statusPipeline: null,
    cotacaoId: c.id,
    propostaId: null,
    tipoLembrete: null,
  };
}

// ---------------------------------------------------------------------------
// Fonte 3 — lembretes pessoais (lembretes; RLS já restringe ao dono)
// ---------------------------------------------------------------------------
export type LembreteRow = {
  id: string;
  tipo: string;
  titulo: string;
  nota: string | null;
  data: string;
  hora: string | null;
  lead: { id: string; nome: string | null; status_pipeline: string } | null;
};

export async function fetchLembretesAgenda(): Promise<LembreteRow[]> {
  const { data, error } = await supabase
    .from("lembretes")
    .select("id,tipo,titulo,nota,data,hora,lead:leads(id,nome,status_pipeline)")
    .eq("done", false)
    .order("data", { ascending: true })
    .order("hora", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as unknown as LembreteRow[];
}

export function lembreteParaItem(l: LembreteRow): AgendaItem {
  return {
    id: `lembrete:${l.id}`,
    fonte: "lembrete",
    data: l.data,
    hora: l.hora,
    titulo: l.titulo,
    texto: [l.nota, l.lead?.nome].filter(Boolean).join(" · ") || "Lembrete",
    leadId: l.lead?.id ?? null,
    statusPipeline: l.lead?.status_pipeline ?? null,
    cotacaoId: null,
    propostaId: null,
    tipoLembrete: (l.tipo as LembreteTipo) || "tarefa",
  };
}

// ---------------------------------------------------------------------------
// Fonte 4 — pendência da seguradora (propostas com transmissao_status='falha')
// ---------------------------------------------------------------------------
export type SeguradoraRow = {
  id: string;
  numero: string | null;
  atualizado_em: string;
  transmissao_motivo: string | null;
  transmissao_mensagem: string | null;
  cotacao: { segurado: { nome: string | null } | null } | null;
};

/** RLS de `propostas` libera SELECT pra toda a empresa (matriz/gestão/colega
 * — `prop_select`, `20260804120000_v11_i_escopo_interno_matriz.sql`), não só
 * o dono. `responsavel_id` é copiado da cotação na criação da proposta
 * (sempre populado nesse fluxo), então filtramos por ele explicitamente. */
export async function fetchSeguradoraAgenda(userId: string): Promise<SeguradoraRow[]> {
  const { data, error } = await supabase
    .from("propostas")
    .select(
      "id,numero,atualizado_em,transmissao_motivo,transmissao_mensagem," +
        "cotacao:cotacoes(segurado:cotacao_segurado(nome))",
    )
    .eq("responsavel_id", userId)
    .eq("transmissao_status", "falha")
    .order("atualizado_em", { ascending: true })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as SeguradoraRow[];
}

export function seguradoraParaItem(p: SeguradoraRow, agora: Date = new Date()): AgendaItem {
  const nome = p.cotacao?.segurado?.nome || "Cliente";
  const dias = diasParados(p.atualizado_em, agora);
  const dt = new Date(p.atualizado_em);
  const dataISO = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  return {
    id: `seguradora:${p.id}`,
    fonte: "seguradora",
    data: dataISO,
    hora: null,
    titulo: `Proposta ${p.numero ?? "—"} bloqueada · ${nome}`,
    texto:
      p.transmissao_motivo || p.transmissao_mensagem
        ? [p.transmissao_motivo, p.transmissao_mensagem].filter(Boolean).join(" — ")
        : `Parada há ${dias} dia${dias === 1 ? "" : "s"} sem retorno da seguradora`,
    leadId: null,
    statusPipeline: null,
    cotacaoId: null,
    propostaId: p.id,
    tipoLembrete: null,
  };
}

// ---------------------------------------------------------------------------
// Fonte 5 — aprovações que o vendedor pediu (desconto_solicitacoes;
// "VIP" do protótipo não existe como tabela — só desconto aqui)
// ---------------------------------------------------------------------------
export type AprovacaoRow = {
  id: string;
  pct_pedido: number;
  criado_em: string;
  cotacao: {
    lead: { id: string; nome: string | null; status_pipeline: string } | null;
  } | null;
};

export async function fetchAprovacoesAgenda(userId: string): Promise<AprovacaoRow[]> {
  const { data, error } = await supabase
    .from("desconto_solicitacoes")
    .select("id,pct_pedido,criado_em,cotacao:cotacoes(lead:leads(id,nome,status_pipeline))")
    .eq("solicitante_id", userId)
    .in("status", ["pendente", "aguardando_aceite"])
    .order("criado_em", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as AprovacaoRow[];
}

export function aprovacaoParaItem(a: AprovacaoRow, agora: Date = new Date()): AgendaItem {
  const nome = a.cotacao?.lead?.nome || "Cliente";
  const dias = diasParados(a.criado_em, agora);
  const dt = new Date(a.criado_em);
  const dataISO = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  return {
    id: `aprovacao:${a.id}`,
    fonte: "aprovacao",
    data: dataISO,
    hora: null,
    titulo: `Desconto de ${a.pct_pedido}% · ${nome}`,
    texto:
      dias > 0
        ? `Acima da sua alçada há ${dias} dia${dias === 1 ? "" : "s"} — aguardando resposta`
        : "Acima da sua alçada — aguardando resposta",
    leadId: a.cotacao?.lead?.id ?? null,
    statusPipeline: a.cotacao?.lead?.status_pipeline ?? null,
    cotacaoId: null,
    propostaId: null,
    tipoLembrete: null,
  };
}

// ---------------------------------------------------------------------------
// Junta as 5 fontes numa lista só, já ordenada por urgência.
// ---------------------------------------------------------------------------
export function montarAgenda(
  retornos: RetornoRow[],
  risco: RiscoRow[],
  seguradora: SeguradoraRow[],
  aprovacoes: AprovacaoRow[],
  lembretes: LembreteRow[],
  agora: Date = new Date(),
): AgendaItem[] {
  const itens = [
    ...retornos.map(retornoParaItem),
    ...risco.map((r) => riscoParaItem(r, agora)),
    ...seguradora.map((s) => seguradoraParaItem(s, agora)),
    ...aprovacoes.map((a) => aprovacaoParaItem(a, agora)),
    ...lembretes.map(lembreteParaItem),
  ];
  return ordenarAgenda(itens, agora);
}

/** Filtra por tipo (fonte) e devolve, junto, a contagem por fonte — usada
 * pelos chips de filtro da tela e testável isoladamente. */
export function contarPorFonte(itens: AgendaItem[]): Record<FonteAgenda, number> {
  const base: Record<FonteAgenda, number> = {
    retorno: 0,
    risco: 0,
    seguradora: 0,
    aprovacao: 0,
    lembrete: 0,
  };
  for (const item of itens) base[item.fonte]++;
  return base;
}

export function filtrarPorFonte(itens: AgendaItem[], fonte: FonteAgenda | "todos"): AgendaItem[] {
  return fonte === "todos" ? itens : itens.filter((i) => i.fonte === fonte);
}

// ---------------------------------------------------------------------------
// A FILA DO INÍCIO — os seis itens que a agenda cobra primeiro (cartão "O que
// fazer agora" da home). Espelha homeFila() do protótipo v12: a ordem já vem
// de `montarAgenda` (atrasado, hoje, amanhã, depois); o único ajuste é
// garantir que o compromisso pessoal do vendedor (retorno marcado com o
// cliente, lembrete que ele mesmo criou) não seja empurrado para fora por uma
// pilha de avisos do sistema (negócio em risco) — é dele que o cliente cobra.
// ---------------------------------------------------------------------------
export const HOME_FILA_N = 6;

export function selecionarFilaHome(itens: AgendaItem[]): AgendaItem[] {
  const fila = itens.slice(0, HOME_FILA_N);
  const pessoal = (x: AgendaItem) => x.fonte === "retorno" || x.fonte === "lembrete";
  if (!fila.some(pessoal)) {
    const primeiro = itens.find(pessoal);
    if (primeiro && fila.length > 0) fila[fila.length - 1] = primeiro;
  }
  return fila;
}
