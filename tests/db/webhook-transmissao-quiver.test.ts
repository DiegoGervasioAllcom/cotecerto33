import { describe, it, expect, beforeAll } from "vitest";
import { admin, anonClient, criarEmpresa, criarPersonaComEmpresa, uniq } from "../helpers/supabase";

/**
 * Onda 1 (banco) do plano doc/PLANO_WEBHOOK_TRANSMISSAO.md:
 * tabela `cotacao_transmissoes` (histórico de tentativas) + RPC
 * `registrar_resultado_transmissao_quiver` (chamada pelo webhook da Onda 2,
 * via service_role — não exposta a `authenticated`).
 */
describe("webhook transmissão Quiver — Onda 1 (banco)", () => {
  async function criarCotacao(empresaId: string, responsavelId?: string) {
    const { data, error } = await admin
      .from("cotacoes")
      .insert({ empresa_id: empresaId, responsavel_id: responsavelId })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }

  async function criarTentativa(cotacaoId: string, overrides?: Record<string, unknown>) {
    const { data, error } = await admin
      .from("cotacao_transmissoes")
      .insert({
        cotacao_id: cotacaoId,
        seguradora: "Seguradora Teste",
        forma_pagamento: "boleto",
        premio: 123.45,
        ...overrides,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }

  it("sucesso: transmitido=true cria/atualiza proposta e marca tentativa", async () => {
    const empresa = await criarEmpresa({ nome: uniq("Empresa Transmissao Ok") });
    const vendedor = await criarPersonaComEmpresa("vendedor", { empresaId: empresa.id });
    const cotacaoId = await criarCotacao(empresa.id, vendedor.userId);
    const tentativaId = await criarTentativa(cotacaoId);

    const { error } = await admin.rpc("registrar_resultado_transmissao_quiver", {
      p_tentativa_id: tentativaId,
      p_transmitido: true,
      p_numero_cotacao: "12345",
    });
    if (error) throw error;

    const { data: tent } = await admin
      .from("cotacao_transmissoes")
      .select("status, proposta_id, numero_cotacao_portal")
      .eq("id", tentativaId)
      .single();
    expect(tent?.status).toBe("transmitida");
    expect(tent?.proposta_id).toBeTruthy();
    expect(tent?.numero_cotacao_portal).toBe("12345");

    const { data: prop } = await admin
      .from("propostas")
      .select("status, transmissao_status, cotacao_id, seguradora")
      .eq("id", tent!.proposta_id!)
      .single();
    expect(prop?.status).toBe("transmitida");
    expect(prop?.transmissao_status).toBe("transmitida");
    expect(prop?.cotacao_id).toBe(cotacaoId);
  });

  it("falha: transmitido=false cria proposta 'gerada' com transmissao_status='falha'", async () => {
    const empresa = await criarEmpresa({ nome: uniq("Empresa Transmissao Falha") });
    const vendedor = await criarPersonaComEmpresa("vendedor", { empresaId: empresa.id });
    const cotacaoId = await criarCotacao(empresa.id, vendedor.userId);
    const tentativaId = await criarTentativa(cotacaoId);

    const { error } = await admin.rpc("registrar_resultado_transmissao_quiver", {
      p_tentativa_id: tentativaId,
      p_transmitido: false,
      p_motivo: "RECUSADA_PELO_PORTAL",
      p_mensagem: "Portal recusou a cotação",
    });
    if (error) throw error;

    const { data: tent } = await admin
      .from("cotacao_transmissoes")
      .select("status, proposta_id, motivo, mensagem")
      .eq("id", tentativaId)
      .single();
    expect(tent?.status).toBe("falha");
    expect(tent?.motivo).toBe("RECUSADA_PELO_PORTAL");

    const { data: prop } = await admin
      .from("propostas")
      .select("status, transmissao_status, transmissao_motivo, transmissao_mensagem, negociacao_status")
      .eq("id", tent!.proposta_id!)
      .single();
    expect(prop?.status).toBe("gerada");
    expect(prop?.transmissao_status).toBe("falha");
    expect(prop?.transmissao_motivo).toBe("RECUSADA_PELO_PORTAL");
    expect(prop?.transmissao_mensagem).toBe("Portal recusou a cotação");
    expect(prop?.negociacao_status).toBe("recusada");

    const { data: versoes } = await admin
      .from("proposta_versoes")
      .select("versao, nota, criado_por")
      .eq("proposta_id", tent!.proposta_id!)
      .order("versao");
    expect(versoes?.length).toBe(1);
    expect(versoes?.[0].versao).toBe(1);
    expect(versoes?.[0].nota).toContain("Portal recusou a cotação");
    expect(versoes?.[0].criado_por).toBeNull();
  });

  it("falha com motivo diferente de RECUSADA_PELO_PORTAL não mexe em negociacao_status nem cria versão", async () => {
    const empresa = await criarEmpresa({ nome: uniq("Empresa Transmissao Falha Campos") });
    const vendedor = await criarPersonaComEmpresa("vendedor", { empresaId: empresa.id });
    const cotacaoId = await criarCotacao(empresa.id, vendedor.userId);
    const tentativaId = await criarTentativa(cotacaoId);

    const { error } = await admin.rpc("registrar_resultado_transmissao_quiver", {
      p_tentativa_id: tentativaId,
      p_transmitido: false,
      p_motivo: "CAMPOS_PENDENTES",
      p_mensagem: "Preencha o campo Dia de Vencimento das Demais Parcelas",
    });
    if (error) throw error;

    const { data: tent } = await admin
      .from("cotacao_transmissoes")
      .select("proposta_id")
      .eq("id", tentativaId)
      .single();

    const { data: prop } = await admin
      .from("propostas")
      .select("negociacao_status")
      .eq("id", tent!.proposta_id!)
      .single();
    expect(prop?.negociacao_status).toBe("aguardando");

    const { data: versoes } = await admin
      .from("proposta_versoes")
      .select("id")
      .eq("proposta_id", tent!.proposta_id!);
    expect(versoes?.length).toBe(0);
  });

  it("idempotência: chamar a RPC duas vezes não duplica proposta nem reprocessa", async () => {
    const empresa = await criarEmpresa({ nome: uniq("Empresa Transmissao Idempotente") });
    const vendedor = await criarPersonaComEmpresa("vendedor", { empresaId: empresa.id });
    const cotacaoId = await criarCotacao(empresa.id, vendedor.userId);
    const tentativaId = await criarTentativa(cotacaoId);

    const { error: e1 } = await admin.rpc("registrar_resultado_transmissao_quiver", {
      p_tentativa_id: tentativaId,
      p_transmitido: true,
    });
    if (e1) throw e1;

    const { data: prop1 } = await admin.from("propostas").select("id").eq("cotacao_id", cotacaoId);
    expect(prop1?.length).toBe(1);

    // segunda chamada (webhook duplicado): tentativa já não está 'enviada' — não reprocessa.
    const { error: e2 } = await admin.rpc("registrar_resultado_transmissao_quiver", {
      p_tentativa_id: tentativaId,
      p_transmitido: false,
      p_motivo: "NAO_DEVE_APLICAR",
    });
    if (e2) throw e2;

    const { data: prop2 } = await admin
      .from("propostas")
      .select("id, status, transmissao_status")
      .eq("cotacao_id", cotacaoId);
    expect(prop2?.length).toBe(1);
    expect(prop2![0].status).toBe("transmitida");
    expect(prop2![0].transmissao_status).toBe("transmitida");
  });

  it("RLS: vendedor dono da cotação vê a tentativa; vendedor de outra empresa não vê", async () => {
    const empresa = await criarEmpresa({ nome: uniq("Empresa RLS A") });
    const outraEmpresa = await criarEmpresa({ nome: uniq("Empresa RLS B") });
    const vendedor = await criarPersonaComEmpresa("vendedor", { empresaId: empresa.id });
    const outroVendedor = await criarPersonaComEmpresa("vendedor", { empresaId: outraEmpresa.id });
    const cotacaoId = await criarCotacao(empresa.id, vendedor.userId);
    const tentativaId = await criarTentativa(cotacaoId);

    const { data: visto, error: eVisto } = await vendedor.client
      .from("cotacao_transmissoes")
      .select("id")
      .eq("id", tentativaId)
      .maybeSingle();
    if (eVisto) throw eVisto;
    expect(visto?.id).toBe(tentativaId);

    const { data: naoVisto } = await outroVendedor.client
      .from("cotacao_transmissoes")
      .select("id")
      .eq("id", tentativaId)
      .maybeSingle();
    expect(naoVisto).toBeNull();
  });

  it("authenticated não consegue chamar a RPC (falta execute) nem inserir/atualizar direto", async () => {
    const empresa = await criarEmpresa({ nome: uniq("Empresa RLS Sem Execute") });
    const vendedor = await criarPersonaComEmpresa("vendedor", { empresaId: empresa.id });
    const cotacaoId = await criarCotacao(empresa.id, vendedor.userId);
    const tentativaId = await criarTentativa(cotacaoId);

    const { error: eRpc } = await vendedor.client.rpc("registrar_resultado_transmissao_quiver", {
      p_tentativa_id: tentativaId,
      p_transmitido: true,
    });
    expect(eRpc).toBeTruthy();

    const { error: eInsert } = await vendedor.client.from("cotacao_transmissoes").insert({
      cotacao_id: cotacaoId,
      seguradora: "Não deveria inserir",
    });
    expect(eInsert).toBeTruthy();

    const { error: eUpdate } = await vendedor.client
      .from("cotacao_transmissoes")
      .update({ status: "transmitida" })
      .eq("id", tentativaId);
    expect(eUpdate).toBeTruthy();
  });

  it("RPC lança exceção quando a tentativa não existe", async () => {
    const { error } = await admin.rpc("registrar_resultado_transmissao_quiver", {
      p_tentativa_id: "00000000-0000-0000-0000-000000000000",
      p_transmitido: true,
    });
    expect(error).toBeTruthy();
  });
});
