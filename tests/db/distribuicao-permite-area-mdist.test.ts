/**
 * Distribuição de leads via área "mdist" (Distribuição), além de matriz/master.
 *
 * As RPCs redistribuir_lead, puxar_lead_de_volta e distribuir_fila_pendente
 * checavam só has_role(matriz/master). Agora também liberam quem tem a área
 * mdist (profile_areas / fn_tem_area) — ex.: Supervisor Operacional, que já
 * tem mdist no preset do cargo (H2), ou qualquer cargo com override.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  admin,
  loginMatriz,
  criarPersonaComEmpresa,
  criarEmpresa,
  uniq,
  type Db,
} from "../helpers/supabase";

async function criarLeadPendente(): Promise<string> {
  const { data, error } = await admin
    .from("leads")
    .insert({ nome: uniq("Lead mdist"), origem: "teste", dados: {} })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

describe("distribuição de leads — acesso via área mdist", () => {
  let cfgOriginal: Record<string, unknown> | null = null;

  beforeAll(async () => {
    const { data: cfg } = await admin
      .from("distribuicao_config")
      .select("*")
      .eq("id", "default")
      .maybeSingle();
    cfgOriginal = cfg;
    // desligado: distribuir_fila_pendente só precisa passar do gate de permissão
    // (com automatico_on=false ela retorna 0 sem tocar em leads).
    await admin.from("distribuicao_config").update({ automatico_on: false }).eq("id", "default");
  });

  afterAll(async () => {
    if (cfgOriginal) await admin.from("distribuicao_config").upsert(cfgOriginal as never);
  });

  describe("NEGATIVO: sup_vendas não tem mdist no preset (H2) → forbidden", () => {
    let sup: { client: Db; userId: string };
    let leadId: string;
    let destino: { id: string };

    beforeAll(async () => {
      sup = await criarPersonaComEmpresa("supervisor", { emailPrefix: "sup-vend-mdist" });
      await admin.from("profiles").update({ cargo_id: "sup_vendas" }).eq("id", sup.userId);
      destino = await criarEmpresa();
      leadId = await criarLeadPendente();
    });

    it("redistribuir_lead → forbidden", async () => {
      const { error } = await sup.client.rpc("redistribuir_lead", {
        p_lead: leadId,
        p_empresa: destino.id,
      });
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/forbidden/);
    });

    it("puxar_lead_de_volta → forbidden", async () => {
      const { error } = await sup.client.rpc("puxar_lead_de_volta", { p_lead: leadId });
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/forbidden/);
    });

    it("distribuir_fila_pendente → forbidden", async () => {
      const { error } = await sup.client.rpc("distribuir_fila_pendente");
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/forbidden/);
    });
  });

  describe("POSITIVO: sup_operacional tem mdist no preset (H2) → passa o gate", () => {
    let sup: { client: Db; userId: string };
    let destino: { id: string };

    beforeAll(async () => {
      sup = await criarPersonaComEmpresa("supervisor", { emailPrefix: "sup-oper-mdist" });
      await admin.from("profiles").update({ cargo_id: "sup_operacional" }).eq("id", sup.userId);
      destino = await criarEmpresa();
    });

    it("redistribuir_lead funciona", async () => {
      const leadId = await criarLeadPendente();
      const { error } = await sup.client.rpc("redistribuir_lead", {
        p_lead: leadId,
        p_empresa: destino.id,
      });
      expect(error).toBeNull();
      const { data: lead } = await admin
        .from("leads")
        .select("empresa_id")
        .eq("id", leadId)
        .single();
      expect(lead?.empresa_id).toBe(destino.id);
    });

    it("puxar_lead_de_volta funciona", async () => {
      const leadId = await criarLeadPendente();
      await admin.from("leads").update({ empresa_id: destino.id }).eq("id", leadId);
      const { error } = await sup.client.rpc("puxar_lead_de_volta", { p_lead: leadId });
      expect(error).toBeNull();
      const { data: lead } = await admin
        .from("leads")
        .select("empresa_id")
        .eq("id", leadId)
        .single();
      expect(lead?.empresa_id).toBeNull();
    });

    it("distribuir_fila_pendente funciona (não dá forbidden)", async () => {
      const { error } = await sup.client.rpc("distribuir_fila_pendente");
      expect(error).toBeNull();
    });
  });

  describe("POSITIVO: override em profile_areas concede mdist a um interno sem cargo com mdist", () => {
    let interno: { client: Db; userId: string };
    let destino: { id: string };

    beforeAll(async () => {
      interno = await criarPersonaComEmpresa("interno", { emailPrefix: "interno-ovr-mdist" });
      // cargo com preset SEM mdist (sup_vendas), mas override individual concede.
      await admin.from("profiles").update({ cargo_id: "sup_vendas" }).eq("id", interno.userId);
      await admin.from("profile_areas").insert({ profile_id: interno.userId, area_chave: "mdist" });
      destino = await criarEmpresa();
    });

    it("redistribuir_lead funciona com o override", async () => {
      const leadId = await criarLeadPendente();
      const { error } = await interno.client.rpc("redistribuir_lead", {
        p_lead: leadId,
        p_empresa: destino.id,
      });
      expect(error).toBeNull();
    });
  });

  describe("Não-regressão: matriz e master continuam funcionando sem depender de área", () => {
    it("matriz (sem cargo/mdist) continua distribuindo normalmente", async () => {
      const matriz = await loginMatriz();
      const destino = await criarEmpresa();
      const leadId = await criarLeadPendente();

      const { error } = await matriz.rpc("redistribuir_lead", {
        p_lead: leadId,
        p_empresa: destino.id,
      });
      expect(error).toBeNull();

      const { error: e2 } = await matriz.rpc("puxar_lead_de_volta", { p_lead: leadId });
      expect(e2).toBeNull();

      const { error: e3 } = await matriz.rpc("distribuir_fila_pendente");
      expect(e3).toBeNull();
    });

    it("master (sem cargo/mdist) continua distribuindo normalmente", async () => {
      const master = await criarPersonaComEmpresa("master", { emailPrefix: "master-mdist" });
      const destino = await criarEmpresa();
      const leadId = await criarLeadPendente();

      const { error } = await master.client.rpc("redistribuir_lead", {
        p_lead: leadId,
        p_empresa: destino.id,
      });
      expect(error).toBeNull();

      const { error: e2 } = await master.client.rpc("puxar_lead_de_volta", { p_lead: leadId });
      expect(e2).toBeNull();

      const { error: e3 } = await master.client.rpc("distribuir_fila_pendente");
      expect(e3).toBeNull();
    });
  });
});
