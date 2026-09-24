import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarEmpresa, criarPersonaComEmpresa, type Db } from "../helpers/supabase";

/**
 * `cotacoes.transmissao_fase` — migration
 * 20260924020332_v12_pipeline_transmissao_fase.sql.
 *
 * Coluna nova sem policy própria: usa a `cot_iud` já existente (for all,
 * using + with check `responsavel_id = auth.uid()`, ver
 * `tests/db/rls-cotacoes.test.ts`) e a `cot_select` já existente (leitura:
 * responsavel_id=self OU mesma empresa OU matriz OU master com
 * empresas_visiveis()).
 *
 * Check da coluna: `transmissao_fase is null or transmissao_fase in
 * ('dados','confirmacao','pagamento')`.
 */
describe("cotacoes.transmissao_fase — constraint + RLS (herda cot_iud/cot_select)", () => {
  let empresaA: string;
  let vendedorA: Db;
  let vendedorAId: string;

  let vendedorB: Db; // outra empresa, sem relação com A

  let matriz: Db;

  let cotacaoId: string;

  beforeAll(async () => {
    const emp = await criarEmpresa({ nome: "Empresa Transmissao Fase A" });
    empresaA = emp.id;

    const v1 = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaA,
      emailPrefix: "vend-transm-fase-a",
    });
    vendedorA = v1.client;
    vendedorAId = v1.userId;

    const vB = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-transm-fase-b" });
    vendedorB = vB.client;

    const m = await criarPersonaComEmpresa("matriz", { emailPrefix: "matriz-transm-fase" });
    matriz = m.client;

    const { data: cot, error: eCot } = await admin
      .from("cotacoes")
      .insert({ empresa_id: empresaA, responsavel_id: vendedorAId })
      .select("id")
      .single();
    if (eCot) throw eCot;
    cotacaoId = cot.id;
  });

  describe("check constraint", () => {
    it("NEGATIVO: valor fora do enum é rejeitado (23514)", async () => {
      const { error } = await admin
        .from("cotacoes")
        .update({ transmissao_fase: "invalido" })
        .eq("id", cotacaoId);
      expect(error).not.toBeNull();
      expect(error?.code).toBe("23514");
    });

    it.each(["dados", "confirmacao", "pagamento"] as const)(
      "POSITIVO: aceita o valor válido '%s'",
      async (valor) => {
        const { data, error } = await admin
          .from("cotacoes")
          .update({ transmissao_fase: valor })
          .eq("id", cotacaoId)
          .select("transmissao_fase")
          .single();
        expect(error).toBeNull();
        expect(data?.transmissao_fase).toBe(valor);
      },
    );

    it("POSITIVO: aceita null (limpa o campo)", async () => {
      const { data, error } = await admin
        .from("cotacoes")
        .update({ transmissao_fase: null })
        .eq("id", cotacaoId)
        .select("transmissao_fase")
        .single();
      expect(error).toBeNull();
      expect(data?.transmissao_fase).toBeNull();
    });
  });

  describe("RLS — write (cot_iud)", () => {
    it("POSITIVO: dono da cotação atualiza transmissao_fase", async () => {
      const { data, error } = await vendedorA
        .from("cotacoes")
        .update({ transmissao_fase: "confirmacao" })
        .eq("id", cotacaoId)
        .select("transmissao_fase")
        .single();
      expect(error).toBeNull();
      expect(data?.transmissao_fase).toBe("confirmacao");
    });

    it("NEGATIVO: outro vendedor (não é o dono) NÃO atualiza transmissao_fase", async () => {
      const { data, error } = await vendedorB
        .from("cotacoes")
        .update({ transmissao_fase: "pagamento" })
        .eq("id", cotacaoId)
        .select("transmissao_fase");
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);

      const { data: real } = await admin
        .from("cotacoes")
        .select("transmissao_fase")
        .eq("id", cotacaoId)
        .single();
      expect(real?.transmissao_fase).toBe("confirmacao");
    });
  });

  describe("RLS — select (cot_select)", () => {
    it("POSITIVO: dono da cotação lê transmissao_fase", async () => {
      const { data, error } = await vendedorA
        .from("cotacoes")
        .select("transmissao_fase")
        .eq("id", cotacaoId)
        .single();
      expect(error).toBeNull();
      expect(data?.transmissao_fase).toBe("confirmacao");
    });

    it("POSITIVO: matriz lê transmissao_fase de qualquer cotação", async () => {
      const { data, error } = await matriz
        .from("cotacoes")
        .select("transmissao_fase")
        .eq("id", cotacaoId)
        .single();
      expect(error).toBeNull();
      expect(data?.transmissao_fase).toBe("confirmacao");
    });
  });
});
