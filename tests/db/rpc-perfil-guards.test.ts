import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarEmpresa, criarPersonaComEmpresa, uniq, type Db } from "../helpers/supabase";

/**
 * Guards de perfil nas RPCs security definer (bypassam RLS de propósito — o guard
 * `if not (has_role(...,'matriz') or has_role(...,'master')) then raise exception 'forbidden'`
 * é a ÚNICA linha de defesa aqui, não a RLS da tabela).
 *
 *  - redistribuir_lead / puxar_lead_de_volta / bloquear_lead / desbloquear_lead
 *    (20240101000016_lead_acoes.sql ~L47-119): exigem matriz ou master.
 *  - lancar_ajuste_comissao (20240101000038_conta_corrente_comissoes.sql ~L151-171):
 *    mesmo guard.
 */
describe("RPCs de perfil — vendedor é barrado, matriz/master passam", () => {
  let empresaFilhaA: string;
  let masterA: Db;
  let vendedorA: Db;
  let vendedorAId: string;
  let leadId: string;

  beforeAll(async () => {
    const master = await criarPersonaComEmpresa("master", { emailPrefix: "master-rpc" });
    masterA = master.client;
    const empresaMasterA = master.empresaId;

    const filha = await criarEmpresa({ nome: "Filha RPC A", parent_id: empresaMasterA });
    empresaFilhaA = filha.id;

    const v1 = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaFilhaA,
      emailPrefix: "vend-rpc-a",
    });
    vendedorA = v1.client;
    vendedorAId = v1.userId;

    const { data: lead, error } = await admin
      .from("leads")
      .insert({
        nome: uniq("Lead RPC"),
        origem: "teste",
        empresa_id: empresaFilhaA,
        responsavel_id: vendedorAId,
      })
      .select("id")
      .single();
    if (error) throw error;
    leadId = lead.id;
  });

  it("NEGATIVO: vendedor não chama redistribuir_lead", async () => {
    const { error } = await vendedorA.rpc("redistribuir_lead", {
      p_lead: leadId,
      p_empresa: empresaFilhaA,
      p_responsavel: vendedorAId,
    });
    expect(error).not.toBeNull();
    expect(error!.message.toLowerCase()).toContain("forbidden");
  });

  it("NEGATIVO: vendedor não chama puxar_lead_de_volta", async () => {
    const { error } = await vendedorA.rpc("puxar_lead_de_volta", { p_lead: leadId });
    expect(error).not.toBeNull();
    expect(error!.message.toLowerCase()).toContain("forbidden");
  });

  it("NEGATIVO: vendedor não chama bloquear_lead", async () => {
    const { error } = await vendedorA.rpc("bloquear_lead", {
      p_lead: leadId,
      p_motivo: "teste vendedor",
    });
    expect(error).not.toBeNull();
    expect(error!.message.toLowerCase()).toContain("forbidden");
  });

  it("NEGATIVO: vendedor não chama desbloquear_lead", async () => {
    const { error } = await vendedorA.rpc("desbloquear_lead", { p_lead: leadId });
    expect(error).not.toBeNull();
    expect(error!.message.toLowerCase()).toContain("forbidden");
  });

  it("NEGATIVO: vendedor não chama lancar_ajuste_comissao", async () => {
    const { error } = await vendedorA.rpc("lancar_ajuste_comissao", {
      p_vendedor: vendedorAId,
      p_tipo: "credito",
      p_valor: 10,
      p_descricao: "ajuste indevido",
    });
    expect(error).not.toBeNull();
    expect(error!.message.toLowerCase()).toContain("forbidden");
  });

  it("POSITIVO: master bloqueia lead da própria rede com sucesso", async () => {
    const { error } = await masterA.rpc("bloquear_lead", {
      p_lead: leadId,
      p_motivo: "bloqueio golden path",
    });
    expect(error).toBeNull();

    const { data: real } = await admin
      .from("leads")
      .select("bloqueado,motivo_bloqueio")
      .eq("id", leadId)
      .single();
    expect(real?.bloqueado).toBe(true);
    expect(real?.motivo_bloqueio).toBe("bloqueio golden path");
  });
});
