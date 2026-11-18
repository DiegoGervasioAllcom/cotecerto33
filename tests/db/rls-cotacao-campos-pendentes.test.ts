import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarPersonaComEmpresa, type Db } from "../helpers/supabase";

/**
 * `cotacoes.campos_pendentes` (migration 20261118061602): lista das
 * perguntas obrigatórias do wizard ainda não respondidas. Escrita pelo dono
 * via a policy `cot_iud` já vigente; colega da mesma empresa não escreve.
 */
describe("RLS cotacoes.campos_pendentes", () => {
  let dono: Db;
  let colega: Db;
  let cotacaoId: string;

  beforeAll(async () => {
    const d = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-pend-dono" });
    dono = d.client;
    const c = await criarPersonaComEmpresa("vendedor", {
      empresaId: d.empresaId,
      emailPrefix: "vend-pend-colega",
    });
    colega = c.client;
    const { data, error } = await admin
      .from("cotacoes")
      .insert({ empresa_id: d.empresaId, responsavel_id: d.userId, status: "rascunho" })
      .select("id, campos_pendentes")
      .single();
    if (error || !data) throw error ?? new Error("falha ao criar cotação de fixture");
    cotacaoId = data.id;
    // Default: cotação nova nasce com TODAS as perguntas pendentes (a lista
    // bate com `chavesPendentes` do front; linhas antigas ficam '{}').
    expect(data.campos_pendentes).toHaveLength(14);
    expect(data.campos_pendentes).toContain("zeroKm");
    expect(data.campos_pendentes).toContain("dados:tipoCalculo");
  });

  it("dono grava e lê as chaves pendentes", async () => {
    const { data, error } = await dono
      .from("cotacoes")
      .update({ campos_pendentes: ["zeroKm", "perfil:garagem"] })
      .eq("id", cotacaoId)
      .select("campos_pendentes");
    expect(error).toBeNull();
    expect(data?.[0].campos_pendentes).toEqual(["zeroKm", "perfil:garagem"]);
  });

  it("colega da mesma empresa não altera", async () => {
    const { data, error } = await colega
      .from("cotacoes")
      .update({ campos_pendentes: [] })
      .eq("id", cotacaoId)
      .select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("rejeita lista maior que 40 itens", async () => {
    const muitas = Array.from({ length: 41 }, (_, i) => `k${i}`);
    const { error } = await admin
      .from("cotacoes")
      .update({ campos_pendentes: muitas })
      .eq("id", cotacaoId);
    expect(error).not.toBeNull();
  });
});
