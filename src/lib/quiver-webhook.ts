// Webhook receiver da Quiver (POST externo, sem sessão de usuário) —
// interceptado direto em src/server.ts, antes do handler do TanStack Start,
// porque não existe (nesta versão) um mecanismo de "API route" de arquivo
// separado do roteamento de páginas. Ver doc/EXTERNAL_API_GUIDE.md do
// projeto /Users/diego.gervasio/Documents/playwright para o payload
// (PremiosExtraidos: cotacaoId, temPremios, cards, mensagem, placaNaoEncontrada).
//
// Autenticação: a Quiver não tem auth própria no POST /cotacao, então o
// segredo compartilhado (x-client-key/x-client-secret, configurado nos dois
// lados) É a única camada de segurança deste endpoint — nunca remover essa
// checagem.
import { createClient } from "@supabase/supabase-js";
import { CALCULO_SEQ_FINAL } from "@/lib/calculo-etapas";
import { requestAutenticado } from "@/lib/webhook-auth";

export const QUIVER_WEBHOOK_PATH = "/api/webhooks/quiver";

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

export async function handleQuiverWebhook(request: Request): Promise<Response> {
  const expectedKey = process.env.SELF_QUIVER_WEBHOOK_CLIENT_KEY;
  const expectedSecret = process.env.SELF_QUIVER_WEBHOOK_CLIENT_SECRET;
  if (!expectedKey || !expectedSecret) {
    console.error("[quiver-webhook] SELF_QUIVER_WEBHOOK_CLIENT_KEY/SECRET não configurados.");
    return Response.json({ error: "Webhook não configurado." }, { status: 500 });
  }

  if (!requestAutenticado(request, { key: expectedKey, secret: expectedSecret })) {
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

  const admin = getServiceClient();
  const { error } = await admin.rpc("registrar_premios_quiver", {
    p_cotacao_id: cotacaoId,
    p_payload: payload,
  });
  if (error) {
    console.error("[quiver-webhook] Falha ao registrar prêmios:", error.message);
    return Response.json({ error: "Falha ao registrar prêmios." }, { status: 500 });
  }

  // Fecha o ciclo de progresso (best-effort): o desfecho real vive em cotacoes.status.
  const { data: cot } = await admin
    .from("cotacoes")
    .select("status,quiver_mensagem")
    .eq("id", cotacaoId)
    .maybeSingle();
  const falhou = cot?.status === "erro_quiver";
  const { error: etapaError } = await admin.rpc("registrar_calculo_etapa", {
    p_cotacao_id: cotacaoId,
    p_etapa: falhou ? "erro" : "concluido",
    p_seq: CALCULO_SEQ_FINAL,
    ...(falhou ? { p_erro: (cot?.quiver_mensagem ?? "").slice(0, 500) || undefined } : {}),
  });
  if (etapaError) console.error("[quiver-webhook] Falha ao fechar etapa:", etapaError.message);

  return Response.json({ ok: true });
}
