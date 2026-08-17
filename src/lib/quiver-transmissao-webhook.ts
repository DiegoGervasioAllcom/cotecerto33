// Webhook receiver do resultado da transmissão automatizada da Quiver (POST
// externo, sem sessão de usuário) — interceptado direto em src/server.ts,
// mesmo padrão de src/lib/quiver-webhook.ts (webhook de COTAÇÃO — não
// confundir os dois). Ver doc/PLANO_WEBHOOK_TRANSMISSAO.md, Onda 2 (T.5-T.8).
//
// É o nosso próprio `transmitirPropostaQuiver` (src/lib/quiver.functions.ts)
// que dispara a chamada ao robô e sempre manda `cotacaoId` — por isso esta v1
// exige o campo, sem fallback por nome/número de cotação.
//
// Autenticação: segredo compartilhado (x-client-key/x-client-secret) próprio
// deste endpoint, DISTINTO das credenciais de saída (SELF_QUIVER_TRANSMISSAO_
// CLIENT_KEY/SECRET, usadas pelo CoteCerto para chamar o robô) e do webhook
// de cotação (SELF_QUIVER_WEBHOOK_CLIENT_KEY/SECRET) — nunca reaproveitar.
import { createClient } from "@supabase/supabase-js";

export const QUIVER_TRANSMISSAO_WEBHOOK_PATH = "/api/webhooks/quiver-transmissao";

function getServiceClient() {
  const url =
    import.meta.env?.VITE_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.SELF_SUPABASE_URL;
  const serviceKey = process.env.SELF_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Configuração do servidor ausente.");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function handleQuiverTransmissaoWebhook(request: Request): Promise<Response> {
  const expectedKey = process.env.SELF_QUIVER_TRANSMISSAO_WEBHOOK_CLIENT_KEY;
  const expectedSecret = process.env.SELF_QUIVER_TRANSMISSAO_WEBHOOK_CLIENT_SECRET;
  if (!expectedKey || !expectedSecret) {
    console.error(
      "[quiver-transmissao-webhook] SELF_QUIVER_TRANSMISSAO_WEBHOOK_CLIENT_KEY/SECRET não configurados.",
    );
    return Response.json({ error: "Webhook não configurado." }, { status: 500 });
  }

  const gotKey = request.headers.get("x-client-key");
  const gotSecret = request.headers.get("x-client-secret");
  if (gotKey !== expectedKey || gotSecret !== expectedSecret) {
    return Response.json({ error: "Credenciais inválidas." }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const cotacaoId = payload.cotacaoId;
  if (typeof cotacaoId !== "string" || !cotacaoId) {
    return Response.json({ error: "cotacaoId ausente no payload." }, { status: 400 });
  }

  const transmitido = payload.transmitido;
  if (typeof transmitido !== "boolean") {
    return Response.json({ error: "transmitido ausente ou inválido no payload." }, { status: 400 });
  }

  const admin = getServiceClient();

  const { data: tentativa, error: buscaError } = await admin
    .from("cotacao_transmissoes")
    .select("id")
    .eq("cotacao_id", cotacaoId)
    .eq("status", "enviada")
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (buscaError) {
    console.error("[quiver-transmissao-webhook] Falha ao buscar tentativa:", buscaError.message);
    return Response.json({ error: buscaError.message }, { status: 500 });
  }

  if (!tentativa) {
    console.error(
      "[quiver-transmissao-webhook] Nenhuma tentativa 'enviada' encontrada para cotacaoId:",
      cotacaoId,
      "payload:",
      JSON.stringify(payload),
    );
    return Response.json(
      { error: "Nenhuma tentativa de transmissão em aberto para esta cotação." },
      { status: 404 },
    );
  }

  const motivo = typeof payload.motivo === "string" ? payload.motivo : null;
  const mensagem = typeof payload.mensagem === "string" ? payload.mensagem : null;
  const numeroCotacao = typeof payload.numeroCotacao === "string" ? payload.numeroCotacao : null;
  const capturadoEm = typeof payload.capturadoEm === "string" ? payload.capturadoEm : undefined;

  const rpcArgs: Record<string, unknown> = {
    p_tentativa_id: tentativa.id,
    p_transmitido: transmitido,
    p_motivo: motivo,
    p_mensagem: mensagem,
    p_numero_cotacao: numeroCotacao,
  };
  if (capturadoEm !== undefined) rpcArgs.p_capturado_em = capturadoEm;

  const { error } = await admin.rpc("registrar_resultado_transmissao_quiver", rpcArgs);
  if (error) {
    console.error(
      "[quiver-transmissao-webhook] Falha ao registrar resultado da transmissão:",
      error.message,
    );
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
