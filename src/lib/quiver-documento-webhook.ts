// Webhook receiver do PDF da proposta capturado pelo robô (V12.4.7 fatia 2).
// POST externo, sem sessão. Padrão de src/lib/quiver-transmissao-webhook.ts.
// Credenciais próprias (SELF_QUIVER_DOCUMENTO_WEBHOOK_CLIENT_KEY/SECRET),
// distintas das demais. O robô não tem chave do Storage: quem grava é este
// handler, com service role. LGPD: nunca logar corpo, base64, nome nem URL —
// só ids e códigos.
import { createClient } from "@supabase/supabase-js";
import {
  credenciaisConferem,
  parsePayloadDocumento,
  storagePathProposta,
  validarPdf,
} from "./quiver-documento";

export { QUIVER_DOCUMENTO_WEBHOOK_PATH } from "./quiver-documento";

const BUCKET = "propostas-docs";
const LOG = "[quiver-documento-webhook]";

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

export async function handleQuiverDocumentoWebhook(request: Request): Promise<Response> {
  const expectedKey = process.env.SELF_QUIVER_DOCUMENTO_WEBHOOK_CLIENT_KEY;
  const expectedSecret = process.env.SELF_QUIVER_DOCUMENTO_WEBHOOK_CLIENT_SECRET;
  if (!expectedKey || !expectedSecret) {
    console.error(`${LOG} SELF_QUIVER_DOCUMENTO_WEBHOOK_CLIENT_KEY/SECRET não configurados.`);
    return Response.json({ error: "Webhook não configurado." }, { status: 500 });
  }
  if (
    !credenciaisConferem(
      { key: request.headers.get("x-client-key"), secret: request.headers.get("x-client-secret") },
      { key: expectedKey, secret: expectedSecret },
    )
  ) {
    return Response.json({ error: "Credenciais inválidas." }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }
  const parsed = parsePayloadDocumento(raw);
  if (!parsed.ok) return Response.json({ error: "Payload inválido." }, { status: 400 });
  const { payload } = parsed;
  const cotacaoId = payload.kind === "pdf" ? payload.data.cotacaoId : payload.cotacaoId;

  // Valida o PDF antes de tocar no banco/Storage.
  let bytes: Buffer | null = null;
  if (payload.kind === "pdf") {
    const v = validarPdf(payload.data);
    if (!v.ok) {
      console.error(`${LOG} PDF recusado cotacaoId=${cotacaoId} codigo=${v.codigo}`);
      return Response.json({ error: "PDF inválido.", codigo: v.codigo }, { status: 422 });
    }
    bytes = v.bytes;
  }

  const admin = getServiceClient();

  const { data: tr, error: trErr } = await admin
    .from("cotacao_transmissoes")
    .select("proposta_id")
    .eq("cotacao_id", cotacaoId)
    .eq("status", "transmitida")
    .not("proposta_id", "is", null)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (trErr) {
    console.error(`${LOG} falha ao buscar transmissão cotacaoId=${cotacaoId} code=${trErr.code}`);
    return Response.json({ error: "Falha interna." }, { status: 500 });
  }
  if (!tr?.proposta_id) {
    return Response.json(
      { error: "Sem transmissão concluída para esta cotação." },
      { status: 404 },
    );
  }
  const propostaId = tr.proposta_id;

  const { data: prop, error: propErr } = await admin
    .from("propostas")
    .select("empresa_id")
    .eq("id", propostaId)
    .maybeSingle();
  if (propErr || !prop?.empresa_id) {
    console.error(`${LOG} proposta não resolvida propostaId=${propostaId}`);
    return Response.json({ error: "Falha interna." }, { status: 500 });
  }

  // Idempotência: documento já capturado -> 200 sem regravar nem duplicar.
  const { data: existente, error: exErr } = await admin
    .from("proposta_documentos")
    .select("status")
    .eq("proposta_id", propostaId)
    .eq("tipo", "proposta_pdf")
    .maybeSingle();
  if (exErr) {
    console.error(`${LOG} falha ao ler documento propostaId=${propostaId} code=${exErr.code}`);
    return Response.json({ error: "Falha interna." }, { status: 500 });
  }
  if (existente?.status === "ok") {
    return Response.json({ ok: true, duplicado: true });
  }

  if (payload.kind === "pdf" && bytes) {
    const path = storagePathProposta(prop.empresa_id, propostaId);
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (upErr) {
      console.error(`${LOG} falha no upload propostaId=${propostaId}`);
      return Response.json({ error: "Falha ao gravar o documento." }, { status: 500 });
    }
    const { error } = await admin.rpc("registrar_documento_proposta", {
      p_cotacao_id: cotacaoId,
      p_tipo: "proposta_pdf",
      p_status: "ok",
      p_storage_path: path,
      p_nome: payload.data.nome,
      p_tamanho: bytes.length,
      p_sha256: payload.data.sha256,
      p_erro_codigo: null,
    });
    if (error) {
      console.error(`${LOG} falha ao registrar propostaId=${propostaId} code=${error.code}`);
      return Response.json({ error: "Falha ao registrar o documento." }, { status: 500 });
    }
    return Response.json({ ok: true });
  }

  if (payload.kind === "erro") {
    const { error } = await admin.rpc("registrar_documento_proposta", {
      p_cotacao_id: cotacaoId,
      p_tipo: "proposta_pdf",
      p_status: "falhou",
      p_storage_path: null,
      p_nome: null,
      p_tamanho: null,
      p_sha256: null,
      p_erro_codigo: payload.erro,
    });
    if (error) {
      console.error(`${LOG} falha ao registrar erro propostaId=${propostaId} code=${error.code}`);
      return Response.json({ error: "Falha ao registrar o resultado." }, { status: 500 });
    }
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Payload inválido." }, { status: 400 });
}
