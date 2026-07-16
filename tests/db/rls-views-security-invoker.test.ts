import { describe, it, expect, beforeAll } from "vitest";
import { admin, loginMatriz, criarPersonaComEmpresa, uniqDoc, type Db } from "../helpers/supabase";

/**
 * S1: 4 views rodavam sem `security_invoker` (ignoravam a RLS de quem consulta) e a
 * policy de SELECT de `comissao_lancamentos` liberava master/franqueado para ler
 * lançamentos de QUALQUER rede.
 *
 * 20260714200110_s1_views_security_invoker_e_escopo_comissao.sql corrige:
 *  1) `security_invoker = true` em vendedor_conta_corrente_saldo, v_franquia_kpis,
 *     v_vendedor_kpis, v_user_presence.
 *  2) "presence read self or rede" em user_presence (era `using(true)`).
 *  3) "cc lanc select self or rede" em comissao_lancamentos (era irrestrito para
 *     has_role(master)/has_role(franqueado)).
 *
 * Rede A: master A (empresa própria) + franquia filha F1 (parent_id = empresa do
 * master A; o vendedor de F1 tem `profiles.superior_id` = master A, que é o que a
 * empresas_visiveis() multinível (G1.2) usa para enxergar a rede — parent_id sozinho
 * não basta mais). Rede B: master B independente, com um vendedor — usada nos casos
 * negativos.
 */
describe("RLS — views security_invoker + escopo de comissão/presença por rede", () => {
  let matriz: Db;

  let masterA: Db;
  let masterAId: string;
  let empresaMasterA: string;
  let empresaFilhaA: string;
  let vendedorFilhaA: Db;
  let vendedorFilhaAId: string;

  let masterB: Db;
  let masterBId: string;
  let empresaMasterB: string;
  let vendedorB: Db;
  let vendedorBId: string;

  beforeAll(async () => {
    matriz = await loginMatriz();

    // Rede A: master + franquia filha
    const master = await criarPersonaComEmpresa("master", { emailPrefix: "master-a" });
    masterA = master.client;
    masterAId = master.userId;
    empresaMasterA = master.empresaId;

    const { data: filha, error: eF } = await admin
      .from("empresas")
      .insert({
        nome: "S1 Filha F1",
        tipo: "pj",
        documento: uniqDoc(),
        status: "aprovada",
        parent_id: empresaMasterA,
      })
      .select("id")
      .single();
    if (eF) throw eF;
    empresaFilhaA = filha.id;

    const vFilha = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaFilhaA,
      emailPrefix: "vend-filha-a",
      superiorId: masterAId,
    });
    vendedorFilhaA = vFilha.client;
    vendedorFilhaAId = vFilha.userId;

    // Rede B: master + vendedor, independente da rede A
    const mB = await criarPersonaComEmpresa("master", { emailPrefix: "master-b" });
    masterB = mB.client;
    masterBId = mB.userId;
    empresaMasterB = mB.empresaId;

    const vB = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaMasterB,
      emailPrefix: "vend-b",
    });
    vendedorB = vB.client;
    vendedorBId = vB.userId;

    // Lançamentos de comissão (via admin, bypassa RLS — só monta fixture)
    await admin.from("comissao_lancamentos").insert([
      {
        vendedor_id: vendedorFilhaAId,
        empresa_id: empresaFilhaA,
        tipo: "credito",
        valor: 100,
        descricao: "S1 fixture A",
      },
      {
        vendedor_id: vendedorBId,
        empresa_id: empresaMasterB,
        tipo: "credito",
        valor: 200,
        descricao: "S1 fixture B",
      },
    ]);

    // Presença (upsert direto na tabela base, via admin)
    await admin.from("user_presence").upsert([
      { user_id: vendedorFilhaAId, status: "online", last_seen_at: new Date().toISOString() },
      { user_id: masterAId, status: "online", last_seen_at: new Date().toISOString() },
      { user_id: vendedorBId, status: "online", last_seen_at: new Date().toISOString() },
      { user_id: masterBId, status: "online", last_seen_at: new Date().toISOString() },
    ]);
  });

  describe("v_vendedor_kpis / vendedor_conta_corrente_saldo", () => {
    it("NEGATIVO: vendedor de uma rede não lê v_vendedor_kpis de vendedor de outra rede", async () => {
      const { data, error } = await vendedorFilhaA
        .from("v_vendedor_kpis")
        .select("user_id")
        .eq("user_id", vendedorBId);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("NEGATIVO: vendedor de uma rede não lê o saldo de vendedor de outra rede", async () => {
      const { data, error } = await vendedorFilhaA
        .from("vendedor_conta_corrente_saldo")
        .select("vendedor_id")
        .eq("vendedor_id", vendedorBId);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("NEGATIVO: master de uma rede não lê v_vendedor_kpis/saldo de vendedor fora da sua rede", async () => {
      const kpis = await masterA
        .from("v_vendedor_kpis")
        .select("user_id")
        .eq("user_id", vendedorBId);
      expect(kpis.error).toBeNull();
      expect(kpis.data ?? []).toHaveLength(0);

      const saldo = await masterA
        .from("vendedor_conta_corrente_saldo")
        .select("vendedor_id")
        .eq("vendedor_id", vendedorBId);
      expect(saldo.error).toBeNull();
      expect(saldo.data ?? []).toHaveLength(0);
    });

    it("POSITIVO: master lê v_vendedor_kpis/saldo do vendedor da própria rede (franquia filha)", async () => {
      const kpis = await masterA
        .from("v_vendedor_kpis")
        .select("user_id")
        .eq("user_id", vendedorFilhaAId);
      expect(kpis.error).toBeNull();
      expect(kpis.data).toHaveLength(1);

      const saldo = await masterA
        .from("vendedor_conta_corrente_saldo")
        .select("vendedor_id,saldo")
        .eq("vendedor_id", vendedorFilhaAId);
      expect(saldo.error).toBeNull();
      expect(saldo.data).toHaveLength(1);
    });

    it("POSITIVO: matriz lê v_vendedor_kpis/saldo de qualquer rede", async () => {
      const kpis = await matriz
        .from("v_vendedor_kpis")
        .select("user_id")
        .eq("user_id", vendedorBId);
      expect(kpis.error).toBeNull();
      expect(kpis.data).toHaveLength(1);

      const saldo = await matriz
        .from("vendedor_conta_corrente_saldo")
        .select("vendedor_id")
        .eq("vendedor_id", vendedorBId);
      expect(saldo.error).toBeNull();
      expect(saldo.data).toHaveLength(1);
    });
  });

  describe("v_franquia_kpis", () => {
    it("NEGATIVO: master de uma rede não lê v_franquia_kpis de empresa fora da sua rede", async () => {
      const { data, error } = await masterA
        .from("v_franquia_kpis")
        .select("empresa_id")
        .eq("empresa_id", empresaMasterB);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("POSITIVO: master lê v_franquia_kpis da própria rede (própria empresa + filha)", async () => {
      const propria = await masterA
        .from("v_franquia_kpis")
        .select("empresa_id")
        .eq("empresa_id", empresaMasterA);
      expect(propria.error).toBeNull();
      expect(propria.data).toHaveLength(1);

      const filha = await masterA
        .from("v_franquia_kpis")
        .select("empresa_id")
        .eq("empresa_id", empresaFilhaA);
      expect(filha.error).toBeNull();
      expect(filha.data).toHaveLength(1);
    });

    it("POSITIVO: matriz lê v_franquia_kpis de qualquer rede", async () => {
      const { data, error } = await matriz
        .from("v_franquia_kpis")
        .select("empresa_id")
        .eq("empresa_id", empresaMasterB);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });
  });

  describe("v_user_presence", () => {
    it("NEGATIVO: usuário não lê v_user_presence de usuário de outra rede", async () => {
      const { data, error } = await vendedorFilhaA
        .from("v_user_presence")
        .select("user_id")
        .eq("user_id", vendedorBId);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("NEGATIVO: master não lê v_user_presence de usuário de outra rede", async () => {
      const { data, error } = await masterA
        .from("v_user_presence")
        .select("user_id")
        .eq("user_id", masterBId);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("POSITIVO: master lê v_user_presence da própria rede (própria + filha)", async () => {
      const propria = await masterA
        .from("v_user_presence")
        .select("user_id")
        .eq("user_id", masterAId);
      expect(propria.error).toBeNull();
      expect(propria.data).toHaveLength(1);

      const filha = await masterA
        .from("v_user_presence")
        .select("user_id")
        .eq("user_id", vendedorFilhaAId);
      expect(filha.error).toBeNull();
      expect(filha.data).toHaveLength(1);
    });

    it("POSITIVO: matriz lê v_user_presence de qualquer rede", async () => {
      const { data, error } = await matriz
        .from("v_user_presence")
        .select("user_id")
        .eq("user_id", vendedorBId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });
  });

  describe("comissao_lancamentos (SELECT)", () => {
    it("NEGATIVO: master não lê comissao_lancamentos de vendedor de outra rede", async () => {
      const { data, error } = await masterA
        .from("comissao_lancamentos")
        .select("id")
        .eq("vendedor_id", vendedorBId);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("POSITIVO: master lê comissao_lancamentos de vendedor da própria rede (franquia filha)", async () => {
      const { data, error } = await masterA
        .from("comissao_lancamentos")
        .select("id")
        .eq("vendedor_id", vendedorFilhaAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("POSITIVO: vendedor lê os próprios lançamentos", async () => {
      const { data, error } = await vendedorFilhaA
        .from("comissao_lancamentos")
        .select("id")
        .eq("vendedor_id", vendedorFilhaAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("POSITIVO: matriz lê comissao_lancamentos de qualquer rede", async () => {
      const { data, error } = await matriz
        .from("comissao_lancamentos")
        .select("id")
        .eq("vendedor_id", vendedorBId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });
  });
});
