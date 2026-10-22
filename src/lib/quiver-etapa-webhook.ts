// Webhook de ETAPA do cálculo (POST do robô, sem sessão de usuário) —
// interceptado em src/server.ts, mesmo padrão de src/lib/quiver-webhook.ts.
// Por decisão do produto, usa o MESMO segredo compartilhado do webhook de
// cotação (SELF_QUIVER_WEBHOOK_CLIENT_KEY/SECRET). Aviso informativo: a RPC é
// idempotente e ignora seq antigo, então o robô não faz retry.
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { CALCULO_ETAPAS, CALCULO_ETAPA_SEQ } from "@/lib/calculo-etapas";

export const QUIVER_ETAPA_WEBHOOK_PATH = "/api/webhooks/quiver-etapa";

const payloadSchema = z
  .object({
    cotacaoId: z.string().uuid(),
    etapa: z.enum(CALCULO_ETAPAS),
    seq: z.number().int().min(0).max(8),
  })
  .refine((p) => p.seq === CALCULO_ETAPA_SEQ[p.etapa], { message: "seq não bate com a etapa." });

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

export async function handleQuiverEtapaWebhook(request: Request): Promise<Response> {
  const expectedKey = process.env.SELF_QUIVER_WEBHOOK_CLIENT_KEY;
  const expectedSecret = process.env.SELF_QUIVER_WEBHOOK_CLIENT_SECRET;
  if (!expectedKey || !expectedSecret) {
    console.error("[quiver-etapa-webhook] SELF_QUIVER_WEBHOOK_CLIENT_KEY/SECRET não configurados.");
    return Response.json({ error: "Webhook não configurado." }, { status: 500 });
  }

  if (
    request.headers.get("x-client-key") !== expectedKey ||
    request.headers.get("x-client-secret") !== expectedSecret
  ) {
    return Response.json({ error: "Credenciais inválidas." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Payload inválido." }, { status: 400 });
  }

  const { data, error } = await getServiceClient().rpc("registrar_calculo_etapa", {
    p_cotacao_id: parsed.data.cotacaoId,
    p_etapa: parsed.data.etapa,
    p_seq: parsed.data.seq,
  });
  if (error) {
    console.error("[quiver-etapa-webhook] Falha ao registrar etapa:", error.message);
    return Response.json({ error: "Falha ao registrar etapa." }, { status: 500 });
  }

  return Response.json({ aplicado: data === true });
}
