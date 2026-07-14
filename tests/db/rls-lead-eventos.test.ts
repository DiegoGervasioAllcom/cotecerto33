import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarPersonaComEmpresa, uniq, type Db } from "../helpers/supabase";

/**
 * RLS de `lead_eventos` (histórico/timeline de leads).
 *
 * S4 — a policy "leadev_insert" (`for insert to authenticated with check
 * (true)`, 20240101000016_lead_acoes.sql ~L39-41) foi removida em
 * 20260714204638_fechar_insert_aberto_lead_eventos.sql. Criação legítima de
 * evento só via RPCs security definer (redistribuir_lead, arquivar_lead,
 * assumir_lead, expirar_leads_nao_atendidos, distribuir_lead_auto, etc.).
 */
describe("S4 — insert direto em lead_eventos fica bloqueado; RPC continua funcionando", () => {
  let vendedorA: Db;
  let leadSemDono: string;

  beforeAll(async () => {
    const v = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-leadev" });
    vendedorA = v.client;

    // lead "com a matriz": sem empresa_id e sem responsavel_id, elegível para arquivar_lead.
    const { data: lead, error } = await admin
      .from("leads")
      .insert({ nome: uniq("Lead Matriz Eventos"), origem: "teste" })
      .select("id")
      .single();
    if (error) throw error;
    leadSemDono = lead.id;
  });

  it("NEGATIVO: usuário autenticado comum não insere evento direto", async () => {
    const { data, error } = await vendedorA
      .from("lead_eventos")
      .insert({
        lead_id: leadSemDono,
        tipo: "forjado",
        titulo: "Evento forjado",
        descricao: "tentativa de insert direto",
      })
      .select("id");
    expect(error).not.toBeNull();
    expect(data ?? []).toHaveLength(0);

    const { data: real } = await admin
      .from("lead_eventos")
      .select("id")
      .eq("lead_id", leadSemDono)
      .eq("tipo", "forjado");
    expect(real ?? []).toHaveLength(0);
  });

  it("POSITIVO: arquivar_lead (RPC definer) via client autenticado comum continua registrando evento", async () => {
    const { error } = await vendedorA.rpc("arquivar_lead", { p_lead: leadSemDono });
    expect(error).toBeNull();

    const { data: real } = await admin
      .from("lead_eventos")
      .select("id, tipo")
      .eq("lead_id", leadSemDono)
      .eq("tipo", "arquivado");
    expect(real ?? []).toHaveLength(1);

    const { data: leadReal } = await admin
      .from("leads")
      .select("arquivado")
      .eq("id", leadSemDono)
      .single();
    expect(leadReal?.arquivado).toBe(true);
  });
});
