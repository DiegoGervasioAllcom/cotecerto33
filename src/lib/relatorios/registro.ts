import { supabase } from "@/integrations/supabase/client";
import type { ColunaRelatorio, LinhaRelatorio } from "@/lib/export-relatorio";
import { avisoTrunc, fmtBRL, fmtDate, fmtDateTime, LIMITE, mapById } from "./helpers";
import type { Periodo } from "./periodo";

export type ResultadoRelatorio = {
  colunas: ColunaRelatorio[];
  linhas: LinhaRelatorio[];
  /** Linhas de resumo (KPIs) exibidas no topo do PDF. */
  resumo?: string[];
};

export type RelatorioDef = {
  key: string;
  titulo: string;
  descricao: string;
  icone: string;
  fetch: (periodo: Periodo) => Promise<ResultadoRelatorio>;
};

async function loadEmpresas() {
  const { data } = await supabase.from("empresas").select("id,nome");
  return mapById(data ?? []);
}

async function loadProfiles() {
  const { data } = await supabase.from("profiles").select("id,nome");
  return mapById(data ?? []);
}

/* ---------- 1) Performance comercial ---------- */
async function fetchPerformanceComercial(periodo: Periodo): Promise<ResultadoRelatorio> {
  const [leadsRes, propostasRes, empresas, profiles] = await Promise.all([
    supabase
      .from("leads")
      .select("id,empresa_id,responsavel_id")
      .gte("criado_em", periodo.ini)
      .lt("criado_em", periodo.fim)
      .limit(LIMITE),
    supabase
      .from("propostas")
      .select("id,empresa_id,responsavel_id,premio,valor")
      .not("emitida_em", "is", null)
      .gte("emitida_em", periodo.ini)
      .lt("emitida_em", periodo.fim)
      .limit(LIMITE),
    loadEmpresas(),
    loadProfiles(),
  ]);

  type Agg = { leads: number; vendas: number; premio: number };
  const porVendedor = new Map<string, Agg>();
  const key = (empresaId: string | null, respId: string | null) =>
    `${empresaId ?? "-"}|${respId ?? "-"}`;

  for (const l of leadsRes.data ?? []) {
    const k = key(l.empresa_id, l.responsavel_id);
    const agg = porVendedor.get(k) ?? { leads: 0, vendas: 0, premio: 0 };
    agg.leads += 1;
    porVendedor.set(k, agg);
  }
  for (const p of propostasRes.data ?? []) {
    const k = key(p.empresa_id, p.responsavel_id);
    const agg = porVendedor.get(k) ?? { leads: 0, vendas: 0, premio: 0 };
    agg.vendas += 1;
    agg.premio += Number(p.premio ?? p.valor ?? 0);
    porVendedor.set(k, agg);
  }

  const colunas: ColunaRelatorio[] = [
    { header: "Franquia", key: "franquia" },
    { header: "Vendedor", key: "vendedor" },
    { header: "Leads", key: "leads" },
    { header: "Vendas", key: "vendas" },
    { header: "Conversão", key: "conversao" },
    { header: "Ticket médio", key: "ticket" },
  ];

  const linhas: LinhaRelatorio[] = Array.from(porVendedor.entries())
    .map(([k, agg]) => {
      const [empresaId, respId] = k.split("|");
      const conversao = agg.leads > 0 ? (agg.vendas / agg.leads) * 100 : 0;
      const ticket = agg.vendas > 0 ? agg.premio / agg.vendas : 0;
      return {
        franquia: empresas[empresaId]?.nome ?? "—",
        vendedor: profiles[respId]?.nome ?? "—",
        leads: agg.leads,
        vendas: agg.vendas,
        conversao: `${conversao.toFixed(1)}%`,
        ticket: fmtBRL(ticket),
        _sort: agg.premio,
      } as unknown as LinhaRelatorio;
    })
    .sort((a, b) => Number(b._sort) - Number(a._sort))
    .map(({ _sort, ...r }) => r);

  const totalLeads = leadsRes.data?.length ?? 0;
  const totalVendas = propostasRes.data?.length ?? 0;
  const resumo = [
    `Leads no período: ${totalLeads}`,
    `Vendas emitidas: ${totalVendas}`,
    `Conversão geral: ${totalLeads > 0 ? ((totalVendas / totalLeads) * 100).toFixed(1) : "0"}%`,
  ];
  const trunc = avisoTrunc(Math.max(totalLeads, totalVendas));
  if (trunc) resumo.push(trunc);

  return { colunas, linhas, resumo };
}

/* ---------- 2) Financeiro ---------- */
async function fetchFinanceiro(periodo: Periodo): Promise<ResultadoRelatorio> {
  const [{ data, error }, empresas, profiles] = await Promise.all([
    supabase
      .from("propostas")
      .select(
        "id,numero,apolice_numero,seguradora,premio,valor,emitida_em,pago_em,cancelada_em,empresa_id,responsavel_id",
      )
      .not("emitida_em", "is", null)
      .gte("emitida_em", periodo.ini)
      .lt("emitida_em", periodo.fim)
      .order("emitida_em", { ascending: false })
      .limit(LIMITE),
    loadEmpresas(),
    loadProfiles(),
  ]);
  if (error) throw error;

  const colunas: ColunaRelatorio[] = [
    { header: "Apólice", key: "apolice" },
    { header: "Seguradora", key: "seguradora" },
    { header: "Franquia", key: "franquia" },
    { header: "Vendedor", key: "vendedor" },
    { header: "Prêmio", key: "premio" },
    { header: "Emitida em", key: "emitida" },
    { header: "Situação financeira", key: "situacao" },
  ];

  let premioEmitido = 0;
  let premioPago = 0;
  let premioNaoPago = 0;
  let qtdPago = 0;
  let qtdNaoPago = 0;

  const linhas: LinhaRelatorio[] = (data ?? []).map((p) => {
    const valor = Number(p.premio ?? p.valor ?? 0);
    premioEmitido += valor;
    let situacao = "Não paga";
    if (p.cancelada_em) situacao = "Cancelada";
    else if (p.pago_em) {
      situacao = "Paga";
      premioPago += valor;
      qtdPago += 1;
    } else {
      premioNaoPago += valor;
      qtdNaoPago += 1;
    }
    return {
      apolice: p.apolice_numero || p.numero || "—",
      seguradora: p.seguradora || "—",
      franquia: empresas[p.empresa_id ?? ""]?.nome ?? "—",
      vendedor: profiles[p.responsavel_id ?? ""]?.nome ?? "—",
      premio: fmtBRL(valor),
      emitida: fmtDate(p.emitida_em),
      situacao,
    };
  });

  const resumo = [
    `Prêmio emitido: ${fmtBRL(premioEmitido)}`,
    `Pago: ${fmtBRL(premioPago)} (${qtdPago} apólices)`,
    `Não pago: ${fmtBRL(premioNaoPago)} (${qtdNaoPago} apólices)`,
  ];
  const trunc = avisoTrunc(data?.length);
  if (trunc) resumo.push(trunc);

  return { colunas, linhas, resumo };
}

/* ---------- 3) Comissão ---------- */
async function fetchComissao(periodo: Periodo): Promise<ResultadoRelatorio> {
  const [{ data, error }, profiles, empresas] = await Promise.all([
    supabase
      .from("v_comissao_por_competencia")
      .select(
        "beneficiario_id,competencia,empresa_id,total_creditos,total_debitos,saldo,qtd_creditos,qtd_debitos",
      )
      .eq("competencia", periodo.competencia)
      .order("saldo", { ascending: false })
      .limit(LIMITE),
    loadProfiles(),
    loadEmpresas(),
  ]);
  if (error) throw error;

  const colunas: ColunaRelatorio[] = [
    { header: "Beneficiário", key: "beneficiario" },
    { header: "Franquia", key: "franquia" },
    { header: "Competência", key: "competencia" },
    { header: "Comissão gerada", key: "gerada" },
    { header: "Estornos/débitos", key: "debitos" },
    { header: "Saldo (a pagar)", key: "saldo" },
  ];

  let totalGerado = 0;
  let totalDebito = 0;
  let totalSaldo = 0;

  const linhas: LinhaRelatorio[] = (data ?? []).map((r) => {
    totalGerado += Number(r.total_creditos ?? 0);
    totalDebito += Number(r.total_debitos ?? 0);
    totalSaldo += Number(r.saldo ?? 0);
    return {
      beneficiario: profiles[r.beneficiario_id ?? ""]?.nome ?? "—",
      franquia: empresas[r.empresa_id ?? ""]?.nome ?? "—",
      competencia: r.competencia ?? "—",
      gerada: fmtBRL(Number(r.total_creditos ?? 0)),
      debitos: fmtBRL(Number(r.total_debitos ?? 0)),
      saldo: fmtBRL(Number(r.saldo ?? 0)),
    };
  });

  const resumo = [
    `Competência: ${periodo.competencia}`,
    `Comissão gerada: ${fmtBRL(totalGerado)}`,
    `Débitos/estornos: ${fmtBRL(totalDebito)}`,
    `Saldo total a pagar: ${fmtBRL(totalSaldo)}`,
  ];
  const trunc = avisoTrunc(data?.length);
  if (trunc) resumo.push(trunc);

  return { colunas, linhas, resumo };
}

/* ---------- 4) Premiação ---------- */
async function fetchPremiacao(periodo: Periodo): Promise<ResultadoRelatorio> {
  const [{ data, error }, profiles, empresas] = await Promise.all([
    supabase
      .from("premiacao_lancamentos")
      .select(
        "id,campanha_id,vendedor_id,empresa_id,competencia,valor,status,pago_em," +
          "campanha:premiacao_campanhas(nome)",
      )
      .eq("competencia", periodo.competencia)
      .order("valor", { ascending: false })
      .limit(LIMITE),
    loadProfiles(),
    loadEmpresas(),
  ]);
  if (error) throw error;

  const colunas: ColunaRelatorio[] = [
    { header: "Campanha", key: "campanha" },
    { header: "Vendedor", key: "vendedor" },
    { header: "Franquia", key: "franquia" },
    { header: "Valor", key: "valor" },
    { header: "Status", key: "status" },
    { header: "Pago em", key: "pago" },
  ];

  let totalPago = 0;
  let totalAPagar = 0;

  const linhas: LinhaRelatorio[] = (
    (data ?? []) as unknown as Array<{
      id: string;
      vendedor_id: string;
      empresa_id: string | null;
      valor: number;
      status: string;
      pago_em: string | null;
      campanha: { nome: string } | { nome: string }[] | null;
    }>
  ).map((r) => {
    const valor = Number(r.valor ?? 0);
    if (r.status === "pago") totalPago += valor;
    else totalAPagar += valor;
    const campanhaNome = Array.isArray(r.campanha) ? r.campanha[0]?.nome : r.campanha?.nome;
    return {
      campanha: campanhaNome ?? "—",
      vendedor: profiles[r.vendedor_id ?? ""]?.nome ?? "—",
      franquia: empresas[r.empresa_id ?? ""]?.nome ?? "—",
      valor: fmtBRL(valor),
      status: r.status === "pago" ? "Pago" : "A pagar",
      pago: fmtDate(r.pago_em),
    };
  });

  const resumo = [
    `Competência: ${periodo.competencia}`,
    `Pago: ${fmtBRL(totalPago)}`,
    `Saldo a pagar: ${fmtBRL(totalAPagar)}`,
  ];
  const trunc = avisoTrunc(linhas.length);
  if (trunc) resumo.push(trunc);

  return { colunas, linhas, resumo };
}

/* ---------- 5) Estornos ---------- */
async function fetchEstornos(periodo: Periodo): Promise<ResultadoRelatorio> {
  const [{ data, error }, empresas, profiles] = await Promise.all([
    supabase
      .from("propostas")
      .select(
        "id,numero,apolice_numero,seguradora,premio,valor,comissao_valor,cancelada_em,cancelamento_motivo,empresa_id,responsavel_id",
      )
      .not("cancelada_em", "is", null)
      .gte("cancelada_em", periodo.ini)
      .lt("cancelada_em", periodo.fim)
      .order("cancelada_em", { ascending: false })
      .limit(LIMITE),
    loadEmpresas(),
    loadProfiles(),
  ]);
  if (error) throw error;

  const colunas: ColunaRelatorio[] = [
    { header: "Apólice", key: "apolice" },
    { header: "Seguradora", key: "seguradora" },
    { header: "Franquia", key: "franquia" },
    { header: "Vendedor", key: "vendedor" },
    { header: "Prêmio estornado", key: "premio" },
    { header: "Comissão revertida", key: "comissao" },
    { header: "Data", key: "data" },
    { header: "Motivo", key: "motivo" },
  ];

  let totalPremio = 0;
  let totalComissao = 0;

  const linhas: LinhaRelatorio[] = (data ?? []).map((r) => {
    totalPremio += Number(r.premio ?? r.valor ?? 0);
    totalComissao += Number(r.comissao_valor ?? 0);
    return {
      apolice: r.apolice_numero || r.numero || "—",
      seguradora: r.seguradora || "—",
      franquia: empresas[r.empresa_id ?? ""]?.nome ?? "—",
      vendedor: profiles[r.responsavel_id ?? ""]?.nome ?? "—",
      premio: fmtBRL(Number(r.premio ?? r.valor ?? 0)),
      comissao: fmtBRL(Number(r.comissao_valor ?? 0)),
      data: fmtDate(r.cancelada_em),
      motivo: r.cancelamento_motivo || "Cancelamento",
    };
  });

  const resumo = [
    `Estornos no período: ${linhas.length}`,
    `Prêmio estornado: ${fmtBRL(totalPremio)}`,
    `Comissão revertida: ${fmtBRL(totalComissao)}`,
  ];
  const trunc = avisoTrunc(linhas.length);
  if (trunc) resumo.push(trunc);

  return { colunas, linhas, resumo };
}

/* ---------- 6) Renovações ---------- */
async function fetchRenovacoes(periodo: Periodo): Promise<ResultadoRelatorio> {
  const windowDays = 90;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + windowDays);

  const [vencendo, renov, perd, empresas, profiles] = await Promise.all([
    supabase
      .from("propostas")
      .select(
        "id,numero,apolice_numero,seguradora,premio,valor,vencimento,empresa_id,responsavel_id",
      )
      .not("vencimento", "is", null)
      .is("cancelada_em", null)
      .gte("vencimento", today.toISOString().slice(0, 10))
      .lte("vencimento", limit.toISOString().slice(0, 10))
      .order("vencimento", { ascending: true })
      .limit(LIMITE),
    supabase
      .from("propostas")
      .select("id", { count: "exact", head: true })
      .eq("tipo_venda", "renovacao")
      .not("emitida_em", "is", null)
      .gte("emitida_em", periodo.ini)
      .lt("emitida_em", periodo.fim),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("origem", "renovacao")
      .eq("status_pipeline", "perdido")
      .gte("atualizado_em", periodo.ini)
      .lt("atualizado_em", periodo.fim),
    loadEmpresas(),
    loadProfiles(),
  ]);
  if (vencendo.error) throw vencendo.error;

  const colunas: ColunaRelatorio[] = [
    { header: "Apólice", key: "apolice" },
    { header: "Seguradora", key: "seguradora" },
    { header: "Franquia", key: "franquia" },
    { header: "Vendedor", key: "vendedor" },
    { header: "Vencimento", key: "vencimento" },
    { header: "Prêmio atual", key: "premio" },
  ];

  const linhas: LinhaRelatorio[] = (vencendo.data ?? []).map((r) => ({
    apolice: r.apolice_numero || r.numero || "—",
    seguradora: r.seguradora || "—",
    franquia: empresas[r.empresa_id ?? ""]?.nome ?? "—",
    vendedor: profiles[r.responsavel_id ?? ""]?.nome ?? "—",
    vencimento: fmtDate(r.vencimento),
    premio: fmtBRL(Number(r.premio ?? r.valor ?? 0)),
  }));

  const resumo = [
    `A vencer (próx. ${windowDays} dias): ${linhas.length}`,
    `Renovadas no recorte "${periodo.label}": ${renov.error ? "—" : (renov.count ?? 0)}`,
    `Perdidas no recorte "${periodo.label}": ${perd.error ? "—" : (perd.count ?? 0)}`,
  ];
  if (renov.error || perd.error) {
    resumo.push("⚠ Algumas contagens (renovadas/perdidas) podem estar indisponíveis.");
  }
  const trunc = avisoTrunc(linhas.length);
  if (trunc) resumo.push(trunc);

  return { colunas, linhas, resumo };
}

/* ---------- 7) Leads ---------- */
async function fetchLeads(periodo: Periodo): Promise<ResultadoRelatorio> {
  const [{ data, error }, empresas, profiles] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id,nome,origem,status_pipeline,empresa_id,responsavel_id,criado_em,distribuido_em,ultimo_atendimento_em",
      )
      .gte("criado_em", periodo.ini)
      .lt("criado_em", periodo.fim)
      .order("criado_em", { ascending: false })
      .limit(LIMITE),
    loadEmpresas(),
    loadProfiles(),
  ]);
  if (error) throw error;

  const colunas: ColunaRelatorio[] = [
    { header: "Lead", key: "nome" },
    { header: "Origem", key: "origem" },
    { header: "Franquia", key: "franquia" },
    { header: "Vendedor", key: "vendedor" },
    { header: "Status", key: "status" },
    { header: "Criado em", key: "criado" },
    { header: "Distribuído em", key: "distribuido" },
    { header: "SLA até 1º atendimento", key: "sla" },
  ];

  const statusLabel: Record<string, string> = {
    novo: "Novo",
    em_atendimento: "Em atendimento",
    proposta: "Proposta",
    ganho: "Ganho",
    perdido: "Perdido",
  };

  let comAtendimento = 0;
  let somaMinutos = 0;

  const linhas: LinhaRelatorio[] = (data ?? []).map((l) => {
    let sla = "—";
    if (l.distribuido_em && l.ultimo_atendimento_em) {
      const min = Math.max(
        0,
        Math.round(
          (new Date(l.ultimo_atendimento_em).getTime() - new Date(l.distribuido_em).getTime()) /
            60000,
        ),
      );
      sla = `${min} min`;
      comAtendimento += 1;
      somaMinutos += min;
    }
    return {
      nome: l.nome || "—",
      origem: l.origem || "—",
      franquia: empresas[l.empresa_id ?? ""]?.nome ?? "—",
      vendedor: profiles[l.responsavel_id ?? ""]?.nome ?? "—",
      status: statusLabel[l.status_pipeline] ?? l.status_pipeline,
      criado: fmtDateTime(l.criado_em),
      distribuido: fmtDateTime(l.distribuido_em),
      sla,
    };
  });

  const resumo = [
    `Leads no período: ${linhas.length}`,
    `SLA médio até 1º atendimento: ${
      comAtendimento > 0 ? `${Math.round(somaMinutos / comAtendimento)} min` : "—"
    }`,
  ];
  const trunc = avisoTrunc(linhas.length);
  if (trunc) resumo.push(trunc);

  return { colunas, linhas, resumo };
}

export const RELATORIOS: RelatorioDef[] = [
  {
    key: "performance",
    titulo: "Performance comercial",
    descricao: "Leads, conversão, ticket e ranking por franquia e vendedor.",
    icone: "trending-up",
    fetch: fetchPerformanceComercial,
  },
  {
    key: "financeiro",
    titulo: "Financeiro",
    descricao: "Vendas emitidas, pagas, não pagas e fluxo por período.",
    icone: "dollar",
    fetch: fetchFinanceiro,
  },
  {
    key: "comissao",
    titulo: "Comissão",
    descricao: "Comissão gerada, paga e pendente — com fechamento mensal.",
    icone: "percent",
    fetch: fetchComissao,
  },
  {
    key: "premiacao",
    titulo: "Premiação",
    descricao: "Campanhas, ganhadores e saldo a pagar.",
    icone: "award",
    fetch: fetchPremiacao,
  },
  {
    key: "estornos",
    titulo: "Estornos",
    descricao: "Cancelamentos, motivos e comissão revertida.",
    icone: "refresh",
    fetch: fetchEstornos,
  },
  {
    key: "renovacoes",
    titulo: "Renovações",
    descricao: "Carteira a vencer, renovadas e perdidas.",
    icone: "history",
    fetch: fetchRenovacoes,
  },
  {
    key: "leads",
    titulo: "Leads",
    descricao: "Origem, distribuição, SLA e atendimento.",
    icone: "layers",
    fetch: fetchLeads,
  },
];
