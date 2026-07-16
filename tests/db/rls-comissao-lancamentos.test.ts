import { describe, it, expect, beforeAll } from "vitest";
import {
  admin,
  criarPersonaComEmpresa,
  criarUsuario,
  uniq,
  uniqDoc,
  type Db,
} from "../helpers/supabase";

/**
 * S3 — escrita em `comissao_lancamentos`.
 *
 * A policy "cc lanc insert matriz" (20240101000038_conta_corrente_comissoes.sql
 * ~L42-48, `for insert to authenticated with check (has_role(matriz) or
 * has_role(master))`) permitia insert DIRETO na tabela por matriz/master,
 * contornando a validação da RPC `lancar_ajuste_comissao` (valor arbitrário,
 * vendedor de qualquer rede, origem livre).
 * 20260715153607_s3_fechar_insert_comissao_lancamentos.sql:
 *   1) remove essa policy (sem substituta — escrita autenticada só via RPC/trigger
 *      definer);
 *   2) `lancar_ajuste_comissao` passa a validar valor > 0 e, para master, que o
 *      vendedor-alvo esteja na rede visível (empresas_visiveis).
 * O trigger `_sync_comissao_lancamento` (crédito/débito automático ao
 * pagar/cancelar proposta) não foi tocado.
 *
 * Rede A: master A (empresa própria) + franquia filha F1 (parent_id = empresa do
 * master A; o vendedor de F1 tem `profiles.superior_id` = master A — é essa cadeia
 * de pessoas que a empresas_visiveis() multinível (G1.2) usa, não mais só
 * parent_id). Rede B: vendedor independente, fora da rede A — usado para o caso
 * negativo de escopo.
 */
describe("S3 — insert direto em comissao_lancamentos fica bloqueado; RPC valida valor/rede", () => {
  let matriz: Db;
  let masterA: Db;

  let vendedorFilhaA: Db;
  let vendedorFilhaAId: string;
  let empresaFilhaAId: string;

  let vendedorB: Db;
  let vendedorBId: string;

  beforeAll(async () => {
    const m = await criarPersonaComEmpresa("matriz", { emailPrefix: "matriz-cclanc" });
    matriz = m.client;

    // Rede A: empresa do master + franquia filha, com vendedor na filha
    const { data: empA, error: eA } = await admin
      .from("empresas")
      .insert({
        nome: uniq("Rede A Master cclanc"),
        tipo: "pj",
        documento: uniqDoc(),
        status: "aprovada",
      })
      .select("id")
      .single();
    if (eA) throw eA;

    const { data: empAFilha, error: eAF } = await admin
      .from("empresas")
      .insert({
        nome: uniq("Rede A Filha cclanc"),
        tipo: "pj",
        documento: uniqDoc(),
        status: "aprovada",
        parent_id: empA.id,
      })
      .select("id")
      .single();
    if (eAF) throw eAF;
    empresaFilhaAId = empAFilha.id;

    const masterAP = await criarPersonaComEmpresa("master", {
      empresaId: empA.id,
      emailPrefix: "master-a-cclanc",
    });
    masterA = masterAP.client;
    const masterAId = masterAP.userId;

    const vFilha = await criarUsuario(`${uniq("vend-filha-a-cclanc")}@teste.local`);
    vendedorFilhaA = vFilha.client;
    vendedorFilhaAId = vFilha.userId;
    await admin
      .from("profiles")
      .update({ empresa_id: empAFilha.id, status: "aprovada", superior_id: masterAId })
      .eq("id", vendedorFilhaAId);
    await admin.from("user_roles").insert({ user_id: vendedorFilhaAId, role: "vendedor" });

    // Rede B: vendedor independente
    const vB = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-b-cclanc" });
    vendedorB = vB.client;
    vendedorBId = vB.userId;
  });

  it("NEGATIVO: master autenticado não insere direto em comissao_lancamentos (RLS)", async () => {
    const { data, error } = await masterA
      .from("comissao_lancamentos")
      .insert({
        vendedor_id: vendedorFilhaAId,
        tipo: "credito",
        valor: 999,
        descricao: "tentativa de insert direto",
      })
      .select("id");
    expect(error).not.toBeNull();
    expect(data ?? []).toHaveLength(0);

    const { data: real } = await admin
      .from("comissao_lancamentos")
      .select("id")
      .eq("vendedor_id", vendedorFilhaAId)
      .eq("descricao", "tentativa de insert direto");
    expect(real ?? []).toHaveLength(0);
  });

  it("NEGATIVO: lancar_ajuste_comissao rejeita valor <= 0", async () => {
    const { data: zero, error: eZero } = await matriz.rpc("lancar_ajuste_comissao", {
      p_vendedor: vendedorFilhaAId,
      p_tipo: "credito",
      p_valor: 0,
      p_descricao: "valor zero",
    });
    expect(eZero).not.toBeNull();
    expect(zero).toBeNull();

    const { data: neg, error: eNeg } = await matriz.rpc("lancar_ajuste_comissao", {
      p_vendedor: vendedorFilhaAId,
      p_tipo: "credito",
      p_valor: -10,
      p_descricao: "valor negativo",
    });
    expect(eNeg).not.toBeNull();
    expect(neg).toBeNull();
  });

  it("NEGATIVO: master chamando lancar_ajuste_comissao para vendedor de outra rede é rejeitado", async () => {
    const { data, error } = await masterA.rpc("lancar_ajuste_comissao", {
      p_vendedor: vendedorBId,
      p_tipo: "credito",
      p_valor: 50,
      p_descricao: "fora da rede",
    });
    expect(error).not.toBeNull();
    expect(data).toBeNull();

    const { data: real } = await admin
      .from("comissao_lancamentos")
      .select("id")
      .eq("vendedor_id", vendedorBId)
      .eq("descricao", "fora da rede");
    expect(real ?? []).toHaveLength(0);
  });

  it("POSITIVO: matriz lança ajuste para qualquer vendedor com valor válido (origem='ajuste')", async () => {
    const { data: id, error } = await matriz.rpc("lancar_ajuste_comissao", {
      p_vendedor: vendedorBId,
      p_tipo: "credito",
      p_valor: 123.45,
      p_descricao: "ajuste matriz",
    });
    expect(error).toBeNull();
    expect(id).not.toBeNull();

    const { data: real } = await admin
      .from("comissao_lancamentos")
      .select("origem, valor, vendedor_id")
      .eq("id", id as string)
      .single();
    expect(real?.origem).toBe("ajuste");
    expect(real?.valor).toBe(123.45);
    expect(real?.vendedor_id).toBe(vendedorBId);
  });

  it("POSITIVO: master lança ajuste para vendedor da própria rede (franquia filha)", async () => {
    const { data: id, error } = await masterA.rpc("lancar_ajuste_comissao", {
      p_vendedor: vendedorFilhaAId,
      p_tipo: "debito",
      p_valor: 20,
      p_descricao: "ajuste master rede propria",
    });
    expect(error).toBeNull();
    expect(id).not.toBeNull();

    const { data: real } = await admin
      .from("comissao_lancamentos")
      .select("origem, tipo, vendedor_id")
      .eq("id", id as string)
      .single();
    expect(real?.origem).toBe("ajuste");
    expect(real?.tipo).toBe("debito");
    expect(real?.vendedor_id).toBe(vendedorFilhaAId);
  });

  it("POSITIVO (rede de segurança do motor): trigger de sync ainda cria lançamento automático ao pagar proposta", async () => {
    const { data: proposta, error: eProp } = await admin
      .from("propostas")
      .insert({
        empresa_id: empresaFilhaAId,
        responsavel_id: vendedorFilhaAId,
        status: "gerada",
        comissao_valor: 77.5,
        seguradora: "Seguradora Teste",
      })
      .select("id")
      .single();
    if (eProp) throw eProp;

    const { error: ePago } = await admin
      .from("propostas")
      .update({ pago_em: new Date().toISOString() })
      .eq("id", proposta.id);
    expect(ePago).toBeNull();

    const { data: lanc } = await admin
      .from("comissao_lancamentos")
      .select("id, tipo, valor, origem")
      .eq("proposta_id", proposta.id)
      .eq("tipo", "credito");
    expect(lanc ?? []).toHaveLength(1);
    expect(lanc?.[0]?.origem).toBe("auto");
    expect(lanc?.[0]?.valor).toBe(77.5);
  });
});
