import { describe, it, expect, beforeAll } from "vitest";
import {
  admin,
  criarPersonaComEmpresa,
  loginMatriz,
  uniq,
  uniqDoc,
  type Db,
} from "../helpers/supabase";

/**
 * G4.2 (048) — ledger multinível de comissão + competência (26->25).
 *
 * `comissao_lancamentos` ganha `beneficiario_id`/`papel`/`competencia`/`regra`
 * (aditivo, nullable); o índice único vira (proposta_id, tipo, beneficiario_id)
 * — permite crédito pro vendedor E pro beneficiário de um override na MESMA
 * proposta, sem perder a proteção anti-duplicata por beneficiário. O trigger
 * `_sync_comissao_lancamento` troca o `* 0.16` fixo por `fn_pct_comissao_efetivo`
 * (empresas.perc_comissao -> modelos_franquia.perc_comissao_padrao -> 16
 * fallback), e a mesma função passa a ser usada por `marcar_apolice_emitida`
 * (037) no lugar do 16 hardcoded de lá.
 */
describe("G4.2 — fn_competencia", () => {
  it("dia < 26 conta para a competência do próprio mês", async () => {
    const { data, error } = await admin.rpc("fn_competencia", {
      ts: "2026-07-10T12:00:00-03:00",
    });
    expect(error).toBeNull();
    expect(data).toBe("2026-07");
  });

  it("dia >= 26 conta para a competência do mês seguinte", async () => {
    const { data, error } = await admin.rpc("fn_competencia", {
      ts: "2026-07-28T12:00:00-03:00",
    });
    expect(error).toBeNull();
    expect(data).toBe("2026-08");
  });

  it("dia 26 exatamente já vira o mês seguinte (borda)", async () => {
    const { data } = await admin.rpc("fn_competencia", { ts: "2026-07-26T00:00:01-03:00" });
    expect(data).toBe("2026-08");
  });

  it("dia 25 ainda é o mês corrente (borda)", async () => {
    const { data } = await admin.rpc("fn_competencia", { ts: "2026-07-25T23:59:59-03:00" });
    expect(data).toBe("2026-07");
  });

  it("virada de ano: 2026-12-27 -> competência 2027-01", async () => {
    const { data } = await admin.rpc("fn_competencia", { ts: "2026-12-27T10:00:00-03:00" });
    expect(data).toBe("2027-01");
  });
});

describe("G4.2 — trigger de sync usa % efetivo (empresa > modelo > fallback 16)", () => {
  let vendedor: Db;
  let vendedorId: string;
  let empresaComOverrideId: string;
  let empresaSemOverrideMasComModeloId: string;
  let empresaSemNadaId: string;

  beforeAll(async () => {
    const p = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-ledger" });
    vendedor = p.client;
    vendedorId = p.userId;
    void vendedor;

    const { data: empOverride, error: e1 } = await admin
      .from("empresas")
      .insert({
        nome: uniq("Empresa override 50pct"),
        tipo: "pj",
        documento: uniqDoc(),
        status: "aprovada",
        perc_comissao: 50,
      })
      .select("id")
      .single();
    if (e1) throw e1;
    empresaComOverrideId = empOverride.id;

    const { data: modelo, error: e2 } = await admin
      .from("modelos_franquia")
      .insert({ nome: uniq("Modelo 30pct"), tipo: "franqueada", perc_comissao_padrao: 30 })
      .select("id")
      .single();
    if (e2) throw e2;

    const { data: empModelo, error: e3 } = await admin
      .from("empresas")
      .insert({
        nome: uniq("Empresa via modelo"),
        tipo: "pj",
        documento: uniqDoc(),
        status: "aprovada",
        modelo_id: modelo.id,
      })
      .select("id")
      .single();
    if (e3) throw e3;
    empresaSemOverrideMasComModeloId = empModelo.id;

    const { data: empNada, error: e4 } = await admin
      .from("empresas")
      .insert({
        nome: uniq("Empresa sem override nem modelo"),
        tipo: "pj",
        documento: uniqDoc(),
        status: "aprovada",
      })
      .select("id")
      .single();
    if (e4) throw e4;
    empresaSemNadaId = empNada.id;
  });

  async function pagarPropostaEBuscarLancamento(empresaId: string, premio: number) {
    const { data: proposta, error: eProp } = await admin
      .from("propostas")
      .insert({
        empresa_id: empresaId,
        responsavel_id: vendedorId,
        status: "gerada",
        premio,
        seguradora: "Seguradora Teste",
      })
      .select("id")
      .single();
    if (eProp) throw eProp;

    const { error: ePago } = await admin
      .from("propostas")
      .update({ pago_em: new Date().toISOString() })
      .eq("id", proposta.id);
    if (ePago) throw ePago;

    const { data: lanc, error: eLanc } = await admin
      .from("comissao_lancamentos")
      .select("valor, regra, beneficiario_id, competencia")
      .eq("proposta_id", proposta.id)
      .eq("tipo", "credito")
      .single();
    if (eLanc) throw eLanc;
    return lanc;
  }

  it("empresa com perc_comissao=50 -> valor = premio*0.50 e regra registra fonte=empresa", async () => {
    const lanc = await pagarPropostaEBuscarLancamento(empresaComOverrideId, 1000);
    expect(lanc.valor).toBe(500);
    expect(lanc.regra).toMatchObject({ pct: 50, fonte: "empresa" });
    expect(lanc.beneficiario_id).toBe(vendedorId);
    expect(lanc.competencia).toMatch(/^\d{4}-\d{2}$/);
  });

  it("empresa sem override mas com modelo (30%) -> usa o pct do modelo", async () => {
    const lanc = await pagarPropostaEBuscarLancamento(empresaSemOverrideMasComModeloId, 1000);
    expect(lanc.valor).toBe(300);
    expect(lanc.regra).toMatchObject({ pct: 30, fonte: "modelo" });
  });

  it("empresa sem override nem modelo -> fallback 16%", async () => {
    const lanc = await pagarPropostaEBuscarLancamento(empresaSemNadaId, 1000);
    expect(lanc.valor).toBe(160);
    expect(lanc.regra).toMatchObject({ pct: 16, fonte: "fallback" });
  });
});

describe("G4.2 — marcar_apolice_emitida usa o mesmo % efetivo (não mais 16 fixo)", () => {
  it("empresa com perc_comissao=50, sem p_comissao_pct -> comissao_pct grava 50", async () => {
    const persona = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-apolice" });

    const { data: empresa, error: eEmp } = await admin
      .from("empresas")
      .insert({
        nome: uniq("Empresa apolice 50pct"),
        tipo: "pj",
        documento: uniqDoc(),
        status: "aprovada",
        perc_comissao: 50,
      })
      .select("id")
      .single();
    if (eEmp) throw eEmp;

    await admin.from("profiles").update({ empresa_id: empresa.id }).eq("id", persona.userId);

    const { data: proposta, error: eProp } = await admin
      .from("propostas")
      .insert({
        empresa_id: empresa.id,
        responsavel_id: persona.userId,
        status: "gerada",
        premio: 1000,
      })
      .select("id")
      .single();
    if (eProp) throw eProp;

    const { error: eRpc } = await persona.client.rpc("marcar_apolice_emitida", {
      p_proposta_id: proposta.id,
      p_apolice: "AP-" + uniq("teste"),
    });
    expect(eRpc).toBeNull();

    const { data: propostaAtualizada } = await admin
      .from("propostas")
      .select("comissao_pct, comissao_valor")
      .eq("id", proposta.id)
      .single();
    expect(propostaAtualizada?.comissao_pct).toBe(50);
    expect(propostaAtualizada?.comissao_valor).toBe(500);
  });
});

describe("G4.2 — índice único (proposta_id, tipo, beneficiario_id)", () => {
  it("permite crédito da MESMA proposta para 2 beneficiários diferentes", async () => {
    const persona = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-multi" });
    const master = await criarPersonaComEmpresa("master", { emailPrefix: "master-multi" });

    const { data: proposta, error: eProp } = await admin
      .from("propostas")
      .insert({
        empresa_id: persona.empresaId,
        responsavel_id: persona.userId,
        status: "gerada",
        comissao_valor: 100,
      })
      .select("id")
      .single();
    if (eProp) throw eProp;

    // Crédito automático do trigger (beneficiario_id = vendedor, via responsavel_id).
    const { error: ePago } = await admin
      .from("propostas")
      .update({ pago_em: new Date().toISOString() })
      .eq("id", proposta.id);
    expect(ePago).toBeNull();

    // Crédito adicional simulando um override de master na MESMA proposta —
    // inserido diretamente via admin (fixture; escrita autenticada normal segue
    // só pela RPC de ajuste / trigger, ver S3).
    const { error: eOverride } = await admin.from("comissao_lancamentos").insert({
      vendedor_id: persona.userId,
      beneficiario_id: master.userId,
      empresa_id: persona.empresaId,
      proposta_id: proposta.id,
      tipo: "credito",
      valor: 20,
      descricao: "Override master",
      origem: "auto",
      papel: "master",
    });
    expect(eOverride).toBeNull();

    const { data: lancamentos } = await admin
      .from("comissao_lancamentos")
      .select("beneficiario_id, valor")
      .eq("proposta_id", proposta.id)
      .eq("tipo", "credito");
    expect(lancamentos ?? []).toHaveLength(2);

    // Duplicar mesmo (proposta, tipo, beneficiario) falha.
    const { error: eDup } = await admin.from("comissao_lancamentos").insert({
      vendedor_id: persona.userId,
      beneficiario_id: master.userId,
      empresa_id: persona.empresaId,
      proposta_id: proposta.id,
      tipo: "credito",
      valor: 999,
      descricao: "Duplicata",
      origem: "auto",
    });
    expect(eDup).not.toBeNull();
  });
});

describe("G4.2 — view v_comissao_por_competencia", () => {
  it("saldo por competência bate com os lançamentos inseridos (ajuste manual)", async () => {
    const persona = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-view-comp" });
    const matriz = await loginMatriz();

    const { data: idCredito, error: eCred } = await matriz.rpc("lancar_ajuste_comissao", {
      p_vendedor: persona.userId,
      p_tipo: "credito",
      p_valor: 300,
      p_descricao: "ajuste view competencia",
    });
    expect(eCred).toBeNull();
    expect(idCredito).not.toBeNull();

    // Ajuste manual não passa pelo trigger; backfilla beneficiario_id/competencia
    // manualmente pra fixture representar o cenário pós-048 (RPC de ajuste em si
    // não seta essas colunas nesta fatia — ficará a cargo de fatia futura do
    // motor multinível se ajustes manuais também precisarem de beneficiario_id).
    await admin
      .from("comissao_lancamentos")
      .update({ beneficiario_id: persona.userId, competencia: "2026-07" })
      .eq("id", idCredito as string);

    const { data: view, error: eView } = await matriz
      .from("v_comissao_por_competencia")
      .select("saldo, total_creditos, total_debitos")
      .eq("beneficiario_id", persona.userId)
      .eq("competencia", "2026-07")
      .single();
    expect(eView).toBeNull();
    expect(view?.total_creditos).toBe(300);
    expect(view?.saldo).toBe(300);
  });
});

describe("G4.2 — fn_pct_comissao_efetivo não é exposta via RPC direta", () => {
  it("NEGATIVO: vendedor autenticado não consegue sondar o % de uma empresa alheia", async () => {
    // O % negociado por empresa é dado sensível protegido pela RLS de `empresas`
    // (empresas_visiveis). A função é security definer para uso INTERNO
    // (trigger/marcar_apolice_emitida); o execute foi revogado de
    // public/anon/authenticated — chamar via RPC direta deve falhar.
    const persona = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-sonda" });
    const { data: alvo, error: eAlvo } = await admin
      .from("empresas")
      .insert({
        nome: uniq("Empresa alheia sondada"),
        tipo: "pj",
        documento: uniqDoc(),
        status: "aprovada",
        perc_comissao: 42,
      })
      .select("id")
      .single();
    if (eAlvo) throw eAlvo;

    const { data, error } = await persona.client.rpc("fn_pct_comissao_efetivo", {
      p_empresa_id: alvo.id,
    });
    expect(error).not.toBeNull(); // permission denied for function
    expect(data).toBeNull();
  });
});
