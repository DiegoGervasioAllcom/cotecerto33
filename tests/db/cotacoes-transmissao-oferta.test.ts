import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarEmpresa, criarPersonaComEmpresa, type Db } from "../helpers/supabase";

/**
 * `cotacoes.transmissao_oferta` — migration
 * 20260928054400_v12_cotacao_transmissao_oferta.sql.
 *
 * Snapshot best-effort da oferta escolhida para transmitir (seguradora,
 * produto_id, produto, forma_pagamento, parcelas, premio), gravado no
 * Cálculo pra o wizard reabrir na Transmissão (sub-passo Dados
 * complementares) mesmo antes da 1ª tentativa real.
 *
 * Coluna nova sem policy própria: usa a `cot_iud` já existente (for all,
 * using + with check `responsavel_id = auth.uid()`, ver
 * `tests/db/rls-cotacoes.test.ts`) e a `cot_select` já existente.
 *
 * Checks da coluna: `jsonb_typeof(transmissao_oferta) = 'object'` e
 * `char_length(transmissao_oferta::text) <= 2000`.
 */
describe("cotacoes.transmissao_oferta — constraint + RLS (herda cot_iud/cot_select)", () => {
  let empresaA: string;
  let vendedorA: Db;
  let vendedorAId: string;

  let colegaA: Db; // mesma empresa, não é o dono da cotação

  let cotacaoId: string;

  const ofertaValida = {
    seguradora: "Porto Seguro",
    produto_id: "auto-basico",
    produto: "Auto Básico",
    forma_pagamento: "boleto",
    parcelas: 12,
    premio: 1234.56,
  };

  beforeAll(async () => {
    const emp = await criarEmpresa({ nome: "Empresa Transmissao Oferta A" });
    empresaA = emp.id;

    const v1 = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaA,
      emailPrefix: "vend-transm-oferta-a",
    });
    vendedorA = v1.client;
    vendedorAId = v1.userId;

    const c1 = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaA,
      emailPrefix: "vend-transm-oferta-colega",
    });
    colegaA = c1.client;

    const { data: cot, error: eCot } = await admin
      .from("cotacoes")
      .insert({ empresa_id: empresaA, responsavel_id: vendedorAId })
      .select("id")
      .single();
    if (eCot) throw eCot;
    cotacaoId = cot.id;
  });

  describe("check constraint", () => {
    it("POSITIVO: aceita um objeto jsonb válido dentro do limite de tamanho", async () => {
      const { data, error } = await admin
        .from("cotacoes")
        .update({ transmissao_oferta: ofertaValida })
        .eq("id", cotacaoId)
        .select("transmissao_oferta")
        .single();
      expect(error).toBeNull();
      expect(data?.transmissao_oferta).toEqual(ofertaValida);
    });

    it("POSITIVO: aceita null (limpa o campo)", async () => {
      const { data, error } = await admin
        .from("cotacoes")
        .update({ transmissao_oferta: null })
        .eq("id", cotacaoId)
        .select("transmissao_oferta")
        .single();
      expect(error).toBeNull();
      expect(data?.transmissao_oferta).toBeNull();
    });

    it("NEGATIVO: valor que não é objeto (array) é rejeitado (23514)", async () => {
      const { error } = await admin
        .from("cotacoes")
        .update({ transmissao_oferta: ["não", "é", "objeto"] })
        .eq("id", cotacaoId);
      expect(error).not.toBeNull();
      expect(error?.code).toBe("23514");
    });

    it("NEGATIVO: valor que não é objeto (string escalar) é rejeitado (23514)", async () => {
      const { error } = await admin
        .from("cotacoes")
        .update({ transmissao_oferta: "string-solta" })
        .eq("id", cotacaoId);
      expect(error).not.toBeNull();
      expect(error?.code).toBe("23514");
    });

    it("NEGATIVO: objeto acima de 2000 caracteres é rejeitado (23514)", async () => {
      const ofertaGigante = {
        ...ofertaValida,
        observacao: "x".repeat(2100),
      };
      const { error } = await admin
        .from("cotacoes")
        .update({ transmissao_oferta: ofertaGigante })
        .eq("id", cotacaoId);
      expect(error).not.toBeNull();
      expect(error?.code).toBe("23514");
    });
  });

  describe("RLS — write (cot_iud)", () => {
    it("POSITIVO: dono da cotação grava transmissao_oferta", async () => {
      const { data, error } = await vendedorA
        .from("cotacoes")
        .update({ transmissao_oferta: ofertaValida })
        .eq("id", cotacaoId)
        .select("transmissao_oferta")
        .single();
      expect(error).toBeNull();
      expect(data?.transmissao_oferta).toEqual(ofertaValida);
    });

    it("NEGATIVO: colega da mesma empresa (não é o dono) NÃO grava transmissao_oferta", async () => {
      const outraOferta = { ...ofertaValida, seguradora: "Azul Seguros" };
      const { data, error } = await colegaA
        .from("cotacoes")
        .update({ transmissao_oferta: outraOferta })
        .eq("id", cotacaoId)
        .select("transmissao_oferta");
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);

      const { data: real } = await admin
        .from("cotacoes")
        .select("transmissao_oferta")
        .eq("id", cotacaoId)
        .single();
      expect(real?.transmissao_oferta).toEqual(ofertaValida);
    });
  });

  describe("RLS — read (cot_select)", () => {
    it("POSITIVO: dono da cotação lê transmissao_oferta", async () => {
      const { data, error } = await vendedorA
        .from("cotacoes")
        .select("transmissao_oferta")
        .eq("id", cotacaoId)
        .single();
      expect(error).toBeNull();
      expect(data?.transmissao_oferta).toEqual(ofertaValida);
    });

    it("POSITIVO: colega da mesma empresa lê transmissao_oferta (cot_select cobre mesma empresa)", async () => {
      const { data, error } = await colegaA
        .from("cotacoes")
        .select("transmissao_oferta")
        .eq("id", cotacaoId)
        .single();
      expect(error).toBeNull();
      expect(data?.transmissao_oferta).toEqual(ofertaValida);
    });
  });
});
