import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarPersonaComEmpresa, uniq, type Db } from "../helpers/supabase";

/**
 * S-crítica — master tinha acesso IRRESTRITO (sem escopo de rede) em 12 tabelas
 * via has_role(auth.uid(),'master') solto (sem filtro de empresas_visiveis()).
 * Corrigido em 20260721150000_s_fix_master_rls_escopo_rede.sql.
 *
 * Monta 2 redes independentes, cada uma com Master + vendedor + proposta +
 * cotação (com as 6 tabelas-filha) + lead (+ evento) + meta + login_audit.
 * Confirma que Master A não enxerga nada da rede B nas 12 tabelas, mas
 * continua enxergando a própria rede (não regressão).
 */
describe("S-crítica — master escopado por empresas_visiveis() em 12 tabelas", () => {
  let masterA: Db;
  let masterB: Db;

  let empresaA: string;
  let empresaB: string;

  let vendedorAId: string;
  let vendedorBId: string;

  let propostaA: string;
  let propostaB: string;
  let cotacaoA: string;
  let cotacaoB: string;
  let leadA: string;
  let leadB: string;
  let metaEmpresaA: string;
  let metaEmpresaB: string;

  beforeAll(async () => {
    const mA = await criarPersonaComEmpresa("master", { emailPrefix: "master-rede-a" });
    masterA = mA.client;
    empresaA = mA.empresaId;

    const mB = await criarPersonaComEmpresa("master", { emailPrefix: "master-rede-b" });
    masterB = mB.client;
    empresaB = mB.empresaId;

    const vA = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaA,
      emailPrefix: "vend-rede-a",
      superiorId: mA.userId,
    });
    vendedorAId = vA.userId;

    const vB = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaB,
      emailPrefix: "vend-rede-b",
      superiorId: mB.userId,
    });
    vendedorBId = vB.userId;

    // cotações + tabelas-filha
    const { data: cotA, error: eCotA } = await admin
      .from("cotacoes")
      .insert({ empresa_id: empresaA, responsavel_id: vendedorAId })
      .select("id")
      .single();
    if (eCotA) throw eCotA;
    cotacaoA = cotA.id;

    const { data: cotB, error: eCotB } = await admin
      .from("cotacoes")
      .insert({ empresa_id: empresaB, responsavel_id: vendedorBId })
      .select("id")
      .single();
    if (eCotB) throw eCotB;
    cotacaoB = cotB.id;

    for (const [cotId] of [[cotacaoA], [cotacaoB]]) {
      const { error: eSeg } = await admin
        .from("cotacao_segurado")
        .insert({ cotacao_id: cotId, nome: "Segurado Teste" });
      if (eSeg) throw eSeg;
      const { error: eVei } = await admin
        .from("cotacao_veiculo")
        .insert({ cotacao_id: cotId, marca_nome: "FIAT", modelo_nome: "UNO" });
      if (eVei) throw eVei;
      const { error: eCob } = await admin.from("cotacao_coberturas").insert({ cotacao_id: cotId });
      if (eCob) throw eCob;
      const { error: ePerfil } = await admin.from("cotacao_perfil").insert({ cotacao_id: cotId });
      if (ePerfil) throw ePerfil;
      const { error: ePremio } = await admin
        .from("cotacao_premios")
        .insert({ cotacao_id: cotId, seguradora: "Seguradora Teste" });
      if (ePremio) throw ePremio;
      const { error: eSeguro } = await admin.from("cotacao_seguro").insert({ cotacao_id: cotId });
      if (eSeguro) throw eSeguro;
    }

    // propostas + proposta_versoes
    const { data: propA, error: ePropA } = await admin
      .from("propostas")
      .insert({ empresa_id: empresaA, responsavel_id: vendedorAId, cotacao_id: cotacaoA })
      .select("id")
      .single();
    if (ePropA) throw ePropA;
    propostaA = propA.id;

    const { data: propB, error: ePropB } = await admin
      .from("propostas")
      .insert({ empresa_id: empresaB, responsavel_id: vendedorBId, cotacao_id: cotacaoB })
      .select("id")
      .single();
    if (ePropB) throw ePropB;
    propostaB = propB.id;

    const { error: eVersA } = await admin
      .from("proposta_versoes")
      .insert({ proposta_id: propostaA, versao: 1, nota: "versão A", criado_por: vendedorAId });
    if (eVersA) throw eVersA;
    const { error: eVersB } = await admin
      .from("proposta_versoes")
      .insert({ proposta_id: propostaB, versao: 1, nota: "versão B", criado_por: vendedorBId });
    if (eVersB) throw eVersB;

    // leads + eventos
    const { data: ldA, error: eLdA } = await admin
      .from("leads")
      .insert({
        nome: uniq("Lead Rede A"),
        origem: "teste",
        empresa_id: empresaA,
        responsavel_id: vendedorAId,
      })
      .select("id")
      .single();
    if (eLdA) throw eLdA;
    leadA = ldA.id;

    const { data: ldB, error: eLdB } = await admin
      .from("leads")
      .insert({
        nome: uniq("Lead Rede B"),
        origem: "teste",
        empresa_id: empresaB,
        responsavel_id: vendedorBId,
      })
      .select("id")
      .single();
    if (eLdB) throw eLdB;
    leadB = ldB.id;

    await admin
      .from("lead_eventos")
      .insert({ lead_id: leadA, tipo: "nota", titulo: "Evento A", descricao: "evento rede A" });
    await admin
      .from("lead_eventos")
      .insert({ lead_id: leadB, tipo: "nota", titulo: "Evento B", descricao: "evento rede B" });

    // login_audit
    await admin
      .from("login_audit")
      .insert({ email: "vend-rede-a@teste.local", user_id: vendedorAId, sucesso: true });
    await admin
      .from("login_audit")
      .insert({ email: "vend-rede-b@teste.local", user_id: vendedorBId, sucesso: true });

    // metas (escopo empresa)
    const { data: metaA, error: eMetaA } = await admin
      .from("metas")
      .insert({ escopo: "empresa", ref_id: empresaA, ano: 2026, mes: 1, meta_vendas: 10 })
      .select("id")
      .single();
    if (eMetaA) throw eMetaA;
    metaEmpresaA = metaA.id;

    const { data: metaB, error: eMetaB } = await admin
      .from("metas")
      .insert({ escopo: "empresa", ref_id: empresaB, ano: 2026, mes: 1, meta_vendas: 20 })
      .select("id")
      .single();
    if (eMetaB) throw eMetaB;
    metaEmpresaB = metaB.id;
  });

  it("NEGATIVO: master A não vê propostas/cotações/tabelas-filha da rede B", async () => {
    const { data: prop } = await masterA.from("propostas").select("id").eq("id", propostaB);
    expect(prop ?? []).toHaveLength(0);

    const { data: cot } = await masterA.from("cotacoes").select("id").eq("id", cotacaoB);
    expect(cot ?? []).toHaveLength(0);

    const filhas = [
      "cotacao_coberturas",
      "cotacao_perfil",
      "cotacao_premios",
      "cotacao_segurado",
      "cotacao_seguro",
      "cotacao_veiculo",
    ] as const;
    for (const tabela of filhas) {
      const { data } = await masterA.from(tabela).select("cotacao_id").eq("cotacao_id", cotacaoB);
      expect(data ?? [], `master A não deve ver ${tabela} da rede B`).toHaveLength(0);
    }

    const { data: versB } = await masterA
      .from("proposta_versoes")
      .select("id")
      .eq("proposta_id", propostaB);
    expect(versB ?? []).toHaveLength(0);
  });

  it("NEGATIVO: master A não vê lead_eventos/login_audit/metas da rede B", async () => {
    const { data: evB } = await masterA.from("lead_eventos").select("id").eq("lead_id", leadB);
    expect(evB ?? []).toHaveLength(0);

    const { data: laB } = await masterA.from("login_audit").select("id").eq("user_id", vendedorBId);
    expect(laB ?? []).toHaveLength(0);

    // metas_select também foi corrigido (20260721160000_s_fix_metas_select_escopo.sql):
    // master A não deve mais enxergar a meta da empresa B.
    const { data: metaB } = await masterA.from("metas").select("id").eq("id", metaEmpresaB);
    expect(metaB ?? []).toHaveLength(0);

    const { data: upd, error: eUpd } = await masterA
      .from("metas")
      .update({ meta_vendas: 999 })
      .eq("id", metaEmpresaB)
      .select("id");
    expect(eUpd).toBeNull();
    expect(upd ?? []).toHaveLength(0);
    const { data: real } = await admin
      .from("metas")
      .select("meta_vendas")
      .eq("id", metaEmpresaB)
      .single();
    expect(real?.meta_vendas).toBe(20);
  });

  it("POSITIVO (não regressão): master A continua vendo tudo da própria rede A nas 12 tabelas", async () => {
    const { data: prop } = await masterA.from("propostas").select("id").eq("id", propostaA);
    expect(prop ?? []).toHaveLength(1);

    const { data: cot } = await masterA.from("cotacoes").select("id").eq("id", cotacaoA);
    expect(cot ?? []).toHaveLength(1);

    const filhas = [
      "cotacao_coberturas",
      "cotacao_perfil",
      "cotacao_premios",
      "cotacao_segurado",
      "cotacao_seguro",
      "cotacao_veiculo",
    ] as const;
    for (const tabela of filhas) {
      const { data } = await masterA.from(tabela).select("cotacao_id").eq("cotacao_id", cotacaoA);
      expect(data ?? [], `master A deve ver ${tabela} da própria rede`).toHaveLength(1);
    }

    const { data: versA } = await masterA
      .from("proposta_versoes")
      .select("id")
      .eq("proposta_id", propostaA);
    expect(versA ?? []).toHaveLength(1);

    const { data: evA } = await masterA.from("lead_eventos").select("id").eq("lead_id", leadA);
    expect(evA ?? []).toHaveLength(1);

    const { data: laA } = await masterA.from("login_audit").select("id").eq("user_id", vendedorAId);
    expect(laA ?? []).toHaveLength(1);

    const { data: metaA } = await masterA.from("metas").select("id").eq("id", metaEmpresaA);
    expect(metaA ?? []).toHaveLength(1);
  });
});
