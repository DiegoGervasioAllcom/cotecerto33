import { describe, it, expect, beforeAll } from "vitest";
import {
  admin,
  loginMatriz,
  criarEmpresa,
  criarPersonaComEmpresa,
  type Db,
} from "../helpers/supabase";

/**
 * RLS de `empresas` e `profiles` — cadeia da V10: vendedor de franquia › franquia
 * (master) › matriz.
 *
 * Rede A: master A (empresa própria) + franquia filha F1 (parent_id = empresa do
 * master A), com dois vendedores em F1 (colegas de empresa).
 * Rede B: franqueado B com empresa própria, independente da rede A — usada nos
 * casos negativos.
 *
 * Policies (20240101000001_init.sql):
 *  - "empresas select" (~L228-233): matriz vê tudo; demais via empresas_visiveis().
 *  - "empresas update matriz" (~L241-244): só matriz.
 *  - "profiles select self or rede" (~L248-254): self, matriz, ou empresa na rede visível.
 *  - "profiles update self" (~L257-260): só self ou matriz.
 *  - empresas_visiveis() (~L99-126): master vê própria+filhas (parent_id=própria); vendedor vê só a própria.
 */
describe("RLS empresas/profiles — visibilidade por rede", () => {
  let matriz: Db;

  let masterA: Db;
  let masterAId: string;
  let empresaMasterA: string;
  let empresaFilhaA: string;
  let vendedorF1a: Db;
  let vendedorF1aId: string;
  let vendedorF1b: Db;
  let vendedorF1bId: string;

  let empresaB: string;
  let vendedorB: Db;
  let vendedorBId: string;

  beforeAll(async () => {
    matriz = await loginMatriz();

    const master = await criarPersonaComEmpresa("master", { emailPrefix: "master-a" });
    masterA = master.client;
    masterAId = master.userId;
    empresaMasterA = master.empresaId;

    const filha = await criarEmpresa({ nome: "Filha F1", parent_id: empresaMasterA });
    empresaFilhaA = filha.id;

    const v1 = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaFilhaA,
      emailPrefix: "vend-f1a",
    });
    vendedorF1a = v1.client;
    vendedorF1aId = v1.userId;

    const v2 = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaFilhaA,
      emailPrefix: "vend-f1b",
    });
    vendedorF1b = v2.client;
    vendedorF1bId = v2.userId;

    const franqB = await criarPersonaComEmpresa("franqueado", { emailPrefix: "franq-b" });
    empresaB = franqB.empresaId;

    const vB = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaB,
      emailPrefix: "vend-b",
    });
    vendedorB = vB.client;
    vendedorBId = vB.userId;
  });

  it("POSITIVO: matriz vê todas as empresas (própria rede + rede B)", async () => {
    const { data, error } = await matriz
      .from("empresas")
      .select("id")
      .in("id", [empresaMasterA, empresaFilhaA, empresaB]);
    expect(error).toBeNull();
    const ids = new Set((data ?? []).map((e) => e.id));
    expect(ids).toEqual(new Set([empresaMasterA, empresaFilhaA, empresaB]));
  });

  it("POSITIVO: master vê própria empresa + franquia filha", async () => {
    const { data, error } = await masterA
      .from("empresas")
      .select("id")
      .in("id", [empresaMasterA, empresaFilhaA, empresaB]);
    expect(error).toBeNull();
    const ids = new Set((data ?? []).map((e) => e.id));
    expect(ids).toEqual(new Set([empresaMasterA, empresaFilhaA]));
  });

  it("NEGATIVO: master não vê empresa da rede B", async () => {
    const { data, error } = await masterA.from("empresas").select("id").eq("id", empresaB);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("POSITIVO: vendedor de F1 vê só a própria empresa (F1)", async () => {
    const { data, error } = await vendedorF1a
      .from("empresas")
      .select("id")
      .in("id", [empresaMasterA, empresaFilhaA, empresaB]);
    expect(error).toBeNull();
    const ids = new Set((data ?? []).map((e) => e.id));
    expect(ids).toEqual(new Set([empresaFilhaA]));
  });

  it("NEGATIVO: vendedor de F1 não vê empresa do master nem da rede B", async () => {
    const { data, error } = await vendedorF1a
      .from("empresas")
      .select("id")
      .in("id", [empresaMasterA, empresaB]);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("POSITIVO: self sempre vê o próprio profile", async () => {
    const { data, error } = await vendedorF1a.from("profiles").select("id").eq("id", vendedorF1aId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("POSITIVO: vendedor vê profile de colega da mesma empresa", async () => {
    const { data, error } = await vendedorF1a.from("profiles").select("id").eq("id", vendedorF1bId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("NEGATIVO: vendedor não vê profile de usuário da rede B", async () => {
    const { data, error } = await vendedorF1a.from("profiles").select("id").eq("id", vendedorBId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("NEGATIVO: master não atualiza profile de vendedor (só self ou matriz)", async () => {
    const { data, error } = await masterA
      .from("profiles")
      .update({ nome: "Nome Forjado Pelo Master" })
      .eq("id", vendedorF1aId)
      .select("nome");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);

    const { data: real } = await admin
      .from("profiles")
      .select("nome")
      .eq("id", vendedorF1aId)
      .single();
    expect(real?.nome).not.toBe("Nome Forjado Pelo Master");
  });

  it("POSITIVO: matriz atualiza status de empresa", async () => {
    const { data, error } = await matriz
      .from("empresas")
      .update({ status: "suspensa" })
      .eq("id", empresaB)
      .select("status")
      .single();
    expect(error).toBeNull();
    expect(data?.status).toBe("suspensa");

    // restaura para não afetar outros testes que dependem de empresaB aprovada
    await admin.from("empresas").update({ status: "aprovada" }).eq("id", empresaB);
  });

  it("NEGATIVO: master não atualiza empresas (nem a própria)", async () => {
    const { data, error } = await masterA
      .from("empresas")
      .update({ status: "suspensa" })
      .eq("id", empresaMasterA)
      .select("status");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);

    const { data: real } = await admin
      .from("empresas")
      .select("status")
      .eq("id", empresaMasterA)
      .single();
    expect(real?.status).toBe("aprovada");
  });
});
