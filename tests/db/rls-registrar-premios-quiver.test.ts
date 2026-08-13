import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarEmpresa, criarPersonaComEmpresa, type Db } from "../helpers/supabase";

/**
 * Segurança da integração com a Quiver (Fase 6): `registrar_premios_quiver`
 * (20260722205124_g1_5b_quiver_integracao.sql) é a RPC que o webhook receiver
 * (`/api/webhooks/quiver`, fora da sessão de usuário) usa pra gravar o
 * resultado do cálculo assim que a automação termina.
 *
 * `revoke all ... from public, anon, authenticated` + `grant ... to service_role`
 * (linhas 84-85 da migration): nenhum usuário autenticado — nem o próprio
 * responsável pela cotação — deve conseguir "forjar" um resultado chamando a
 * RPC direto via `supabase.rpc(...)` do client. A única camada de autorização
 * real é o segredo compartilhado (`x-client-key`/`x-client-secret`) validado
 * no endpoint HTTP, que então usa o client de `service_role` (mesmo cliente do
 * `admin` destes testes) pra chamar a função.
 */
describe("RLS registrar_premios_quiver — só service_role, nunca authenticated", () => {
  let vendedorA: Db;
  let vendedorAId: string;
  let cotacaoId: string;

  beforeAll(async () => {
    const emp = await criarEmpresa({ nome: "Empresa Quiver RLS" });
    const v1 = await criarPersonaComEmpresa("vendedor", {
      empresaId: emp.id,
      emailPrefix: "vend-quiver-rls",
    });
    vendedorA = v1.client;
    vendedorAId = v1.userId;

    const { data: cot, error } = await admin
      .from("cotacoes")
      .insert({ empresa_id: emp.id, responsavel_id: vendedorAId, status: "enviada_quiver" })
      .select("id")
      .single();
    if (error) throw error;
    cotacaoId = cot.id;
  });

  it("NEGATIVO: o próprio responsável pela cotação não consegue chamar a RPC (forjar resultado)", async () => {
    const { error } = await vendedorA.rpc("registrar_premios_quiver", {
      p_cotacao_id: cotacaoId,
      p_payload: {
        temPremios: true,
        cards: [{ seguradora: "Forjado", opcoes: [{ tipo: "Compreensiva", avista: "1,00" }] }],
      } as never,
    });
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/permission denied/i);

    const { data: real } = await admin
      .from("cotacoes")
      .select("status")
      .eq("id", cotacaoId)
      .single();
    expect(real?.status).toBe("enviada_quiver");

    const { data: premios } = await admin
      .from("cotacao_premios")
      .select("seguradora")
      .eq("cotacao_id", cotacaoId);
    expect(premios ?? []).toHaveLength(0);
  });

  it("POSITIVO: service_role grava o resultado corretamente (caminho real do webhook)", async () => {
    const { error } = await admin.rpc("registrar_premios_quiver", {
      p_cotacao_id: cotacaoId,
      p_payload: {
        temPremios: true,
        cards: [
          {
            seguradora: "Porto",
            opcoes: [{ tipo: "Compreensiva", avista: "1.234,56" }],
          },
        ],
      } as never,
    });
    expect(error).toBeNull();

    const { data: cot } = await admin
      .from("cotacoes")
      .select("status")
      .eq("id", cotacaoId)
      .single();
    expect(cot?.status).toBe("calculada");

    const { data: premios } = await admin
      .from("cotacao_premios")
      .select("seguradora,cobertura,premio")
      .eq("cotacao_id", cotacaoId);
    expect(premios).toHaveLength(1);
    expect(premios?.[0].seguradora).toBe("Porto");
    expect(premios?.[0].cobertura).toBe("Compreensiva");
    expect(Number(premios?.[0].premio)).toBe(1234.56);
  });

  it("POSITIVO: service_role grava erro_quiver quando temPremios=false (placa não encontrada)", async () => {
    const { data: cot2, error: eCot } = await admin
      .from("cotacoes")
      .insert({
        empresa_id: (await criarEmpresa({ nome: "Empresa Quiver RLS 2" })).id,
        responsavel_id: vendedorAId,
        status: "enviada_quiver",
      })
      .select("id")
      .single();
    if (eCot) throw eCot;

    const { error } = await admin.rpc("registrar_premios_quiver", {
      p_cotacao_id: cot2.id,
      p_payload: { temPremios: false, placaNaoEncontrada: true } as never,
    });
    expect(error).toBeNull();

    const { data: real } = await admin
      .from("cotacoes")
      .select("status,quiver_mensagem")
      .eq("id", cot2.id)
      .single();
    expect(real?.status).toBe("erro_quiver");
    expect(real?.quiver_mensagem).toMatch(/placa/i);
  });

  async function criarCotacaoComLead(statusPipeline: string) {
    const emp = await criarEmpresa({ nome: `Empresa Pipeline Quiver ${statusPipeline}` });
    const { data: lead, error: eLead } = await admin
      .from("leads")
      .insert({
        empresa_id: emp.id,
        responsavel_id: vendedorAId,
        nome: "Lead Pipeline Quiver",
        status_pipeline: statusPipeline as never,
      })
      .select("id")
      .single();
    if (eLead) throw eLead;
    const { data: cotacao, error: eCotacao } = await admin
      .from("cotacoes")
      .insert({
        empresa_id: emp.id,
        responsavel_id: vendedorAId,
        lead_id: lead.id,
        status: "enviada_quiver",
      })
      .select("id")
      .single();
    if (eCotacao) throw eCotacao;
    return { leadId: lead.id, cotacaoId: cotacao.id };
  }

  const retornoValido = {
    temPremios: true,
    cards: [{ seguradora: "Porto", opcoes: [{ tipo: "Compreensiva", avista: "R$ 1.234,56" }] }],
  };

  it("avança atomicamente um lead anterior para cotacao e registra um evento", async () => {
    const fixture = await criarCotacaoComLead("qualificando");
    const { error } = await admin.rpc("registrar_premios_quiver", {
      p_cotacao_id: fixture.cotacaoId,
      p_payload: retornoValido as never,
    });
    expect(error).toBeNull();

    const { data: lead } = await admin
      .from("leads")
      .select("status_pipeline")
      .eq("id", fixture.leadId)
      .single();
    expect(lead?.status_pipeline).toBe("cotacao");

    const { data: eventos } = await admin
      .from("lead_eventos")
      .select("tipo,meta")
      .eq("lead_id", fixture.leadId)
      .eq("tipo", "cotacao_calculada");
    expect(eventos).toHaveLength(1);
    expect(eventos?.[0].meta).toMatchObject({ cotacao_id: fixture.cotacaoId, premios_validos: 1 });
  });

  it("não avança quando temPremios=true mas nenhum card/prêmio é válido", async () => {
    const fixture = await criarCotacaoComLead("cotando");
    const { error } = await admin.rpc("registrar_premios_quiver", {
      p_cotacao_id: fixture.cotacaoId,
      p_payload: {
        temPremios: true,
        cards: [
          { opcoes: [{ tipo: "Compreensiva", avista: "1.000,00" }] },
          { seguradora: "Porto", opcoes: [{ tipo: "Compreensiva", avista: "0,00" }] },
        ],
      } as never,
    });
    expect(error).toBeNull();

    const { data: lead } = await admin
      .from("leads")
      .select("status_pipeline")
      .eq("id", fixture.leadId)
      .single();
    expect(lead?.status_pipeline).toBe("cotando");
    const { data: cotacao } = await admin
      .from("cotacoes")
      .select("status,quiver_mensagem,quiver_resultado_raw")
      .eq("id", fixture.cotacaoId)
      .single();
    expect(cotacao?.status).toBe("erro_quiver");
    expect(cotacao?.quiver_mensagem).toMatch(/não retornou prêmios válidos/i);
    expect(cotacao?.quiver_resultado_raw).toMatchObject({ temPremios: true });
    const { count } = await admin
      .from("cotacao_premios")
      .select("id", { count: "exact", head: true })
      .eq("cotacao_id", fixture.cotacaoId);
    expect(count).toBe(0);
  });

  it("cotação sem lead registra os cards sem criar evento de pipeline", async () => {
    const emp = await criarEmpresa({ nome: "Empresa Quiver sem lead" });
    const { data: cotacao, error: eCotacao } = await admin
      .from("cotacoes")
      .insert({ empresa_id: emp.id, responsavel_id: vendedorAId, status: "enviada_quiver" })
      .select("id")
      .single();
    if (eCotacao) throw eCotacao;

    const { error } = await admin.rpc("registrar_premios_quiver", {
      p_cotacao_id: cotacao.id,
      p_payload: retornoValido as never,
    });
    expect(error).toBeNull();

    const [{ data: real }, { count: premios }, { count: eventos }] = await Promise.all([
      admin.from("cotacoes").select("status").eq("id", cotacao.id).single(),
      admin
        .from("cotacao_premios")
        .select("id", { count: "exact", head: true })
        .eq("cotacao_id", cotacao.id),
      admin
        .from("lead_eventos")
        .select("id", { count: "exact", head: true })
        .contains("meta", { cotacao_id: cotacao.id }),
    ]);
    expect(real?.status).toBe("calculada");
    expect(premios).toBe(1);
    expect(eventos).toBe(0);
  });

  it("não regride etapa posterior", async () => {
    const fixture = await criarCotacaoComLead("proposta");
    const { error } = await admin.rpc("registrar_premios_quiver", {
      p_cotacao_id: fixture.cotacaoId,
      p_payload: retornoValido as never,
    });
    expect(error).toBeNull();
    const { data: lead } = await admin
      .from("leads")
      .select("status_pipeline")
      .eq("id", fixture.leadId)
      .single();
    expect(lead?.status_pipeline).toBe("proposta");
  });

  it("temPremios=false sem sucesso anterior não avança lead vinculado", async () => {
    const fixture = await criarCotacaoComLead("qualificado");
    const { error } = await admin.rpc("registrar_premios_quiver", {
      p_cotacao_id: fixture.cotacaoId,
      p_payload: { temPremios: false, mensagem: "Portal indisponível" } as never,
    });
    expect(error).toBeNull();

    const [{ data: lead }, { data: cotacao }, { count: eventos }] = await Promise.all([
      admin.from("leads").select("status_pipeline").eq("id", fixture.leadId).single(),
      admin.from("cotacoes").select("status").eq("id", fixture.cotacaoId).single(),
      admin
        .from("lead_eventos")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", fixture.leadId)
        .eq("tipo", "cotacao_calculada"),
    ]);
    expect(lead?.status_pipeline).toBe("qualificado");
    expect(cotacao?.status).toBe("erro_quiver");
    expect(eventos).toBe(0);
  });

  it("sucesso é monotônico contra callbacks posteriores de erro ou sem cards válidos", async () => {
    const fixture = await criarCotacaoComLead("novo");
    const sucesso = await admin.rpc("registrar_premios_quiver", {
      p_cotacao_id: fixture.cotacaoId,
      p_payload: retornoValido as never,
    });
    expect(sucesso.error).toBeNull();

    const erro = await admin.rpc("registrar_premios_quiver", {
      p_cotacao_id: fixture.cotacaoId,
      p_payload: { temPremios: false, mensagem: "Falha atrasada" } as never,
    });
    const vazio = await admin.rpc("registrar_premios_quiver", {
      p_cotacao_id: fixture.cotacaoId,
      p_payload: {
        temPremios: true,
        cards: [{ seguradora: "Inválida", opcoes: [{ tipo: "Compreensiva", avista: "0,00" }] }],
      } as never,
    });
    expect(erro.error).toBeNull();
    expect(vazio.error).toBeNull();

    const [{ data: lead }, { data: cotacao }, { data: premios }, { count: eventos }] =
      await Promise.all([
        admin.from("leads").select("status_pipeline").eq("id", fixture.leadId).single(),
        admin
          .from("cotacoes")
          .select("status,quiver_mensagem,quiver_resultado_raw")
          .eq("id", fixture.cotacaoId)
          .single(),
        admin
          .from("cotacao_premios")
          .select("seguradora,premio")
          .eq("cotacao_id", fixture.cotacaoId),
        admin
          .from("lead_eventos")
          .select("id", { count: "exact", head: true })
          .eq("lead_id", fixture.leadId)
          .eq("tipo", "cotacao_calculada"),
      ]);
    expect(lead?.status_pipeline).toBe("cotacao");
    expect(cotacao?.status).toBe("calculada");
    expect(cotacao?.quiver_mensagem).toBeNull();
    expect(cotacao?.quiver_resultado_raw).toMatchObject(retornoValido);
    expect(premios).toHaveLength(1);
    expect(premios?.[0].seguradora).toBe("Porto");
    expect(Number(premios?.[0].premio)).toBe(1234.56);
    expect(eventos).toBe(1);
  });

  it("callbacks concorrentes/repetidos são idempotentes no pipeline e histórico", async () => {
    const fixture = await criarCotacaoComLead("novo");
    const resultados = await Promise.all([
      admin.rpc("registrar_premios_quiver", {
        p_cotacao_id: fixture.cotacaoId,
        p_payload: retornoValido as never,
      }),
      admin.rpc("registrar_premios_quiver", {
        p_cotacao_id: fixture.cotacaoId,
        p_payload: retornoValido as never,
      }),
    ]);
    expect(resultados.map((resultado) => resultado.error)).toEqual([null, null]);

    const { count: premios } = await admin
      .from("cotacao_premios")
      .select("id", { count: "exact", head: true })
      .eq("cotacao_id", fixture.cotacaoId);
    const { count: eventos } = await admin
      .from("lead_eventos")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", fixture.leadId)
      .eq("tipo", "cotacao_calculada");
    expect(premios).toBe(1);
    expect(eventos).toBe(1);
  });
});
