import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarPersonaComEmpresa, criarEmpresa, uniq, type Db } from "../helpers/supabase";

/**
 * V11.I.1 + V11.I.2 — escopo de leitura do time de apoio (Marketing /
 * Assistente Comercial), migration 20260804120000_v11_i_escopo_interno_matriz.sql.
 *
 * Decisão da Lis (03/08): `interno` vê a operação PRÓPRIA da Matriz (empresa
 * com `tipo='matriz'`) — nunca rede externa (Master, Individual, Full). Sem
 * escrita além do que os presets já dão.
 *
 * Monta 4 empresas: a Matriz (seedada, `tipo='matriz'`, única) + Master +
 * Individual + Full — cada uma com lead/oportunidade/cliente/proposta/cotação
 * (+ 6 tabelas-filha)/canal próprio/lançamento de comissão/premiação. `interno`
 * (Marketing) tem sua PRÓPRIA empresa (o "shell" pessoal que o fluxo de
 * convite cria pra qualquer pessoa aprovada — não é a empresa da Matriz).
 */
describe("V11.I — escopo de leitura do interno (Marketing/Assistente) na Matriz", () => {
  let matrizEmpresaId: string;
  let interno: Db;
  let internoId: string;

  type Rede = {
    label: string;
    empresaId: string;
    vendedorId: string;
    leadId: string;
    clienteId: string;
    oportunidadeId: string;
    cotacaoId: string;
    propostaId: string;
    canalId: string;
    comissaoLancId: string;
    premiacaoLancId: string;
  };
  const redes: Record<"matriz" | "master" | "individual" | "full", Rede> = {} as never;

  async function montarRede(label: string, empresaId: string, vendedorId: string): Promise<Rede> {
    const { data: lead, error: eLead } = await admin
      .from("leads")
      .insert({
        nome: uniq(`Lead ${label}`),
        origem: "teste",
        empresa_id: empresaId,
        responsavel_id: vendedorId,
      })
      .select("id")
      .single();
    if (eLead) throw eLead;

    const { data: cliente, error: eCliente } = await admin
      .from("clientes")
      .insert({ nome: uniq(`Cliente ${label}`), empresa_id: empresaId })
      .select("id")
      .single();
    if (eCliente) throw eCliente;

    const { data: oport, error: eOport } = await admin
      .from("oportunidades")
      .insert({ empresa_id: empresaId, lead_id: lead.id, responsavel_id: vendedorId, valor: 100 })
      .select("id")
      .single();
    if (eOport) throw eOport;

    const { data: cot, error: eCot } = await admin
      .from("cotacoes")
      .insert({ empresa_id: empresaId, responsavel_id: vendedorId })
      .select("id")
      .single();
    if (eCot) throw eCot;

    type TabelaFilha =
      | "cotacao_segurado"
      | "cotacao_veiculo"
      | "cotacao_coberturas"
      | "cotacao_perfil"
      | "cotacao_premios"
      | "cotacao_seguro";
    const filhas: Array<[TabelaFilha, Record<string, unknown>]> = [
      ["cotacao_segurado", { nome: `Segurado ${label}` }],
      ["cotacao_veiculo", { marca_nome: "FIAT", modelo_nome: "UNO" }],
      ["cotacao_coberturas", {}],
      ["cotacao_perfil", {}],
      ["cotacao_premios", { seguradora: `Seguradora ${label}` }],
      ["cotacao_seguro", {}],
    ];
    for (const [tabela, extra] of filhas) {
      const { error } = await admin.from(tabela).insert({ cotacao_id: cot.id, ...extra });
      if (error) throw new Error(`${tabela} (${label}): ${error.message}`);
    }

    const { data: prop, error: eProp } = await admin
      .from("propostas")
      .insert({ empresa_id: empresaId, responsavel_id: vendedorId, cotacao_id: cot.id })
      .select("id")
      .single();
    if (eProp) throw eProp;

    const { data: canal, error: eCanal } = await admin
      .from("canais")
      .insert({ nome: uniq(`Canal ${label}`), tipo: "manual", empresa_id: empresaId })
      .select("id")
      .single();
    if (eCanal) throw eCanal;

    const { data: cclanc, error: eCclanc } = await admin
      .from("comissao_lancamentos")
      .insert({
        empresa_id: empresaId,
        vendedor_id: vendedorId,
        beneficiario_id: vendedorId,
        tipo: "credito",
        origem: "teste",
        valor: 50,
        competencia: "2031-01",
        descricao: `Comissão teste ${label}`,
      })
      .select("id")
      .single();
    if (eCclanc) throw new Error(`comissao_lancamentos (${label}): ${eCclanc.message}`);

    const { data: campanha, error: eCampanha } = await admin
      .from("premiacao_campanhas")
      .insert({ nome: uniq(`Campanha ${label}`) })
      .select("id")
      .single();
    if (eCampanha) throw eCampanha;

    const { data: premlanc, error: ePremlanc } = await admin
      .from("premiacao_lancamentos")
      .insert({
        campanha_id: campanha.id,
        vendedor_id: vendedorId,
        empresa_id: empresaId,
        competencia: "2031-01",
        valor: 30,
      })
      .select("id")
      .single();
    if (ePremlanc) throw ePremlanc;

    return {
      label,
      empresaId,
      vendedorId,
      leadId: lead.id,
      clienteId: cliente.id,
      oportunidadeId: oport.id,
      cotacaoId: cot.id,
      propostaId: prop.id,
      canalId: canal.id,
      comissaoLancId: cclanc.id,
      premiacaoLancId: premlanc.id,
    };
  }

  beforeAll(async () => {
    const { data: matrizEmp, error } = await admin
      .from("empresas")
      .select("id")
      .eq("tipo", "matriz")
      .single();
    if (error) throw error;
    matrizEmpresaId = matrizEmp.id;

    // Vendedor "Matriz" (empresa_id = a própria Matriz — CLT da operação
    // própria, é o dado que interno deveria ver).
    const vendMatriz = await criarPersonaComEmpresa("vendedor", {
      empresaId: matrizEmpresaId,
      emailPrefix: "vend-matriz",
    });
    redes.matriz = await montarRede("Matriz", matrizEmpresaId, vendMatriz.userId);

    // Master, Individual e Full — 3 redes externas distintas, nenhuma delas
    // deve aparecer pro interno.
    const master = await criarPersonaComEmpresa("master", { emailPrefix: "master-esc" });
    redes.master = await montarRede("Master", master.empresaId, master.userId);

    const individual = await criarPersonaComEmpresa("franqueado", {
      emailPrefix: "franq-individual-esc",
    });
    redes.individual = await montarRede("Individual", individual.empresaId, individual.userId);

    const fullEmpresa = await criarEmpresa({ nome: uniq("Franquia Full") });
    const full = await criarPersonaComEmpresa("franqueado", {
      empresaId: fullEmpresa.id,
      emailPrefix: "franq-full-esc",
    });
    redes.full = await montarRede("Full", full.empresaId, full.userId);

    // `interno` (Marketing): a própria empresa é um shell pessoal, igual ao
    // que `cadastrar_franquia_admin` cria pra qualquer pessoa aprovada — não é
    // a empresa da Matriz. É essa distinção que faz o gap existir.
    const pInterno = await criarPersonaComEmpresa("interno", { emailPrefix: "interno-mkt" });
    interno = pInterno.client;
    internoId = pInterno.userId;
    await admin.from("profiles").update({ cargo_id: "marketing" }).eq("id", internoId);
  });

  it("POSITIVO: interno vê leads/clientes/oportunidades/propostas/cotações da Matriz", async () => {
    const r = redes.matriz;

    const { data: lead } = await interno.from("leads").select("id").eq("id", r.leadId);
    expect(lead ?? [], "lead da Matriz").toHaveLength(1);

    const { data: cliente } = await interno.from("clientes").select("id").eq("id", r.clienteId);
    expect(cliente ?? [], "cliente da Matriz").toHaveLength(1);

    const { data: oport } = await interno
      .from("oportunidades")
      .select("id")
      .eq("id", r.oportunidadeId);
    expect(oport ?? [], "oportunidade da Matriz").toHaveLength(1);

    const { data: prop } = await interno.from("propostas").select("id").eq("id", r.propostaId);
    expect(prop ?? [], "proposta da Matriz").toHaveLength(1);

    const { data: cot } = await interno.from("cotacoes").select("id").eq("id", r.cotacaoId);
    expect(cot ?? [], "cotação da Matriz (pré-requisito do embed em vendas/pipeline)").toHaveLength(
      1,
    );

    const filhas = [
      "cotacao_coberturas",
      "cotacao_perfil",
      "cotacao_premios",
      "cotacao_segurado",
      "cotacao_seguro",
      "cotacao_veiculo",
    ] as const;
    for (const tabela of filhas) {
      const { data } = await interno
        .from(tabela)
        .select("cotacao_id")
        .eq("cotacao_id", r.cotacaoId);
      expect(data ?? [], `${tabela} da Matriz`).toHaveLength(1);
    }

    const { data: canal } = await interno.from("canais").select("id").eq("id", r.canalId);
    expect(canal ?? [], "canal próprio da Matriz").toHaveLength(1);

    const { data: comissao } = await interno
      .from("comissao_lancamentos")
      .select("id")
      .eq("id", r.comissaoLancId);
    expect(comissao ?? [], "lançamento de comissão da Matriz").toHaveLength(1);

    // A view agrupa por (beneficiario_id, competencia, empresa_id) — filtrar só
    // por empresa_id+competencia não é único (outros testes/redes podem gravar
    // na mesma competência), então soma beneficiario_id pra isolar esta rede.
    const { data: vComissao } = await interno
      .from("v_comissao_por_competencia")
      .select("empresa_id")
      .eq("empresa_id", matrizEmpresaId)
      .eq("competencia", "2031-01")
      .eq("beneficiario_id", redes.matriz.vendedorId);
    expect(vComissao ?? [], "v_comissao_por_competencia da Matriz").toHaveLength(1);

    const { data: premiacao } = await interno
      .from("premiacao_lancamentos")
      .select("id")
      .eq("id", r.premiacaoLancId);
    expect(premiacao ?? [], "lançamento de premiação da Matriz").toHaveLength(1);
  });

  it("NEGATIVO: interno NÃO vê dado de Master, Individual nem Full", async () => {
    type TabelaComId =
      | "leads"
      | "clientes"
      | "oportunidades"
      | "propostas"
      | "cotacoes"
      | "canais"
      | "comissao_lancamentos"
      | "premiacao_lancamentos";
    const tabelasComId: Array<[TabelaComId, keyof Rede]> = [
      ["leads", "leadId"],
      ["clientes", "clienteId"],
      ["oportunidades", "oportunidadeId"],
      ["propostas", "propostaId"],
      ["cotacoes", "cotacaoId"],
      ["canais", "canalId"],
      ["comissao_lancamentos", "comissaoLancId"],
      ["premiacao_lancamentos", "premiacaoLancId"],
    ];
    for (const redeKey of ["master", "individual", "full"] as const) {
      const r = redes[redeKey];
      for (const [tabela, campo] of tabelasComId) {
        const { data } = await interno
          .from(tabela)
          .select("id")
          .eq("id", r[campo] as string);
        expect(data ?? [], `interno não deve ver ${tabela} de ${r.label}`).toHaveLength(0);
      }

      const filhas = [
        "cotacao_coberturas",
        "cotacao_perfil",
        "cotacao_premios",
        "cotacao_segurado",
        "cotacao_seguro",
        "cotacao_veiculo",
      ] as const;
      for (const tabela of filhas) {
        const { data } = await interno
          .from(tabela)
          .select("cotacao_id")
          .eq("cotacao_id", r.cotacaoId);
        expect(data ?? [], `interno não deve ver ${tabela} de ${r.label}`).toHaveLength(0);
      }

      const { data: vComissao } = await interno
        .from("v_comissao_por_competencia")
        .select("empresa_id")
        .eq("empresa_id", r.empresaId)
        .eq("competencia", "2031-01");
      expect(
        vComissao ?? [],
        `interno não deve ver v_comissao_por_competencia de ${r.label}`,
      ).toHaveLength(0);
    }
  });

  it("NEGATIVO: escrita continua bloqueada pro interno em leads/oportunidades/clientes/propostas da Matriz", async () => {
    const r = redes.matriz;

    const { error: eInsLead } = await interno
      .from("leads")
      .insert({ nome: "tentativa interno", origem: "teste", empresa_id: matrizEmpresaId });
    expect(eInsLead, "insert de lead deveria ser bloqueado pro interno").not.toBeNull();

    const { data: updLead } = await interno
      .from("leads")
      .update({ nome: "editado por interno" })
      .eq("id", r.leadId)
      .select("id");
    expect(updLead ?? [], "update de lead da Matriz deveria afetar 0 linhas").toHaveLength(0);

    const { data: delLead } = await interno.from("leads").delete().eq("id", r.leadId).select("id");
    expect(delLead ?? [], "delete de lead da Matriz deveria afetar 0 linhas").toHaveLength(0);

    const { error: eInsCliente } = await interno
      .from("clientes")
      .insert({ nome: "tentativa interno", empresa_id: matrizEmpresaId });
    expect(eInsCliente, "insert de cliente deveria ser bloqueado pro interno").not.toBeNull();

    const { error: eInsOport } = await interno
      .from("oportunidades")
      .insert({ empresa_id: matrizEmpresaId, valor: 1 });
    expect(eInsOport, "insert de oportunidade deveria ser bloqueado pro interno").not.toBeNull();

    // propostas não tem NENHUMA policy de update pro cliente desde o fix
    // 20260714190228 (toda escrita é via RPC security definer) — então isto
    // bloqueia pra qualquer role, não é uma garantia específica do interno,
    // mas confirma que esta migration não abriu uma exceção nova.
    const { data: updProp } = await interno
      .from("propostas")
      .update({ numero: "editado-por-interno" })
      .eq("id", r.propostaId)
      .select("id");
    expect(updProp ?? [], "update de proposta da Matriz deveria afetar 0 linhas").toHaveLength(0);

    // confirma no admin que nada mudou de fato
    const { data: leadReal } = await admin.from("leads").select("nome").eq("id", r.leadId).single();
    expect(leadReal?.nome).not.toBe("editado por interno");
  });

  it("NEGATIVO: DELETE bloqueado pro interno nas 6 tabelas-filha de cotações da Matriz (risco específico da task)", async () => {
    const r = redes.matriz;
    const filhas = [
      "cotacao_coberturas",
      "cotacao_perfil",
      "cotacao_premios",
      "cotacao_segurado",
      "cotacao_seguro",
      "cotacao_veiculo",
    ] as const;
    for (const tabela of filhas) {
      const { data: antes } = await admin
        .from(tabela)
        .select("cotacao_id")
        .eq("cotacao_id", r.cotacaoId);
      expect(antes ?? [], `${tabela} deveria existir antes da tentativa de delete`).toHaveLength(1);

      const { data: del } = await interno
        .from(tabela)
        .delete()
        .eq("cotacao_id", r.cotacaoId)
        .select("cotacao_id");
      expect(del ?? [], `delete em ${tabela} pelo interno deveria afetar 0 linhas`).toHaveLength(0);

      const { data: depois } = await admin
        .from(tabela)
        .select("cotacao_id")
        .eq("cotacao_id", r.cotacaoId);
      expect(depois ?? [], `${tabela} não deveria ter sido apagada`).toHaveLength(1);
    }

    // update também deve continuar bloqueado (mesma policy _rw, WITH CHECK só
    // libera responsavel_id = auth.uid()).
    const { data: upd } = await interno
      .from("cotacao_segurado")
      .update({ nome: "editado por interno" })
      .eq("cotacao_id", r.cotacaoId)
      .select("cotacao_id");
    expect(
      upd ?? [],
      "update em cotacao_segurado pelo interno deveria afetar 0 linhas",
    ).toHaveLength(0);
  });

  it("V11.I.3 — Marketing e Assistente Comercial têm áreas diferentes (não são intercambiáveis)", async () => {
    const { data: areasMkt, error: eMkt } = await interno.rpc("fn_areas_do_usuario", {
      _user_id: internoId,
    });
    if (eMkt) throw eMkt;
    expect((areasMkt ?? []).map((r) => r.area_chave).sort()).toEqual([
      "mdash",
      "mdist",
      "mkt",
      "mleads",
      "mrel",
    ]);

    const assistente = await criarPersonaComEmpresa("interno", { emailPrefix: "interno-assist" });
    await admin.from("profiles").update({ cargo_id: "assist_com" }).eq("id", assistente.userId);
    const { data: areasAssist, error: eAssist } = await assistente.client.rpc(
      "fn_areas_do_usuario",
      { _user_id: assistente.userId },
    );
    if (eAssist) throw eAssist;
    expect((areasAssist ?? []).map((r) => r.area_chave).sort()).toEqual([
      "mdash",
      "mpipe",
      "mvendas",
    ]);

    // Mesma RLS pro Assistente Comercial: /operacao/vendas e /operacao/pipeline-geral
    // leem leads/propostas/cotacoes — mesmas tabelas já cobertas acima, sem
    // policy adicional (não há gate de role client-side nessas duas rotas,
    // diferente de /comando/leads e /comando/distribuicao — ver relatório).
    const r = redes.matriz;
    const { data: propAssist } = await assistente.client
      .from("propostas")
      .select("id")
      .eq("id", r.propostaId);
    expect(propAssist ?? [], "Assistente Comercial vê proposta da Matriz").toHaveLength(1);

    const { data: propAssistFull } = await assistente.client
      .from("propostas")
      .select("id")
      .eq("id", redes.full.propostaId);
    expect(propAssistFull ?? [], "Assistente Comercial não vê proposta da Full").toHaveLength(0);
  });
});
