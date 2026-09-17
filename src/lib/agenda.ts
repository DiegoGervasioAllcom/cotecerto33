// Helpers e fontes de dados da tela "Minha agenda" (Frente 9, V12).
// Espelha agQuando()/agRetornos()/agRisco()/agLembretes()/agTudo() do
// protótipo v12 (cotecerto_prototipo_v12.html), mas com só 3 fontes reais
// (decisão do usuário para o v1 — "pendência da seguradora" e "aprovações"
// do protótipo ficam de fora):
//  1) retornos agendados (lead_agendamentos, done=false, do próprio vendedor)
//  2) negócios em risco: cotações calculada/proposta paradas há mais de
//     RISCO_DIAS_PARADO dias sem atualização (query derivada — sem tabela
//     própria, mesmo filtro base de status de em-negociacao.tsx)
//  3) lembretes pessoais (lembretes, done=false — RLS já restringe ao dono)

import { supabase } from "@/integrations/supabase/client";
import { veiculoLabel } from "@/lib/veiculo";
import type { LembreteTipo } from "@/lib/schemas/lembrete.schema";

export type FonteAgenda = "retorno" | "risco" | "lembrete";

export const FONTE_LABEL: Record<FonteAgenda, string> = {
  retorno: "Retorno agendado",
  risco: "Negócio em risco",
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

const padNumero = (n: number) => String(n).padStart(5, "0");
export const cotNumero = (numero: number) => `COT-${new Date().getFullYear()}-${padNumero(numero)}`;

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
    tipoLembrete: null,
  };
}

// ---------------------------------------------------------------------------
// Fonte 2 — negócios em risco (derivado de cotacoes, sem tabela própria)
// ---------------------------------------------------------------------------
export type RiscoRow = {
  id: string;
  numero: number;
  atualizado_em: string;
  segurado: { nome: string | null } | null;
  veiculo: {
    marca_nome: string | null;
    modelo_nome: string | null;
    ano_modelo: string | null;
  } | null;
};

export async function fetchRiscoAgenda(agora: Date = new Date()): Promise<RiscoRow[]> {
  const { data, error } = await supabase
    .from("cotacoes")
    .select(
      "id,numero,atualizado_em," +
        "segurado:cotacao_segurado(nome)," +
        "veiculo:cotacao_veiculo(marca_nome,modelo_nome,ano_modelo)",
    )
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
    titulo: `${nome}${veiculo ? ` — ${veiculo}` : ""} · ${cotNumero(c.numero)}`,
    texto: `Parada há ${dias} dia${dias === 1 ? "" : "s"} sem atualização`,
    leadId: null,
    statusPipeline: null,
    cotacaoId: c.id,
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
    tipoLembrete: (l.tipo as LembreteTipo) || "tarefa",
  };
}

// ---------------------------------------------------------------------------
// Junta as 3 fontes numa lista só, já ordenada por urgência.
// ---------------------------------------------------------------------------
export function montarAgenda(
  retornos: RetornoRow[],
  risco: RiscoRow[],
  lembretes: LembreteRow[],
  agora: Date = new Date(),
): AgendaItem[] {
  const itens = [
    ...retornos.map(retornoParaItem),
    ...risco.map((r) => riscoParaItem(r, agora)),
    ...lembretes.map(lembreteParaItem),
  ];
  return ordenarAgenda(itens, agora);
}
