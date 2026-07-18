import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarPersonaComEmpresa, type Db } from "../helpers/supabase";

/**
 * G4.1 — RLS de `comissao_regras` e `campanhas_elite`.
 *
 * 20260718020617_g4_1_comissao_regras_campanhas.sql cria as duas tabelas:
 * leitura liberada para qualquer `authenticated` (as regras/faixas não são
 * segredo — telas de grupo mostram %), escrita só para `matriz`
 * (`has_role`). O shape do jsonb é validado por CHECK (padrão D4):
 * `jsonb_comissao_regras_ok` (parametros: objeto, valores de 1º nível
 * string/number não-negativo/boolean/array) e `jsonb_faixas_bonus_ok`
 * (faixas: array não-vazio de {minimo>=0, bonus_pct 0-100}).
 */
describe("G4.1 — comissao_regras / campanhas_elite", () => {
  let matriz: Db;
  let vendedor: Db;

  beforeAll(async () => {
    const m = await criarPersonaComEmpresa("matriz", { emailPrefix: "matriz-comregras" });
    matriz = m.client;

    const v = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vendedor-comregras" });
    vendedor = v.client;
  });

  it("seeds aplicados: 5 regras de comissão e 2 campanhas elite", async () => {
    const { data: regras, error: eRegras } = await admin
      .from("comissao_regras")
      .select("papel")
      .order("papel");
    expect(eRegras).toBeNull();
    expect(regras?.map((r) => r.papel).sort()).toEqual(
      ["franquia_full", "franquia_individual", "master", "supervisor", "vendedor_clt"].sort(),
    );

    const { data: campanhas, error: eCampanhas } = await admin
      .from("campanhas_elite")
      .select("tipo")
      .order("tipo");
    expect(eCampanhas).toBeNull();
    expect(campanhas?.map((c) => c.tipo).sort()).toEqual(
      ["elite_franqueado", "elite_master"].sort(),
    );
  });

  it("vendedor (authenticated) lê regras e campanhas", async () => {
    const { data: regras, error: eRegras } = await vendedor.from("comissao_regras").select("*");
    expect(eRegras).toBeNull();
    expect(regras?.length).toBeGreaterThan(0);

    const { data: campanhas, error: eCampanhas } = await vendedor
      .from("campanhas_elite")
      .select("*");
    expect(eCampanhas).toBeNull();
    expect(campanhas?.length).toBeGreaterThan(0);
  });

  it("vendedor NÃO consegue insert/update em comissao_regras nem campanhas_elite", async () => {
    const { error: eUpdateRegra } = await vendedor
      .from("comissao_regras")
      .update({ descricao: "hackeado" })
      .eq("papel", "vendedor_clt");
    // RLS bloqueia: 0 linhas afetadas (update sem erro, mas sem efeito) ou erro de policy.
    expect(eUpdateRegra).toBeNull();
    const { data: confereRegra } = await admin
      .from("comissao_regras")
      .select("descricao")
      .eq("papel", "vendedor_clt")
      .single();
    expect(confereRegra?.descricao).not.toBe("hackeado");

    const { error: eInsertRegra } = await vendedor.from("comissao_regras").insert({
      papel: "vendedor_clt",
      parametros: {},
    } as never);
    expect(eInsertRegra).not.toBeNull();

    const { error: eUpdateCampanha } = await vendedor
      .from("campanhas_elite")
      .update({ ativa: false })
      .eq("tipo", "elite_master");
    expect(eUpdateCampanha).toBeNull();
    const { data: confereCampanha } = await admin
      .from("campanhas_elite")
      .select("ativa")
      .eq("tipo", "elite_master")
      .single();
    expect(confereCampanha?.ativa).toBe(true);

    const { error: eInsertCampanha } = await vendedor.from("campanhas_elite").insert({
      nome: "hack",
      tipo: "elite_master",
      faixas: [{ minimo: 1, bonus_pct: 1 }],
    } as never);
    expect(eInsertCampanha).not.toBeNull();
  });

  it("matriz consegue update em comissao_regras e campanhas_elite", async () => {
    const { error: eUpdateRegra } = await matriz
      .from("comissao_regras")
      .update({ parametros: { fonte: "clt_config", estorno_dias: 60 } })
      .eq("papel", "vendedor_clt");
    expect(eUpdateRegra).toBeNull();

    const { data: confereRegra } = await admin
      .from("comissao_regras")
      .select("parametros")
      .eq("papel", "vendedor_clt")
      .single();
    expect((confereRegra?.parametros as { estorno_dias: number }).estorno_dias).toBe(60);

    // restaura
    await admin
      .from("comissao_regras")
      .update({ parametros: { fonte: "clt_config", estorno_dias: 90 } })
      .eq("papel", "vendedor_clt");

    const { error: eUpdateCampanha } = await matriz
      .from("campanhas_elite")
      .update({ periodo: "semestral" })
      .eq("tipo", "elite_franqueado");
    expect(eUpdateCampanha).toBeNull();

    const { data: confereCampanha } = await admin
      .from("campanhas_elite")
      .select("periodo")
      .eq("tipo", "elite_franqueado")
      .single();
    expect(confereCampanha?.periodo).toBe("semestral");

    // restaura
    await admin
      .from("campanhas_elite")
      .update({ periodo: "trimestral" })
      .eq("tipo", "elite_franqueado");
  });

  it("CHECK jsonb rejeita parametros/faixas fora do shape", async () => {
    // comissao_regras.parametros: número negativo no 1º nível é inválido
    const { error: eNegativo } = await admin
      .from("comissao_regras")
      .update({ parametros: { estorno_dias: -1 } })
      .eq("papel", "vendedor_clt");
    expect(eNegativo?.code).toBe("23514");

    // comissao_regras.parametros: escalar (não-objeto) é inválido
    const { error: eEscalar } = await admin
      .from("comissao_regras")
      .update({ parametros: "não é objeto" } as never)
      .eq("papel", "vendedor_clt");
    expect(eEscalar?.code).toBe("23514");

    // restaura
    await admin
      .from("comissao_regras")
      .update({ parametros: { fonte: "clt_config", estorno_dias: 90 } })
      .eq("papel", "vendedor_clt");

    // campanhas_elite.faixas: não-array é inválido
    const { error: eFaixasNaoArray } = await admin
      .from("campanhas_elite")
      .update({ faixas: { minimo: 1, bonus_pct: 1 } } as never)
      .eq("tipo", "elite_master");
    expect(eFaixasNaoArray?.code).toBe("23514");

    // campanhas_elite.faixas: bonus_pct fora de 0-100 é inválido
    const { error: eBonusForaDeFaixa } = await admin
      .from("campanhas_elite")
      .update({ faixas: [{ minimo: 1, bonus_pct: 150 }] })
      .eq("tipo", "elite_master");
    expect(eBonusForaDeFaixa?.code).toBe("23514");

    // campanhas_elite.faixas: array vazio é inválido
    const { error: eVazio } = await admin
      .from("campanhas_elite")
      .update({ faixas: [] })
      .eq("tipo", "elite_master");
    expect(eVazio?.code).toBe("23514");
  });
});
