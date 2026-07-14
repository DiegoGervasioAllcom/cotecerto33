import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarEmpresa, criarPersonaComEmpresa, type Db } from "../helpers/supabase";

/**
 * RLS de `cotacoes` + 2 tabelas-filha representativas (`cotacao_segurado`,
 * `cotacao_veiculo`), que herdam a visibilidade da cotação via EXISTS.
 *
 * Policies (20240101000007_cotacoes.sql):
 *  - cot_select (~L31-36): responsavel_id=self OU mesma empresa (via profiles.empresa_id
 *    do usuário) OU matriz/master.
 *  - cot_iud (~L37-40): SÓ responsavel_id=self (nem colega de empresa, nem matriz/master
 *    entram aqui — policy mais restritiva que a de select).
 *  - tabelas-filha (~L92-113): mesmo EXISTS de leitura para select/update; o `with check`
 *    do `for all` também exige responsavel_id=self.
 */
describe("RLS cotacoes — responsável edita, colega só lê, outra empresa não vê nada", () => {
  let empresaA: string;
  let vendedorA: Db;
  let vendedorAId: string;
  let vendedorA2: Db; // colega de empresa

  let vendedorB: Db; // outra empresa, sem relação com A

  let cotacaoId: string;

  beforeAll(async () => {
    const emp = await criarEmpresa({ nome: "Empresa Cotacao A" });
    empresaA = emp.id;

    const v1 = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaA,
      emailPrefix: "vend-cot-a",
    });
    vendedorA = v1.client;
    vendedorAId = v1.userId;

    const v2 = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaA,
      emailPrefix: "vend-cot-a2",
    });
    vendedorA2 = v2.client;

    const vB = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-cot-b" });
    vendedorB = vB.client;

    const { data: cot, error: eCot } = await admin
      .from("cotacoes")
      .insert({ empresa_id: empresaA, responsavel_id: vendedorAId })
      .select("id")
      .single();
    if (eCot) throw eCot;
    cotacaoId = cot.id;

    const { error: eSeg } = await admin
      .from("cotacao_segurado")
      .insert({ cotacao_id: cotacaoId, nome: "Segurado Teste" });
    if (eSeg) throw eSeg;

    const { error: eVei } = await admin
      .from("cotacao_veiculo")
      .insert({ cotacao_id: cotacaoId, marca_nome: "FIAT", modelo_nome: "UNO" });
    if (eVei) throw eVei;
  });

  it("POSITIVO: responsável lê a própria cotação", async () => {
    const { data, error } = await vendedorA.from("cotacoes").select("id").eq("id", cotacaoId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("POSITIVO: responsável edita a própria cotação (cot_iud)", async () => {
    const { data, error } = await vendedorA
      .from("cotacoes")
      .update({ step_atual: 3 })
      .eq("id", cotacaoId)
      .select("step_atual")
      .single();
    expect(error).toBeNull();
    expect(data?.step_atual).toBe(3);
  });

  it("POSITIVO: colega de empresa LÊ a cotação (mesma empresa)", async () => {
    const { data, error } = await vendedorA2.from("cotacoes").select("id").eq("id", cotacaoId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("NEGATIVO: colega de empresa NÃO edita a cotação (cot_iud só responsavel_id=self)", async () => {
    const { data, error } = await vendedorA2
      .from("cotacoes")
      .update({ step_atual: 5 })
      .eq("id", cotacaoId)
      .select("step_atual");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);

    const { data: real } = await admin
      .from("cotacoes")
      .select("step_atual")
      .eq("id", cotacaoId)
      .single();
    expect(real?.step_atual).toBe(3);
  });

  it("NEGATIVO: usuário de outra empresa não vê a cotação nem as tabelas-filha (segurado/veículo)", async () => {
    const { data: cot, error: eCot } = await vendedorB
      .from("cotacoes")
      .select("id")
      .eq("id", cotacaoId);
    expect(eCot).toBeNull();
    expect(cot ?? []).toHaveLength(0);

    const { data: seg, error: eSeg } = await vendedorB
      .from("cotacao_segurado")
      .select("cotacao_id")
      .eq("cotacao_id", cotacaoId);
    expect(eSeg).toBeNull();
    expect(seg ?? []).toHaveLength(0);

    const { data: vei, error: eVei } = await vendedorB
      .from("cotacao_veiculo")
      .select("cotacao_id")
      .eq("cotacao_id", cotacaoId);
    expect(eVei).toBeNull();
    expect(vei ?? []).toHaveLength(0);
  });
});
