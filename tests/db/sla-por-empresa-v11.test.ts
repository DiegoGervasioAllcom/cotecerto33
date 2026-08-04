/**
 * V11.5.3 (Frente 5 — Franquia Full) — SLA por empresa.
 *
 * Regra 10 das "Regras Decididas": a Franquia Full define o próprio SLA de
 * atendimento, sem depender dos 3 minutos (180s) fixos da Matriz
 * (`distribuicao_config`, singleton).
 *
 * Cobre:
 * - `fn_sla_efetivo`: sem override cai no singleton global; com override da
 *   empresa, usa o override.
 * - `fn_sla_aplicavel_lead`: canal repassado (ou sem canal) usa o SLA global;
 *   canal próprio de uma Full usa `fn_sla_efetivo` daquela Full.
 * - `fn_salvar_sla_empresa` (RLS de quem pode salvar): Matriz sobre qualquer
 *   empresa; a própria Full sobre a própria empresa; franquia individual e
 *   vendedor NÃO podem (regra 10 é autonomia só da Full); escrita direta na
 *   tabela (sem passar pela RPC) é bloqueada a nível de grant, mesmo pra
 *   matriz.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  criarUsuario,
  loginMatriz,
  uniq,
  uniqDoc,
  type Db,
} from "../helpers/supabase";

type SlaRpcClient = {
  rpc: (
    nome: "fn_sla_efetivo" | "fn_sla_aplicavel_lead" | "fn_salvar_sla_empresa",
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
};

async function criarEmpresaComModalidade(modalidade: "individual" | "full" | undefined) {
  const { data: modelo, error: eModelo } = await admin
    .from("modelos_franquia")
    .insert({ nome: uniq(`modelo-sla-${modalidade ?? "sem"}`), tipo: "franqueada", modalidade })
    .select("id")
    .single();
  if (eModelo) throw eModelo;

  const { data: emp, error: eEmp } = await admin
    .from("empresas")
    .insert({
      nome: uniq("Empresa SLA"),
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

async function criarFranqueado(empresaId: string) {
  const { userId, client } = await criarUsuario(`${uniq("franq-sla")}@teste.local`);
  await admin
    .from("profiles")
    .update({ empresa_id: empresaId, status: "aprovada" })
    .eq("id", userId);
  await admin.from("user_roles").insert({ user_id: userId, role: "franqueado" });
  return { userId, client: client as unknown as SlaRpcClient };
}

async function criarCanal(empresaId: string | null) {
  const { data, error } = await admin
    .from("canais")
    .insert({ nome: uniq("Canal SLA"), tipo: empresaId ? "manual" : "supper", empresa_id: empresaId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function criarLead(canalId: string | null) {
  const { data, error } = await admin
    .from("leads")
    .insert({ nome: uniq("Lead SLA"), canal_id: canalId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

describe("V11.5.3 — SLA por empresa", () => {
  let matriz: SlaRpcClient;
  let slaGlobalOriginal: number;

  beforeAll(async () => {
    matriz = (await loginMatriz()) as unknown as SlaRpcClient;
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
    await admin
      .from("distribuicao_config")
      .update({ sla_segundos: slaGlobalOriginal })
      .eq("id", "default");
  });

  describe("fn_sla_efetivo", () => {
    it("sem override: cai no singleton global (distribuicao_config.sla_segundos)", async () => {
      const empresaId = await criarEmpresaComModalidade("individual");
      const { data, error } = await matriz.rpc("fn_sla_efetivo", { p_empresa_id: empresaId });
      if (error) throw error;
      expect(data).toBe(180);
    });

    it("com override da empresa: usa o override, não o global", async () => {
      const empresaId = await criarEmpresaComModalidade("full");
      const { error: eIns } = await admin
        .from("sla_empresa_config")
        .insert({ empresa_id: empresaId, sla_segundos: 600 });
      if (eIns) throw eIns;

      const { data, error } = await matriz.rpc("fn_sla_efetivo", { p_empresa_id: empresaId });
      if (error) throw error;
      expect(data).toBe(600);
    });

    it("p_empresa_id NULL cai no singleton (usado por fn_sla_aplicavel_lead p/ repassado)", async () => {
      const { data, error } = await matriz.rpc("fn_sla_efetivo", { p_empresa_id: null });
      if (error) throw error;
      expect(data).toBe(180);
    });
  });

  describe("fn_sla_aplicavel_lead", () => {
    it("lead sem canal usa o SLA global", async () => {
      const leadId = await criarLead(null);
      const { data, error } = await matriz.rpc("fn_sla_aplicavel_lead", { p_lead_id: leadId });
      if (error) throw error;
      expect(data).toBe(180);
    });

    it("lead com canal repassado (canal.empresa_id NULL) usa o SLA global", async () => {
      const canalMatrizId = await criarCanal(null);
      const leadId = await criarLead(canalMatrizId);
      const { data, error } = await matriz.rpc("fn_sla_aplicavel_lead", { p_lead_id: leadId });
      if (error) throw error;
      expect(data).toBe(180);
    });

    it("lead com canal próprio de uma Full com override usa o SLA da Full", async () => {
      const empresaId = await criarEmpresaComModalidade("full");
      await admin.from("sla_empresa_config").insert({ empresa_id: empresaId, sla_segundos: 900 });
      const canalId = await criarCanal(empresaId);
      const leadId = await criarLead(canalId);

      const { data, error } = await matriz.rpc("fn_sla_aplicavel_lead", { p_lead_id: leadId });
      if (error) throw error;
      expect(data).toBe(900);
    });

    it("lead com canal próprio de uma Full SEM override cai no global (fallback transitivo)", async () => {
      const empresaId = await criarEmpresaComModalidade("full");
      const canalId = await criarCanal(empresaId);
      const leadId = await criarLead(canalId);

      const { data, error } = await matriz.rpc("fn_sla_aplicavel_lead", { p_lead_id: leadId });
      if (error) throw error;
      expect(data).toBe(180);
    });
  });

  describe("fn_salvar_sla_empresa — quem pode chamar", () => {
    it("POSITIVO: matriz salva SLA de qualquer empresa (individual ou full)", async () => {
      const empresaId = await criarEmpresaComModalidade("individual");
      const { data, error } = await matriz.rpc("fn_salvar_sla_empresa", {
        p_empresa_id: empresaId,
        p_sla_segundos: 300,
      });
      expect(error).toBeNull();
      expect((data as { sla_segundos: number }).sla_segundos).toBe(300);
    });

    it("POSITIVO: a própria Full salva o próprio SLA", async () => {
      const empresaId = await criarEmpresaComModalidade("full");
      const { client } = await criarFranqueado(empresaId);

      const { data, error } = await client.rpc("fn_salvar_sla_empresa", {
        p_empresa_id: empresaId,
        p_sla_segundos: 240,
      });
      expect(error).toBeNull();
      expect((data as { sla_segundos: number }).sla_segundos).toBe(240);
    });

    it("NEGATIVO: franquia individual não pode configurar o próprio SLA (autonomia é só da Full)", async () => {
      const empresaId = await criarEmpresaComModalidade("individual");
      const { client } = await criarFranqueado(empresaId);

      const { error } = await client.rpc("fn_salvar_sla_empresa", {
        p_empresa_id: empresaId,
        p_sla_segundos: 240,
      });
      expect(error?.message).toContain("forbidden");
    });

    it("NEGATIVO: uma Full não pode configurar o SLA de OUTRA empresa", async () => {
      const empresaFullA = await criarEmpresaComModalidade("full");
      const empresaFullB = await criarEmpresaComModalidade("full");
      const { client } = await criarFranqueado(empresaFullA);

      const { error } = await client.rpc("fn_salvar_sla_empresa", {
        p_empresa_id: empresaFullB,
        p_sla_segundos: 240,
      });
      expect(error?.message).toContain("forbidden");
    });

    it("NEGATIVO: vendedor não pode configurar SLA de nenhuma empresa", async () => {
      const empresaId = await criarEmpresaComModalidade("full");
      const { userId, client } = await criarUsuario(`${uniq("vend-sla")}@teste.local`);
      await admin
        .from("profiles")
        .update({ empresa_id: empresaId, status: "aprovada" })
        .eq("id", userId);
      await admin.from("user_roles").insert({ user_id: userId, role: "vendedor" });

      const { error } = await (client as unknown as SlaRpcClient).rpc("fn_salvar_sla_empresa", {
        p_empresa_id: empresaId,
        p_sla_segundos: 240,
      });
      expect(error?.message).toContain("forbidden");
    });

    it("NEGATIVO: anon não executa a RPC", async () => {
      const anon = anonClient() as unknown as SlaRpcClient;
      const { error } = await anon.rpc("fn_salvar_sla_empresa", {
        p_empresa_id: null,
        p_sla_segundos: 240,
      });
      expect(error?.message).toMatch(/permission denied/i);
    });

    it("NEGATIVO: faixa inválida de sla_segundos é rejeitada (mesmo pra matriz)", async () => {
      const empresaId = await criarEmpresaComModalidade("individual");

      const baixo = await matriz.rpc("fn_salvar_sla_empresa", {
        p_empresa_id: empresaId,
        p_sla_segundos: 5,
      });
      expect(baixo.error?.message).toContain("sla_segundos_fora_da_faixa");

      const alto = await matriz.rpc("fn_salvar_sla_empresa", {
        p_empresa_id: empresaId,
        p_sla_segundos: 100000,
      });
      expect(alto.error?.message).toContain("sla_segundos_fora_da_faixa");
    });

    it("NEGATIVO: escrita direta na tabela (sem RPC) é bloqueada a nível de grant, mesmo pra matriz", async () => {
      const empresaId = await criarEmpresaComModalidade("individual");
      const matrizDb = matriz as unknown as Db;

      const { error } = await matrizDb
        .from("sla_empresa_config")
        .insert({ empresa_id: empresaId, sla_segundos: 300 });
      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");
    });
  });
});
