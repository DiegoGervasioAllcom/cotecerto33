/**
 * V11.5.7 (Frente 5 — Franquia Full) — SLA por lead + fronteira Full/Matriz.
 *
 * Regras 9+10 das "Regras Decididas": lead de canal PRÓPRIO de uma Full segue
 * o SLA dela (`sla_empresa_config`/`fn_sla_aplicavel_lead`, V11.5.3); lead
 * REPASSADO (canal.empresa_id NULL, ou sem canal) segue o SLA global
 * (`distribuicao_config`). `expirar_leads_nao_atendidos` (017/018/030/031)
 * usava uma janela fixa pro lote inteiro — esta suíte cobre o fechamento desse
 * gap (20260804003840_v11_5_7_sla_fronteira_franquia.sql):
 *
 * - repassado expira no SLA global (180s) — comportamento de hoje preservado;
 * - próprio de uma Full COM override expira no prazo DELA, não em 180s;
 * - próprio de uma Full SEM override cai no fallback global (180s);
 * - repassado que expira CRUZA a fronteira: empresa_id -> null (pool padrão
 *   da Matriz);
 * - próprio que expira NÃO cruza a fronteira: mantém empresa_id (fica no pool
 *   da própria Full), só limpa responsavel_id/distribuido_em.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, criarUsuario, uniq, uniqDoc } from "../helpers/supabase";

async function criarEmpresaComModalidade(modalidade: "individual" | "full") {
  const { data: modelo, error: eModelo } = await admin
    .from("modelos_franquia")
    .insert({ nome: uniq(`modelo-fronteira-${modalidade}`), tipo: "franqueada", modalidade })
    .select("id")
    .single();
  if (eModelo) throw eModelo;

  const { data: emp, error: eEmp } = await admin
    .from("empresas")
    .insert({
      nome: uniq("Empresa Fronteira"),
      tipo: "pj",
      documento: uniqDoc(),
      status: "aprovada",
      modelo_id: modelo.id,
    })
    .select("id")
    .single();
  if (eEmp) throw eEmp;
  return emp.id as string;
}

async function criarVendedor(empresaId: string) {
  const { userId } = await criarUsuario(`${uniq("vend-fronteira")}@teste.local`);
  await admin.from("profiles").update({ empresa_id: empresaId, status: "aprovada" }).eq("id", userId);
  await admin.from("user_roles").insert({ user_id: userId, role: "vendedor" });
  return userId;
}

async function criarCanal(empresaId: string | null) {
  const { data, error } = await admin
    .from("canais")
    .insert({ nome: uniq("Canal Fronteira"), tipo: empresaId ? "manual" : "supper", empresa_id: empresaId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Insere o lead já distribuído (empresa_id/responsavel_id/distribuido_em setados
 * diretamente) — como ambos vêm preenchidos, `trg_distribuir_lead_auto` (BEFORE
 * INSERT) não age (early-return), então o valor gravado é exatamente o que
 * passamos, sem interferência da distribuição automática. */
async function criarLeadDistribuido(args: {
  canalId: string | null;
  empresaId: string;
  responsavelId: string;
  distribuidoHaSeg: number;
}) {
  const distribuidoEm = new Date(Date.now() - args.distribuidoHaSeg * 1000).toISOString();
  const { data, error } = await admin
    .from("leads")
    .insert({
      nome: uniq("Lead Fronteira"),
      canal_id: args.canalId,
      empresa_id: args.empresaId,
      responsavel_id: args.responsavelId,
      distribuido_em: distribuidoEm,
      status_pipeline: "novo",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function expirar(pJanelaSeg = 180) {
  const { data, error } = await admin.rpc("expirar_leads_nao_atendidos", {
    p_janela_seg: pJanelaSeg,
  });
  if (error) throw error;
  return data as number;
}

async function buscarLead(id: string) {
  const { data, error } = await admin
    .from("leads")
    .select("empresa_id, responsavel_id, distribuido_em, status_pipeline")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

async function buscarEventoSlaExpirado(leadId: string) {
  const { data, error } = await admin
    .from("lead_eventos")
    .select("meta")
    .eq("lead_id", leadId)
    .eq("tipo", "sla_expirado")
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

describe("V11.5.7 — SLA por lead + fronteira Full/Matriz (expirar_leads_nao_atendidos)", () => {
  let slaGlobalOriginal: number;

  beforeAll(async () => {
    const { data } = await admin
      .from("distribuicao_config")
      .select("sla_segundos")
      .eq("id", "default")
      .single();
    slaGlobalOriginal = data!.sla_segundos;
    // Fixa um valor conhecido pra não depender do que outros testes deixaram.
    await admin.from("distribuicao_config").update({ sla_segundos: 180 }).eq("id", "default");
  });

  afterAll(async () => {
    await admin.from("distribuicao_config").update({ sla_segundos: slaGlobalOriginal }).eq("id", "default");
  });

  // Cada teste chama a RPC explicitamente (não depende do pg_cron de fundo) —
  // determinístico independente de o ambiente ter pg_cron ativo ou não.

  it("REPASSADO (sem canal): expira nos 180s globais e cruza a fronteira — comportamento de hoje preservado", async () => {
    const empresaAtual = await criarEmpresaComModalidade("individual");
    const vendedor = await criarVendedor(empresaAtual);
    const leadId = await criarLeadDistribuido({
      canalId: null,
      empresaId: empresaAtual,
      responsavelId: vendedor,
      distribuidoHaSeg: 200, // > 180s
    });

    const total = await expirar(180);
    expect(total).toBeGreaterThanOrEqual(1);

    const lead = await buscarLead(leadId);
    expect(lead.empresa_id).toBeNull();
    expect(lead.responsavel_id).toBeNull();
    expect(lead.distribuido_em).toBeNull();
    expect(lead.status_pipeline).toBe("novo");

    const evento = await buscarEventoSlaExpirado(leadId);
    expect(evento).not.toBeNull();
    const meta = evento!.meta as Record<string, unknown>;
    expect(meta.cruzou_fronteira).toBe(true);
    expect(meta.sla_aplicado_seg).toBe(180);
  });

  it("REPASSADO com canal Supper (empresa_id NULL): mesma regra do sem-canal", async () => {
    const empresaAtual = await criarEmpresaComModalidade("individual");
    const vendedor = await criarVendedor(empresaAtual);
    const canalSupper = await criarCanal(null);
    const leadId = await criarLeadDistribuido({
      canalId: canalSupper,
      empresaId: empresaAtual,
      responsavelId: vendedor,
      distribuidoHaSeg: 200,
    });

    await expirar(180);

    const lead = await buscarLead(leadId);
    expect(lead.empresa_id).toBeNull();
    expect(lead.responsavel_id).toBeNull();
  });

  it("REPASSADO ainda dentro do prazo (100s < 180s): NÃO expira — regressão", async () => {
    const empresaAtual = await criarEmpresaComModalidade("individual");
    const vendedor = await criarVendedor(empresaAtual);
    const leadId = await criarLeadDistribuido({
      canalId: null,
      empresaId: empresaAtual,
      responsavelId: vendedor,
      distribuidoHaSeg: 100,
    });

    await expirar(180);

    const lead = await buscarLead(leadId);
    expect(lead.empresa_id).toBe(empresaAtual);
    expect(lead.responsavel_id).toBe(vendedor);
    expect(lead.distribuido_em).not.toBeNull();
  });

  it("PRÓPRIO de uma Full COM override de SLA: expira no prazo DELA, não em 180s", async () => {
    const fullId = await criarEmpresaComModalidade("full");
    await admin.from("sla_empresa_config").insert({ empresa_id: fullId, sla_segundos: 900 });
    const canalProprio = await criarCanal(fullId);
    const vendedor = await criarVendedor(fullId);

    // 200s: expiraria nos 180s globais, mas o SLA da Full é 900s — não deve expirar.
    const leadDentroDoPrazoDaFull = await criarLeadDistribuido({
      canalId: canalProprio,
      empresaId: fullId,
      responsavelId: vendedor,
      distribuidoHaSeg: 200,
    });
    await expirar(180);
    const leadAindaAtivo = await buscarLead(leadDentroDoPrazoDaFull);
    expect(leadAindaAtivo.responsavel_id).toBe(vendedor);
    expect(leadAindaAtivo.empresa_id).toBe(fullId);

    // 1000s: agora estourou o prazo da própria Full (900s).
    const leadEstourado = await criarLeadDistribuido({
      canalId: canalProprio,
      empresaId: fullId,
      responsavelId: vendedor,
      distribuidoHaSeg: 1000,
    });
    const total = await expirar(180);
    expect(total).toBeGreaterThanOrEqual(1);

    const lead = await buscarLead(leadEstourado);
    // NÃO cruza a fronteira: continua na própria Full.
    expect(lead.empresa_id).toBe(fullId);
    expect(lead.responsavel_id).toBeNull();
    expect(lead.distribuido_em).toBeNull();
    expect(lead.status_pipeline).toBe("novo");

    const evento = await buscarEventoSlaExpirado(leadEstourado);
    const meta = evento!.meta as Record<string, unknown>;
    expect(meta.cruzou_fronteira).toBe(false);
    expect(meta.sla_aplicado_seg).toBe(900);
  });

  it("PRÓPRIO de uma Full SEM override: cai no fallback global (180s) — mesmo comportamento de hoje, mas sem cruzar a fronteira", async () => {
    const fullId = await criarEmpresaComModalidade("full");
    const canalProprio = await criarCanal(fullId);
    const vendedor = await criarVendedor(fullId);

    const leadId = await criarLeadDistribuido({
      canalId: canalProprio,
      empresaId: fullId,
      responsavelId: vendedor,
      distribuidoHaSeg: 200, // > 180s global (fallback)
    });

    const total = await expirar(180);
    expect(total).toBeGreaterThanOrEqual(1);

    const lead = await buscarLead(leadId);
    expect(lead.empresa_id).toBe(fullId); // permanece no pool da própria Full
    expect(lead.responsavel_id).toBeNull();

    const evento = await buscarEventoSlaExpirado(leadId);
    const meta = evento!.meta as Record<string, unknown>;
    expect(meta.cruzou_fronteira).toBe(false);
    expect(meta.sla_aplicado_seg).toBe(180);
  });

  it("PRÓPRIO de uma Full que expira continua visível na fila da própria empresa (não vaza pro pool geral)", async () => {
    const fullId = await criarEmpresaComModalidade("full");
    const canalProprio = await criarCanal(fullId);
    const vendedor = await criarVendedor(fullId);

    const leadId = await criarLeadDistribuido({
      canalId: canalProprio,
      empresaId: fullId,
      responsavelId: vendedor,
      distribuidoHaSeg: 200,
    });
    await expirar(180);

    // O pool padrão da Matriz (distribuir_fila_pendente/trigger de INSERT) só
    // pega `empresa_id is null and responsavel_id is null` — o lead da Full
    // não entra nesse filtro porque empresa_id continua preenchido.
    const { data: noPoolGeral } = await admin
      .from("leads")
      .select("id")
      .is("empresa_id", null)
      .eq("id", leadId);
    expect(noPoolGeral ?? []).toHaveLength(0);

    // E continua elegível pra `assumir_lead` de qualquer vendedor da própria empresa,
    // porque `leads_select` inclui `empresa_id in empresas_visiveis`.
    const { data: naPropriaEmpresa } = await admin
      .from("leads")
      .select("id, empresa_id, responsavel_id")
      .eq("id", leadId)
      .single();
    expect(naPropriaEmpresa?.empresa_id).toBe(fullId);
    expect(naPropriaEmpresa?.responsavel_id).toBeNull();
  });
});
