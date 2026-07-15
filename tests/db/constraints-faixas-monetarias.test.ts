import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarEmpresa, uniq, uniqDoc } from "../helpers/supabase";

/**
 * D2 — faixas em valores monetários/percentuais.
 *
 * 20260715164134_d2_check_faixas_valores_monetarios.sql adiciona CHECK de
 * faixa (defesa em profundidade) em colunas monetárias/percentuais que hoje
 * só eram validadas no front/RPC:
 *   - comissao_lancamentos.valor        > 0
 *   - leads.valor                       >= 0
 *   - oportunidades.valor               >= 0
 *   - propostas.valor                   >= 0
 *   - propostas.premio                  >= 0
 *   - propostas.comissao_valor          >= 0
 *   - propostas.comissao_pct            0..100
 *   - cotacao_premios.premio            >= 0
 *   - modelos_franquia.perc_comissao_padrao  0..100
 *   - empresas.perc_comissao            0..100
 *
 * Usa `admin` (service_role) para inserir direto e testar somente o CHECK,
 * sem interferência de RLS. Código de violação de check esperado: 23514.
 *
 * `cotacao_premios.*` exige uma `cotacoes` (que por sua vez exige uma
 * `empresas`) — fixture montada em beforeAll. `propostas.*` exige apenas
 * `empresa_id`; sem `pago_em`/`cancelada_em` o trigger de sync de comissão
 * (038) não dispara, então o insert direto testa só o CHECK.
 */
describe("D2 — CHECK de faixa em colunas monetárias/percentuais", () => {
  let empresaId: string;
  let cotacaoId: string;
  let vendedorId: string;

  beforeAll(async () => {
    const emp = await criarEmpresa({ nome: uniq("Empresa D2") });
    empresaId = emp.id;

    const { data: cot, error: eCot } = await admin
      .from("cotacoes")
      .insert({ empresa_id: empresaId })
      .select("id")
      .single();
    if (eCot) throw eCot;
    cotacaoId = cot.id;

    const { data: user, error: eUser } = await admin.auth.admin.createUser({
      email: `${uniq("d2-cclanc-vend")}@teste.local`,
      password: "Teste@123!",
      email_confirm: true,
    });
    if (eUser || !user.user) throw eUser ?? new Error("falha ao criar vendedor de fixture");
    vendedorId = user.user.id;
  });

  it("comissao_lancamentos.valor: rejeita <= 0, aceita > 0", async () => {
    const { error: eNeg } = await admin.from("comissao_lancamentos").insert({
      vendedor_id: vendedorId,
      tipo: "credito",
      valor: -1,
      descricao: uniq("d2-cclanc-negativo"),
    });
    expect(eNeg?.code).toBe("23514");

    const { error: eZero } = await admin.from("comissao_lancamentos").insert({
      vendedor_id: vendedorId,
      tipo: "credito",
      valor: 0,
      descricao: uniq("d2-cclanc-zero"),
    });
    expect(eZero?.code).toBe("23514");

    const { error: eOk } = await admin.from("comissao_lancamentos").insert({
      vendedor_id: vendedorId,
      tipo: "credito",
      valor: 0.01,
      descricao: uniq("d2-cclanc-valido"),
    });
    expect(eOk).toBeNull();
  });

  it("leads.valor: rejeita negativo, aceita 0", async () => {
    const { error: eNeg } = await admin
      .from("leads")
      .insert({ empresa_id: empresaId, nome: uniq("d2-lead-neg"), valor: -1 });
    expect(eNeg?.code).toBe("23514");

    const { error: eOk } = await admin
      .from("leads")
      .insert({ empresa_id: empresaId, nome: uniq("d2-lead-ok"), valor: 0 });
    expect(eOk).toBeNull();
  });

  it("oportunidades.valor: rejeita negativo, aceita 0", async () => {
    const { error: eNeg } = await admin
      .from("oportunidades")
      .insert({ empresa_id: empresaId, valor: -1 });
    expect(eNeg?.code).toBe("23514");

    const { error: eOk } = await admin
      .from("oportunidades")
      .insert({ empresa_id: empresaId, valor: 0 });
    expect(eOk).toBeNull();
  });

  it("propostas.valor: rejeita negativo, aceita 0", async () => {
    const { error: eNeg } = await admin
      .from("propostas")
      .insert({ empresa_id: empresaId, valor: -1 });
    expect(eNeg?.code).toBe("23514");

    const { error: eOk } = await admin
      .from("propostas")
      .insert({ empresa_id: empresaId, valor: 0 });
    expect(eOk).toBeNull();
  });

  it("propostas.premio: rejeita negativo, aceita 0", async () => {
    const { error: eNeg } = await admin
      .from("propostas")
      .insert({ empresa_id: empresaId, premio: -1 });
    expect(eNeg?.code).toBe("23514");

    const { error: eOk } = await admin
      .from("propostas")
      .insert({ empresa_id: empresaId, premio: 0 });
    expect(eOk).toBeNull();
  });

  it("propostas.comissao_valor: rejeita negativo, aceita 0", async () => {
    const { error: eNeg } = await admin
      .from("propostas")
      .insert({ empresa_id: empresaId, comissao_valor: -1 });
    expect(eNeg?.code).toBe("23514");

    const { error: eOk } = await admin
      .from("propostas")
      .insert({ empresa_id: empresaId, comissao_valor: 0 });
    expect(eOk).toBeNull();
  });

  it("propostas.comissao_pct: rejeita fora de 0..100, aceita limites 0 e 100", async () => {
    const { error: eNeg } = await admin
      .from("propostas")
      .insert({ empresa_id: empresaId, comissao_pct: -1 });
    expect(eNeg?.code).toBe("23514");

    const { error: eAcima } = await admin
      .from("propostas")
      .insert({ empresa_id: empresaId, comissao_pct: 100.01 });
    expect(eAcima?.code).toBe("23514");

    const { error: eZero } = await admin
      .from("propostas")
      .insert({ empresa_id: empresaId, comissao_pct: 0 });
    expect(eZero).toBeNull();

    const { error: eCem } = await admin
      .from("propostas")
      .insert({ empresa_id: empresaId, comissao_pct: 100 });
    expect(eCem).toBeNull();
  });

  it("cotacao_premios.premio: rejeita negativo, aceita 0", async () => {
    const { error: eNeg } = await admin
      .from("cotacao_premios")
      .insert({ cotacao_id: cotacaoId, seguradora: uniq("Seg D2"), premio: -1 });
    expect(eNeg?.code).toBe("23514");

    const { error: eOk } = await admin
      .from("cotacao_premios")
      .insert({ cotacao_id: cotacaoId, seguradora: uniq("Seg D2"), premio: 0 });
    expect(eOk).toBeNull();
  });

  it("modelos_franquia.perc_comissao_padrao: rejeita fora de 0..100, aceita limites", async () => {
    const { error: eNeg } = await admin
      .from("modelos_franquia")
      .insert({ nome: uniq("Modelo D2 neg"), perc_comissao_padrao: -1 });
    expect(eNeg?.code).toBe("23514");

    const { error: eAcima } = await admin
      .from("modelos_franquia")
      .insert({ nome: uniq("Modelo D2 acima"), perc_comissao_padrao: 100.5 });
    expect(eAcima?.code).toBe("23514");

    const { error: eZero } = await admin
      .from("modelos_franquia")
      .insert({ nome: uniq("Modelo D2 zero"), perc_comissao_padrao: 0 });
    expect(eZero).toBeNull();

    const { error: eCem } = await admin
      .from("modelos_franquia")
      .insert({ nome: uniq("Modelo D2 cem"), perc_comissao_padrao: 100 });
    expect(eCem).toBeNull();
  });

  it("empresas.perc_comissao: rejeita fora de 0..100, aceita limites", async () => {
    const { error: eNeg } = await admin.from("empresas").insert({
      nome: uniq("Empresa D2 neg"),
      tipo: "pj",
      documento: uniqDoc(),
      perc_comissao: -1,
    });
    expect(eNeg?.code).toBe("23514");

    const { error: eAcima } = await admin.from("empresas").insert({
      nome: uniq("Empresa D2 acima"),
      tipo: "pj",
      documento: uniqDoc(),
      perc_comissao: 100.5,
    });
    expect(eAcima?.code).toBe("23514");

    const { error: eZero } = await admin.from("empresas").insert({
      nome: uniq("Empresa D2 zero"),
      tipo: "pj",
      documento: uniqDoc(),
      perc_comissao: 0,
    });
    expect(eZero).toBeNull();

    const { error: eCem } = await admin.from("empresas").insert({
      nome: uniq("Empresa D2 cem"),
      tipo: "pj",
      documento: uniqDoc(),
      perc_comissao: 100,
    });
    expect(eCem).toBeNull();
  });
});
