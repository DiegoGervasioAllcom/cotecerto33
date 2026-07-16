import { describe, it, expect } from "vitest";
import { admin, uniq, uniqDoc } from "../helpers/supabase";

/**
 * D4 — validação de schema dos jsonb.
 *
 * 20260716033627_d4_jsonb_schema.sql adiciona CHECKs (defesa em profundidade)
 * ao shape de colunas jsonb hoje só validadas pelo front:
 *   - clt_config: progressiva/fator_novas/fator_remalho/seguradora_planos/
 *     seguradora_adic devem ser array de pares [string, string]
 *     (`jsonb_is_pair_array`); regras deve ter apuracao_ini/apuracao_fim/
 *     pagamento/iof como string e rules como array quando presentes
 *     (`jsonb_clt_regras_ok`).
 *   - distribuicao_config.criterios: regiao/franquia/disp/conv/volume/horario
 *     devem ser boolean quando presentes (`jsonb_criterios_ok`).
 *   - modelos_franquia.params, empresas.dados_cadastro, leads.dados,
 *     lead_eventos.meta, presence_eventos.meta: pelo menos objeto
 *     (não escalar, não array). Colunas nullable seguem nullable.
 *
 * Chaves ausentes/extras não invalidam — só o tipo das chaves conhecidas
 * PRESENTES é checado. Usa `admin` (service_role), sem interferência de RLS.
 */
describe("D4 — CHECK de schema dos jsonb", () => {
  it("clt_config: colunas de faixa [rótulo, valor]", async () => {
    const campos = [
      "progressiva",
      "fator_novas",
      "fator_remalho",
      "seguradora_planos",
      "seguradora_adic",
    ] as const;

    for (const col of campos) {
      // válido: array de pares de string (e array vazio, o default)
      const { error: eValidoPar } = await admin
        .from("clt_config")
        .update({ [col]: [["0", "10"]] } as never)
        .eq("id", "default");
      expect(eValidoPar, `${col} par de strings`).toBeNull();

      const { error: eValidoVazio } = await admin
        .from("clt_config")
        .update({ [col]: [] } as never)
        .eq("id", "default");
      expect(eValidoVazio, `${col} array vazio`).toBeNull();

      // inválido: escalar
      const { error: eEscalar } = await admin
        .from("clt_config")
        .update({ [col]: "não é array" } as never)
        .eq("id", "default");
      expect(eEscalar?.code, `${col} escalar`).toBe("23514");

      // inválido: elemento com 1 só item
      const { error: eUmItem } = await admin
        .from("clt_config")
        .update({ [col]: [["só-um"]] } as never)
        .eq("id", "default");
      expect(eUmItem?.code, `${col} elemento com 1 item`).toBe("23514");

      // inválido: elemento com item não-string
      const { error: eNaoString } = await admin
        .from("clt_config")
        .update({ [col]: [[1, 2]] } as never)
        .eq("id", "default");
      expect(eNaoString?.code, `${col} elemento não-string`).toBe("23514");
    }

    // restaura para não vazar estado entre `it`s (default do seed)
    await admin
      .from("clt_config")
      .update({
        progressiva: [],
        fator_novas: [],
        fator_remalho: [],
        seguradora_planos: [],
        seguradora_adic: [],
      } as never)
      .eq("id", "default");
  });

  it("clt_config.regras: shape das chaves conhecidas", async () => {
    const { error: eValido } = await admin
      .from("clt_config")
      .update({ regras: { iof: "7,38%" } } as never)
      .eq("id", "default");
    expect(eValido, "regras.iof string").toBeNull();

    const { error: eVazio } = await admin
      .from("clt_config")
      .update({ regras: {} } as never)
      .eq("id", "default");
    expect(eVazio, "regras vazio").toBeNull();

    const { error: eIofNumero } = await admin
      .from("clt_config")
      .update({ regras: { iof: 738 } } as never)
      .eq("id", "default");
    expect(eIofNumero?.code, "regras.iof numérico").toBe("23514");

    const { error: eRulesObjeto } = await admin
      .from("clt_config")
      .update({ regras: { rules: { a: 1 } } } as never)
      .eq("id", "default");
    expect(eRulesObjeto?.code, "regras.rules não-array").toBe("23514");

    // restaura
    await admin
      .from("clt_config")
      .update({ regras: {} } as never)
      .eq("id", "default");
  });

  it("distribuicao_config.criterios: shape das chaves conhecidas", async () => {
    const { error: eValido } = await admin
      .from("distribuicao_config")
      .update({ criterios: { regiao: true } } as never)
      .eq("id", "default");
    expect(eValido, "criterios.regiao boolean").toBeNull();

    const { error: eInvalido } = await admin
      .from("distribuicao_config")
      .update({ criterios: { regiao: "sim" } } as never)
      .eq("id", "default");
    expect(eInvalido?.code, "criterios.regiao string").toBe("23514");

    // restaura para o default
    await admin
      .from("distribuicao_config")
      .update({
        criterios: {
          regiao: true,
          franquia: true,
          disp: true,
          conv: true,
          volume: true,
          horario: false,
        },
      } as never)
      .eq("id", "default");
  });

  it("modelos_franquia.params: exige objeto", async () => {
    const base = {
      nome: uniq("D4 modelo"),
      tipo: "franqueada" as const,
      perc_comissao_padrao: 10,
    };

    const { error: eEscalar } = await admin
      .from("modelos_franquia")
      .insert({ ...base, params: "txt" } as never);
    expect(eEscalar?.code, "params escalar").toBe("23514");

    const { error: eArray } = await admin
      .from("modelos_franquia")
      .insert({ ...base, params: [] } as never);
    expect(eArray?.code, "params array").toBe("23514");

    const { error: eVazio } = await admin
      .from("modelos_franquia")
      .insert({ ...base, params: {} } as never);
    expect(eVazio, "params objeto vazio").toBeNull();
  });

  it("empresas.dados_cadastro: exige objeto", async () => {
    const { error: eEscalar } = await admin.from("empresas").insert({
      nome: uniq("D4 emp"),
      tipo: "pj",
      documento: uniqDoc(),
      dados_cadastro: "txt",
    } as never);
    expect(eEscalar?.code, "dados_cadastro escalar").toBe("23514");

    const { error: eVazio } = await admin.from("empresas").insert({
      nome: uniq("D4 emp"),
      tipo: "pj",
      documento: uniqDoc(),
      dados_cadastro: {},
    } as never);
    expect(eVazio, "dados_cadastro objeto vazio").toBeNull();
  });

  it("leads.dados: nullable, exige objeto quando presente", async () => {
    const { error: eNulo } = await admin
      .from("leads")
      .insert({ nome: uniq("D4 lead"), dados: null } as never);
    expect(eNulo, "dados null").toBeNull();

    const { error: eArray } = await admin
      .from("leads")
      .insert({ nome: uniq("D4 lead"), dados: [1, 2] } as never);
    expect(eArray?.code, "dados array").toBe("23514");

    const { error: eObjeto } = await admin
      .from("leads")
      .insert({ nome: uniq("D4 lead"), dados: { origem: "site" } } as never);
    expect(eObjeto, "dados objeto").toBeNull();
  });

  it("lead_eventos.meta: exige objeto", async () => {
    const { data: lead } = await admin
      .from("leads")
      .insert({ nome: uniq("D4 lead evento") } as never)
      .select("id")
      .single();
    const leadId = (lead as { id: string }).id;

    const { error: eEscalar } = await admin.from("lead_eventos").insert({
      lead_id: leadId,
      tipo: "teste",
      titulo: "teste",
      meta: "txt",
    } as never);
    expect(eEscalar?.code, "meta escalar").toBe("23514");

    const { error: eVazio } = await admin.from("lead_eventos").insert({
      lead_id: leadId,
      tipo: "teste",
      titulo: "teste",
      meta: {},
    } as never);
    expect(eVazio, "meta objeto vazio").toBeNull();
  });

  it("presence_eventos.meta: nullable, exige objeto quando presente", async () => {
    const { data: userRow } = await admin.from("profiles").select("id").limit(1).single();
    const userId = (userRow as { id: string }).id;

    const { error: eNulo } = await admin.from("presence_eventos").insert({
      user_id: userId,
      tipo: "entrou",
      meta: null,
    } as never);
    expect(eNulo, "meta null").toBeNull();

    const { error: eArray } = await admin.from("presence_eventos").insert({
      user_id: userId,
      tipo: "entrou",
      meta: [1, 2],
    } as never);
    expect(eArray?.code, "meta array").toBe("23514");

    const { error: eObjeto } = await admin.from("presence_eventos").insert({
      user_id: userId,
      tipo: "entrou",
      meta: { ip: "127.0.0.1" },
    } as never);
    expect(eObjeto, "meta objeto").toBeNull();
  });
});
