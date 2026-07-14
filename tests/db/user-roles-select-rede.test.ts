import { describe, it, expect, beforeAll } from "vitest";
import { admin, loginMatriz, criarUsuario, uniq, uniqDoc, type Db } from "../helpers/supabase";

/**
 * mini-S5: a policy legada "user_roles_select" (20240101000002_modelos_metas.sql) usava
 * `using (true)`, expondo o role de TODOS os usuários a qualquer autenticado. A migration
 * 20260714164737_fix_user_roles_select_rede.sql substitui isso por self + rede visível
 * (mesmo critério de "profiles select self or rede").
 *
 * Rede A: empresa do master (matriz da rede) + 1 franquia filha (parent_id = empresa do master).
 * Rede B: empresa independente, sem relação com a rede A — usada para os casos negativos.
 */
describe("RLS user_roles — select escopado por rede", () => {
  let matriz: Db;

  let masterA: Db;
  let masterAId: string;
  let vendedorFilhaA: Db;
  let vendedorFilhaAId: string;
  let vendedorB: Db;
  let vendedorBId: string;

  beforeAll(async () => {
    matriz = await loginMatriz();

    // Rede A: empresa do master + franquia filha
    const { data: empA, error: eA } = await admin
      .from("empresas")
      .insert({ nome: uniq("Rede A Master"), tipo: "pj", documento: uniqDoc(), status: "aprovada" })
      .select("id")
      .single();
    if (eA) throw eA;

    const { data: empAFilha, error: eAF } = await admin
      .from("empresas")
      .insert({
        nome: uniq("Rede A Filha"),
        tipo: "pj",
        documento: uniqDoc(),
        status: "aprovada",
        parent_id: empA.id,
      })
      .select("id")
      .single();
    if (eAF) throw eAF;

    // Rede B: empresa independente (outra network)
    const { data: empB, error: eB } = await admin
      .from("empresas")
      .insert({ nome: uniq("Rede B"), tipo: "pj", documento: uniqDoc(), status: "aprovada" })
      .select("id")
      .single();
    if (eB) throw eB;

    // Usuários
    const m = await criarUsuario(`${uniq("master-a")}@teste.local`);
    masterA = m.client;
    masterAId = m.userId;
    await admin
      .from("profiles")
      .update({ empresa_id: empA.id, status: "aprovada" })
      .eq("id", masterAId);
    await admin.from("user_roles").insert({ user_id: masterAId, role: "master" });

    const vFilha = await criarUsuario(`${uniq("vend-filha-a")}@teste.local`);
    vendedorFilhaA = vFilha.client;
    vendedorFilhaAId = vFilha.userId;
    await admin
      .from("profiles")
      .update({ empresa_id: empAFilha.id, status: "aprovada" })
      .eq("id", vendedorFilhaAId);
    await admin.from("user_roles").insert({ user_id: vendedorFilhaAId, role: "vendedor" });

    const vB = await criarUsuario(`${uniq("vend-b")}@teste.local`);
    vendedorB = vB.client;
    vendedorBId = vB.userId;
    await admin
      .from("profiles")
      .update({ empresa_id: empB.id, status: "aprovada" })
      .eq("id", vendedorBId);
    await admin.from("user_roles").insert({ user_id: vendedorBId, role: "vendedor" });
  });

  it("POSITIVO: qualquer usuário lê o próprio role", async () => {
    const { data, error } = await vendedorFilhaA
      .from("user_roles")
      .select("role")
      .eq("user_id", vendedorFilhaAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.role).toBe("vendedor");
  });

  it("POSITIVO: matriz lê o role de qualquer usuário (rede global)", async () => {
    const { data, error } = await matriz
      .from("user_roles")
      .select("role")
      .eq("user_id", vendedorBId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.role).toBe("vendedor");
  });

  it("POSITIVO: master lê o role de usuário da franquia filha (própria rede)", async () => {
    const { data, error } = await masterA
      .from("user_roles")
      .select("role")
      .eq("user_id", vendedorFilhaAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.role).toBe("vendedor");
  });

  it("NEGATIVO: master NÃO lê o role de usuário de outra rede", async () => {
    const { data, error } = await masterA
      .from("user_roles")
      .select("role")
      .eq("user_id", vendedorBId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("NEGATIVO: vendedor NÃO lê o role de usuário de outra rede", async () => {
    const { data, error } = await vendedorFilhaA
      .from("user_roles")
      .select("role")
      .eq("user_id", vendedorBId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("NEGATIVO: vendedor NÃO enumera roles de outras redes (using(true) removido)", async () => {
    const { data, error } = await vendedorFilhaA.from("user_roles").select("user_id");
    expect(error).toBeNull();
    const ids = new Set((data ?? []).map((r) => r.user_id));
    expect(ids.has(vendedorBId)).toBe(false);
    // masterA está na empresa-mãe (rede A), não na franquia filha do vendedor — fora do escopo dele.
    expect(ids.has(masterAId)).toBe(false);
  });
});
