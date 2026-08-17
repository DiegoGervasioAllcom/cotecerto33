import { describe, it, expect } from "vitest";
import { admin, criarEmpresa, criarPersonaComEmpresa, uniq } from "../helpers/supabase";
import {
  QUIVER_TRANSMISSAO_WEBHOOK_PATH,
  handleQuiverTransmissaoWebhook,
} from "@/lib/quiver-transmissao-webhook";

/**
 * Onda 2 (webhook HTTP de entrada) do plano doc/PLANO_WEBHOOK_TRANSMISSAO.md.
 * Testa `handleQuiverTransmissaoWebhook` diretamente (mesma técnica do
 * webhook de cotação: sem subir servidor HTTP, só invoca o handler com um
 * `Request` de verdade — o roteamento em src/server.ts é só um `if` trivial).
 *
 * Credenciais de teste vêm do .env local:
 * SELF_QUIVER_TRANSMISSAO_WEBHOOK_CLIENT_KEY/SECRET.
 */
const KEY = process.env.SELF_QUIVER_TRANSMISSAO_WEBHOOK_CLIENT_KEY!;
const SECRET = process.env.SELF_QUIVER_TRANSMISSAO_WEBHOOK_CLIENT_SECRET!;

function req(body: unknown, headers?: Record<string, string>) {
  return new Request(`http://localhost${QUIVER_TRANSMISSAO_WEBHOOK_PATH}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-client-key": KEY,
      "x-client-secret": SECRET,
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("webhook de transmissão Quiver — Onda 2 (endpoint HTTP)", () => {
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

  it("401 sem headers de auth", async () => {
    const res = await handleQuiverTransmissaoWebhook(
      req({ cotacaoId: "x", transmitido: true }, { "x-client-key": "", "x-client-secret": "" }),
    );
    expect(res.status).toBe(401);
  });

  it("401 com credenciais erradas", async () => {
    const res = await handleQuiverTransmissaoWebhook(
      req(
        { cotacaoId: "x", transmitido: true },
        { "x-client-key": "errado", "x-client-secret": "errado" },
      ),
    );
    expect(res.status).toBe(401);
  });

  it("500 se as env vars de auth não estiverem configuradas", async () => {
    const originalKey = process.env.SELF_QUIVER_TRANSMISSAO_WEBHOOK_CLIENT_KEY;
    const originalSecret = process.env.SELF_QUIVER_TRANSMISSAO_WEBHOOK_CLIENT_SECRET;
    delete process.env.SELF_QUIVER_TRANSMISSAO_WEBHOOK_CLIENT_KEY;
    delete process.env.SELF_QUIVER_TRANSMISSAO_WEBHOOK_CLIENT_SECRET;
    try {
      const res = await handleQuiverTransmissaoWebhook(req({ cotacaoId: "x", transmitido: true }));
      expect(res.status).toBe(500);
    } finally {
      process.env.SELF_QUIVER_TRANSMISSAO_WEBHOOK_CLIENT_KEY = originalKey;
      process.env.SELF_QUIVER_TRANSMISSAO_WEBHOOK_CLIENT_SECRET = originalSecret;
    }
  });

  it("400 se JSON inválido", async () => {
    const res = await handleQuiverTransmissaoWebhook(req("{isso não é json"));
    expect(res.status).toBe(400);
  });

  it("400 se cotacaoId ausente", async () => {
    const res = await handleQuiverTransmissaoWebhook(req({ transmitido: true }));
    expect(res.status).toBe(400);
  });

  it("400 se transmitido ausente", async () => {
    const res = await handleQuiverTransmissaoWebhook(req({ cotacaoId: "x" }));
    expect(res.status).toBe(400);
  });

  it("400 se transmitido não é boolean", async () => {
    const res = await handleQuiverTransmissaoWebhook(req({ cotacaoId: "x", transmitido: "sim" }));
    expect(res.status).toBe(400);
  });

  it("404 quando não existe tentativa 'enviada' para o cotacaoId", async () => {
    const empresa = await criarEmpresa({ nome: uniq("Empresa Webhook Sem Tentativa") });
    const vendedor = await criarPersonaComEmpresa("vendedor", { empresaId: empresa.id });
    const cotacaoId = await criarCotacao(empresa.id, vendedor.userId);
    // sem tentativa criada

    const res = await handleQuiverTransmissaoWebhook(req({ cotacaoId, transmitido: true }));
    expect(res.status).toBe(404);
  });

  it("404 quando a única tentativa já foi processada (não está mais 'enviada')", async () => {
    const empresa = await criarEmpresa({ nome: uniq("Empresa Webhook Ja Processada") });
    const vendedor = await criarPersonaComEmpresa("vendedor", { empresaId: empresa.id });
    const cotacaoId = await criarCotacao(empresa.id, vendedor.userId);
    await criarTentativa(cotacaoId, { status: "transmitida" });

    const res = await handleQuiverTransmissaoWebhook(req({ cotacaoId, transmitido: true }));
    expect(res.status).toBe(404);
  });

  it("200 caminho feliz sucesso: registra a RPC e reflete em propostas/tentativa", async () => {
    const empresa = await criarEmpresa({ nome: uniq("Empresa Webhook Sucesso") });
    const vendedor = await criarPersonaComEmpresa("vendedor", { empresaId: empresa.id });
    const cotacaoId = await criarCotacao(empresa.id, vendedor.userId);
    const tentativaId = await criarTentativa(cotacaoId);

    const res = await handleQuiverTransmissaoWebhook(
      req({
        cotacaoId,
        transmitido: true,
        numeroCotacao: "999888",
        capturadoEm: new Date().toISOString(),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });

    const { data: tent } = await admin
      .from("cotacao_transmissoes")
      .select("status, proposta_id, numero_cotacao_portal")
      .eq("id", tentativaId)
      .single();
    expect(tent?.status).toBe("transmitida");
    expect(tent?.numero_cotacao_portal).toBe("999888");
    expect(tent?.proposta_id).toBeTruthy();

    const { data: prop } = await admin
      .from("propostas")
      .select("status, transmissao_status")
      .eq("id", tent!.proposta_id!)
      .single();
    expect(prop?.status).toBe("transmitida");
    expect(prop?.transmissao_status).toBe("transmitida");
  });

  it("200 caminho feliz falha: registra a RPC com motivo/mensagem e marca a proposta como falha", async () => {
    const empresa = await criarEmpresa({ nome: uniq("Empresa Webhook Falha") });
    const vendedor = await criarPersonaComEmpresa("vendedor", { empresaId: empresa.id });
    const cotacaoId = await criarCotacao(empresa.id, vendedor.userId);
    const tentativaId = await criarTentativa(cotacaoId);

    const res = await handleQuiverTransmissaoWebhook(
      req({
        cotacaoId,
        transmitido: false,
        motivo: "RECUSADA_PELO_PORTAL",
        mensagem: "Portal recusou a cotação",
      }),
    );
    expect(res.status).toBe(200);

    const { data: tent } = await admin
      .from("cotacao_transmissoes")
      .select("status, proposta_id, motivo, mensagem")
      .eq("id", tentativaId)
      .single();
    expect(tent?.status).toBe("falha");
    expect(tent?.motivo).toBe("RECUSADA_PELO_PORTAL");

    const { data: prop } = await admin
      .from("propostas")
      .select("status, transmissao_status, transmissao_motivo, transmissao_mensagem")
      .eq("id", tent!.proposta_id!)
      .single();
    expect(prop?.status).toBe("gerada");
    expect(prop?.transmissao_status).toBe("falha");
    expect(prop?.transmissao_motivo).toBe("RECUSADA_PELO_PORTAL");
    expect(prop?.transmissao_mensagem).toBe("Portal recusou a cotação");
  });

  it("usa a tentativa mais recente quando há mais de uma 'enviada' para o mesmo cotacaoId", async () => {
    const empresa = await criarEmpresa({ nome: uniq("Empresa Webhook Multiplas Tentativas") });
    const vendedor = await criarPersonaComEmpresa("vendedor", { empresaId: empresa.id });
    const cotacaoId = await criarCotacao(empresa.id, vendedor.userId);
    const antiga = await criarTentativa(cotacaoId, { seguradora: "Antiga" });
    // Garante ordenação determinística por criado_em.
    await admin
      .from("cotacao_transmissoes")
      .update({ criado_em: new Date(Date.now() - 60_000).toISOString() })
      .eq("id", antiga);
    const recente = await criarTentativa(cotacaoId, { seguradora: "Recente" });

    const res = await handleQuiverTransmissaoWebhook(req({ cotacaoId, transmitido: true }));
    expect(res.status).toBe(200);

    const { data: tentAntiga } = await admin
      .from("cotacao_transmissoes")
      .select("status")
      .eq("id", antiga)
      .single();
    expect(tentAntiga?.status).toBe("enviada");

    const { data: tentRecente } = await admin
      .from("cotacao_transmissoes")
      .select("status")
      .eq("id", recente)
      .single();
    expect(tentRecente?.status).toBe("transmitida");
  });
});
