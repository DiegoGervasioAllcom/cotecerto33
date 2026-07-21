import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarPersonaComEmpresa, loginMatriz, uniq, type Db } from "../helpers/supabase";

/**
 * S-crítica — metas_select estava `using (true)`: qualquer autenticado lia
 * qualquer meta de qualquer empresa/vendedor. Corrigido em
 * 20260721160000_s_fix_metas_select_escopo.sql.
 *
 * Confirma: vendedor comum só vê a própria meta (escopo='usuario') e a da
 * própria empresa (escopo='empresa'), nunca a de outra rede; master vê a
 * própria rede mas não a rede B; matriz vê tudo.
 */
describe("S-crítica — metas_select escopado (vendedor/master/matriz)", () => {
  let matriz: Db;

  let masterA: Db;
  let vendedorA: Db;
  let vendedorAId: string;
  let empresaA: string;

  let masterB: Db;
  let empresaB: string;
  let vendedorBId: string;

  let metaUsuarioA: string;
  let metaEmpresaA: string;
  let metaUsuarioB: string;
  let metaEmpresaB: string;

  beforeAll(async () => {
    matriz = await loginMatriz();

    const mA = await criarPersonaComEmpresa("master", { emailPrefix: "master-metas-a" });
    masterA = mA.client;
    empresaA = mA.empresaId;

    const mB = await criarPersonaComEmpresa("master", { emailPrefix: "master-metas-b" });
    masterB = mB.client;
    empresaB = mB.empresaId;

    const vA = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaA,
      emailPrefix: "vend-metas-a",
      superiorId: mA.userId,
    });
    vendedorA = vA.client;
    vendedorAId = vA.userId;

    const vB = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaB,
      emailPrefix: "vend-metas-b",
      superiorId: mB.userId,
    });
    vendedorBId = vB.userId;

    const { data: mUA, error: eMUA } = await admin
      .from("metas")
      .insert({ escopo: "usuario", ref_id: vendedorAId, ano: 2026, mes: 2, meta_vendas: 5 })
      .select("id")
      .single();
    if (eMUA) throw eMUA;
    metaUsuarioA = mUA.id;

    const { data: mEA, error: eMEA } = await admin
      .from("metas")
      .insert({ escopo: "empresa", ref_id: empresaA, ano: 2026, mes: 2, meta_vendas: 15 })
      .select("id")
      .single();
    if (eMEA) throw eMEA;
    metaEmpresaA = mEA.id;

    const { data: mUB, error: eMUB } = await admin
      .from("metas")
      .insert({ escopo: "usuario", ref_id: vendedorBId, ano: 2026, mes: 2, meta_vendas: 7 })
      .select("id")
      .single();
    if (eMUB) throw eMUB;
    metaUsuarioB = mUB.id;

    const { data: mEB, error: eMEB } = await admin
      .from("metas")
      .insert({ escopo: "empresa", ref_id: empresaB, ano: 2026, mes: 2, meta_vendas: 25 })
      .select("id")
      .single();
    if (eMEB) throw eMEB;
    metaEmpresaB = mEB.id;
  });

  it("vendedor A vê a própria meta e a da própria empresa", async () => {
    const { data: propria } = await vendedorA.from("metas").select("id").eq("id", metaUsuarioA);
    expect(propria ?? []).toHaveLength(1);

    const { data: daEmpresa } = await vendedorA.from("metas").select("id").eq("id", metaEmpresaA);
    expect(daEmpresa ?? []).toHaveLength(1);
  });

  it("vendedor A NÃO vê meta de outro vendedor nem de outra empresa/rede", async () => {
    const { data: outroVend } = await vendedorA.from("metas").select("id").eq("id", metaUsuarioB);
    expect(outroVend ?? []).toHaveLength(0);

    const { data: outraEmpresa } = await vendedorA
      .from("metas")
      .select("id")
      .eq("id", metaEmpresaB);
    expect(outraEmpresa ?? []).toHaveLength(0);
  });

  it("master A vê metas da própria rede (usuário e empresa) mas não da rede B", async () => {
    const { data: uA } = await masterA.from("metas").select("id").eq("id", metaUsuarioA);
    expect(uA ?? []).toHaveLength(1);
    const { data: eA } = await masterA.from("metas").select("id").eq("id", metaEmpresaA);
    expect(eA ?? []).toHaveLength(1);

    const { data: uB } = await masterA.from("metas").select("id").eq("id", metaUsuarioB);
    expect(uB ?? []).toHaveLength(0);
    const { data: eB } = await masterA.from("metas").select("id").eq("id", metaEmpresaB);
    expect(eB ?? []).toHaveLength(0);
  });

  it("matriz vê todas as metas, de qualquer rede", async () => {
    const ids = [metaUsuarioA, metaEmpresaA, metaUsuarioB, metaEmpresaB];
    const { data } = await matriz.from("metas").select("id").in("id", ids);
    expect(data ?? []).toHaveLength(4);
  });
});
